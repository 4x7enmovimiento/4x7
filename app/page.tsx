"use client";

import { useMemo, useState } from "react";

const navItems = ["Inicio", "Muro", "Progreso", "Calendario", "Liga", "Retos"] as const;
type Section = typeof navItems[number];

const family = [
  { name: "Ana", points: 1280, initials: "A", color: "coral", trend: "+120", workouts: 4 },
  { name: "Pedro", points: 1160, initials: "P", color: "mint", trend: "+100", workouts: 3 },
  { name: "Sofi", points: 980, initials: "S", color: "lilac", trend: "+60", workouts: 4 },
  { name: "Mateo", points: 760, initials: "M", color: "sun", trend: "+20", workouts: 2 },
];

type Post = { id: number; name: string; meta: string; initials: string; color: string; title: string; body: string; tag: string; likes: number; comments: number; visual: string; stat: string };
const posts: Post[] = [
  { id: 1, name: "Ana", meta: "Hace 32 min · Parque México", initials: "A", color: "coral", title: "5 km antes de empezar el día", body: "Hoy costó salir, pero terminó siendo mi mejor ritmo del mes. ✨", tag: "Carrera · 31 min", likes: 8, comments: 3, visual: "AIRE", stat: "5.0 KM" },
  { id: 2, name: "Sofi", meta: "Ayer · Entrenamiento en casa", initials: "S", color: "lilac", title: "Día de piernas completado", body: "Semana 3 del reto. Ya se siente la diferencia y todavía queda energía.", tag: "Fuerza · 46 min", likes: 11, comments: 5, visual: "FUERZA", stat: "46 MIN" },
  { id: 3, name: "Mateo", meta: "Ayer · Bosque de Chapultepec", initials: "M", color: "sun", title: "Rodada familiar pendiente: pagada", body: "Casi me gana el sillón, pero el grupo no perdona. 🚲", tag: "Bicicleta · 52 min", likes: 14, comments: 7, visual: "RUEDA", stat: "12.4 KM" },
];

const week = [
  { day: "L", date: "10", state: "done" }, { day: "M", date: "11", state: "done" },
  { day: "M", date: "12", state: "rest" }, { day: "J", date: "13", state: "done" },
  { day: "V", date: "14", state: "next" }, { day: "S", date: "15", state: "empty" },
  { day: "D", date: "16", state: "empty" },
];

const calendarDays = Array.from({ length: 36 }, (_, index) => index < 5 ? null : index - 4);
const titleCopy: Record<Section, [string, string]> = {
  Inicio: ["SEMANA 33 · 10–16 AGO", "Buenas tardes, Pedro"],
  Muro: ["EL MURO DEL SUDOR", "Tu familia se está moviendo"],
  Progreso: ["TU EVOLUCIÓN", "Cada semana cuenta"],
  Calendario: ["AGOSTO 2026", "Organiza tu 4×7"],
  Liga: ["COMPETENCIA CON CARIÑO", "Liga familiar"],
  Retos: ["JUNTOS CUESTA MENOS", "Retos 4×7"],
};

function Glyph({ label }: { label: string }) {
  const glyphs: Record<string, string> = { Inicio: "⌂", Muro: "◫", Progreso: "↗", Calendario: "□", Liga: "◇", Retos: "⚑" };
  return <span aria-hidden="true">{glyphs[label]}</span>;
}

