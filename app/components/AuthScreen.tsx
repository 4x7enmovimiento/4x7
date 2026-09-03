"use client";

import { FormEvent, useEffect, useState } from "react";
import { clientApi, type Session } from "../lib/client-api";

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

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("López y Amigos");
  const [challengeStartDate, setChallengeStartDate] = useState("2026-09-01");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("four_seven_saved_email");
      const savedPassword = localStorage.getItem("four_seven_saved_password");
      if (savedEmail) {
        setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
        setMode("login");
      }
    } catch {
      // Ignore if storage blocked
    }
  }, []);

  const submit = async (event: FormEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setError("");
    setBusy(true);
    try {
      const session = mode === "login"
        ? await clientApi.login(email, password)
        : await clientApi.register({
          name,
          nickname: nickname.trim() || name.split(" ")[0],
          email,
          password,
          familyName: familyName.trim() || "López y Amigos",
          challengeStartDate,
        });
      
      try {
        localStorage.setItem("four_seven_saved_email", email);
        localStorage.setItem("four_seven_saved_password", password);
        if (mode === "register") {
          localStorage.setItem("four_seven_challenge_start_date", challengeStartDate);
        }
      } catch {
        // Ignore
      }

      onAuthenticated(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos entrar.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-story">
      <div className="auth-brand"><span>4×7</span><i /></div>
      <p className="auth-kicker">FITNESS EN FAMILIA</p>
      <h1>Cuatro días.<br />Siete oportunidades.<br /><em>Juntos.</em></h1>
      <p>Entrenen, compartan evidencias y conviertan la constancia en una competencia que sí se disfruta.</p>
      <div className="auth-benefits"><span>🔥 Rachas</span><span>♡ Muro familiar</span><span>◇ Puntos y retos</span></div>
    </section>
    <section className="auth-panel">
      <form className="auth-card" onSubmit={submit} action="javascript:void(0);">
        <div className="auth-mobile-brand">4×7<span /></div>
        <p className="eyebrow">BIENVENIDO A TU EQUIPO</p>
        <h2>{mode === "login" ? "Qué bueno verte otra vez" : "Empiecen su 4×7"}</h2>
        <div className="auth-tabs" role="tablist">
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Crear cuenta</button>
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Ya tengo cuenta</button>
        </div>
        {mode === "register" && (
          <>
            <label>
              Nombre completo
              <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="ej. Pedro Humberto González López" autoComplete="name" />
            </label>
            <label>
              Nickname / Apodo en la Liga
              <input required minLength={2} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="ej. Pedcaz, JuuGlez, Wero, etc." />
            </label>
          </>
        )}
        <label>Correo o Usuario<input required type="text" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="p.glez.lpz92@gmail.com o Pedcaz" autoComplete="username" /></label>
        <label>Contraseña<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {mode === "register" && (
          <label>
            Equipo o Familia
            <input
              required
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="López y Amigos"
            />
          </label>
        )}
        {mode === "register" && (
          <label style={{ display: "block", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span>¿Cuándo inicias tu Reto 4×7?</span>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#166534", background: "#dcfce7", border: "1px solid #86efac", padding: "2px 8px", borderRadius: "999px" }}>
                1 al 15 de Septiembre
              </span>
            </div>
            <select
              value={challengeStartDate}
              onChange={(event) => setChallengeStartDate(event.target.value)}
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "12px",
                border: "1.5px solid #d2e4d9",
                fontSize: "13.5px",
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
              🗓️ Elige el día en que arranca tu marcador y tus metas de entrenamiento este mes.
            </small>
          </label>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Preparando tu espacio…" : mode === "login" ? "Entrar a mi familia" : "Unirme a López y Amigos"}</button>
        
        <small className="auth-privacy" style={{ marginTop: "16px" }}>Tu información y las fotos de tu familia permanecen privadas y protegidas dentro de su grupo.</small>
      </form>
    </section>
  </main>;
}

