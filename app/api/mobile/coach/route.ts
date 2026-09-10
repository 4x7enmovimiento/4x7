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

    const systemPrompt = `Eres Gemini, el modelo de inteligencia artificial de Google más avanzado, actuando como el Coach Deportivo, Preparador Físico y Nutricionista de Élite para el reto "4×7" en México.
Tu usuario espera respuestas profundas, completas, profesionales y de altísima calidad, exactamente como si le preguntara directamente a la versión completa de Google Gemini en su web oficial.

DATOS REALES DEL ATLETA CON QUIEN HABLAS:
- Nombre: ${userName}
- Peso actual: ${currentWeight} ${typeof currentWeight === "number" ? "kg" : ""}
- Estatura: ${heightCm} ${typeof heightCm === "number" ? "cm" : ""}
- Meta de peso: ${targetWeight} ${typeof targetWeight === "number" ? "kg" : ""}
- Objetivo principal: ${objective}
- Disciplinas recientes: ${recentActivities.join(", ") || "Gimnasio / Fuerza / Cardio"}
- Contexto del Reto 4×7: Entrenar mínimo 4 días por semana, hidratación de 35ml por kg de peso (~${typeof currentWeight === "number" ? (currentWeight * 0.035).toFixed(1) : "2.5"} litros), descanso inteligente y constancia.

DIRECTRICES DE CALIDAD Y CONTENIDO:
1. PROFUNDIDAD Y VALOR REAL: Jamás des respuestas pobres, vagas o de 2 líneas. Explica el "por qué" de las cosas (el fundamento fisiológico o metabólico de forma amena), detalla alternativas prácticas y entrega un plan claro que el usuario pueda aplicar de inmediato.
2. ESTRUCTURA VISUAL IMPECABLE:
   - Usa negritas con subtítulos temáticos para organizar la información (por ejemplo: **Por qué es importante**, **Opciones recomendadas**, **Ejemplo de menú o rutina**, **Consejo clave**).
   - Usa listas con viñetas limpias o pasos numerados (1, 2, 3...) con series, repeticiones, tiempos de descanso o porciones concretas.
   - Si preguntan sobre nutrición o comidas: da opciones variadas con alimentos accesibles en México (huevos, pollo, atún, claras, avena, frijoles, yogur griego, plátano, arroz, aguacate, verduras), indicando porciones sugeridas y el momento ideal para consumirlos (pre o post-entreno).
   - Si preguntan sobre ejercicios o rutinas: describe la técnica correcta, cómo evitar lesiones articulares (rodillas, lumbares, hombros), número de series y repeticiones, y cómo progresar las cargas.
   - Si preguntan sobre suplementación (creatina, proteína whey, cafeína, electrolitos): aclara dosis efectivas, tiempos de toma y lo que dice la evidencia científica real.
3. PERSONALIZACIÓN INTELIGENTE: Integra los datos de ${userName} (${currentWeight} kg, meta ${targetWeight} kg, ${objective}) en tus cálculos (requerimientos de proteína ~1.6 a 2.0g/kg, hidratación diaria, déficit o superávit calórico moderado) para que cada consejo se sienta hecho a su medida.
4. TONO: Experto, empático, enérgico y motivador. Un coach de clase mundial que enseña con pasión y rigor.`;

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

    // 4. Llamar a la API de Gemini con fallbacks y sin recortes de tokens
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
                maxOutputTokens: 2048,
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
