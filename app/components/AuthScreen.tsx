"use client";

import { FormEvent, useState } from "react";
import { clientApi, type Session } from "../lib/client-api";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [familyMode, setFamilyMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const session = mode === "login"
        ? await clientApi.login(email, password)
        : await clientApi.register({
          name,
          email,
          password,
          familyName: familyMode === "create" ? familyName : undefined,
          inviteCode: familyMode === "join" ? inviteCode : undefined,
        });
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
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mobile-brand">4×7<span /></div>
        <p className="eyebrow">BIENVENIDO A TU EQUIPO</p>
        <h2>{mode === "login" ? "Qué bueno verte otra vez" : "Empiecen su 4×7"}</h2>
        <div className="auth-tabs" role="tablist">
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Crear cuenta</button>
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Ya tengo cuenta</button>
        </div>
        {mode === "register" && <label>Tu nombre<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Pedro" autoComplete="name" /></label>}
        <label>Correo<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" autoComplete="email" /></label>
        <label>Contraseña<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {mode === "register" && <>
          <div className="family-choice">
            <button type="button" className={familyMode === "create" ? "active" : ""} onClick={() => setFamilyMode("create")}>Crear familia</button>
            <button type="button" className={familyMode === "join" ? "active" : ""} onClick={() => setFamilyMode("join")}>Tengo un código</button>
          </div>
          {familyMode === "create"
            ? <label>Nombre de la familia<input required value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="Familia González" /></label>
            : <label>Código de invitación<input required value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="4X7ABC123" /></label>}
        </>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Preparando tu espacio…" : mode === "login" ? "Entrar a mi familia" : "Crear mi espacio 4×7"}</button>
        <small className="auth-privacy">Tu información y las fotos de tu familia permanecen privadas dentro de su grupo.</small>
      </form>
    </section>
  </main>;
}
