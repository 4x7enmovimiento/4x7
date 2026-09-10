import { getSupabase } from "../../../../db/supabase";
import { apiError, cleanText, json, options, requireMobileUser } from "../_shared";

export const OPTIONS = options;

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Inicia sesión para consultar al Coach." }, 401);

    const payload = (await request.json()) as Record<string, unknown>;
    const userMessage = cleanText(payload.message, 1000);
    const history = Array.isArray(payload.history) ? payload.history : [];

    if (!userMessage) {
      return json({ error: "Escribe tu pregunta para el Coach." }, 400);
    }

    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      ""
    ).trim().replace(/^["']|["']$/g, "");

    const openAiKey = (
      process.env.OPENAI_API_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      ""
    ).trim().replace(/^["']|["']$/g, "");

    if (!apiKey && !openAiKey) {
      return json({
        reply:
          "⚠️ El Coach Virtual necesita una API Key. Por favor agrega la variable GEMINI_API_KEY (o OPENAI_API_KEY) en Vercel en el entorno Production y haz un Redeploy.",
      });
    }

    // 1. Obtener perfil clínico y deportivo del usuario en Supabase
    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", current.userId)
      .maybeSingle();

    const { data: measurements } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", current.userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: workouts } = await supabase
      .from("workouts")
      .select("activity_type, created_at")
      .eq("user_id", current.userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentActivities = (workouts || []).map((w: any) => w.activity_type).filter(Boolean);

    // 2. Construir contexto del usuario
    const userName = current.name ? current.name.split(" ")[0] : "Atleta";
    const currentWeight = measurements?.weight_kg || profile?.weight_kg || "No registrado";
    const targetWeight = profile?.target_weight_kg || "No registrado";
    const heightCm = profile?.height_cm || "No registrado";
    const objective =
      profile?.objective === "lose_fat"
        ? "Bajar grasa y peso de forma saludable"
        : profile?.objective === "gain_muscle"
        ? "Ganar masa muscular y fuerza"
        : profile?.objective === "maintain"
        ? "Mantener peso y mejorar salud cardiovascular"
        : "Salud general y constancia 4×7";

    const systemPrompt = `Eres el Coach Deportivo y Nutricionista Oficial del reto "4×7" en México.
Tu atleta te está consultando desde su teléfono móvil y tu respuesta también se escuchará en voz alta con el sintetizador de voz.

DATOS DEL ATLETA:
- Nombre: ${userName}
- Peso actual: ${currentWeight} ${typeof currentWeight === "number" ? "kg" : ""}
- Estatura: ${heightCm} ${typeof heightCm === "number" ? "cm" : ""}
- Meta: ${targetWeight} ${typeof targetWeight === "number" ? "kg" : ""}
- Objetivo: ${objective}
- Disciplina reciente: ${recentActivities.join(", ") || "Entrenamiento 4×7"}

REGLAS DE RESPUESTA (CORTA, CONCRETA Y NO ABURRIDA):
1. SÉ MUY BREVE Y DIRECTO AL GRANO: Prohibido dar respuestas largas, bíblicas o aburridas. Máximo 100 a 150 palabras en total para que no aburra al leer ni al escuchar.
2. ESTRUCTURA DINÁMICA:
   - 1 frase breve empática o motivadora dirigida a ${userName}.
   - De 2 a 4 recomendaciones clave en viñetas limpias (•) o pasos cortos con acciones concretas (por ejemplo: cantidades exactas de agua o electrolitos, alimentos clave como plátano con miel o atún, estiramientos específicos de 30 segundos, ducha fría o descanso).
   - 1 frase final corta, enérgica y motivadora para el reto 4×7.
3. TONO: Cercano, enérgico, profesional y práctico ("Al grano, como un buen coach en persona").`;

    // 3. Formatear historial asegurando estricta alternancia para Gemini (user -> model -> user)
    const validHistory: Array<{ role: "user" | "model"; text: string }> = [];

    for (const msg of history) {
      if (!msg || !msg.text) continue;
      const role = msg.role === "coach" || msg.role === "model" ? "model" : "user";
      const text = String(msg.text).trim();
      if (!text) continue;

      if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === role) {
        validHistory[validHistory.length - 1].text += `\n${text}`;
      } else {
        validHistory.push({ role, text });
      }
    }

    // Asegurar que el último turno sea la pregunta actual del usuario
    const lastTurn = validHistory[validHistory.length - 1];
    if (!lastTurn || lastTurn.role !== "user" || lastTurn.text !== userMessage) {
      if (lastTurn && lastTurn.role === "user") {
        lastTurn.text = userMessage;
      } else {
        validHistory.push({ role: "user", text: userMessage });
      }
    }

    // Asegurar que el historial inicie con turno de 'user'
    while (validHistory.length > 0 && validHistory[0].role !== "user") {
      validHistory.shift();
    }

    const finalTurns = validHistory.slice(-6);

    const contents = finalTurns.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));

    // 4. Llamar a la API de Gemini con Interactions API oficial y generateContent
    let replyText = "";
    let lastErrorDetail = "";

    const inputHistory = validHistory
      .slice(-4)
      .map((h) => `${h.role === "model" ? "Coach" : "Atleta"}: ${h.text}`)
      .join("\n\n");
    const fullInput = inputHistory ? `${inputHistory}\n\nAtleta: ${userMessage}` : userMessage;

    if (apiKey) {
      // Priorizar los modelos modernos 3.x recomendados por Google (gemini-3.6-flash)
      let targetModels: string[] = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
      ];

      try {
        const listRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
          { headers: { "x-goog-api-key": apiKey } }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          if (Array.isArray(listData?.models)) {
            const available = listData.models
              .filter((m: any) =>
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes("generateContent")
              )
              .map((m: any) => m.name.replace(/^models\//, ""))
              .filter((m: string) =>
                !m.startsWith("gemini-1.") &&
                !m.startsWith("gemini-2.") &&
                !m.includes("embedding") &&
                !m.includes("aqa") &&
                !m.includes("imagen")
              );

            if (available.length > 0) {
              targetModels = Array.from(new Set(["gemini-3.6-flash", "gemini-3.7-flash", ...available, ...targetModels]));
            }
          }
        }
      } catch (e) {
        console.warn("Could not query ListModels:", e);
      }

      // Probar primero la Interactions API recomendada por Google con gemini-3.6-flash y gemini-3.7-flash
      const interModels = ["gemini-3.6-flash", "gemini-3.7-flash"];
      for (const interModel of interModels) {
        try {
          const interRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
                "Api-Revision": "2026-05-20",
              },
              body: JSON.stringify({
                model: interModel,
                system_instruction: systemPrompt,
                input: fullInput,
              }),
            }
          );

          if (interRes.ok) {
            const interData = await interRes.json();
            // 1. New schema: steps array
            if (Array.isArray(interData.steps)) {
              for (const step of interData.steps) {
                if (step.type === "model_output" && Array.isArray(step.content)) {
                  for (const part of step.content) {
                    if (part?.text) {
                      replyText += part.text;
                    }
                  }
                }
              }
            }
            // 2. Legacy schema: outputs array
            if (!replyText && Array.isArray(interData.outputs)) {
              for (const out of interData.outputs) {
                if (out?.text) {
                  replyText += out.text;
                }
              }
            }
            // 3. Convenience output_text
            if (!replyText && typeof interData.output_text === "string" && interData.output_text.trim()) {
              replyText = interData.output_text.trim();
            }

            if (replyText) break;
          } else {
            const interErr = await interRes.json().catch(() => ({}));
            lastErrorDetail = interErr?.error?.message || `Interactions API HTTP ${interRes.status} en ${interModel}`;
            if (/depleted|credits|billing/i.test(lastErrorDetail)) {
              break;
            }
          }
        } catch (interErr: any) {
          lastErrorDetail = interErr?.message || "Error al llamar Interactions API";
        }
      }

      // Si Interactions API no devolvió respuesta y no es error de cuenta/facturación, intentar generateContent
      const isAccountBillingError = /depleted|credits|billing/i.test(lastErrorDetail);
      if (!replyText && !isAccountBillingError) {
        for (const model of targetModels) {
          try {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: systemPrompt }] },
                  contents,
                  generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                  },
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (replyText) break;
            } else {
              const errData = await response.json().catch(() => ({}));
              lastErrorDetail = errData?.error?.message || `HTTP ${response.status} en ${model}`;

              // Si falla por compatibilidad de schema, reintentar con el prompt unificado en user turn
              const fallbackContents = [
                {
                  role: "user",
                  parts: [{ text: `${systemPrompt}\n\n---\nHistorial previo:\n${inputHistory}\n\n---\nPregunta del atleta:\n${userMessage}` }],
                },
              ];
              const retryResp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                  },
                  body: JSON.stringify({
                    contents: fallbackContents,
                    generationConfig: {
                      temperature: 0.7,
                      maxOutputTokens: 500,
                    },
                  }),
                }
              );
              if (retryResp.ok) {
                const retryData = await retryResp.json();
                replyText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (replyText) break;
              } else {
                const retryErr = await retryResp.json().catch(() => ({}));
                if (retryErr?.error?.message) {
                  lastErrorDetail = retryErr.error.message;
                }
              }
            }
          } catch (callErr: any) {
            lastErrorDetail = callErr?.message || `Fallo de conexión al modelo ${model}`;
          }
        }
      }
    }

    // 5. Fallback a OpenAI si Gemini no respondió y hay OPENAI_API_KEY
    if (!replyText && openAiKey) {
      try {
        const oaiMessages: any[] = [
          { role: "system", content: systemPrompt },
          ...validHistory.map((h) => ({
            role: h.role === "model" ? "assistant" : "user",
            content: h.text,
          })),
        ];

        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: oaiMessages,
            temperature: 0.7,
            max_tokens: 450,
          }),
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          replyText = oaiData?.choices?.[0]?.message?.content || "";
        } else {
          const oaiErr = await oaiRes.json().catch(() => ({}));
          lastErrorDetail = oaiErr?.error?.message || `OpenAI HTTP ${oaiRes.status}`;
        }
      } catch (err: any) {
        lastErrorDetail = err?.message || "Error al conectar con OpenAI";
      }
    }

    if (!replyText) {
      return json({
        reply: `⚠️ El Coach no pudo conectar con la inteligencia artificial (${lastErrorDetail || "Error desconocido"}).\n\nPor favor verifica tu clave en Google AI Studio (o agrega OPENAI_API_KEY en Vercel).`,
      });
    }

    return json({ reply: replyText });
  } catch (error) {
    return apiError(error);
  }
}
