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

    const systemPrompt = `Eres un coach deportivo y preparador físico personal de alto nivel, hablando con ${userName} en México para el reto 4×7.
Responde de manera 100% natural, fluida y conversacional, exactamente como lo hace ChatGPT en una charla directa, inteligente y humana.

PERFIL DEL ATLETA:
- Nombre: ${userName}
- Peso: ${currentWeight} ${typeof currentWeight === "number" ? "kg" : ""}
- Estatura: ${heightCm} ${typeof heightCm === "number" ? "cm" : ""}
- Meta: ${targetWeight} ${typeof targetWeight === "number" ? "kg" : ""}
- Objetivo: ${objective}
- Entrenamientos recientes: ${recentActivities.join(", ") || "Reto 4×7"}

PAUTAS DE ESTILO (NATURAL, HUMANO Y SIN PLANTILLAS):
1. CERO ESTRUCTURAS ROBÓTICAS: Prohibido sonar como un bot que siempre repite la misma fórmula de "saludo con nombre + mini explicación + 3 viñetas + frase motivacional cliché". Cada respuesta tuya debe ser única y sonar a conversación real.
2. ADAPTA EL FORMATO SEGÚN LA PREGUNTA:
   - Si la duda es directa o sobre sensaciones/dolor/ánimo, responde en párrafos normales, fluidos y bien explicados.
   - Si piden menús, ejercicios o opciones puntuales, puedes usar viñetas si facilitan la lectura, pero de forma orgánica.
3. EXTENSIÓN NATURAL: Ni una enciclopedia pesada ni un telegrama telegráfico. Responde con la profundidad y claridad justas que darías en un mensaje directo a tu atleta.
4. TONO: Cercano, empático, experto y amigable ("como tu preparador físico de confianza que realmente sabe de fisiología y nutrición").`;

    // 3. Formatear historial asegurando estricta alternancia
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

    const inputHistory = validHistory
      .slice(-6)
      .map((h) => `${h.role === "model" ? "Coach" : "Atleta"}: ${h.text}`)
      .join("\n\n");

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

    let replyText = "";
    let lastErrorDetail = "";

    // 4. Si el usuario configuró OPENAI_API_KEY, llamar a OpenAI primero para respuesta inmediata
    if (openAiKey) {
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
            temperature: 0.8,
            max_tokens: 420,
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

    // 5. Si OpenAI no respondió y hay clave de Gemini, llamar a Gemini
    if (!replyText && apiKey) {
      const fullInput = inputHistory ? `${inputHistory}\n\nAtleta: ${userMessage}` : userMessage;
      let targetModels: string[] = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
      ];

      // Probar Interactions API
      for (const interModel of ["gemini-3.6-flash", "gemini-3.7-flash"]) {
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
            if (Array.isArray(interData.steps)) {
              for (const step of interData.steps) {
                if (step.type === "model_output" && Array.isArray(step.content)) {
                  for (const part of step.content) {
                    if (part?.text) replyText += part.text;
                  }
                }
              }
            }
            if (!replyText && Array.isArray(interData.outputs)) {
              for (const out of interData.outputs) {
                if (out?.text) replyText += out.text;
              }
            }
            if (!replyText && typeof interData.output_text === "string") {
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

      // Si no devolvió respuesta y no es error de saldo agotado, intentar generateContent
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
                  contents,
                  generationConfig: {
                    temperature: 0.65,
                    maxOutputTokens: 350,
                  },
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (replyText) break;
            }
          } catch (callErr: any) {
            lastErrorDetail = callErr?.message || `Fallo en modelo ${model}`;
          }
        }
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
