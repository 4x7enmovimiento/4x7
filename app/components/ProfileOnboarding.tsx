"use client";

import { FormEvent, useMemo, useState } from "react";
import { clientApi, type ProfileResponse } from "../lib/client-api";

const ObjectiveIcon = ({ id }: { id: string }) => {
  if (id === "lose_fat") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>
      </svg>
    );
  }
  if (id === "gain_muscle") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    );
  }
  if (id === "maintain") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  );
};

const objectives = [
  { id: "lose_fat", title: "Bajar peso o grasa", text: "Reducir de forma gradual conservando fuerza." },
  { id: "gain_muscle", title: "Subir músculo", text: "Ganar masa y mejorar fuerza progresivamente." },
  { id: "maintain", title: "Mantenerme", text: "Conservar peso y mejorar condición física." },
  { id: "general_fitness", title: "Sentirme mejor", text: "Crear condición, energía y constancia." },
] as const;

const optionalMeasures = [
  ["waistCm", "Cintura"], ["hipCm", "Glúteo / cadera"], ["chestCm", "Pecho"], ["armCm", "Bíceps"],
  ["thighCm", "Muslo"], ["calfCm", "Pantorrilla"], ["neckCm", "Cuello"], ["bodyFatPercent", "% grasa corporal"],
] as const;

const activities = [
  { id: "Gimnasio", icon: "🏋️", label: "Gimnasio / Pesas" },
  { id: "Bici", icon: "🚴", label: "Bicicleta" },
  { id: "Correr", icon: "🏃", label: "Correr / Running" },
  { id: "Nadar", icon: "🏊", label: "Natación" },
  { id: "Jumping", icon: "🦘", label: "Jumping Fitness" },
  { id: "Zumba", icon: "💃", label: "Zumba / Baile" },
  { id: "Caminata", icon: "🚶", label: "Caminata / Senderismo" },
  { id: "Funcional", icon: "⚡", label: "Funcional / HIIT" },
] as const;

const weekDaysList = [
  { id: "lun", label: "Lunes", short: "L" },
  { id: "mar", label: "Martes", short: "M" },
  { id: "mie", label: "Miércoles", short: "M" },
  { id: "jue", label: "Jueves", short: "J" },
  { id: "vie", label: "Viernes", short: "V" },
  { id: "sab", label: "Sábado", short: "S" },
  { id: "dom", label: "Domingo", short: "D" },
] as const;

const START_DATE_OPTIONS = [
  { value: "2026-09-01", label: "1 de Septiembre (Martes · Arranque de mes 🗓️)" },
  { value: "2026-09-02", label: "2 de Septiembre (Miércoles)" },
  { value: "2026-09-03", label: "3 de Septiembre (Jueves)" },
  { value: "2026-09-04", label: "4 de Septiembre (Viernes)" },
  { value: "2026-09-05", label: "5 de Septiembre (Sábado)" },
  { value: "2026-09-06", label: "6 de Septiembre (Domingo)" },
  { value: "2026-09-07", label: "7 de Septiembre (Lunes · Recomendado semana completa 🚀)" },
  { value: "2026-09-08", label: "8 de Septiembre (Martes)" },
  { value: "2026-09-09", label: "9 de Septiembre (Miércoles)" },
  { value: "2026-09-10", label: "10 de Septiembre (Jueves)" },
  { value: "2026-09-11", label: "11 de Septiembre (Viernes)" },
  { value: "2026-09-12", label: "12 de Septiembre (Sábado)" },
  { value: "2026-09-13", label: "13 de Septiembre (Domingo)" },
  { value: "2026-09-14", label: "14 de Septiembre (Lunes · Semana 3 ⚡)" },
  { value: "2026-09-15", label: "15 de Septiembre (Martes · Fecha límite de arranque 🇲🇽)" },
];

