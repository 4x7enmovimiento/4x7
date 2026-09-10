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
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_KEY ||
      ""
    ).trim();

    if (!apiKey) {
      return json({
        reply:
          "¡Hola! El Coach Virtual necesita la clave de Gemini. Por favor asegúrate de haber agregado la variable GEMINI_API_KEY en Vercel (marcando el entorno Production) y hacer un Redeploy.",
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

    const systemPrompt = `Eres el "Coach 4×7", el entrenador personal, preparador físico y asesor nutricional de la familia en el Reto 4×7 (México).
Tu misión es responder con precisión y empatía a la duda puntual del usuario sobre nutrición, ejercicios, recuperación o hábitos.

DATOS REALES DEL ATLETA CON QUIEN HABLAS:
- Nombre: ${userName}
- Peso actual: ${currentWeight} ${typeof currentWeight === "number" ? "kg" : ""}
- Estatura: ${heightCm} ${typeof heightCm === "number" ? "cm" : ""}
- Meta de peso: ${targetWeight} ${typeof targetWeight === "number" ? "kg" : ""}
- Objetivo principal: ${objective}
- Disciplinas recientes: ${recentActivities.join(", ") || "Gimnasio / Cardio"}
- Meta del reto: Entrenar de 4 a 7 días por semana, beber 35ml de agua por kg de peso, cuidar articulaciones y descansar 3 días.

PAUTAS OBLIGATORIAS:
1. Responde DIRECTAMENTE a lo que el usuario está preguntando. No repitas saludos largos ni sueltes un monólogo genérico.
2. Da respuestas concisas y fáciles de leer en el celular: usa viñetas cortas, pasos 1-2-3 y emojis deportivos (💪, 🥗, 💧, ⚡, 🥑, 🏋️).
3. Si preguntan sobre comida, da ejemplos de alimentos comunes, accesibles y ricos en proteína (huevos, pollo, frijoles, atún, avena, yogur griego, verduras).
4. Si preguntan sobre dolor o molestias en rodillas o espalda, prioriza la postura, calentamiento y la prudencia médica.
5. Mantén las respuestas en una extensión cómoda para ser leída o escuchada en voz alta (máximo 2 a 3 párrafos cortos).`;

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

    // 4. Llamar a la API de Gemini con fallbacks
    let replyText = "";
    let lastErrorDetail = "";
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          replyText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (replyText) break;
        } else {
          const errData = await response.json().catch(() => ({}));
          lastErrorDetail = errData?.error?.message || `HTTP ${response.status} en modelo ${model}`;
          console.warn(`Gemini model ${model} error:`, errData);
        }
      } catch (callErr: any) {
        lastErrorDetail = callErr?.message || `Fallo de conexión al modelo ${model}`;
        console.warn(`Gemini call failure on ${model}:`, callErr);
      }
    }

    if (!replyText) {
      if (lastErrorDetail) {
        console.error("Coach Gemini Error:", lastErrorDetail);
        if (
          lastErrorDetail.toLowerCase().includes("key") ||
          lastErrorDetail.toLowerCase().includes("permission") ||
          lastErrorDetail.toLowerCase().includes("quota")
        ) {
          return json({
            reply: `Hubo un inconveniente con la API Key de Gemini: ${lastErrorDetail}. Por favor verifica tu clave en Vercel.`,
          });
        }
      }
      replyText = `¡Hola ${userName}! Para responderte mejor sobre "${userMessage}", toma en cuenta que tu objetivo es ${objective.toLowerCase()}. Mantén tus 4 días de ejercicio esta semana y una hidratación de ~${typeof currentWeight === "number" ? (currentWeight * 0.035).toFixed(1) : "2.5"} litros. ¿Deseas una recomendación puntual de ejercicios o un menú de ejemplo? 💪`;
    }

    return json({ reply: replyText });
  } catch (error) {
    return apiError(error);
  }
}
