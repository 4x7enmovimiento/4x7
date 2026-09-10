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

    const systemPrompt = `Eres el Coach Deportivo del reto "4×7" en México.
Tu atleta te consulta desde su celular y tu respuesta se reproducirá por voz.

REGLAS ESTRICTAS DE RESPUESTA:
1. SÉ ULTRA CONCISO: Tu respuesta NO debe superar las 70 palabras en total.
2. ESTRUCTURA DIRECTA (máximo 4 renglones):
   - 1 saludo breve a ${userName}.
   - De 2 a 3 viñetas (•) súper cortas y prácticas con la solución exacta (ej. estiramiento, qué tomar/comer o descanso).
   - 1 frase de cierre enérgica para el reto 4×7.
3. Prohibidas las explicaciones largas, rodeos o sermones teóricos.`;

    // 3. Formatear historial asegurando estricta alternancia
    const validHistory: Array<{ role: "user" | "model"; text: string }> = [];

    for (const msg of history) {
      if (!msg || !msg.text) continue;
      const role = msg.role === "coach" || msg.role === "model" ? "model" : "user";
      let text = String(msg.text).trim();
      if (!text) continue;

      // Limitar respuestas previas del coach a 120 caracteres para no contaminar con respuestas largas
      if (role === "model" && text.length > 120) {
        text = text.slice(0, 120) + "...";
      }

      if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === role) {
        validHistory[validHistory.length - 1].text += `\n${text}`;
      } else {
        validHistory.push({ role, text });
      }
    }

    const inputHistory = validHistory
      .slice(-4)
      .map((h) => `${h.role === "model" ? "Coach" : "Atleta"}: ${h.text}`)
      .join("\n\n");

    const promptWithConstraint = `${userMessage}\n\n(Coach: responde ultra corto, máximo 3 viñetas breves, menos de 70 palabras).`;

    // Asegurar que el último turno sea la pregunta actual del usuario
    const lastTurn = validHistory[validHistory.length - 1];
    if (!lastTurn || lastTurn.role !== "user" || lastTurn.text !== promptWithConstraint) {
      if (lastTurn && lastTurn.role === "user") {
        lastTurn.text = promptWithConstraint;
      } else {
        validHistory.push({ role: "user", text: promptWithConstraint });
      }
    }

    // Asegurar que el historial inicie con turno de 'user'
    while (validHistory.length > 0 && validHistory[0].role !== "user") {
      validHistory.shift();
    }

    const finalTurns = validHistory.slice(-4);
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
            temperature: 0.6,
            max_tokens: 150,
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
      const fullInput = inputHistory ? `${inputHistory}\n\nAtleta: ${promptWithConstraint}` : promptWithConstraint;
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
                    temperature: 0.6,
                    maxOutputTokens: 160,
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
