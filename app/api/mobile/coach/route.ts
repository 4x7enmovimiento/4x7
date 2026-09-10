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

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    if (!apiKey) {
      return json({
        reply:
          "¡Hola! El Coach Virtual está casi listo. Por favor verifica que la variable GEMINI_API_KEY esté configurada en Vercel para activar las respuestas en tiempo real.",
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
Tu misión es guiar, motivar y educar al usuario con consejos prácticos, seguros y médicamente fundamentados.

DATOS REALES DEL ATLETA CON QUIEN HABLAS:
- Nombre: ${userName}
- Peso actual: ${currentWeight} ${typeof currentWeight === "number" ? "kg" : ""}
- Estatura: ${heightCm} ${typeof heightCm === "number" ? "cm" : ""}
- Meta de peso: ${targetWeight} ${typeof targetWeight === "number" ? "kg" : ""}
- Objetivo principal: ${objective}
- Disciplinas recientes: ${recentActivities.join(", ") || "Gimnasio / Cardio"}
- Meta del reto: Entrenar de 4 a 7 días por semana, beber 35ml de agua por kg de peso, cuidar articulaciones y descansar 3 días.

PAUTAS DE RESPUESTA:
1. Sé empático, enérgico, claro y positivo con tono mexicano cercano y profesional (sin tecnicismos confusos).
2. Da respuestas concisas y fáciles de leer en el celular: usa viñetas cortas, pasos 1-2-3 y emojis deportivos (💪, 🥗, 💧, ⚡, 🥑, 🏋️).
3. Si preguntan sobre comida, da ejemplos de alimentos comunes, accesibles y ricos en proteína (huevos, pollo, frijoles, atún, avena, yogur griego, verduras).
4. Si preguntan sobre dolor o molestias en rodillas o espalda, prioriza la postura, calentamiento y la prudencia médica.
5. Mantén las respuestas en una extensión cómoda para ser leída o escuchada en voz alta (máximo 3 a 4 párrafos cortos).`;

    // 3. Formatear historial para Gemini
    const contents: any[] = [];

    history.slice(-6).forEach((msg: any) => {
      if (msg.role === "user" || msg.role === "model") {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: String(msg.text || "") }],
        });
      }
    });

    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    // 4. Llamar a la API de Gemini (probando gemini-2.5-flash y fallback a gemini-1.5-flash)
    let replyText = "";
    const models = ["gemini-2.5-flash", "gemini-1.5-flash"];

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
          console.warn(`Gemini model ${model} error:`, errData);
        }
      } catch (callErr) {
        console.warn(`Gemini call failure on ${model}:`, callErr);
      }
    }

    if (!replyText) {
      replyText = `¡Hola ${userName}! Aquí tu Coach 4×7. Para tu objetivo de ${objective.toLowerCase()}, la clave de oro es la constancia: cumple tus 4 días de entrenamiento esta semana, bebe tus ${typeof currentWeight === "number" ? (currentWeight * 0.035).toFixed(1) : "2.5"} litros de agua y come suficiente proteína. ¿Tienes alguna duda de tu rutina o tus comidas de hoy? ¡Pregúntame con confianza! 💪🔥`;
    }

    return json({ reply: replyText });
  } catch (error) {
    return apiError(error);
  }
}
