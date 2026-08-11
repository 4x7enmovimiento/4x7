"use client";

import { FormEvent, useMemo, useState } from "react";
import { clientApi, type ProfileResponse } from "../lib/client-api";

const objectives = [
  { id: "lose_fat", icon: "↘", title: "Bajar peso o grasa", text: "Reducir de forma gradual conservando fuerza." },
  { id: "gain_muscle", icon: "↗", title: "Subir músculo", text: "Ganar masa y mejorar fuerza progresivamente." },
  { id: "maintain", icon: "◎", title: "Mantenerme", text: "Conservar peso y mejorar condición física." },
  { id: "general_fitness", icon: "✦", title: "Sentirme mejor", text: "Crear condición, energía y constancia." },
] as const;

const optionalMeasures = [
  ["waistCm", "Cintura"], ["hipCm", "Glúteo / cadera"], ["chestCm", "Pecho"], ["armCm", "Bíceps"],
  ["thighCm", "Muslo"], ["calfCm", "Pantorrilla"], ["neckCm", "Cuello"], ["bodyFatPercent", "% grasa corporal"],
] as const;

export function ProfileOnboarding({ name, onComplete }: { name: string; onComplete: (result: ProfileResponse) => void }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProfileResponse | null>(null);
  const [data, setData] = useState<Record<string, string>>({ objective: "lose_fat", sex: "", age: "", heightCm: "", weightKg: "", targetWeightKg: "", waistCm: "", hipCm: "", chestCm: "", armCm: "", thighCm: "", calfCm: "", neckCm: "", bodyFatPercent: "" });
  const set = (key: string, value: string) => setData((current) => ({ ...current, [key]: value }));
  const selectedObjective = objectives.find((item) => item.id === data.objective)!;
  const targetRequired = data.objective === "lose_fat" || data.objective === "gain_muscle";
  const progress = useMemo(() => `${Math.min(step, 3) * 33.333}%`, [step]);

  const next = () => {
    setError("");
    if (step === 1 && (!data.age || Number(data.age) < 18 || !data.sex || !data.heightCm || !data.weightKg)) return setError("Completa edad, sexo, estatura y peso para calcular tu IMC.");
    if (step === 2 && targetRequired && !data.targetWeightKg) return setError("Escribe tu peso objetivo para crear la proyección.");
    setStep((current) => Math.min(3, current + 1));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const birthDate = `${new Date().getFullYear() - Number(data.age)}-01-01`;
      const payload = Object.fromEntries(Object.entries({ ...data, birthDate }).filter(([key, value]) => key !== "age" && value !== "").map(([key, value]) => [key, key === "objective" || key === "sex" || key === "birthDate" ? value : Number(value)]));
      const saved = await clientApi.saveProfile(payload);
      setResult(saved); setStep(4);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos guardar tu perfil."); }
    finally { setBusy(false); }
  };

  if (step === 4 && result?.projection) return <main className="onboarding-page"><section className="onboarding-result">
    <div className="result-check">✓</div><p className="eyebrow">TU PUNTO DE PARTIDA</p><h1>Tu ruta 4×7 está lista</h1><p>Esta proyección se ajustará con tus registros reales cada semana.</p>
    <div className="bmi-result"><span>IMC ACTUAL<strong>{result.projection.bmi}</strong></span><i /><span>REFERENCIA<strong>{result.projection.bmiCategory}</strong></span></div>
    <div className="projection-preview">{result.projection.weeks.slice(0, 4).map((week) => <article key={week.week}><span>SEM {week.week}</span><strong>{week.weightKg} kg</strong><small>{week.phase}</small></article>)}</div>
    <div className="projection-note"><span>✦</span><p><b>Proyección inteligente, no promesa.</b>El peso y la composición corporal también dependen de alimentación, sueño, genética y salud. 4×7 ajustará la ruta conforme registres avances.</p></div>
    <button className="onboarding-next" onClick={() => onComplete(result)}>Entrar a mi 4×7 →</button>
  </section></main>;

  return <main className="onboarding-page"><section className="onboarding-shell">
    <header className="onboarding-head"><div className="auth-brand"><span>4×7</span><i /></div><div><span>PASO {step} DE 3</span><div><i style={{ width: progress }} /></div></div></header>
    <form onSubmit={save}>
      {step === 1 && <div className="onboarding-step"><p className="eyebrow">HOLA, {name.split(" ")[0].toUpperCase()}</p><h1>Conozcamos tu punto de partida</h1><p>Estos datos permiten calcular tu IMC y personalizar la ruta. El IMC es una referencia, no un diagnóstico.</p>
        <div className="onboarding-fields"><label>Edad<input type="number" inputMode="numeric" min="18" max="100" value={data.age} onChange={(e) => set("age", e.target.value)} placeholder="35" /><small>Por ahora, la proyección es para adultos.</small></label><label>Sexo<select value={data.sex} onChange={(e) => set("sex", e.target.value)}><option value="">Seleccionar</option><option value="female">Mujer</option><option value="male">Hombre</option><option value="other">Otro</option><option value="prefer_not">Prefiero no decirlo</option></select></label><label>Estatura<div className="unit-input"><input type="number" inputMode="decimal" min="120" max="230" value={data.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="175" /><span>cm</span></div></label><label>Peso actual<div className="unit-input"><input type="number" inputMode="decimal" min="30" max="350" step="0.1" value={data.weightKg} onChange={(e) => set("weightKg", e.target.value)} placeholder="82.4" /><span>kg</span></div></label></div>
      </div>}
      {step === 2 && <div className="onboarding-step"><p className="eyebrow">TU OBJETIVO</p><h1>¿Qué quieres conseguir?</h1><p>La ruta semanal cambiará según la meta que elijas.</p><div className="objective-grid">{objectives.map((item) => <button type="button" key={item.id} className={data.objective === item.id ? "selected" : ""} onClick={() => set("objective", item.id)}><span>{item.icon}</span><div><b>{item.title}</b><small>{item.text}</small></div><i>{data.objective === item.id ? "✓" : ""}</i></button>)}</div><label className="target-field">Peso objetivo {targetRequired ? "" : "(opcional)"}<div className="unit-input"><input type="number" inputMode="decimal" min="30" max="350" step="0.1" value={data.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} placeholder={data.objective === "gain_muscle" ? "86" : "75"} /><span>kg</span></div><small>Objetivo elegido: {selectedObjective.title}. Podrás cambiarlo después.</small></label></div>}
      {step === 3 && <div className="onboarding-step"><p className="eyebrow">MEDIDAS OPCIONALES</p><h1>La báscula no cuenta toda la historia</h1><p>Estas medidas ayudan a ver cambios de grasa y músculo incluso cuando el peso se mueve poco. Puedes dejarlas vacías.</p><div className="measure-grid">{optionalMeasures.map(([key, label]) => <label key={key}>{label}<div className="unit-input"><input type="number" inputMode="decimal" step="0.1" value={data[key]} onChange={(e) => set(key, e.target.value)} placeholder="—" /><span>{key === "bodyFatPercent" ? "%" : "cm"}</span></div></label>)}</div><div className="privacy-strip"><span>⌾</span><p><b>Datos privados</b>Solo tú ves tus medidas detalladas. Tu familia verá entrenamientos y puntos, no estas cifras.</p></div></div>}
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <footer className="onboarding-actions">{step > 1 && <button type="button" className="onboarding-back" onClick={() => { setStep(step - 1); setError(""); }}>← Atrás</button>}<button type={step === 3 ? "submit" : "button"} className="onboarding-next" disabled={busy} onClick={step < 3 ? next : undefined}>{busy ? "Creando tu proyección…" : step === 3 ? "Calcular mi ruta 4×7" : "Continuar →"}</button></footer>
    </form>
  </section></main>;
}