export default function Home() {
  const [active, setActive] = useState<Section>("Inicio");
  const [liked, setLiked] = useState<number[]>([2]);
  const [commentOpen, setCommentOpen] = useState<number | null>(null);
  const [extraComments, setExtraComments] = useState<Record<number, number>>({});
  const [commentText, setCommentText] = useState("");
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [logged, setLogged] = useState(false);
  const [toast, setToast] = useState("");
  const [workout, setWorkout] = useState("Fuerza");
  const [note, setNote] = useState("");
  const [scheduledDays, setScheduledDays] = useState([14, 17, 20, 22]);
  const [selectedDay, setSelectedDay] = useState(14);
  const [joined, setJoined] = useState<number[]>([1]);
  const [evidenceName, setEvidenceName] = useState("");
  const totalPoints = useMemo(() => family.reduce((sum, member) => sum + member.points, 0) + (logged ? 100 : 0), [logged]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };
  const toggleLike = (id: number) => setLiked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const addComment = (id: number) => {
    if (!commentText.trim()) return;
    setExtraComments((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    setCommentText(""); setCommentOpen(null); notify("Comentario publicado en el muro");
  };
  const saveWorkout = () => {
    setLogged(true); setQuickLogOpen(false); setNote("");
    notify(`${workout} registrado · +100 puntos`);
  };
  const toggleSchedule = (day: number) => {
    setSelectedDay(day);
    setScheduledDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
    notify(scheduledDays.includes(day) ? `Entrenamiento del ${day} eliminado` : `Entrenamiento programado para el ${day}`);
  };
  const toggleChallenge = (id: number) => {
    setJoined((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    notify(joined.includes(id) ? "Saliste del reto" : "Te uniste al reto familiar");
  };

  const PostCard = ({ post }: { post: Post }) => {
    const isLiked = liked.includes(post.id);
    return <article className="post-card">
      <div className="post-header"><span className={`avatar ${post.color}`}>{post.initials}</span><div><b>{post.name}</b><span>{post.meta}</span></div><button aria-label={`Más opciones de ${post.name}`}>•••</button></div>
      <div className={`post-visual visual-${post.id}`}><span className="visual-word">{post.visual}</span><div className="route-line" /><span className="visual-stat">{post.stat}</span></div>
      <div className="post-copy"><span className="activity-tag">{post.tag}</span><h3>{post.title}</h3><p>{post.body}</p>
        <div className="post-actions"><button className={isLiked ? "liked" : ""} onClick={() => toggleLike(post.id)}>{isLiked ? "♥" : "♡"} {post.likes + (isLiked ? 1 : 0)}</button><button onClick={() => setCommentOpen(commentOpen === post.id ? null : post.id)}>◯ {post.comments + (extraComments[post.id] ?? 0)}</button><button className="share" onClick={() => notify("Enlace de la publicación copiado")}>↗</button></div>
        {commentOpen === post.id && <div className="comment-box"><input autoFocus value={commentText} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addComment(post.id)} placeholder="Escribe algo que motive…" /><button onClick={() => addComment(post.id)}>Enviar</button></div>}
      </div>
    </article>;
  };

  const Dashboard = () => <div className="dashboard-grid">
    <section className="main-column">
      <article className="week-card"><div className="week-intro"><div className="mini-label"><span className="live-dot" /> TU SEMANA</div><h2>{logged ? "Meta cumplida. ¡Qué semana!" : "Te falta 1 día para cumplir"}</h2><p>{logged ? "Sumaste tu cuarto entrenamiento y mantienes viva la racha." : "Viernes es una gran oportunidad para cerrar tu 4×7."}</p><div className="streak-line"><span>🔥</span><b>Racha de 6 semanas</b><span className="best">Mejor: 9</span></div></div>
        <div className="week-progress"><div className={logged ? "progress-ring complete" : "progress-ring"}><div><strong>{logged ? 4 : 3}</strong><span>de 4 días</span></div></div><div className="days-row">{week.map((item, index) => { const state = logged && index === 4 ? "done" : item.state; return <div className={`day ${state}`} key={item.date}><span>{item.day}</span><b>{state === "done" ? "✓" : item.date}</b></div>; })}</div></div></article>
      <section className="metric-row"><article className="metric-card"><div className="metric-icon soft-mint">↗</div><div><span>Entrenamientos</span><strong>{logged ? 15 : 14}</strong><small>este mes</small></div><em>+18%</em></article><article className="metric-card"><div className="metric-icon soft-coral">◎</div><div><span>Tiempo activo</span><strong>9.4 h</strong><small>este mes</small></div><em>+1.2 h</em></article><article className="metric-card"><div className="metric-icon soft-lilac">◇</div><div><span>Puntos</span><strong>{logged ? "1,260" : "1,160"}</strong><small>posición #2</small></div><em>↑ 1</em></article></section>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">EN FAMILIA</p><h2>Últimos movimientos</h2></div><button onClick={() => setActive("Muro")}>Ver todo →</button></div><div className="feed">{posts.slice(0, 2).map((post) => <PostCard post={post} key={post.id} />)}</div></section>
    </section>
    <aside className="right-column"><LeagueCard /><ChallengeMini /><article className="coach-card"><div className="coach-icon">✦</div><div><p className="eyebrow">COACH 4×7</p><h3>Tu semana va equilibrada</h3><p>Una sesión de fuerza de 35 minutos sería un gran cierre.</p></div><button onClick={() => setQuickLogOpen(true)}>→</button></article></aside>
  </div>;

  const LeagueCard = () => <article className="family-card"><div className="card-heading"><div><p className="eyebrow">LIGA FAMILIAR</p><h2>Esta semana</h2></div><span>⌄</span></div><div className="family-total"><span>Puntos en familia</span><strong>{totalPoints.toLocaleString("es-MX")}</strong><small>+740 esta semana</small></div><ol className="leaderboard">{family.map((member, index) => <li key={member.name} className={member.name === "Pedro" ? "you" : ""}><span className="rank">{index + 1}</span><span className={`avatar small ${member.color}`}>{member.initials}</span><span className="member"><b>{member.name}</b><small>{member.trend} pts</small></span><strong>{member.points + (member.name === "Pedro" && logged ? 100 : 0)}</strong></li>)}</ol><button className="text-button" onClick={() => setActive("Liga")}>Ver clasificación completa</button></article>;
  const ChallengeMini = () => <article className="challenge-card"><div className="challenge-art"><span>21</span><small>DÍAS</small></div><p className="eyebrow">RETO ACTIVO</p><h2>Constancia familiar</h2><p>Que todos cumplan su meta semanal durante 3 semanas.</p><div className="challenge-progress"><i /></div><div className="challenge-meta"><span>Semana 2 de 3</span><b>67%</b></div><div className="stacked-avatars"><span className="avatar tiny coral">A</span><span className="avatar tiny mint">P</span><span className="avatar tiny lilac">S</span><span className="avatar tiny sun">M</span><small>4 participantes</small></div></article>;

  const Wall = () => <section className="module-page"><div className="module-toolbar"><div><p>Las evidencias aparecen aquí para que nadie entrene solo.</p></div><label className="upload-button">＋ Subir evidencia<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setEvidenceName(file.name); notify("Evidencia lista para publicar"); } }} /></label></div>{evidenceName && <div className="evidence-ready"><span>✓</span><div><b>{evidenceName}</b><small>Lista para acompañar tu próximo entrenamiento</small></div><button onClick={() => setQuickLogOpen(true)}>Registrar ahora</button></div>}<div className="wall-layout"><div className="feed wall-feed">{posts.map((post) => <PostCard post={post} key={post.id} />)}</div><aside className="wall-side"><article className="family-prompt"><span>🔥</span><p className="eyebrow">RACHA FAMILIAR</p><h3>6 semanas sin soltar el hábito</h3><p>Si todos entrenan antes del domingo, desbloquean +200 puntos.</p></article><ChallengeMini /></aside></div></section>;

  const Progress = () => <section className="module-page"><div className="progress-summary"><article className="progress-hero"><div><p className="eyebrow">PESO ACTUAL</p><strong>82.4 <small>kg</small></strong><span>−2.1 kg desde julio</span></div><div className="trend-chart">{[78, 70, 72, 58, 61, 43, 35, 27].map((height, index) => <i key={index} style={{ height }} className={index === 7 ? "last" : ""} />)}</div><div className="chart-axis"><span>12 JUL</span><span>10 AGO</span></div></article><article className="goal-card"><p className="eyebrow">PROYECCIÓN 4×7</p><h2>7 semanas</h2><p>para acercarte a 78 kg manteniendo tu ritmo actual.</p><div className="goal-line"><i /></div><small>53% del camino</small></article></div>
    <div className="indicator-grid">{[["Cintura", "91.5 cm", "−3.0 cm", "◎"], ["Entrenamientos", logged ? "15" : "14", "+18%", "↗"], ["Racha actual", "6 sem", "Mejor: 9", "🔥"], ["Pasos promedio", "7,240", "+820", "⌁"]].map(([label, value, trend, icon]) => <article className="indicator" key={label}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div><em>{trend}</em></article>)}</div>
    <div className="compare-card"><div className="compare-head"><div><p className="eyebrow">ANTES VS. AHORA</p><h2>El cambio se construye despacio</h2></div><button onClick={() => notify("Comparador listo para añadir fotografías")}>Añadir fotos</button></div><div className="compare-visual"><div><span>12 JUL</span><b>84.5 kg</b></div><div className="compare-arrow">→</div><div><span>10 AGO</span><b>82.4 kg</b></div></div></div></section>;

  const Calendar = () => <section className="module-page calendar-layout"><article className="calendar-card"><div className="calendar-head"><button aria-label="Mes anterior">←</button><div><p className="eyebrow">PLAN MENSUAL</p><h2>Agosto 2026</h2></div><button aria-label="Mes siguiente">→</button></div><div className="weekday-row">{["L", "M", "M", "J", "V", "S", "D"].map((day, i) => <b key={`${day}-${i}`}>{day}</b>)}</div><div className="month-grid">{calendarDays.map((day, index) => day ? <button key={day} onClick={() => toggleSchedule(day)} className={`${[3, 5, 7, 10, 11, 13].includes(day) ? "completed" : ""} ${scheduledDays.includes(day) ? "planned" : ""} ${selectedDay === day ? "selected" : ""}`}><span>{day}</span>{[3, 5, 7, 10, 11, 13].includes(day) && <i>✓</i>}{scheduledDays.includes(day) && <i>•</i>}</button> : <span key={`empty-${index}`} />)}</div><div className="calendar-key"><span><i className="key-done" /> Completado</span><span><i className="key-plan" /> Programado</span></div></article><aside className="agenda"><p className="eyebrow">PRÓXIMOS ENTRENAMIENTOS</p><h2>Tu semana</h2>{scheduledDays.sort((a,b) => a-b).slice(0,4).map((day, index) => <article key={day}><time>{day}<small>AGO</small></time><div><b>{index % 2 ? "Fuerza en casa" : "Caminata al aire libre"}</b><span>{index % 2 ? "35 min · 7:00 p. m." : "40 min · 7:30 a. m."}</span></div><button onClick={() => toggleSchedule(day)}>×</button></article>)}<button className="agenda-add" onClick={() => toggleSchedule(selectedDay === 31 ? 14 : selectedDay + 1)}>＋ Programar otro día</button><div className="calendar-tip"><span>✦</span><p><b>Consejo 4×7</b>Deja un día de descanso entre sesiones de fuerza.</p></div></aside></section>;

  const League = () => <section className="module-page"><div className="league-hero"><div><p className="eyebrow">PUNTOS EN FAMILIA</p><strong>{totalPoints.toLocaleString("es-MX")}</strong><span>+740 esta semana</span></div><div className="podium"><div><span className="avatar mint">P</span><b>Pedro</b><i>2</i></div><div className="winner"><span className="crown">♛</span><span className="avatar coral">A</span><b>Ana</b><i>1</i></div><div><span className="avatar lilac">S</span><b>Sofi</b><i>3</i></div></div></div><div className="league-grid"><article className="ranking-full"><p className="eyebrow">CLASIFICACIÓN SEMANAL</p>{family.map((member, index) => <div key={member.name} className={member.name === "Pedro" ? "you" : ""}><b className="rank">{index + 1}</b><span className={`avatar ${member.color}`}>{member.initials}</span><p><strong>{member.name}{member.name === "Pedro" ? " · Tú" : ""}</strong><small>{member.workouts}/4 entrenamientos</small></p><em>{member.points + (member.name === "Pedro" && logged ? 100 : 0)} pts</em></div>)}</article><article className="villain-card"><span className="villain-emoji">😈</span><p className="eyebrow">VILLANO DE LA SEMANA</p><h2>Mateo</h2><p>Solo lleva 2 de 4. Si no entrena antes del domingo, invita la cena familiar.</p><button onClick={() => notify("Le enviamos un empujoncito a Mateo 😈")}>Mandar empujoncito</button></article></div></section>;

  const challenges = [
    { id: 1, days: "21 días", title: "Constancia familiar", body: "Que todos cumplan 4×7 durante tres semanas.", progress: 67, reward: "+500 pts" },
    { id: 2, days: "7 días", title: "La vuelta al mundo", body: "Sumen 100,000 pasos entre todos esta semana.", progress: 42, reward: "+250 pts" },
    { id: 3, days: "Fin de semana", title: "Sin sillón", body: "Cada integrante debe completar una actividad al aire libre.", progress: 25, reward: "Insignia" },
  ];
  const Challenges = () => <section className="module-page"><div className="challenge-banner"><span>⚑</span><div><p className="eyebrow">MOTIVACIÓN COMPARTIDA</p><h2>Cuando uno afloja, los demás jalan</h2><p>Los retos convierten la constancia en una victoria de toda la familia.</p></div></div><div className="challenge-grid">{challenges.map((challenge) => { const isJoined = joined.includes(challenge.id); return <article className="challenge-full" key={challenge.id}><div className="challenge-full-top"><span>{challenge.days}</span><b>{challenge.reward}</b></div><h2>{challenge.title}</h2><p>{challenge.body}</p><div className="challenge-full-progress"><i style={{ width: `${challenge.progress}%` }} /></div><div className="challenge-full-meta"><span>{challenge.progress}% completado</span><span>{isJoined ? "Participando" : "3 participantes"}</span></div><button className={isJoined ? "joined" : ""} onClick={() => toggleChallenge(challenge.id)}>{isJoined ? "✓ Ya estás dentro" : "Unirme al reto"}</button></article>; })}</div></section>;

  const page = active === "Inicio" ? <Dashboard /> : active === "Muro" ? <Wall /> : active === "Progreso" ? <Progress /> : active === "Calendario" ? <Calendar /> : active === "Liga" ? <League /> : <Challenges />;

  return <main className="app-shell">
    <aside className="sidebar" aria-label="Navegación principal"><div className="brand"><span className="brand-mark">4×7</span><span className="brand-dot" /></div><nav className="side-nav">{navItems.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActive(item)}><Glyph label={item} /><span>{item}</span></button>)}</nav><div className="family-pulse"><div className="pulse-top"><span>ADN familiar</span><b>86%</b></div><div className="pulse-bar"><i /></div><p>Todos están en movimiento esta semana.</p></div><button className="profile-card"><span className="avatar mint">P</span><span><b>Pedro</b><small>Mi perfil</small></span><span className="more">•••</span></button></aside>
    <section className="workspace"><header className="topbar"><div><p className="eyebrow">{titleCopy[active][0]}</p><h1>{titleCopy[active][1]}</h1></div><div className="top-actions"><button className="icon-button" onClick={() => notify("No tienes avisos pendientes")}><span className="notification-dot" />♢</button><button className="primary-button" onClick={() => setQuickLogOpen(true)}><span>＋</span> Registrar entrenamiento</button></div></header>{page}</section>
    <nav className="mobile-nav">{navItems.slice(0, 5).map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><Glyph label={item} /><small>{item}</small></button>)}</nav>
    {quickLogOpen && <div className="modal-backdrop" onMouseDown={() => setQuickLogOpen(false)}><section className="quick-log" role="dialog" onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={() => setQuickLogOpen(false)}>×</button><p className="eyebrow">REGISTRO RÁPIDO</p><h2>¿Qué entrenaste hoy?</h2><p>Tu cuarto día está a un registro de distancia.</p><div className="workout-options">{[["Fuerza", "↗", "35 min"], ["Cardio", "⌁", "30 min"], ["Movilidad", "◌", "20 min"]].map(([name, icon, time]) => <button key={name} className={workout === name ? "selected" : ""} onClick={() => setWorkout(name)}><span>{icon}</span><b>{name}</b><small>{time}</small></button>)}</div><label className="note-field">Nota opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="¿Cómo te sentiste?" /></label><button className="primary-button full" onClick={saveWorkout}>Guardar entrenamiento · +100 pts</button></section></div>}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </main>;
}
