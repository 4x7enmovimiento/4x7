"use client";

import { useMemo, useState } from "react";

const navItems = ["Inicio", "Muro", "Progreso", "Calendario", "Liga", "Retos"];

const week = [
  { day: "L", date: "10", state: "done" },
  { day: "M", date: "11", state: "done" },
  { day: "M", date: "12", state: "rest" },
  { day: "J", date: "13", state: "done" },
  { day: "V", date: "14", state: "next" },
  { day: "S", date: "15", state: "empty" },
  { day: "D", date: "16", state: "empty" },
];

const family = [
  { name: "Ana", points: 1280, initials: "A", color: "coral", trend: "+120" },
  { name: "Pedro", points: 1160, initials: "P", color: "mint", trend: "+100" },
  { name: "Sofi", points: 980, initials: "S", color: "lilac", trend: "+60" },
  { name: "Mateo", points: 760, initials: "M", color: "sun", trend: "+20" },
];

type Post = {
  id: number;
  name: string;
  meta: string;
  initials: string;
  color: string;
  title: string;
  body: string;
  tag: string;
  likes: number;
  comments: number;
};

const initialPosts: Post[] = [
  {
    id: 1,
    name: "Ana",
    meta: "Hace 32 min · Parque México",
    initials: "A",
    color: "coral",
    title: "5 km antes de empezar el día",
    body: "Hoy costó salir, pero terminó siendo mi mejor ritmo del mes. ✨",
    tag: "Carrera · 31 min",
    likes: 8,
    comments: 3,
  },
  {
    id: 2,
    name: "Sofi",
    meta: "Ayer · Entrenamiento en casa",
    initials: "S",
    color: "lilac",
    title: "Día de piernas completado",
    body: "Semana 3 del reto. Ya se siente la diferencia y todavía queda energía.",
    tag: "Fuerza · 46 min",
    likes: 11,
    comments: 5,
  },
];

function Glyph({ label }: { label: string }) {
  const glyphs: Record<string, string> = {
    Inicio: "⌂",
    Muro: "◫",
    Progreso: "↗",
    Calendario: "□",
    Liga: "◇",
    Retos: "⚑",
  };
  return <span aria-hidden="true">{glyphs[label]}</span>;
}