export function ProfileOnboarding({
  name,
  onComplete,
  onLogout,
}: {
  name: string;
  onComplete: (result: ProfileResponse) => void;
  onLogout?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProfileResponse | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<string[]>(["Gimnasio"]);
  const [selectedDays, setSelectedDays] = useState<string[]>(["lun", "mie", "vie", "sab"]);
  const [data, setData] = useState<Record<string, string>>({
    objective: "lose_fat",
    preferredActivity: "Gimnasio",
    challengeStartDate: typeof window !== "undefined" ? (localStorage.getItem("four_seven_challenge_start_date") || "2026-09-01") : "2026-09-01",
    sex: "",
    age: "",
    heightCm: "",
    weightKg: "",
    targetWeightKg: "",
    waistCm: "",
    hipCm: "",
    chestCm: "",
    armCm: "",
    thighCm: "",
    calfCm: "",
    neckCm: "",
    bodyFatPercent: "",
  });

  const set = (key: string, value: string) => setData((current) => ({ ...current, [key]: value }));
  const selectedObjective = objectives.find((item) => item.id === data.objective) || objectives[0];
  const targetRequired = data.objective === "lose_fat" || data.objective === "gain_muscle";
  const progress = useMemo(() => `${Math.min(step, 4) * 25}%`, [step]);

  const toggleActivity = (actId: string) => {
    setSelectedActivities((prev) => {
      if (prev.includes(actId)) {
        return prev.length > 1 ? prev.filter((a) => a !== actId) : prev;
      }
      return [...prev, actId];
    });
  };

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const next = () => {
    setError("");
    // Ensure step 1 defaults
    if (step === 1) {
      if (!data.age) set("age", "30");
      if (!data.sex) set("sex", "female");
      if (!data.heightCm) set("heightCm", "168");
      if (!data.weightKg) set("weightKg", "70");
    }
    // Ensure step 2 target weight calculation if empty
    if (step === 2 && !data.targetWeightKg) {
      const currentWeight = Number(data.weightKg) || 70;
      const autoTarget = data.objective === "lose_fat"
        ? Number((currentWeight * 0.9).toFixed(1))
        : data.objective === "gain_muscle"
        ? Number((currentWeight * 1.05).toFixed(1))
        : currentWeight;
      set("targetWeightKg", String(autoTarget));
    }
    // Ensure step 3 activities & days
    if (step === 3) {
      if (!selectedActivities.length) setSelectedActivities(["Gimnasio"]);
      if (selectedDays.length < 4) setSelectedDays(["lun", "mie", "vie", "sab"]);
    }
    setStep((current) => Math.min(4, current + 1));
  };

  const save = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    setBusy(true);
    setError("");
    
    const currentWeight = Number(data.weightKg) || 70;
    const height = Number(data.heightCm) || 168;
    const targetWeight = Number(data.targetWeightKg) || (data.objective === "lose_fat" ? Number((currentWeight * 0.9).toFixed(1)) : currentWeight);
    const birthDate = `${new Date().getFullYear() - (Number(data.age) || 30)}-01-01`;
    const preferredActivity = selectedActivities.length ? selectedActivities.join(", ") : "Gimnasio";
    const plannedDays = selectedDays.length ? selectedDays.join(",") : "lun,mie,vie,sab";

    const payload = Object.fromEntries(
      Object.entries({
        ...data,
        age: undefined,
        heightCm: height,
        weightKg: currentWeight,
        targetWeightKg: targetWeight,
        preferredActivity,
        birthDate,
        plannedDays,
        sex: data.sex || "other",
        objective: data.objective || "general_fitness",
      })
        .filter(([key, value]) => key !== "age" && value !== "" && value !== undefined)
        .map(([key, value]) => [
          key,
          key === "objective" || key === "sex" || key === "birthDate" || key === "preferredActivity" || key === "plannedDays" || key === "challengeStartDate"
            ? value
            : Number(value),
        ])
    );

    try {
      const saved = await clientApi.saveProfile(payload as Record<string, string | number | null>);
      setResult(saved);
      try {
        localStorage.setItem(`four_seven_profile_${name}`, JSON.stringify(saved));
        localStorage.setItem("four_seven_saved_profile", JSON.stringify(saved));
      } catch {}
      setStep(5);
    } catch {
      // Graceful local fallback so user is NEVER blocked
      const bmi = Number((currentWeight / ((height / 100) ** 2)).toFixed(1));
      const bmiCategory = bmi < 18.5 ? "Bajo peso" : bmi < 24.9 ? "Rango saludable" : bmi < 29.9 ? "Sobrepeso" : "Obesidad";
      const weeks = Array.from({ length: 12 }, (_, i) => ({
        week: i + 1,
        weightKg: Number((currentWeight - (i * (data.objective === "lose_fat" ? 0.4 : -0.2))).toFixed(1)),
        phase: i < 2 ? "Adaptación" : i < 6 ? "Construcción" : "Consolidación",
        focus: data.objective === "gain_muscle" ? "Fuerza e hipertrofia gradual" : "Crear hábito 4×7",
        workoutGoal: 4,
      }));

      const fallback: ProfileResponse = {
        profile: {
          objective: (data.objective as any) || "general_fitness",
          birthDate,
          sex: (data.sex as any) || "other",
          heightCm: height,
          targetWeightKg: targetWeight,
          measurement: { weightKg: currentWeight, recordedAt: new Date().toISOString() },
        },
        measurements: [{ weightKg: currentWeight, recordedAt: new Date().toISOString() }],
        projection: {
          bmi,
          bmiCategory,
          weeklyPaceKg: 0.4,
          estimatedWeeks: 12,
          etaSummary: `A un ritmo constante de 4 días por semana, alcanzarías tu objetivo en unas 12 semanas.`,
          weeks,
          advice: {
            title: "Guía de Inicio 4×7",
            goalSummary: "Cumplir tus 4 días semanales de entrenamiento.",
            doList: ["Cumplir tus 4 días", "Beber suficiente agua", "Registrar tu peso semanal"],
            dontList: ["No sobreentrenar", "No saltarte el descanso"],
          },
        },
      };

      setResult(fallback);
      try {
        localStorage.setItem(`four_seven_profile_${name}`, JSON.stringify(fallback));
        localStorage.setItem("four_seven_saved_profile", JSON.stringify(fallback));
      } catch {}
      setStep(5);
    } finally {
      setBusy(false);
    }
  };

  if (step === 5 && result?.projection) {
    const firstName = name.split(" ")[0];
    const currentWeight = Number(data.weightKg) || 70;
    const height = Number(data.heightCm) || 168;
    const targetWeight = Number(data.targetWeightKg) || (data.objective === "lose_fat" ? Number((currentWeight * 0.9).toFixed(1)) : currentWeight);
    const waterLiters = (currentWeight * 0.035).toFixed(1);
    const proteinGrams = data.objective === "gain_muscle" ? Math.round(currentWeight * 1.8) : data.objective === "lose_fat" ? Math.round(currentWeight * 1.6) : Math.round(currentWeight * 1.3);
    const calorieEstimate = data.objective === "gain_muscle" ? Math.round(currentWeight * 33 + 300) : data.objective === "lose_fat" ? Math.round(currentWeight * 30 - 400) : Math.round(currentWeight * 30);
    const activitiesStr = selectedActivities.length ? selectedActivities.join(", ") : "Gimnasio";

    const age = Number(data.age) || (data.birthDate ? new Date().getFullYear() - new Date(data.birthDate).getFullYear() : 30);
    const bmi = Number((currentWeight / ((height / 100) ** 2)).toFixed(1));
    const targetBmi = Number((targetWeight / ((height / 100) ** 2)).toFixed(1));
    const idealWeight = Math.round(23.5 * ((height / 100) ** 2));
    const weightExcess = Math.round(currentWeight - idealWeight);

    const getHealthDiagnostic = () => {
      if (bmi < 18.5) {
        return {
          status: "Bajo Peso",
          badgeColor: "#1d4ed8",
          badgeBg: "#dbeafe",
          badgeBorder: "#93c5fd",
          alertBg: "#eff6ff",
          alertBorder: "#bfdbfe",
          alertTextColor: "#1e40af",
          icon: "🔵",
          headline: "Déficit de Masa Corporal y Muscular",
          reality: `Tu peso actual de ${currentWeight} kg para tu estatura de ${height} cm genera un IMC de ${bmi}, situándote por debajo del rango óptimo. Médicamente, esto puede significar defensas inmunológicas más bajas, menor densidad ósea y fatiga prematura ante esfuerzos diarios.`,
          encouragementTitle: "💪 ¡El Reto 4×7 es tu mejor medicina!",
          encouragement: `Estás en el lugar exacto. Con tus 4 entrenamientos por semana enfocados en fuerza y una nutrición rica en proteína y calorías saludables, vas a construir masa muscular limpia, proteger tus huesos y sentir una vitalidad que cambiará tu día a día. ¡Vas a ganar fuerza real!`,
        };
      }
      if (bmi < 25) {
        return {
          status: "Peso Saludable (Normal)",
          badgeColor: "#15803d",
          badgeBg: "#dcfce7",
          badgeBorder: "#86efac",
          alertBg: "#f0fdf4",
          alertBorder: "#bbf7d0",
          alertTextColor: "#166534",
          icon: "🟢",
          headline: "Base Cardiovascular y Metabólica Saludable",
          reality: `¡Excelente estado de partida! Tu peso de ${currentWeight} kg para ${height} cm te coloca en un rango saludable con un IMC de ${bmi}. Tu corazón y tus articulaciones operan sin sobrecargas peligrosas, lo que reduce drásticamente tu riesgo de hipertensión y diabetes.`,
          encouragementTitle: "🚀 ¡Momento de desbloquear tu mejor versión!",
          encouragement: `Tener un peso sano es la mejor plataforma para dar el salto. Con el Reto 4×7 no venimos a 'arreglar' un problema, sino a optimizar tu cuerpo: tonificar, ganar resistencia física, lucir con mayor definición y blindar tu salud a largo plazo. ¡Serás un ejemplo de constancia en tu familia!`,
        };
      }
      if (bmi < 30) {
        return {
          status: "Sobrepeso Leve a Moderado",
          badgeColor: "#b45309",
          badgeBg: "#fef3c7",
          badgeBorder: "#fde68a",
          alertBg: "#fffbeb",
          alertBorder: "#fde68a",
          alertTextColor: "#92400e",
          icon: "⚠️",
          headline: "Llamado de Atención: Sobrecarga Metabólica Inicial",
          reality: `Hoy tu cuerpo sostiene ${currentWeight} kg (${Math.max(1, weightExcess)} kg por encima de tu peso ideal sugerido), lo que genera un IMC de ${bmi} (Sobrepeso). Médicamente, esta etapa es crucial: tu cuerpo empieza a resentir mayor presión en rodillas y espalda baja al caminar, y el metabolismo acumula grasa visceral que puede volverse resistencia a la insulina si no se frena a tiempo.`,
          encouragementTitle: "✨ ¡Llegaste en el momento perfecto para revertirlo!",
          encouragement: `Darte cuenta de esta realidad es tu mayor poder. Al iniciar el Reto 4×7 estás actuando a tiempo antes de que el sobrepeso pase a obesidad. No requieres dietas tortuosas: con 4 días de ejercicio constante y la hidratación recomendada, vas a revertir esta sobrecarga en pocas semanas y quitarle ese peso de encima a tu corazón.`,
        };
      }
      if (bmi < 35) {
        return {
          status: "Obesidad Grado I",
          badgeColor: "#b91c1c",
          badgeBg: "#fee2e2",
          badgeBorder: "#fca5a5",
          alertBg: "#fff1f2",
          alertBorder: "#fecdd3",
          alertTextColor: "#9f1239",
          icon: "🚨",
          headline: "Alerta Médica: Sobrecarga Cardiovascular y Articular",
          reality: `Con ${currentWeight} kg y ${height} cm, tu IMC es de ${bmi} (Obesidad Grado I), con aproximadamente ${Math.max(1, weightExcess)} kg de sobrecarga sobre tu estructura ósea. En términos clínicos, tus rodillas reciben hasta 4 veces tu peso en cada impacto al trotar o subir escaleras, tu corazón trabaja con mayor presión sistólica y tus células enfrentan un estado inflamatorio crónico que drena tu energía diaria y eleva el riesgo de hipertensión o hígado graso.`,
          encouragementTitle: "🔥 ¡Tomaste la mejor decisión para tu salud!",
          encouragement: `Esta realidad no es para asustarte ni desanimarte, ¡es la razón exacta por la que decidiste entrar hoy al Reto 4×7! Tu cuerpo te estaba pidiendo ayuda y le estás respondiendo como debe ser. La regla de 4 días a la semana está diseñada para ser sostenible sin lastimarte: reactiva tu circulación, quema grasa visceral y restaura tu vitalidad con el respaldo de tu familia. ¡Estás salvando tu salud futura!`,
        };
      }
      // Obesidad Grado II (IMC 35-39.9) or Grado III (>= 40)
      const isSevere = bmi >= 40;
      return {
        status: isSevere ? "Obesidad Grado III (Mórbida)" : "Obesidad Grado II (Riesgo Alto)",
        badgeColor: "#7f1d1d",
        badgeBg: "#fecaca",
        badgeBorder: "#f87171",
        alertBg: "#fef2f2",
        alertBorder: "#fca5a5",
        alertTextColor: "#991b1b",
        icon: "🚨",
        headline: isSevere ? "Alerta Crítica de Salud · Acción Urgente" : "Alerta de Salud Importante · Sobrecarga Severa",
        reality: `Hoy tu cuerpo sostiene ${currentWeight} kg para tu estatura de ${height} cm, arrojando un IMC de ${bmi} (${isSevere ? "Obesidad Grado III" : "Obesidad Grado II"}). Médicamente estás cargando cerca de ${Math.max(1, weightExcess)} kg de sobrepeso. Esto somete a tu corazón a un esfuerzo continuo severo para bombear sangre, desgasta aceleradamente los cartílagos de tus rodillas y columna lumbar, y genera una fatiga constante por inflamación celular y apnea o falta de oxígeno al dormir.`,
        encouragementTitle: "💎 ¡Estás dando el paso más importante y valiente de tu vida!",
        encouragement: `Confrontar este número duele, pero este es el día en que tu historia cambia. Al registrarte en el Reto 4×7 no estás solo ni necesitas hacer locuras de gimnasio 7 días seguidos que te lesionen: la clave es la constancia 4×7. Solo 4 días de ejercicio estructurado combinados con los ${waterLiters} L de agua recomendados van a desinflamar tu cuerpo, bajar la presión de tus arterias y devolverte la ligereza y energía que te mereces. ¡Toda tu familia te va a apoyar y celebrar cada logro!`,
      };
    };

    const diag = getHealthDiagnostic();

    return (
      <main className="onboarding-page">
        <section className="onboarding-result">
          <div className="ai-coach-badge">
            <span>✨</span> ANÁLISIS CLÍNICO Y TÁCTICO · COACH IA 4×7
          </div>

          <h1>Diagnóstico Inicial y Tu Estrategia, {firstName} 🩺</h1>
          <p>
            Evaluamos tus medidas corporales para mostrarte tu realidad actual de salud y la ruta exacta con la que el <strong>Reto 4×7</strong> transformará tu vida.
          </p>

          <div className="ai-plan-container">
            {/* 1. Diagnóstico de Salud y Realidad Inicial (LO PRIMERO QUE VE EL USUARIO) */}
            <article className="ai-health-diagnostic-card">
              <div className="diagnostic-header">
                <div className="diagnostic-header-left">
                  <div className="diagnostic-avatar-icon">{diag.icon}</div>
                  <div className="diagnostic-header-titles">
                    <h3>Diagnóstico de Salud · Tu Realidad Inicial</h3>
                    <p>Evaluación médica computada a partir de tus datos corporales</p>
                  </div>
                </div>
                <div
                  className="diagnostic-badge"
                  style={{
                    background: diag.badgeBg,
                    color: diag.badgeColor,
                    border: `1.5px solid ${diag.badgeBorder}`,
                  }}
                >
                  <span>●</span> {diag.status} (IMC {bmi})
                </div>
              </div>

              {/* Ficha de datos ingresados */}
              <div className="diagnostic-data-strip">
                <span className="diagnostic-data-item">
                  <span>⚖️ Peso actual:</span> <strong>{currentWeight} kg</strong>
                </span>
                <span className="diagnostic-data-item">
                  <span>📏 Estatura:</span> <strong>{height} cm</strong>
                </span>
                <span className="diagnostic-data-item">
                  <span>🎂 Edad:</span> <strong>{age} años</strong>
                </span>
                <span className="diagnostic-data-item">
                  <span>📊 IMC:</span> <strong>{bmi}</strong>
                </span>
                {data.waistCm && (
                  <span className="diagnostic-data-item">
                    <span>📐 Cintura:</span> <strong>{data.waistCm} cm</strong>
                  </span>
                )}
                {data.hipCm && (
                  <span className="diagnostic-data-item">
                    <span>📐 Cadera:</span> <strong>{data.hipCm} cm</strong>
                  </span>
                )}
                {data.bodyFatPercent && (
                  <span className="diagnostic-data-item">
                    <span>🧬 % Grasa:</span> <strong>{data.bodyFatPercent}%</strong>
                  </span>
                )}
              </div>

              {/* Bloque de Realidad Actual */}
              <div
                className="diagnostic-reality-alert"
                style={{
                  background: diag.alertBg,
                  border: `1.5px solid ${diag.alertBorder}`,
                  color: diag.alertTextColor,
                }}
              >
                <div className="diagnostic-alert-title">
                  <span>{diag.icon}</span>
                  <span>{diag.headline}</span>
                </div>
                <p className="diagnostic-alert-body">{diag.reality}</p>
              </div>

              {/* Bloque de Solución y Reafirmación */}
              <div className="diagnostic-solution-callout">
                <h4>{diag.encouragementTitle}</h4>
                <p>{diag.encouragement}</p>
              </div>
            </article>

            {/* 2. Métricas Clave Personalizadas */}
            <div className="ai-metrics-grid">
              <div className="ai-metric-box">
                <span className="metric-icon">🎯</span>
                <span className="metric-label">Meta Física Proyectada</span>
                <span className="metric-val">{targetWeight} kg</span>
                <span className="metric-sub">
                  Hoy: {currentWeight} kg (IMC {bmi}) → Meta: {targetWeight} kg (IMC {targetBmi})
                </span>
              </div>
              <div className="ai-metric-box">
                <span className="metric-icon">🥩</span>
                <span className="metric-label">Proteína Diaria</span>
                <span className="metric-val">{proteinGrams} g / día</span>
                <span className="metric-sub">
                  ~{data.objective === "gain_muscle" ? "1.8" : "1.6"}g por kg para proteger tu músculo
                </span>
              </div>
              <div className="ai-metric-box" style={{ border: "2px solid #93c5fd", background: "#f0f9ff" }}>
                <span className="metric-icon">💧</span>
                <span className="metric-label" style={{ color: "#0369a1" }}>Agua Diaria Recomendada</span>
                <span className="metric-val" style={{ color: "#0284c7" }}>{waterLiters} L / día</span>
                <span className="metric-sub" style={{ color: "#075985" }}>
                  35 ml por cada kg de tu peso ({currentWeight} kg)
                </span>
              </div>
              <div className="ai-metric-box">
                <span className="metric-icon">🔥</span>
                <span className="metric-label">Gasto Diario Est.</span>
                <span className="metric-val">~{calorieEstimate} kcal</span>
                <span className="metric-sub">
                  {data.objective === "lose_fat" ? "Déficit saludable activo sin rebote" : "Balance de energía óptimo"}
                </span>
              </div>
            </div>

            {/* 3. Por qué te recomendamos esto: Explicación Detallada del Agua y Nutrición */}
            <article className="why-recommendations-card">
              <div className="why-header">
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#e0f2fe", color: "#0284c7", display: "grid", placeItems: "center", fontSize: "22px", flexShrink: 0 }}>
                  💧
                </div>
                <div>
                  <h3>¿Por qué te recomendamos exactamente {waterLiters} L de Agua al día?</h3>
                  <p>La ciencia médica detrás de tu hidratación diaria (35 ml por cada kg de tu peso actual)</p>
                </div>
              </div>

              <div className="why-water-box">
                <div className="why-water-head">
                  <h4>
                    <span>🌊</span> Los 4 Efectos Clínicos de beber tus {waterLiters} Litros diarios:
                  </h4>
                  <span className="why-water-badge">{waterLiters} L AL DÍA</span>
                </div>
                <div className="why-reasons-list">
                  <div className="why-reason-item">
                    <span className="bullet-icon">🔥</span>
                    <div>
                      <strong>1. Activa la Quema de Grasa (Lipólisis celular):</strong>
                      {" "}Para que tu cuerpo descomponga una molécula de grasa almacenada y la convierta en energía, requiere forzosamente agua (proceso de hidrólisis). Si bebes poca agua, los riñones no pueden filtrar bien y el hígado debe intervenir para ayudarlos, frenando por completo la quema de grasa.
                    </div>
                  </div>

                  <div className="why-reason-item">
                    <span className="bullet-icon">🦵</span>
                    <div>
                      <strong>2. Amortigua y Protege tus Articulaciones:</strong>
                      {" "}Con {currentWeight} kg de peso, el cartílago de tus rodillas, tobillos y columna recibe gran presión al ejercitarte. El agua es el componente vital del líquido sinovial que lubrica tus articulaciones, evitando dolores, desgaste temprano e inflamación.
                    </div>
                  </div>

                  <div className="why-reason-item">
                    <span className="bullet-icon">🛡️</span>
                    <div>
                      <strong>3. Elimina la Retención de Líquidos y Desinflama:</strong>
                      {" "}Existe el falso mito de que beber agua 'te hincha'. Al contrario: cuando bebes poca agua, tu cuerpo entra en modo alarma y retiene sodio y líquidos en el abdomen y piernas. Al recibir {waterLiters} L diarios, tu cuerpo se siente seguro, elimina toxinas y desinflama tu vientre en pocos días.
                    </div>
                  </div>

                  <div className="why-reason-item">
                    <span className="bullet-icon">⚡</span>
                    <div>
                      <strong>4. Control de Ansiedad y Rendimiento Muscular:</strong>
                      {" "}Una deshidratación de apenas 2% te resta un 15% de fuerza física y tu cerebro confunde la sed con antojos de pan, frituras o azúcar por la tarde. Mantenerte hidratado elimina la fatiga y los atracones de comida.
                    </div>
                  </div>
                </div>
              </div>

              {/* Justificación de Proteína y Déficit Calórico */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginTop: "4px" }}>
                <div style={{ background: "#fdf8f6", border: "1.5px solid #fed7aa", borderRadius: "14px", padding: "12px 14px" }}>
                  <b style={{ fontSize: "12.5px", color: "#c2410c", display: "flex", alignItems: "center", gap: "6px" }}>
                    🥩 {proteinGrams}g de Proteína / día
                  </b>
                  <p style={{ fontSize: "11.5px", color: "#7c2d12", margin: "5px 0 0 0", lineHeight: "1.45" }}>
                    <strong>¿Por qué?</strong> Protege tu masa muscular durante el déficit calórico para que pierdas pura grasa y nada de músculo. Además, es el nutriente que más saciedad te brinda entre comidas.
                  </p>
                </div>

                <div style={{ background: "#fefce8", border: "1.5px solid #fef08a", borderRadius: "14px", padding: "12px 14px" }}>
                  <b style={{ fontSize: "12.5px", color: "#a16207", display: "flex", alignItems: "center", gap: "6px" }}>
                    🔥 ~{calorieEstimate} kcal / día
                  </b>
                  <p style={{ fontSize: "11.5px", color: "#713f12", margin: "5px 0 0 0", lineHeight: "1.45" }}>
                    <strong>¿Por qué?</strong> Es un déficit inteligente del 15% al 20%. Te asegura quemar de 0.5 a 1 kg por semana de manera constante y sin que tu metabolismo se vuelva lento ni haya rebote.
                  </p>
                </div>
              </div>
            </article>

            {/* 4. Diagnóstico Táctico del Coach IA */}
            <article className="ai-verdict-card">
              <div className="ai-verdict-head">
                <div className="ai-avatar-circle">🤖</div>
                <div>
                  <h3>Estrategia Táctica de Entrenamiento</h3>
                  <p>Adaptada a tu perfil y tus actividades ({activitiesStr})</p>
                </div>
              </div>
              <p className="ai-verdict-text">
                {data.objective === "lose_fat" && `Hola ${firstName}, para bajar a ${targetWeight} kg de forma sana, el secreto no es matarte de hambre, sino la constancia 4×7. Al entrenar 4 días de ${activitiesStr} y consumir ${proteinGrams}g de proteína con tus ${waterLiters}L de agua, tu cuerpo quemará grasa mientras mantiene tu músculo firme.`}
                {data.objective === "gain_muscle" && `Hola ${firstName}, para llegar a ${targetWeight} kg con músculo limpio, tus sesiones de ${activitiesStr} serán el estímulo perfecto. La clave será llegar a tus ${proteinGrams}g de proteína diarios, tus ${waterLiters}L de agua y respetar tus 3 días de descanso para que el músculo crezca.`}
                {(data.objective === "maintain" || data.objective === "general_fitness") && `Hola ${firstName}, tu objetivo de salud integral se logrará perfectamente con el ritmo 4×7. Tus sesiones de ${activitiesStr} mejorarán tu energía y capacidad cardiovascular sin sobrecargar tus articulaciones.`}
              </p>
              <div className="ai-rule-list">
                <div className="ai-rule-item">
                  <span>⚡</span>
                  <div><strong>En tus 4 días de entreno:</strong> Come una porción de carbohidratos (fruta, avena o pan integral) 1 hora antes y tu proteína al finalizar.</div>
                </div>
                <div className="ai-rule-item">
                  <span>🥑</span>
                  <div><strong>En tus 3 días de descanso:</strong> Prioriza tus {waterLiters}L de agua, verduras y caminatas suaves para acelerar la recuperación.</div>
                </div>
                <div className="ai-rule-item">
                  <span>😴</span>
                  <div><strong>Regla de oro del sueño:</strong> Duerme 7 a 8 horas. El 80% de la regeneración y quema de grasa ocurre durante el descanso nocturno.</div>
                </div>
              </div>
            </article>

            {/* 3. Hoja de Ruta en 3 Fases (12 Semanas) */}
            <article className="ai-roadmap-card">
              <h3>📍 Tu Transformación en 3 Fases (12 Semanas)</h3>
              <p>Qué esperar de tu cuerpo semana a semana con el método 4×7:</p>
              <div className="ai-phases-stack">
                <div className="ai-phase-row">
                  <div className="phase-number-badge">1</div>
                  <div className="phase-content">
                    <div className="phase-title-row">
                      <b>Fase de Adaptación (Sem 1 a 2)</b>
                      <span>Crear hábito</span>
                    </div>
                    <p>Adaptación neuromuscular, aumento de energía diaria y primeros 1.0 a 1.5 kg de progreso.</p>
                  </div>
                </div>
                <div className="ai-phase-row">
                  <div className="phase-number-badge">2</div>
                  <div className="phase-content">
                    <div className="phase-title-row">
                      <b>Fase de Transformación (Sem 3 a 6)</b>
                      <span>Quema / Fuerza</span>
                    </div>
                    <p>Reducción notable de medidas, mayor resistencia física y consolidación de la racha familiar.</p>
                  </div>
                </div>
                <div className="ai-phase-row">
                  <div className="phase-number-badge">3</div>
                  <div className="phase-content">
                    <div className="phase-title-row">
                      <b>Fase de Consolidación (Sem 7 a 12)</b>
                      <span>Meta Cumplida</span>
                    </div>
                    <p>Hábito automático, cuerpo tonificado y llegada proyectada a tus {targetWeight} kg.</p>
                  </div>
                </div>
              </div>
            </article>

            {/* 4. Misión Semana 1 */}
            <div className="ai-mission-card">
              <div className="mission-icon-box">🏆</div>
              <div className="mission-text-box">
                <h4>Tu Misión de la Semana 1</h4>
                <p>Completa tus primeros 4 check-ins con foto para ganar tu bono de <strong>+300 PTS</strong> y entrar al podio de <strong>López y Amigos</strong>.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="onboarding-next"
            style={{ width: "100%", marginTop: "10px", height: "48px", fontSize: "14.5px" }}
            onClick={() => {
              try {
                localStorage.setItem(`four_seven_profile_${name}`, JSON.stringify(result));
                localStorage.setItem("four_seven_saved_profile", JSON.stringify(result));
              } catch {}
              onComplete(result);
            }}
          >
            🚀 Comenzar mi Reto 4×7 →
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-shell">
        <header className="onboarding-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", width: "100%" }}>
          <div className="auth-brand"><span>4×7</span><i /></div>
          <div><span>PASO {step} DE 4</span><div><i style={{ width: progress }} /></div></div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1.5px solid #fecaca",
                borderRadius: "999px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: "750",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="Volver a la pantalla de inicio de sesión"
            >
              Salir / Entrar con otra cuenta ✕
            </button>
          )}
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 4) {
              next();
            } else {
              save();
            }
          }}
        >
          {step === 1 && (
            <div className="onboarding-step">
              <p className="eyebrow">HOLA, {name.split(" ")[0].toUpperCase()}</p>
              <h1>Conozcamos tu punto de partida</h1>
              <p>Estos datos permiten calcular tu IMC y proyectar tu tiempo estimado a la meta.</p>
              <div className="onboarding-fields">
                <label>
                  Edad
                  <input type="number" inputMode="numeric" min="10" max="100" value={data.age} onChange={(e) => set("age", e.target.value)} placeholder="35" />
                  <small>Para calcular tu IMC y ritmo de entrenamiento.</small>
                </label>
                <label>
                  Sexo
                  <select value={data.sex} onChange={(e) => set("sex", e.target.value)}>
                    <option value="">Seleccionar</option>
                    <option value="female">Mujer</option>
                    <option value="male">Hombre</option>
                    <option value="other">Otro</option>
                    <option value="prefer_not">Prefiero no decirlo</option>
                  </select>
                </label>
                <label>
                  Estatura
                  <div className="unit-input">
                    <input type="number" inputMode="decimal" min="120" max="230" value={data.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="175" />
                    <span>cm</span>
                  </div>
                </label>
                <label>
                  Peso actual
                  <div className="unit-input">
                    <input type="number" inputMode="decimal" min="30" max="350" step="0.1" value={data.weightKg} onChange={(e) => set("weightKg", e.target.value)} placeholder="82.4" />
                    <span>kg</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <p className="eyebrow">TU OBJETIVO</p>
              <h1>¿Qué quieres conseguir?</h1>
              <p>Tu predicción semanal de tiempo se adaptará según tu meta física.</p>
              <div className="objective-grid">
                {objectives.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={data.objective === item.id ? "selected" : ""}
                    onClick={() => set("objective", item.id)}
                  >
                    <span><ObjectiveIcon id={item.id} /></span>
                    <div><b>{item.title}</b><small>{item.text}</small></div>
                    <i>{data.objective === item.id ? "✓" : ""}</i>
                  </button>
                ))}
              </div>
              <label className="target-field">
                Peso objetivo {targetRequired ? "" : "(opcional)"}
                <div className="unit-input">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="30"
                    max="350"
                    step="0.1"
                    value={data.targetWeightKg}
                    onChange={(e) => set("targetWeightKg", e.target.value)}
                    placeholder={data.objective === "gain_muscle" ? "86" : "75"}
                  />
                  <span>kg</span>
                </div>
                <small>Objetivo actual: {selectedObjective.title}.</small>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step">
              <p className="eyebrow">TU PLAN DE ENTRENAMIENTO</p>
              <h1>¿Qué ejercicios harás y qué días?</h1>
              <p>Elige los ejercicios que practicas o alternas. Marcaremos estos días en tu calendario familiar.</p>

              <div className="form-group" style={{ marginBottom: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontWeight: "700", fontSize: "13px" }}>
                    Ejercicios principales (Puedes elegir varios)
                  </label>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--green-dark)" }}>
                    ✓ {selectedActivities.length} seleccionado{selectedActivities.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="activity-choice-grid">
                  {activities.map((act) => {
                    const isSelected = selectedActivities.includes(act.id);
                    return (
                      <button
                        type="button"
                        key={act.id}
                        className={`act-choice-pill ${isSelected ? "active" : ""}`}
                        onClick={() => toggleActivity(act.id)}
                      >
                        <span>{act.icon}</span>
                        <b>{act.label} {isSelected ? "✓" : ""}</b>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: "700", display: "block", marginBottom: "8px", fontSize: "13px" }}>
                  ¿Qué días de la semana tienes pensado ir? (Mínimo 4)
                </label>
                <div className="days-selector-row">
                  {weekDaysList.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      className={`day-toggle-btn ${selectedDays.includes(d.id) ? "active" : ""}`}
                      onClick={() => toggleDay(d.id)}
                    >
                      <span>{d.short}</span>
                      <small>{d.label.slice(0, 3)}</small>
                    </button>
                  ))}
                </div>
                <p className="sub-hint" style={{ marginTop: "8px", fontSize: "11px", color: selectedDays.length >= 4 ? "#1c5a40" : "#d9534f" }}>
                  {selectedDays.length >= 4
                    ? `✓ ${selectedDays.length} días seleccionados para tu meta 4×7.`
                    : `⚠️ Selecciona al menos 4 días (llevas ${selectedDays.length}/4).`}
                </p>
                </div>

                <div className="field-block" style={{ marginTop: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ margin: 0, fontWeight: 700 }}>¿Cuándo inicias tu Reto 4×7?</label>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#166534", background: "#dcfce7", border: "1px solid #86efac", padding: "2px 8px", borderRadius: "999px" }}>
                      1 al 15 de Septiembre
                    </span>
                  </div>
                  <select
                    value={data.challengeStartDate || "2026-09-01"}
                    onChange={(e) => {
                      const val = e.target.value;
                      set("challengeStartDate", val);
                      if (typeof window !== "undefined") {
                        try { localStorage.setItem("four_seven_challenge_start_date", val); } catch {}
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      borderRadius: "12px",
                      border: "1.5px solid #cce3d5",
                      fontSize: "13px",
                      fontWeight: "650",
                      background: "#f9fcfb",
                      color: "#183b2b",
                      outline: "none",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    {START_DATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <small style={{ fontSize: "11px", color: "#47745e", marginTop: "4px", display: "block", lineHeight: "1.3" }}>
                    🗓️ Tu calendario y tus 4 metas por semana comenzarán a registrarse a partir de este día.
                  </small>
                </div>
              </div>
          )}

          {step === 4 && (
            <div className="onboarding-step">
              <div style={{ display: "inline-block", padding: "3px 8px", borderRadius: "6px", background: "#eef8f2", color: "var(--green-dark)", fontSize: "10px", fontWeight: 800, marginBottom: "6px" }}>
                💡 PASO 100% OPCIONAL
              </div>
              <h1>Medidas corporales (Opcional)</h1>
              <p>Si no tienes cinta métrica ahora, no te preocupes: puedes dejar los campos vacíos y avanzar directamente.</p>
              <div className="measure-grid">
                {optionalMeasures.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <div className="unit-input">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={data[key]}
                        onChange={(e) => set(key, e.target.value)}
                        placeholder="—"
                      />
                      <span>{key === "bodyFatPercent" ? "%" : "cm"}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="privacy-strip" style={{ marginTop: "16px" }}>
                <span>⌾</span>
                <p><b>Privacidad garantizada:</b> Tus medidas son privadas; tu familia solo ve tus días cumplidos y puntos en la liga.</p>
              </div>
            </div>
          )}

          {error && <p className="onboarding-error" role="alert">{error}</p>}

          <footer className="onboarding-actions">
            {step > 1 && (
              <button type="button" className="onboarding-back" onClick={() => { setStep(step - 1); setError(""); }}>
                ← Atrás
              </button>
            )}
            <button
              type="button"
              className="onboarding-next"
              disabled={busy}
              onClick={step < 4 ? next : () => save()}
            >
              {busy ? "Creando tu plan…" : step === 4 ? "✓ Guardar mi plan y entrar" : "Continuar →"}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
