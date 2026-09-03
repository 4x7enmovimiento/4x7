"use client";

import { FormEvent, useEffect, useState } from "react";
import { clientApi, type Session } from "../lib/client-api";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("López y Amigos");
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
          phone: phone.trim(),
          email,
          password,
          familyName: familyName.trim() || "López y Amigos",
        });
      
      try {
        localStorage.setItem("four_seven_saved_email", email);
        localStorage.setItem("four_seven_saved_password", password);
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
            <label>
              Número de celular (WhatsApp)
              <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="ej. 33 2407 7845" autoComplete="tel" />
            </label>
          </>
        )}
        <label>Correo<input required type="text" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" autoComplete="username" /></label>
        <label>Contraseña<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {mode === "register" && (
          <label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span>Equipo o Familia</span>
              <span style={{ fontSize: "10.5px", fontWeight: "800", color: "#166534", background: "#dcfce7", padding: "2px 8px", borderRadius: "999px" }}>
                🔒 Equipo Oficial
              </span>
            </div>
            <input
              readOnly
              value="López y Amigos"
              style={{
                background: "#f1f5f3",
                color: "#183b2b",
                fontWeight: "700",
                cursor: "not-allowed",
                border: "1.5px solid #d2e4d9",
              }}
              title="Equipo oficial predeterminado para el reto familiar"
            />
          </label>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Preparando tu espacio…" : mode === "login" ? "Entrar a mi familia" : "Unirme a López y Amigos"}</button>
        
        <small className="auth-privacy" style={{ marginTop: "16px" }}>Tu información y las fotos de tu familia permanecen privadas y protegidas dentro de su grupo.</small>
      </form>
    </section>
  </main>;
}