export default function Home() {
  const [active, setActive] = useState("Inicio");
  const [liked, setLiked] = useState<number[]>([2]);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [logged, setLogged] = useState(false);
  const [toast, setToast] = useState("");

  const totalPoints = useMemo(() => family.reduce((sum, member) => sum + member.points, 0), []);

  function toggleLike(id: number) {
    setLiked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function saveWorkout() {
    setLogged(true);
    setQuickLogOpen(false);
    setToast("Entrenamiento registrado · +100 puntos");
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand" aria-label="4 por 7">
          <span className="brand-mark">4×7</span>
          <span className="brand-dot" />
        </div>

        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              className={active === item ? "nav-item active" : "nav-item"}
              key={item}
              onClick={() => setActive(item)}
              aria-current={active === item ? "page" : undefined}
            >
              <Glyph label={item} />
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="family-pulse">
          <div className="pulse-top"><span>ADN familiar</span><b>86%</b></div>
          <div className="pulse-bar"><i /></div>
          <p>Todos están en movimiento esta semana.</p>
        </div>

        <button className="profile-card" aria-label="Abrir perfil de Pedro">
          <span className="avatar mint">P</span>
          <span><b>Pedro</b><small>Mi perfil</small></span>
          <span className="more">•••</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">SEMANA 33 · 10–16 AGO</p>
            <h1>Buenas tardes, Pedro</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notificaciones"><span className="notification-dot" />♢</button>
            <button className="primary-button" onClick={() => setQuickLogOpen(true)}>
              <span>＋</span> Registrar entrenamiento
            </button>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="main-column">
            <article className="week-card">
              <div className="week-intro">
                <div className="mini-label"><span className="live-dot" /> TU SEMANA</div>
                <h2>{logged ? "Meta cumplida. ¡Qué semana!" : "Te falta 1 día para cumplir"}</h2>
                <p>{logged ? "Sumaste tu cuarto entrenamiento y mantienes viva la racha." : "Viernes es una gran oportunidad para cerrar tu 4×7."}</p>
                <div className="streak-line"><span>🔥</span><b>Racha de 6 semanas</b><span className="best">Mejor: 9</span></div>
              </div>

              <div className="week-progress">
                <div className={logged ? "progress-ring complete" : "progress-ring"}>
                  <div><strong>{logged ? 4 : 3}</strong><span>de 4 días</span></div>
                </div>
                <div className="days-row" aria-label="Actividad semanal">
                  {week.map((item, index) => {
                    const state = logged && index === 4 ? "done" : item.state;
                    return (
                      <div className={`day ${state}`} key={`${item.day}-${item.date}`}>
                        <span>{item.day}</span>
                        <b>{state === "done" ? "✓" : item.date}</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>

            <section className="metric-row" aria-label="Resumen de progreso">
              <article className="metric-card">
                <div className="metric-icon soft-mint">↗</div>
                <div><span>Entrenamientos</span><strong>{logged ? 15 : 14}</strong><small>este mes</small></div>
                <em>+18%</em>
              </article>
              <article className="metric-card">
                <div className="metric-icon soft-coral">◎</div>
                <div><span>Tiempo activo</span><strong>9.4 h</strong><small>este mes</small></div>
                <em>+1.2 h</em>
              </article>
              <article className="metric-card">
                <div className="metric-icon soft-lilac">◇</div>
                <div><span>Puntos</span><strong>{logged ? "1,260" : "1,160"}</strong><small>posición #2</small></div>
                <em>↑ 1</em>
              </article>
            </section>

            <section className="section-block">
              <div className="section-heading">
                <div><p className="eyebrow">EN FAMILIA</p><h2>Últimos movimientos</h2></div>
                <button onClick={() => setActive("Muro")}>Ver todo →</button>
              </div>

              <div className="feed">
                {initialPosts.map((post) => {
                  const isLiked = liked.includes(post.id);
                  return (
                    <article className="post-card" key={post.id}>
                      <div className="post-header">
                        <span className={`avatar ${post.color}`}>{post.initials}</span>
                        <div><b>{post.name}</b><span>{post.meta}</span></div>
                        <button aria-label={`Más opciones de la publicación de ${post.name}`}>•••</button>
                      </div>
                      <div className={`post-visual visual-${post.id}`}>
                        <span className="visual-word">{post.id === 1 ? "AIRE" : "FUERZA"}</span>
                        <div className="route-line" />
                        <span className="visual-stat">{post.id === 1 ? "5.0 KM" : "46 MIN"}</span>
                      </div>
                      <div className="post-copy">
                        <span className="activity-tag">{post.tag}</span>
                        <h3>{post.title}</h3>
                        <p>{post.body}</p>
                        <div className="post-actions">
                          <button className={isLiked ? "liked" : ""} onClick={() => toggleLike(post.id)} aria-pressed={isLiked}>
                            {isLiked ? "♥" : "♡"} {post.likes + (isLiked ? 1 : 0)}
                          </button>
                          <button>◯ {post.comments}</button>
                          <button className="share" aria-label="Compartir publicación">↗</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>

          <aside className="right-column">
            <article className="family-card">
              <div className="card-heading"><div><p className="eyebrow">LIGA FAMILIAR</p><h2>Esta semana</h2></div><span>⌄</span></div>
              <div className="family-total"><span>Puntos en familia</span><strong>{totalPoints.toLocaleString("es-MX")}</strong><small>+740 esta semana</small></div>
              <ol className="leaderboard">
                {family.map((member, index) => (
                  <li key={member.name} className={member.name === "Pedro" ? "you" : ""}>
                    <span className="rank">{index + 1}</span>
                    <span className={`avatar small ${member.color}`}>{member.initials}</span>
                    <span className="member"><b>{member.name}</b><small>{member.trend} pts</small></span>
                    <strong>{member.name === "Pedro" && logged ? member.points + 100 : member.points}</strong>
                  </li>
                ))}
              </ol>
              <button className="text-button" onClick={() => setActive("Liga")}>Ver clasificación completa</button>
            </article>

            <article className="challenge-card">
              <div className="challenge-art"><span>21</span><small>DÍAS</small></div>
              <p className="eyebrow">RETO ACTIVO</p>
              <h2>Constancia familiar</h2>
              <p>Que todos cumplan su meta semanal durante 3 semanas.</p>
              <div className="challenge-progress"><i /></div>
              <div className="challenge-meta"><span>Semana 2 de 3</span><b>67%</b></div>
              <div className="stacked-avatars"><span className="avatar tiny coral">A</span><span className="avatar tiny mint">P</span><span className="avatar tiny lilac">S</span><span className="avatar tiny sun">M</span><small>4 participantes</small></div>
            </article>

            <article className="coach-card">
              <div className="coach-icon">✦</div>
              <div><p className="eyebrow">COACH 4×7</p><h3>Tu semana va equilibrada</h3><p>Te recomiendo una sesión de fuerza de 35 minutos para cerrar.</p></div>
              <button aria-label="Abrir recomendación">→</button>
            </article>
          </aside>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navItems.slice(0, 5).map((item) => (
          <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><Glyph label={item} /><small>{item}</small></button>
        ))}
      </nav>

      {quickLogOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setQuickLogOpen(false)}>
          <section className="quick-log" role="dialog" aria-modal="true" aria-labelledby="quick-log-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setQuickLogOpen(false)} aria-label="Cerrar">×</button>
            <p className="eyebrow">REGISTRO RÁPIDO</p>
            <h2 id="quick-log-title">¿Qué entrenaste hoy?</h2>
            <p>Tu cuarto día está a un registro de distancia.</p>
            <div className="workout-options">
              <button className="selected"><span>↗</span><b>Fuerza</b><small>35 min</small></button>
              <button><span>⌁</span><b>Cardio</b><small>30 min</small></button>
              <button><span>◌</span><b>Movilidad</b><small>20 min</small></button>
            </div>
            <label className="note-field">Nota opcional<textarea placeholder="¿Cómo te sentiste?" /></label>
            <button className="primary-button full" onClick={saveWorkout}>Guardar entrenamiento · +100 pts</button>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
