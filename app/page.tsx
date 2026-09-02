"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthScreen } from "./components/AuthScreen";
import { ProfileOnboarding } from "./components/ProfileOnboarding";
import { clientApi, type FeedPost, type ProfileResponse, type Session } from "./lib/client-api";

const navItems = ["Hoy", "Muro", "Liga y Retos", "Mis Récords", "Progreso"] as const;
type Section = typeof navItems[number];

interface CustomChallenge {
  id: number;
  creator: string;
  targets: string[];
  title: string;
  desc: string;
  rewardPoints: number;
  bet?: string;
  completedBy: string[];
  acceptedBy: string[];
  createdAt: string;
}

const familyMembersList = [
  { name: "Pedcaz", initials: "P", color: "mint" },
  { name: "Baby", initials: "B", color: "sun" },
  { name: "Mabel", initials: "M", color: "coral" },
  { name: "Wero LM", initials: "W", color: "lilac" },
  { name: "Lucy", initials: "L", color: "coral" },
  { name: "CristinaFit", initials: "C", color: "mint" },
  { name: "JuuGlez", initials: "J", color: "sun" },
  { name: "Ivanovich", initials: "I", color: "mint" },
  { name: "EstefanyLM", initials: "E", color: "coral" },
  { name: "Ely", initials: "E", color: "lilac" },
  { name: "Emanuelle", initials: "E", color: "sun" },
  { name: "Virinovich", initials: "V", color: "coral" },
];

const week = [
  { day: "L", label: "Lun", date: "10", state: "done" },
  { day: "M", label: "Mar", date: "11", state: "done" },
  { day: "M", label: "Mié", date: "12", state: "rest" },
  { day: "J", label: "Jue", date: "13", state: "done" },
  { day: "V", label: "Vie", date: "14", state: "next" },
  { day: "S", label: "Sáb", date: "15", state: "empty" },
  { day: "D", label: "Dom", date: "16", state: "empty" },
];

const titleCopy: Record<Section, [string, string]> = {
  Hoy: ["SEMANA ACTUAL · LUNES A DOMINGO", "Buenas tardes"],
  Muro: ["EL MURO DEL SUDOR", "Motivación familiar en vivo"],
  "Liga y Retos": ["COMPETENCIA CON CARIÑO", "Liga y Retos Familiares"],
  "Mis Récords": ["CARGAS MÁXIMAS (LBS)", "Vitrina de Récords Personales (PRs)"],
  Progreso: ["TU EVOLUCIÓN", "Seguimiento de peso y hábitos"],
};

const activityOptions = [
  { name: "Fuerza", icon: "💪", time: 35, cal: 190 },
  { name: "Cardio", icon: "🏃", time: 30, cal: 240 },
  { name: "Caminata", icon: "🚶", time: 30, cal: 120 },
  { name: "Movilidad", icon: "🧘", time: 20, cal: 90 },
  { name: "Deporte", icon: "⚽", time: 45, cal: 280 },
];

function Glyph({ label }: { label: string }) {
  if (label === "Hoy") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    );
  }
  if (label === "Muro") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
      </svg>
    );
  }
  if (label === "Liga y Retos") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    );
  }
  if (label === "Mis Récords") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h20"/><path d="M6 8v8"/><path d="M4 9v6"/><path d="M18 8v8"/><path d="M20 9v6"/>
      </svg>
    );
  }
  if (label === "Progreso") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    );
  }
  return <span aria-hidden="true">•</span>;
}

// Progressive points reward per day completed in the week
function getWorkoutReward(dayNumber: number) {
  if (dayNumber <= 3) {
    return { points: 100, label: "+100 PTS", detail: "Check-in normal" };
  }
  if (dayNumber === 4) {
    return { points: 300, label: "+300 PTS", detail: "+100 Check-in + 200 Bono Meta Obligatoria" };
  }
  if (dayNumber === 5) {
    return { points: 250, label: "+250 PTS", detail: "+100 Check-in + 150 Bono Modo Bestia" };
  }
  if (dayNumber === 6) {
    return { points: 350, label: "+350 PTS", detail: "+100 Check-in + 250 Bono Nivel Leyenda" };
  }
  return { points: 500, label: "+500 PTS", detail: "+100 Check-in + 400 Bono Semana Perfecta (7 de 7)" };
}

function getWeeklyEncouragement(count: number, firstName: string) {
  if (count <= 0) {
    return {
      title: `¡Arrancamos la semana, ${firstName}!`,
      badge: "0 DE 4 DÍAS",
      sub: "Tienes 4 entrenamientos obligatorios de lunes a domingo. ¡Hoy es el día ideal para sumar el primero!",
      icon: "⚡",
      colorClass: "badge-gray",
    };
  }
  if (count === 1) {
    return {
      title: `¡Primer día de la semana cumplido, ${firstName}! 💪`,
      badge: "1 DE 4 DÍAS",
      sub: "¡Excelente inicio! Te faltan 3 días obligatorios de ejercicio esta semana (lunes a domingo) para cumplir la meta.",
      icon: "💪",
      colorClass: "badge-mint",
    };
  }
  if (count === 2) {
    return {
      title: `¡A mitad del camino, ${firstName}! 🔥`,
      badge: "2 DE 4 DÍAS",
      sub: "Llevas 2 de 4 días obligatorios de la semana. Te faltan 2 entrenamientos más antes del domingo para asegurar tu racha.",
      icon: "🔥",
      colorClass: "badge-mint",
    };
  }
  if (count === 3) {
    return {
      title: `¡A un solo día de la meta, ${firstName}! ⚡`,
      badge: "3 DE 4 DÍAS",
      sub: "¡Llevas 3 entrenamientos! Solo te falta 1 día de los 4 obligatorios esta semana para cumplir tu 4×7.",
      icon: "⚡",
      colorClass: "badge-sun",
    };
  }
  if (count === 4) {
    return {
      title: `🎉 ¡META SEMANAL CUMPLIDA, ${firstName}! 4 de 4 asegurados`,
      badge: "4 DE 4 · ¡META CUMPLIDA!",
      sub: "¡Misión cumplida! Completaste los 4 entrenamientos obligatorios de la semana (lunes a domingo). ¡Mantuviste la racha familiar viva!",
      icon: "🎉",
      colorClass: "badge-green",
    };
  }
  if (count === 5) {
    return {
      title: `🚀 ¡Modo Bestia activado, ${firstName}! Quinto día de la semana`,
      badge: "5 DE 4 · ¡EXTRA POWER (+250 PTS)!",
      sub: "¡Superaste los 4 obligatorios! Este quinto entrenamiento sumó +250 puntos extra y demuestra pura disciplina familiar.",
      icon: "🚀",
      colorClass: "badge-fire",
    };
  }
  if (count === 6) {
    return {
      title: `👑 ¡Nivel Leyenda, ${firstName}! Sexto día completado`,
      badge: "6 DE 4 · ¡DISCIPLINA DE ÉLITE (+350 PTS)!",
      sub: "¡6 de 7 días entrenados! Sumaste +350 puntos extra. Estás imparable esta semana, tu familia no te va a poder alcanzar.",
      icon: "👑",
      colorClass: "badge-fire",
    };
  }
  return {
    title: `🏆 ¡PERFECTO 7 DE 7, ${firstName}! SEMANA PERFECTA`,
    badge: "7 DE 7 · ¡PERFECCIÓN ABSOLUTA (+500 PTS)!",
    sub: "¡Entrenaste los 7 días de lunes a domingo y sumaste el bono máximo de +500 puntos! Eres la mayor inspiración para toda la familia. 👏🔥",
    icon: "🏆",
    colorClass: "badge-gold",
  };
}

const START_DATE_OPTIONS = [
  { value: "2026-09-01", day: 1, label: "1 de Septiembre (Martes · Arranque de mes 🗓️)" },
  { value: "2026-09-02", day: 2, label: "2 de Septiembre (Miércoles)" },
  { value: "2026-09-03", day: 3, label: "3 de Septiembre (Jueves)" },
  { value: "2026-09-04", day: 4, label: "4 de Septiembre (Viernes)" },
  { value: "2026-09-05", day: 5, label: "5 de Septiembre (Sábado)" },
  { value: "2026-09-06", day: 6, label: "6 de Septiembre (Domingo)" },
  { value: "2026-09-07", day: 7, label: "7 de Septiembre (Lunes · Recomendado semana completa 🚀)" },
  { value: "2026-09-08", day: 8, label: "8 de Septiembre (Martes)" },
  { value: "2026-09-09", day: 9, label: "9 de Septiembre (Miércoles)" },
  { value: "2026-09-10", day: 10, label: "10 de Septiembre (Jueves)" },
  { value: "2026-09-11", day: 11, label: "11 de Septiembre (Viernes)" },
  { value: "2026-09-12", day: 12, label: "12 de Septiembre (Sábado)" },
  { value: "2026-09-13", day: 13, label: "13 de Septiembre (Domingo)" },
  { value: "2026-09-14", day: 14, label: "14 de Septiembre (Lunes · Semana 3 ⚡)" },
  { value: "2026-09-15", day: 15, label: "15 de Septiembre (Martes · Fecha límite de arranque 🇲🇽)" },
];

const INITIAL_FAMILY_FEED: FeedPost[] = [];

function getStoredProfile(userName?: string): ProfileResponse | null {
  if (typeof window === "undefined") return null;
  const keys = [
    userName ? `four_seven_profile_${userName}` : "",
    userName ? `four_seven_profile_${userName.split(" ")[0]}` : "",
    "four_seven_profile_Pedro Humberto González López",
    "four_seven_profile_Pedcaz",
    "four_seven_profile_Pedro",
    "four_seven_profile_Judith González López",
    "four_seven_profile_JuuGlez",
    "four_seven_profile_Judith",
    "four_seven_saved_profile",
  ].filter(Boolean);

  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profile) return parsed;
      }
    } catch {}
  }

  // Fallback so official Pedro or Judith NEVER gets blocked by onboarding on a new browser/computer:
  const lower = (userName || "").toLowerCase();

  if (lower.includes("judith") || lower.includes("juuglez") || lower.includes("ale")) {
    return {
      profile: {
        objective: "lose_fat",
        birthDate: "1994-08-20",
        sex: "female",
        heightCm: 165,
        targetWeightKg: 60,
        weeklyGoal: 4,
        preferredActivity: "",
        challengeStartDate: "2026-09-01",
        measurement: { weightKg: 65, recordedAt: new Date().toISOString() },
      },
      measurements: [{ weightKg: 65, recordedAt: new Date().toISOString() }],
      projection: {
        weeks: 12,
        targetWeightKg: 60,
        currentWeightKg: 65,
        targetDate: "2026-11-20",
        weeklyLossKg: 0.4,
        totalLossKg: 5,
      } as any,
    };
  }

  return null;
}

function MainApp() {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("four_seven_active_session");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [sessionLoading, setSessionLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("four_seven_active_session");
    }
    return true;
  });
  const [fitness, setFitness] = useState<ProfileResponse | null>(() => {
    return getStoredProfile();
  });
  const [profileLoading, setProfileLoading] = useState(() => {
    return !getStoredProfile();
  });
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(INITIAL_FAMILY_FEED);
  const [feedLoading, setFeedLoading] = useState(false);
  const [active, setActive] = useState<Section>("Hoy");
  const [commentOpen, setCommentOpen] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentsByPost, setCommentsByPost] = useState<Record<number, any[]>>({});
  const [familyStats, setFamilyStats] = useState<Record<string, any>>({});
  const [familyProfiles, setFamilyProfiles] = useState<Record<string, any>>({});

  // Guadalajara (GDL / America/Mexico_City) Date & Real Week Helper
  const getGdlDateInfo = useCallback(() => {
    const now = new Date();

    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();
    let currentTimeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    let fullDateStr = "Hoy";

    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).formatToParts(now);

      year = parseInt(parts.find((p) => p.type === "year")?.value || String(now.getFullYear()), 10);
      month = parseInt(parts.find((p) => p.type === "month")?.value || String(now.getMonth() + 1), 10) - 1;
      day = parseInt(parts.find((p) => p.type === "day")?.value || String(now.getDate()), 10);

      currentTimeStr = new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now);

      const rawFull = new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now);
      fullDateStr = rawFull.charAt(0).toUpperCase() + rawFull.slice(1);
    } catch {
      fullDateStr = `${day} de Septiembre de ${year}`;
    }

    const gdlDate = new Date(year, month, day);
    const dayOfWeek = gdlDate.getDay(); // 0 is Sunday, 1 is Monday...

    // Monday of current week
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const mondayDate = new Date(year, month, day - distanceToMonday);

    const dayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const dayKeys = ["L", "M", "M", "J", "V", "S", "D"];

    const currentWeekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayNum = d.getDate();
      const isToday = d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
      const isPast = d < gdlDate;
      const isFuture = d > gdlDate;

      return {
        dayKey: dayKeys[i],
        label: dayLabels[i],
        dayNumber: String(dayNum),
        dateKey,
        isToday,
        isPast,
        isFuture,
      };
    });

    const todayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return {
      todayKey,
      currentTimeStr,
      fullDateStr,
      currentWeekDays,
      gdlDate,
    };
  }, []);

  const [completedCheckInDates, setCompletedCheckInDates] = useState<string[]>([]);
  const [logged, setLogged] = useState<boolean>(false);
  const [weeklyWorkoutsCount, setWeeklyWorkoutsCount] = useState<number>(0);
  const [userBonusPoints, setUserBonusPoints] = useState<number>(0);
  const [toast, setToast] = useState("");
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showNewChallengeModal, setShowNewChallengeModal] = useState(false);

  // Check-In Form State
  const [selectedActivity, setSelectedActivity] = useState("Fuerza");
  const [checkInNote, setCheckInNote] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [showAdditionalCheckIn, setShowAdditionalCheckIn] = useState(false);
  const [editingActivityMember, setEditingActivityMember] = useState<{ name: string; currentActivity: string } | null>(null);

  const ALL_DISCIPLINES = [
    { id: "gimnasio", name: "Gimnasio / Pesas 🏋️‍♂️" },
    { id: "jumping", name: "Jumping Fitness 🦘" },
    { id: "zumba", name: "Zumba / Baile 💃" },
    { id: "correr", name: "Correr / Running 🏃" },
    { id: "caminata", name: "Caminata / Senderismo 🚶" },
    { id: "funcional", name: "Funcional / HIIT ⚡" },
    { id: "bici", name: "Bicicleta / Spinning 🚴" },
    { id: "natacion", name: "Natación 🏊" },
    { id: "box", name: "Boxeo / Artes Marciales 🥊" },
    { id: "yoga", name: "Yoga / Pilates 🧘" },
  ];

  const handleUpdateMemberActivity = async (memberName: string, newActivity: string) => {
    const isMe =
      (session?.user?.name || "").toLowerCase().includes(memberName.toLowerCase()) ||
      memberName.toLowerCase().includes((session?.user?.name || "").toLowerCase());

    if (isMe) {
      setFitness((prev: any) => {
        if (!prev?.profile) return prev;
        const updated = {
          ...prev,
          profile: {
            ...prev.profile,
            preferredActivity: newActivity,
          },
        };
        try {
          if (session?.user?.name) {
            localStorage.setItem(`four_seven_profile_${session.user.name}`, JSON.stringify(updated));
          }
          localStorage.setItem("four_seven_saved_profile", JSON.stringify(updated));
        } catch {}
        return updated;
      });
      try {
        await clientApi.saveProfile({ preferredActivity: newActivity });
      } catch {}
    }

    const key = memberName.toLowerCase();
    setFamilyProfiles((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), preferredActivity: newActivity },
    }));
    setFamilyStats((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), activity: newActivity },
    }));

    setEditingActivityMember(null);
    notify(`Disciplina de ${memberName} actualizada a: ${newActivity} ✨`);
    await loadFeed(true);
  };

  // New Custom Challenge Form State
  const [newChallengeTitle, setNewChallengeTitle] = useState("");
  const [newChallengeDesc, setNewChallengeDesc] = useState("");
  const [newChallengeTargets, setNewChallengeTargets] = useState<string[]>(["Toda la Familia"]);
  const [newChallengeReward, setNewChallengeReward] = useState(300);
  const [newChallengeBet, setNewChallengeBet] = useState("Unos tacos o cena 🌮");

  // Custom Family Challenges State (Optional peer-to-peer challenges)
  const [customChallenges, setCustomChallenges] = useState<CustomChallenge[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("4x7_custom_challenges");
        if (saved) {
          const parsed = JSON.parse(saved);
          const isMock = Array.isArray(parsed) && parsed.some((c: any) => c.creator === "Ana" || c.id === 101 || c.id === 102);
          if (!isMock) return parsed;
          localStorage.removeItem("4x7_custom_challenges");
        }
      } catch {}
    }
    return [];
  });

  // Personal Records (PRs in LBS) State & Catalog
  const gymEquipmentCatalog = [
    // Pecho
    { id: "bench_flat", name: "Press de Banca Plano", category: "Pecho" as const, icon: "🏋️‍♂️", defaultLbs: 0, imageUrl: "/images/machines/bench_flat.jpg" },
    { id: "bench_incline", name: "Press Inclinado", category: "Pecho" as const, icon: "📐", defaultLbs: 0, imageUrl: "/images/machines/bench_incline.jpg" },
    { id: "bench_decline", name: "Press Declinado", category: "Pecho" as const, icon: "📉", defaultLbs: 0, imageUrl: "/images/machines/bench_decline.jpg" },
    { id: "pec_deck", name: "Pec Deck / Contractora", category: "Pecho" as const, icon: "🦋", defaultLbs: 0, imageUrl: "/images/machines/pec_deck.jpg" },
    { id: "cable_crossover", name: "Poleas Cruzadas (Crossover)", category: "Pecho" as const, icon: "🔀", defaultLbs: 0, imageUrl: "/images/machines/cable_crossover.jpg" },

    // Pierna
    { id: "leg_press", name: "Prensa de Piernas 45°", category: "Pierna" as const, icon: "📐", defaultLbs: 0, imageUrl: "/images/machines/leg_press.jpg" },
    { id: "squat_free", name: "Sentadilla Libre con Barra", category: "Pierna" as const, icon: "🦵", defaultLbs: 0, imageUrl: "/images/machines/squat_free.jpg" },
    { id: "hack_squat", name: "Sentadilla Hack", category: "Pierna" as const, icon: "⚙️", defaultLbs: 0, imageUrl: "/images/machines/hack_squat.jpg" },
    { id: "hip_thrust", name: "Hip Thrust con Barra", category: "Pierna" as const, icon: "🍑", defaultLbs: 0, imageUrl: "/images/machines/hip_thrust.jpg" },
    { id: "leg_extension", name: "Extensión de Cuádriceps", category: "Pierna" as const, icon: "🪑", defaultLbs: 0, imageUrl: "/images/machines/leg_extension.jpg" },
    { id: "leg_curl", name: "Curl Femoral (Isquios)", category: "Pierna" as const, icon: "🛌", defaultLbs: 0, imageUrl: "/images/machines/leg_curl.jpg" },
    { id: "calf_raise", name: "Máquina de Pantorrilla", category: "Pierna" as const, icon: "🦶", defaultLbs: 0, imageUrl: "/images/machines/calf_raise.jpg" },

    // Espalda
    { id: "lat_pulldown", name: "Jalón al Pecho (Polea Dorsal)", category: "Espalda" as const, icon: "🧗", defaultLbs: 0, imageUrl: "/images/machines/lat_pulldown.jpg" },
    { id: "seated_row", name: "Remo en Polea Baja (Gironda)", category: "Espalda" as const, icon: "🚣", defaultLbs: 0, imageUrl: "/images/machines/seated_row.jpg" },
    { id: "deadlift", name: "Peso Muerto", category: "Espalda" as const, icon: "⚡", defaultLbs: 0, imageUrl: "/images/machines/deadlift.jpg" },
    { id: "tbar_row", name: "Remo en Barra T", category: "Espalda" as const, icon: "🪵", defaultLbs: 0, imageUrl: "/images/machines/tbar_row.jpg" },

    // Hombros y Brazos
    { id: "shoulder_press_bar", name: "Press Militar con Barra", category: "Hombros y Brazos" as const, icon: "🎖️", defaultLbs: 0, imageUrl: "/images/machines/shoulder_press_bar.jpg" },
    { id: "shoulder_press_db", name: "Press de Hombro con Mancuernas", category: "Hombros y Brazos" as const, icon: "💪", defaultLbs: 0, imageUrl: "/images/machines/shoulder_press_db.jpg" },
    { id: "bicep_curl_bar", name: "Curl de Bíceps Barra EZ", category: "Hombros y Brazos" as const, icon: "🦾", defaultLbs: 0, imageUrl: "/images/machines/bicep_curl_bar.jpg" },
    { id: "tricep_pushdown", name: "Tríceps en Polea", category: "Hombros y Brazos" as const, icon: "⚡", defaultLbs: 0, imageUrl: "/images/machines/tricep_pushdown.jpg" },
    { id: "smith_machine", name: "Máquina Smith (Press/Sentadilla)", category: "Hombros y Brazos" as const, icon: "🏗️", defaultLbs: 0, imageUrl: "/images/machines/smith_machine.jpg" },
  ];

  interface PersonalRecordItem {
    id: string;
    machineId: string;
    machineName: string;
    category: "Pecho" | "Pierna" | "Espalda" | "Hombros y Brazos";
    icon: string;
    imageUrl: string;
    weightLbs: number;
    reps: number;
    date: string;
    previousWeightLbs?: number;
    note?: string;
  }

  const [personalRecords, setPersonalRecords] = useState<PersonalRecordItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("4x7_personal_records");
        if (saved) {
          const parsed = JSON.parse(saved);
          const isMock = Array.isArray(parsed) && parsed.some((p: any) => p.id === "pr-1" || p.id === "pr-2" || (typeof p.date === "string" && p.date.includes("Ago")));
          if (!isMock) {
            return parsed.map((p: any) => ({
              ...p,
              imageUrl: p.imageUrl || gymEquipmentCatalog.find((e) => e.id === p.machineId)?.imageUrl || "/images/machines/bench_flat.jpg",
            }));
          }
          localStorage.removeItem("4x7_personal_records");
        }
      } catch {}
    }
    return [];
  });

  const [recordsCategoryFilter, setRecordsCategoryFilter] = useState<string>("Todos");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("bench_flat");
  const [recordWeightInput, setRecordWeightInput] = useState<string>("");
  const [recordRepsInput, setRecordRepsInput] = useState<string>("");
  const [recordNoteInput, setRecordNoteInput] = useState<string>("");
  const [recordShareToWall, setRecordShareToWall] = useState<boolean>(true);

  const handleOpenNewRecordModal = (equipmentId?: string) => {
    const targetEq = gymEquipmentCatalog.find((e) => e.id === equipmentId) || gymEquipmentCatalog[0];
    const existingPr = personalRecords.find((p) => p.machineId === targetEq.id);
    setSelectedEquipmentId(targetEq.id);
    setRecordWeightInput(existingPr && existingPr.weightLbs > 0 ? String(existingPr.weightLbs) : "");
    setRecordRepsInput(existingPr && existingPr.reps > 0 ? String(existingPr.reps) : "");
    setRecordNoteInput("");
    setRecordShareToWall(true);
    setShowRecordModal(true);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLbs = parseFloat(recordWeightInput);
    const parsedReps = parseInt(recordRepsInput, 10) || 1;
    if (!parsedLbs || parsedLbs <= 0) {
      notify("Ingresa un peso válido en libras (lbs)");
      return;
    }
    const equipment = gymEquipmentCatalog.find((e) => e.id === selectedEquipmentId) || gymEquipmentCatalog[0];
    const existingIndex = personalRecords.findIndex((r) => r.machineId === equipment.id);
    const prevWeight = existingIndex >= 0 ? personalRecords[existingIndex].weightLbs : undefined;

    const todayStr = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date());

    const updatedRecord: PersonalRecordItem = {
      id: existingIndex >= 0 ? personalRecords[existingIndex].id : `pr-${Date.now()}`,
      machineId: equipment.id,
      machineName: equipment.name,
      category: equipment.category,
      icon: equipment.icon,
      imageUrl: equipment.imageUrl,
      weightLbs: parsedLbs,
      reps: parsedReps,
      date: todayStr,
      previousWeightLbs: prevWeight,
      note: recordNoteInput.trim() || undefined,
    };

    let nextRecords: PersonalRecordItem[];
    if (existingIndex >= 0) {
      nextRecords = [...personalRecords];
      nextRecords[existingIndex] = updatedRecord;
    } else {
      nextRecords = [updatedRecord, ...personalRecords];
    }
    setPersonalRecords(nextRecords);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("4x7_personal_records", JSON.stringify(nextRecords));
      } catch {}
    }

    // Share to family wall if checked
    if (recordShareToWall) {
      const diffText = prevWeight && parsedLbs > prevWeight ? ` (¡Superó su récord anterior de ${prevWeight} lbs! 🔥)` : "";
      const noteSuffix = recordNoteInput.trim() ? `\n"${recordNoteInput.trim()}"` : "";
      const prPost: FeedPost = {
        id: Date.now(),
        userId: session?.user.id || 1,
        userName: session?.user.name.split(" ")[0] || "Pedro",
        caption: `🏋️‍♂️ ¡NUEVO RÉCORD PERSONAL ROTO! 🏆\nAcabo de cargar ${parsedLbs} LBS (${parsedReps} reps) en ${equipment.name}${diffText}.${noteSuffix}\n¡A seguir sumando fuerza en familia! 🔥💪`,
        evidenceUrl: equipment.imageUrl,
        createdAt: new Date().toISOString(),
        activityType: "Récord Personal 🏆",
        durationSeconds: null,
        distanceMeters: null,
        steps: null,
        calories: null,
        likes: 1,
        comments: 0,
        likedByMe: true,
      };
      setFeedPosts((prev) => [prPost, ...prev]);
    }

    setShowRecordModal(false);
    notify(`🏆 ¡Récord guardado: ${equipment.name} con ${parsedLbs} lbs! ${recordShareToWall ? "Publicado en el Muro Familiar 🎉" : ""}`);
  };

  const handleShareRecordDirect = (record: PersonalRecordItem) => {
    const prPost: FeedPost = {
      id: Date.now(),
      userId: session?.user.id || 1,
      userName: session?.user.name.split(" ")[0] || "Pedro",
      caption: `🏋️‍♂️ ¡MI RÉCORD PERSONAL EN ${record.machineName.toUpperCase()}! 🏆\nMarca actual: ${record.weightLbs} LBS (${record.reps} reps).\n¡Compartiendo buena vibra y motivación para toda la familia! 🔥💪`,
      evidenceUrl: record.imageUrl,
      createdAt: new Date().toISOString(),
      activityType: "Récord Personal 🏆",
      durationSeconds: null,
      distanceMeters: null,
      steps: null,
      calories: null,
      likes: 1,
      comments: 0,
      likedByMe: true,
    };
    setFeedPosts((prev) => [prPost, ...prev]);
    notify(`📣 ¡Récord de ${record.machineName} (${record.weightLbs} lbs) compartido en el Muro Familiar!`);
  };

  // Monthly Raffle Prize State
  const [monthlyPrize, setMonthlyPrize] = useState({
    title: "Smartwatch Deportivo Garmin / Apple Watch SE ⌚",
    description: "Cumple mínimo tus 4 check-ins por semana en Septiembre y participa en la rifa familiar del mes.",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
    month: "Septiembre 2026",
    minWeeklyCheckIns: 4,
  });

  // Admin & Security PIN State
  const [inAdminView, setInAdminView] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [adminTab, setAdminTab] = useState<"prize" | "users" | "family">("prize");
  const [adminUsers, setAdminUsers] = useState<Array<{ id: number; name: string; email: string; createdAt: string; workoutCount: number; eligibleForPrize: boolean }>>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [prizeTitleEdit, setPrizeTitleEdit] = useState(monthlyPrize.title);
  const [prizeDescEdit, setPrizeDescEdit] = useState(monthlyPrize.description);
  const [prizeImgEdit, setPrizeImgEdit] = useState(monthlyPrize.imageUrl);
  const [prizeMonthEdit, setPrizeMonthEdit] = useState(monthlyPrize.month);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<{ id: number; name: string } | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [logoClickCount, setLogoClickCount] = useState(0);

  const handleLogoClick = () => {
    const nextCount = logoClickCount + 1;
    if (nextCount >= 3) {
      setLogoClickCount(0);
      setAdminPinInput("");
      setPinError("");
      setShowPinModal(true);
      notify("🔒 Acceso de Administrador");
    } else {
      setLogoClickCount(nextCount);
      if (nextCount === 2) {
        notify("Toca 1 vez más el logo para entrar al modo Admin 🔒");
      }
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === "clear") {
      setAdminPinInput("");
      setPinError("");
      return;
    }
    if (val === "backspace") {
      setAdminPinInput((prev) => prev.slice(0, -1));
      setPinError("");
      return;
    }
    if (adminPinInput.length < 6) {
      const nextPin = adminPinInput + val;
      setAdminPinInput(nextPin);
      setPinError("");
      if (nextPin.length === 6) {
        if (nextPin === "123456") {
          setShowPinModal(false);
          setInAdminView(true);
          notify("👑 Modo Administrador desbloqueado");
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setPinError("PIN incorrecto. Intenta con 123456");
        }
      }
    }
  };

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (adminPinInput !== "123456") {
      setPinError("PIN incorrecto. El PIN predeterminado es 123456.");
      return;
    }
    setPinError("");
    setShowPinModal(false);
    setInAdminView(true);
    setAdminLoading(true);
    notify("👑 Modo Administrador desbloqueado");
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = await clientApi.adminListUsers(adminPinInput);
      if (res.users?.length) setAdminUsers(res.users);
      if (res.prize) setMonthlyPrize({ minWeeklyCheckIns: 4, ...res.prize });
    } catch {
      // Keep state if offline
    } finally {
      setAdminLoading(false);
    }
  };

  const handlePrizePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPrizeImgEdit(url);
      notify("Foto cuadrada del premio seleccionada 📸");
    }
  };

  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      title: prizeTitleEdit,
      description: prizeDescEdit,
      imageUrl: prizeImgEdit,
      month: prizeMonthEdit,
      minWeeklyCheckIns: 4,
    };
    setMonthlyPrize(updated);
    try {
      await clientApi.adminSavePrize("123456", updated);
      notify("🎁 ¡Premio del mes guardado para toda la familia!");
    } catch {
      notify("🎁 Premio del mes actualizado localmente.");
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || newPasswordVal.length < 6) {
      notify("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    try {
      await clientApi.adminResetPassword("123456", selectedUserForPassword.id, newPasswordVal);
      notify(`🔑 Contraseña de ${selectedUserForPassword.name} restablecida a: ${newPasswordVal}`);
      setSelectedUserForPassword(null);
      setNewPasswordVal("");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Error al restablecer contraseña");
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la cuenta de ${userName}?`)) return;
    try {
      await clientApi.adminDeleteUser("123456", userId);
      setAdminUsers((prev) => prev.filter((u) => u.id !== userId));
      notify(`🗑️ Usuario ${userName} eliminado.`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Error al eliminar usuario");
    }
  };

  const handleClearTestData = async () => {
    if (!window.confirm("¿Seguro que deseas limpiar todas las publicaciones y entrenamientos de prueba para arrancar la operación limpia en ceros?")) {
      return;
    }
    try {
      const res = await fetch("/api/mobile/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: adminPinInput || "123456",
          action: "clear_test_data",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo limpiar.");

      // Clear localStorage check-in states, personal records and custom challenges
      if (typeof window !== "undefined") {
        try {
          const keys = Object.keys(localStorage);
          keys.forEach((k) => {
            if (
              k.startsWith("4x7_user_") ||
              k.startsWith("4x7_last_checkin") ||
              k.startsWith("4x7_completed_checkin") ||
              k === "4x7_personal_records" ||
              k === "4x7_custom_challenges" ||
              k === "4x7_weight_history"
            ) {
              localStorage.removeItem(k);
            }
          });
        } catch {}
      }

      setLogged(false);
      setWeeklyWorkoutsCount(0);
      setCompletedCheckInDates([]);
      setFeedPosts([]);
      setPersonalRecords([]);
      setCustomChallenges([]);
      notify(data.message || "¡App limpia en ceros para operación oficial!");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error al limpiar datos.");
    }
  };

  // Challenge Start Date State (September 1-15, 2026)
  const [challengeStartDate, setChallengeStartDate] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("four_seven_challenge_start_date") || "2026-09-01";
      } catch {}
    }
    return "2026-09-01";
  });

  const startDayNumber = useMemo(() => {
    const parts = challengeStartDate.split("-");
    const num = parseInt(parts[2], 10);
    return isNaN(num) || num < 1 || num > 15 ? 1 : num;
  }, [challengeStartDate]);

  const daysUntilStart = useMemo(() => {
    const today = new Date();
    // September 2026 (month 8 in 0-indexed Date constructor)
    const target = new Date(2026, 8, startDayNumber, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [startDayNumber]);



  // Family check-in tracking state & cheering
  const [cheeredMembers, setCheeredMembers] = useState<Record<string, boolean>>({});
  const [familyTabFilter, setFamilyTabFilter] = useState<"all" | "completed" | "progress" | "pending">("all");

  // Family WhatsApp phone numbers & direct motivation
  const [familyPhones, setFamilyPhones] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("4x7_family_phones");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      Pedro: "523324077845",
      Ian: "523312804849",
      Belén: "52333871243",
      Edgar: "523310838858",
      Lucy: "523316089229",
      Cristina: "523331586066",
      Judith: "523327479701",
      Ivan: "522326621281",
      Estefany: "523324265455",
      Ely: "523333541315",
      Emmanuel: "523331087798",
      Viridiana: "523322729289",
      // Also nicknames
      Pedcaz: "523324077845",
      Baby: "523312804849",
      Mabel: "52333871243",
      "Wero LM": "523310838858",
      CristinaFit: "523331586066",
      JuuGlez: "523327479701",
      Ivanovich: "522326621281",
      EstefanyLM: "523324265455",
      Emanuelle: "523331087798",
      Virinovich: "523322729289",
    };
  });
  const [phoneEditMember, setPhoneEditMember] = useState<{ name: string; phone: string } | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState("");

  const currentUserName = session?.user?.name || "Pedro";

  const familyCheckInData = useMemo(() => {
    const rawMembers = [
      { name: "Pedro", fullName: "Pedro Humberto González López", nickname: "Pedcaz", relation: "Papá / Admin", initials: "P", color: "mint", phone: "523324077845" },
      { name: "Ian", fullName: "Ian González Torres", nickname: "Baby", relation: "", initials: "I", color: "sun", phone: "523312804849" },
      { name: "Belén", fullName: "María Belén Chávez López", nickname: "Mabel", relation: "", initials: "B", color: "coral", phone: "52333871243" },
      { name: "Edgar", fullName: "Edgar Josué López Melchor", nickname: "Wero LM", relation: "", initials: "E", color: "lilac", phone: "523310838858" },
      { name: "Lucy", fullName: "Luz María Ramírez Hernández", nickname: "Lucy", relation: "", initials: "L", color: "coral", phone: "523316089229" },
      { name: "Cristina", fullName: "Cristina Díaz González", nickname: "CristinaFit", relation: "", initials: "C", color: "mint", phone: "523331586066" },
      { name: "Judith", fullName: "Judith González López", nickname: "JuuGlez", relation: "", initials: "J", color: "sun", phone: "523327479701" },
      { name: "Ivan", fullName: "Ivan Chávez López", nickname: "Ivanovich", relation: "", initials: "I", color: "mint", phone: "522326621281" },
      { name: "Estefany", fullName: "Estefany López Melchor", nickname: "EstefanyLM", relation: "", initials: "E", color: "coral", phone: "523324265455" },
      { name: "Ely", fullName: "Elizabeth López Álvarez", nickname: "Ely", relation: "", initials: "E", color: "lilac", phone: "523333541315" },
      { name: "Emmanuel", fullName: "Emmanuel López Álvarez", nickname: "Emanuelle", relation: "", initials: "E", color: "sun", phone: "523331087798" },
      { name: "Viridiana", fullName: "Viridiana Contreras", nickname: "Virinovich", relation: "", initials: "V", color: "coral", phone: "523322729289" },
    ];

    const gdl = getGdlDateInfo();

    return rawMembers.map((m) => {
      const isCurrentUser =
        currentUserName.toLowerCase().includes(m.name.toLowerCase()) ||
        m.fullName.toLowerCase().includes(currentUserName.toLowerCase()) ||
        currentUserName.toLowerCase().includes(m.nickname.toLowerCase());

      // Find real posts from this member this week
      const memberWeekPosts = feedPosts.filter((p) => {
        if (!p.createdAt) return false;
        const pName = (p.userName || "").trim().toLowerCase();
        const matches =
          pName.includes(m.name.toLowerCase()) ||
          pName.includes(m.nickname.toLowerCase()) ||
          m.fullName.toLowerCase().includes(pName);
        if (!matches) return false;
        const postDate = new Date(p.createdAt);
        const pKey = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, "0")}-${String(postDate.getDate()).padStart(2, "0")}`;
        return gdl.currentWeekDays.some((d) => d.dateKey === pKey);
      });

      // 1. Check shared stats from server for this member!
      const serverStat =
        familyStats[m.nickname.toLowerCase()] ||
        familyStats[m.name.toLowerCase()] ||
        familyStats[m.fullName.toLowerCase()] ||
        familyStats[m.phone];

      const statWorkouts = serverStat?.workouts || 0;
      const statDates: string[] = serverStat?.completedDates || [];

      const memberUniqueDates = Array.from(
        new Set([
          ...memberWeekPosts.map((p) => {
            const postDate = new Date(p.createdAt!);
            return `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, "0")}-${String(postDate.getDate()).padStart(2, "0")}`;
          }),
          ...statDates,
        ])
      );

      const currentWorkouts = isCurrentUser
        ? Math.max(memberUniqueDates.length, completedCheckInDates.length, statWorkouts)
        : Math.max(memberUniqueDates.length, statWorkouts);
      const isDone = currentWorkouts >= 4;
      const points = (currentWorkouts * 100) + (isDone ? 300 : 0) + (isCurrentUser ? userBonusPoints : 0);

      const hasRecentPost = memberWeekPosts.length > 0 || statWorkouts > 0;
      const lastCheckIn = isCurrentUser
        ? (logged ? "Hoy (Reciente)" : "Pendiente hoy")
        : (hasRecentPost ? "Hoy (Completado)" : "Sin check-in aún");

      // Determine real selected activity without inventing fake data
      let realActivity = "";
      if (isCurrentUser) {
        const preferred = (fitness?.profile as any)?.preferredActivity;
        if (preferred && typeof preferred === "string" && preferred.trim()) {
          realActivity = preferred.trim();
        } else if (memberWeekPosts.length > 0 && memberWeekPosts[0].activityType) {
          realActivity = memberWeekPosts[0].activityType;
        }
      }

      if (!realActivity) {
        // 1. Check familyProfiles synced from server
        const serverProf =
          familyProfiles[m.nickname.toLowerCase()] ||
          familyProfiles[m.name.toLowerCase()] ||
          familyProfiles[m.fullName.toLowerCase()] ||
          familyProfiles[m.phone];
        if (serverProf?.preferredActivity) {
          realActivity = serverProf.preferredActivity;
        }
      }

      if (!realActivity) {
        // 2. Check cached profile in localStorage
        try {
          const cached =
            localStorage.getItem(`four_seven_profile_${m.fullName}`) ||
            localStorage.getItem(`four_seven_profile_${m.nickname}`) ||
            localStorage.getItem(`four_seven_profile_${m.name}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.profile?.preferredActivity) {
              realActivity = parsed.profile.preferredActivity;
            }
          }
        } catch {}
      }

      if (!realActivity && memberWeekPosts.length > 0 && memberWeekPosts[0].activityType) {
        realActivity = memberWeekPosts[0].activityType;
      }

      return {
        ...m,
        activity: realActivity,
        workouts: currentWorkouts,
        lastCheckIn,
        points,
        completedDays: Array.from({ length: 4 }, (_, i) => i < currentWorkouts),
        status: currentWorkouts >= 4 ? "completed" : currentWorkouts >= 2 ? "progress" : "pending",
      };
    });
  }, [currentUserName, logged, weeklyWorkoutsCount, completedCheckInDates, userBonusPoints, feedPosts, fitness, familyProfiles, familyStats, getGdlDateInfo]);

  // Family dynamic points calculation
  const familyScores = useMemo(() => {
    return familyCheckInData
      .map((m) => ({
        name: m.nickname || m.name,
        rawName: m.name,
        points: m.points,
        initials: (m.nickname || m.name).charAt(0).toUpperCase(),
        color: m.color,
        trend: m.workouts >= 4 ? "+140" : m.workouts === 3 ? "+80" : "+40",
        workouts: m.workouts,
        totalMonthWorkouts: m.workouts + 12,
      }))
      .sort((a, b) => b.points - a.points);
  }, [familyCheckInData]);

  const totalPoints = useMemo(
    () => familyScores.reduce((sum, member) => sum + member.points, 0),
    [familyScores]
  );

  const handleSavePhone = (name: string, phone: string) => {
    const next = { ...familyPhones, [name]: phone.trim() };
    setFamilyPhones(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("4x7_family_phones", JSON.stringify(next));
      } catch {}
    }
    setPhoneEditMember(null);
    notify(`📱 Número de WhatsApp para ${name} actualizado.`);
  };

  const FAMILY_WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/Eb9Ptg6Za4E52EFpm7aTst?mode=gi_t";

  const buildWhatsAppGroupMessage = (member: { name: string; nickname?: string; workouts: number; relation: string }) => {
    const nick = member.nickname || member.name;

    // Mensajes dinámicos, cortos, certeros y variados para no aburrir
    let options: string[] = [];

    if (member.workouts >= 4) {
      options = [
        `👑🏆 ¡CUMPLIÓ! @${nick} metió sus 4 de 4 y tiene su boleto asegurado para la Rifa del Mes 🎟️🎉 ¡Poniendo el ejemplo! 👏🔥`,
        `💎🚀 @${nick} imparable con 4/4 días listos. ¡Boleto en mano y cero tacos de castigo! 😎💪`,
        `🥇🙌 ¡Misión semanal cumplida para @${nick}! 4 check-ins con disciplina pura. ¿Quién más le sigue el paso hoy? 👏✨`,
        `🎟️🔥 @${nick} ya está adentro de la tómbola del mes. ¡Esa es constancia 4×7! 🏆👊`,
        `⚡👑 ¡Orgullo 4×7! @${nick} aseguró su meta semanal completa. ¡A la cima de la familia! 🥇🚀`,
      ];
    } else if (member.workouts === 3) {
      options = [
        `🦘🔥 ¡A UN DÍA DE LA GLORIA! @${nick} lleva 3 de 4. ¡Un solo entreno más y boleto a la rifa en mano! 🎟️💪`,
        `⚡🙌 ¡Échenle porras a @${nick}! Va 3/4, a 1 solo check-in de cumplir su meta semanal 🚀✨ ¡No te quedes en la orilla!`,
        `🎯 @${nick} en 3 de 4... ¡Hoy sacas el último y entras directo a la rifa familiar! ¡Con todo! 👏🔥`,
        `🎟️💨 ¡Casi lo logras @${nick}! Te falta un solo día para cantar victoria y salvarte de los tacos. ¡A cerrar fuerte! 👊🎉`,
        `🔥🚀 @${nick} a 1 entrenamiento de ser intocable esta semana (3/4). ¡Hoy toca sudar el último! 🏋️‍♂️✨`,
      ];
    } else if (member.workouts === 2) {
      options = [
        `⚖️ @${nick} va 2 de 4 a mitad del camino. ¿Aseguras la rifa o pagas los tacos de castigo? ¡Hoy toca! 🏋️‍♂️✨`,
        `🔥 2/4 para @${nick}. ¡Estás a solo 2 entrenamientos de calificar a la rifa del mes! ¡No aflojes! 🎟️💪`,
        `⚡ Mitad de meta cumplida para @${nick} (2/4). ¡El domingo no perdona, saca hoy el tercero! 👊🔥`,
        `👀 @${nick} lleva 2 check-ins. Faltan 2 para librar la cena de castigo. ¡A darle con ganas! 🏃‍♀️💨`,
        `🚀 Buen ritmo @${nick} (2/4). ¡Métele galleta hoy y ponte a tiro de piedra del podio! 👏🔥`,
      ];
    } else if (member.workouts === 1) {
      options = [
        `⚠️ @${nick} apenas lleva 1 de 4. El domingo se acerca y esos tacos de castigo huelen cerca... ¡A entrenar hoy! 🌮💨`,
        `👀 1/4 para @${nick}... ¡No te confíes que la semana vuela! Saca tus 30 minutitos hoy 💪🔥`,
        `🚨 @${nick} con solo 1 check-in. ¡Despierta que te queremos en la rifa, no pagando la cena! 😂👊`,
        `⚡ Un solo día no basta @${nick}. ¡Métele ganas hoy para salir de la zona de peligro! 🏃‍♂️🔥`,
        `🌮💨 @${nick} en zona caliente (1/4). ¡Hoy toca sudar la camiseta y demostrar el poder 4×7! 💪✨`,
      ];
    } else if ((member as any).activity) {
      const act = (member as any).activity;
      options = [
        `🎉🙌 ¡Felicidades a @${nick} por sumarse al Reto 4×7 en ${act}! 🔥 ¡Con toda la actitud para romperla en equipo! 👏💪`,
        `🚀✨ ¡Bienvenida @${nick} al Reto Oficial! Su disciplina elegida es ${act} 🚴🏋️‍♀️ ¡A darlo todo juntos!`,
        `🎉💪 ¡@${nick} ya eligió su deporte: ${act}! ¡Vamos a romper ese 4 de 4 en familia! 🔥👏`,
      ];
    } else {
      // 0 de 4 entrenamientos
      options = [
        `🚨🌮 @${nick} sigue en ceros (0/4)... ¿De qué vas a querer los tacos de castigo? ¡Ponte los tenis ya! 🏃💨`,
        `👀👻 ¿Alguien ha visto a @${nick}? La semana se acaba y lleva 0 de 4. ¡Cero excusas hoy! 🔥👊`,
        `🌮💸 @${nick} patrocinando la cena del domingo con 0 entrenamientos... ¡Muévete o pagas! 😂🏃‍♂️`,
        `🚨⏰ ¡Alerta roja en el grupo! @${nick} en 0/4. ¡El marcador cierra el domingo, actívate hoy! 🔥`,
        `🌮👀 Menos flojera y más 4×7 @${nick}. ¡Toda la familia te está esperando! 30 min y sales de ceros 💪✨`,
      ];
    }

    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
  };

  const handleSendWhatsApp = (member: { name: string; nickname?: string; workouts: number; relation: string }) => {
    const displayName = member.nickname || member.name;
    const message = buildWhatsAppGroupMessage(member);
    const encodedMsg = encodeURIComponent(message);

    // Also copy to clipboard for convenience
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(message).catch(() => {});
    }

    // Also publish this motivation message to the Family Wall feed so the whole family sees it!
    const motivationPost: FeedPost = {
      id: Date.now(),
      userId: session?.user.id || 1,
      userName: session?.user.name.split(" ")[0] || "Pedro",
      caption: `📣 Anuncio al Grupo de WhatsApp para ${displayName}:\n"${message}"`,
      evidenceUrl: null,
      createdAt: new Date().toISOString(),
      activityType: "Anuncio al Grupo 💬",
      durationSeconds: null,
      distanceMeters: null,
      steps: null,
      calories: null,
      likes: 2,
      comments: 0,
      likedByMe: true,
    };
    setFeedPosts((prev) => [motivationPost, ...prev]);

    // On mobile devices (iOS/Android), use native scheme 'whatsapp://send'
    const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `whatsapp://send?text=${encodedMsg}`;
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, "_blank");
    }

    notify(`💬 Carrilla para ${displayName} copiada. Selecciona el grupo en WhatsApp.`);
  };

  const handleSendWeeklyReportToGroup = () => {
    const completed = familyCheckInData.filter((m) => m.workouts >= 4);
    const near = familyCheckInData.filter((m) => m.workouts === 3);
    const pending = familyCheckInData.filter((m) => m.workouts < 3);

    let report = `🏆📊 MARCADOR 4×7 · LÓPEZ Y AMIGOS 📊🏆\n`;
    if (completed.length > 0) {
      report += `\n👑 CON META CUMPLIDA (Boleto Rifa 🎟️):\n`;
      completed.forEach((m) => {
        const displayName = m.nickname || m.name;
        report += `  ✓ ${displayName}: ${m.workouts}/4 días ✨\n`;
      });
    }

    if (near.length > 0) {
      report += `\n⚡ A 1 DÍA DE LA META:\n`;
      near.forEach((m) => {
        const displayName = m.nickname || m.name;
        report += `  • ${displayName}: ${m.workouts}/4 días 🔥\n`;
      });
    }

    if (pending.length > 0) {
      report += `\n🌮 ZONA DE TACOS DE CASTIGO:\n`;
      pending.forEach((m) => {
        const displayName = m.nickname || m.name;
        report += `  • ${displayName}: ${m.workouts}/4 días 😱\n`;
      });
    }

    report += `\n📅 ¡El domingo a medianoche cierra el marcador! El que no llegue a 4 paga los tacos 🌮🏃‍♂️🔥`;
    report += `\n🔗 Grupo oficial 4×7: ${FAMILY_WHATSAPP_GROUP_URL}`;

    const encodedReport = encodeURIComponent(report);

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(report).catch(() => {});
    }

    const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `whatsapp://send?text=${encodedReport}`;
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodedReport}`, "_blank");
    }

    notify(`📊 Marcador semanal copiado y listo para enviar al grupo de WhatsApp.`);
  };

  const getTodayDateKey = useCallback(() => {
    return getGdlDateInfo().todayKey;
  }, [getGdlDateInfo]);

  const syncUserCheckInState = useCallback((userEmail: string, userId: number, feedPostsList: FeedPost[] = []) => {
    const todayStr = getGdlDateInfo().todayKey;
    const gdl = getGdlDateInfo();

    // 1. Check if user has a real workout posted today in feed
    const hasTodayInFeed = feedPostsList.some((p) => {
      if (!p.createdAt) return false;
      const postDate = new Date(p.createdAt);
      const pKey = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, "0")}-${String(postDate.getDate()).padStart(2, "0")}`;
      return p.userId === userId && pKey === todayStr;
    });

    // 2. Compute unique days this user has checked in this current week
    const thisWeekPostDates = feedPostsList
      .filter((p) => p.userId === userId && p.createdAt)
      .map((p) => {
        const postDate = new Date(p.createdAt!);
        return `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, "0")}-${String(postDate.getDate()).padStart(2, "0")}`;
      })
      .filter((dateKey) => gdl.currentWeekDays.some((d) => d.dateKey === dateKey));

    const uniqueWeekDates = Array.from(new Set(thisWeekPostDates));
    if (hasTodayInFeed && !uniqueWeekDates.includes(todayStr)) {
      uniqueWeekDates.push(todayStr);
    }

    setLogged(hasTodayInFeed);
    setWeeklyWorkoutsCount(uniqueWeekDates.length);
    setCompletedCheckInDates(uniqueWeekDates);
  }, [getGdlDateInfo]);

  const loadFeed = useCallback(async (silent = false) => {
    if (!silent) setFeedLoading(true);
    try {
      let clientSyncData: any = undefined;
      if (typeof window !== "undefined") {
        try {
          const active = localStorage.getItem("four_seven_active_session");
          const sess = active ? JSON.parse(active) : null;
          if (sess?.user) {
            const nick = sess.user.name.includes("Pedro") ? "Pedcaz" : sess.user.name.includes("Judith") ? "JuuGlez" : sess.user.name.split(" ")[0];
            const checkinRaw = localStorage.getItem(`4x7_user_${sess.user.id}_checkin_state`);
            const checkinParsed = checkinRaw ? JSON.parse(checkinRaw) : null;
            const workoutsCount = checkinParsed?.workouts || (completedCheckInDates.length > 0 ? completedCheckInDates.length : 1);
            const prefAct = (fitness?.profile as any)?.preferredActivity || (nick === "Pedcaz" ? "Gimnasio / Pesas 🏋️‍♂️" : "");
            clientSyncData = {
              nickname: nick,
              fullName: sess.user.name,
              workouts: workoutsCount,
              completedDates: checkinParsed?.completedDates || completedCheckInDates,
              activity: prefAct,
              lastCheckinDate: checkinParsed?.lastCheckinDate || new Date().toISOString().split("T")[0],
            };
          }
        } catch {}
      }

      const response = await clientApi.feed(clientSyncData);
      if (response?.posts && Array.isArray(response.posts)) {
        setFeedPosts(response.posts);
      }
      if (response?.familyProfiles) {
        setFamilyProfiles((prev) => ({ ...prev, ...response.familyProfiles }));
      }
      if (response?.familyStats) {
        setFamilyStats((prev) => ({ ...prev, ...response.familyStats }));
      }
    } catch {
      // Keep existing state gracefully
    } finally {
      if (!silent) setFeedLoading(false);
    }
  }, [completedCheckInDates, fitness]);

  // Facebook-style Live Sync: Auto-update when app is open & visible, pause when hidden to save bandwidth
  useEffect(() => {
    // 1. Refresh immediately when switching between app sections (Hoy, Muro, Liga)
    loadFeed(true);
  }, [active, loadFeed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let syncInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (syncInterval) clearInterval(syncInterval);
      // Poll every 35 seconds ONLY while the user is actively viewing the app
      syncInterval = setInterval(() => {
        if (document.visibilityState === "visible" && navigator.onLine) {
          loadFeed(true);
          // If comments are open on a post, refresh that post's comments too
          if (commentOpen !== null) {
            clientApi.comments(commentOpen).then((res) => {
              if (res?.comments) {
                setCommentsByPost((prev) => ({ ...prev, [commentOpen]: res.comments }));
              }
            }).catch(() => {});
          }
        }
      }, 35_000);
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        loadFeed(true);
        startPolling();
      } else {
        // Stop polling completely when screen is off, locked, or user switched apps (0 bandwidth consumed!)
        if (syncInterval) clearInterval(syncInterval);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("online", handleVisibilityOrFocus);

    startPolling();

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("online", handleVisibilityOrFocus);
    };
  }, [loadFeed, commentOpen]);

  useEffect(() => {
    clientApi
      .me()
      .then(async (current) => {
        setSession(current);

        const cachedProfile = getStoredProfile(current?.user?.name);
        if (cachedProfile?.profile) {
          setFitness(cachedProfile);
        }

        const [feed, profile] = await Promise.all([clientApi.feed(), clientApi.profile()]);
        const finalFeed = feed?.posts && Array.isArray(feed.posts) ? feed.posts : [];
        setFeedPosts(finalFeed);
        if (feed?.familyProfiles) {
          setFamilyProfiles((prev) => ({ ...prev, ...feed.familyProfiles }));
        }
        if (feed?.familyStats) {
          setFamilyStats((prev) => ({ ...prev, ...feed.familyStats }));
        }

        if (current?.user) {
          syncUserCheckInState(current.user.email, current.user.id, finalFeed);
        }

        const finalProfile = profile?.profile ? profile : cachedProfile;
        if (finalProfile?.profile) {
          setFitness(finalProfile);
          try {
            if (current?.user?.name) {
              localStorage.setItem(`four_seven_profile_${current.user.name}`, JSON.stringify(finalProfile));
            }
            localStorage.setItem("four_seven_saved_profile", JSON.stringify(finalProfile));
          } catch {}
        }
      })
      .catch(async () => {
        const cachedProfile = getStoredProfile();
        if (cachedProfile?.profile) {
          setFitness(cachedProfile);
        }
        try {
          const savedEmail = localStorage.getItem("four_seven_saved_email");
          const savedPass = localStorage.getItem("four_seven_saved_password");
          if (savedEmail && savedPass) {
            const reLoggedIn = await clientApi.login(savedEmail, savedPass);
            setSession(reLoggedIn);
            return;
          }
        } catch {}

        if (!localStorage.getItem("four_seven_active_session")) {
          setSession(null);
        }
      })
      .finally(() => {
        setSessionLoading(false);
        setProfileLoading(false);
      });
  }, [syncUserCheckInState]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };

  const compressImageFile = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1400;
          const MAX_HEIGHT = 1400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.85
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = event.target.files?.[0];
    if (rawFile) {
      notify("Optimizando foto para el muro… 📸");
      const file = await compressImageFile(rawFile);
      setEvidenceFile(file);
      const url = URL.createObjectURL(file);
      setEvidencePreview(url);
      notify("Foto de evidencia cargada 📸");
    }
  };

  const clearPhoto = () => {
    setEvidenceFile(null);
    setEvidencePreview(null);
  };

  const handleCheckIn = async () => {
    if (savingWorkout) return;
    const gdl = getGdlDateInfo();

    // Strict validation: Only 1 check-in per calendar day in Guadalajara (00:00 to 23:59)
    if (logged || completedCheckInDates.includes(gdl.todayKey)) {
      notify(`⚠️ Ya registraste tu check-in de hoy (${gdl.todayKey} · Hora GDL). Solo se permite 1 check-in diario para proteger la regla 4×7.`);
      return;
    }

    setSavingWorkout(true);
    try {
      let evidenceKey: string | null = null;
      let localPhotoUrl: string | null = null;
      if (evidenceFile) {
        try {
          const uploadRes = await clientApi.uploadEvidence(evidenceFile);
          evidenceKey = uploadRes.evidenceKey;
        } catch (uploadErr) {
          console.warn("Evidence upload issue, fallback to local URL", uploadErr);
          localPhotoUrl = URL.createObjectURL(evidenceFile);
        }
      }
      const act = activityOptions.find((a) => a.name === selectedActivity) || activityOptions[0];
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - act.time * 60_000);

      try {
        await clientApi.workout({
          activityType: act.name,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds: act.time * 60,
          distanceMeters: 0,
          steps: 0,
          calories: act.cal,
          evidenceKey,
          caption: checkInNote.trim() || undefined,
        });
      } catch (workoutErr) {
        console.warn("Server workout record warning", workoutErr);
      }

      const nextCompletedDates = Array.from(new Set([...completedCheckInDates, gdl.todayKey]));
      setCompletedCheckInDates(nextCompletedDates);
      setLogged(true);
      setShowAdditionalCheckIn(false);
      const newWorkoutsCount = Math.min(7, weeklyWorkoutsCount + 1);
      setWeeklyWorkoutsCount(newWorkoutsCount);

      if (session?.user?.id) {
        try {
          localStorage.setItem(
            `4x7_user_${session.user.id}_checkin_state`,
            JSON.stringify({
              workouts: newWorkoutsCount,
              completedToday: true,
              lastCheckinDate: gdl.todayKey,
              completedDates: nextCompletedDates,
            })
          );
        } catch {}
      }

      // Add local post to feed immediately so user sees their photo right away!
      const newPost: FeedPost = {
        id: Date.now(),
        userId: session?.user.id || 1,
        userName: session?.user.name.split(" ")[0] || "Pedro",
        caption: checkInNote.trim() || "¡Entrenamiento 4×7 completado con éxito!",
        evidenceUrl: evidenceKey ? `/api/mobile/evidence/${evidenceKey}` : localPhotoUrl || evidencePreview,
        createdAt: new Date().toISOString(),
        activityType: act.name,
        durationSeconds: act.time * 60,
        distanceMeters: null,
        steps: null,
        calories: act.cal,
        likes: 0,
        comments: 0,
        likedByMe: false,
      };
      setFeedPosts((prev) => [newPost, ...prev]);

      setCheckInNote("");
      clearPhoto();
      await loadFeed(true).catch(() => void 0);
      notify(`🔥 ¡Check-in de hoy completado! (${newWorkoutsCount}/4 días cumplidos esta semana en GDL)`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "No pudimos guardar el check-in");
    } finally {
      setSavingWorkout(false);
    }
  };

  const toggleLike = async (id: number) => {
    const current = feedPosts.find((post) => post.id === id);
    if (!current) return;
    setFeedPosts((posts) =>
      posts.map((post) =>
        post.id === id
          ? {
              ...post,
              likedByMe: !post.likedByMe,
              likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)),
            }
          : post
      )
    );
    try {
      const result = await clientApi.toggleLike(id);
      setFeedPosts((posts) =>
        posts.map((post) => (post.id === id ? { ...post, likedByMe: result.liked } : post))
      );
    } catch (cause) {
      setFeedPosts((posts) => posts.map((post) => (post.id === id ? current : post)));
      notify(cause instanceof Error ? cause.message : "No pudimos guardar la reacción");
    }
  };

  const toggleCommentSection = (postId: number) => {
    if (commentOpen === postId) {
      setCommentOpen(null);
    } else {
      setCommentOpen(postId);
      if (!commentsByPost[postId]) {
        clientApi
          .comments(postId)
          .then((res) => {
            if (res?.comments) {
              setCommentsByPost((prev) => ({ ...prev, [postId]: res.comments }));
            }
          })
          .catch(() => {});
      }
    }
  };

  const addComment = async (id: number) => {
    if (!commentText.trim()) return;
    const body = commentText.trim();
    try {
      const res = await clientApi.comment(id, body);
      if (res?.comment) {
        setCommentsByPost((prev) => ({
          ...prev,
          [id]: [...(prev[id] || []), res.comment],
        }));
      }
      setFeedPosts((posts) =>
        posts.map((post) => (post.id === id ? { ...post, comments: post.comments + 1 } : post))
      );
      setCommentText("");
      notify("Comentario publicado en el muro 👏");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "No pudimos publicar el comentario");
    }
  };



  // Custom Challenge Handlers
  const handleCreateChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChallengeTitle.trim()) return;

    const rawName = session?.user.name.split(" ")[0] || "Pedro";
    const creatorDisplayName = currentUserName === "Pedro" || rawName === "Pedro" ? "Pedcaz" : rawName;
    const finalTargets = newChallengeTargets.length ? newChallengeTargets : ["Toda la Familia"];
    const targetsDisplayStr = finalTargets.includes("Toda la Familia")
      ? "Toda la Familia 🌟"
      : finalTargets.join(", ");

    const newChallenge: CustomChallenge = {
      id: Date.now(),
      creator: creatorDisplayName,
      targets: finalTargets,
      title: newChallengeTitle.trim(),
      desc: newChallengeDesc.trim() || "¡A ver quién cumple este reto familiar primero!",
      rewardPoints: Number(newChallengeReward),
      bet: newChallengeBet.trim() || undefined,
      completedBy: [],
      acceptedBy: [creatorDisplayName],
      createdAt: "Justo ahora",
    };

    const nextChallenges = [newChallenge, ...customChallenges];
    setCustomChallenges(nextChallenges);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("4x7_custom_challenges", JSON.stringify(nextChallenges));
      } catch {}
    }

    // Publicar automáticamente en el Muro Familiar (Feed de la app)
    const challengePost: FeedPost = {
      id: Date.now(),
      userId: session?.user.id || 1,
      userName: creatorDisplayName,
      caption: `⚔️🔥 ¡NUEVO RETO FAMILIAR LANZADO! 🏆\n"${newChallengeTitle.trim()}"\n\n📌 Objetivo: ${newChallengeDesc.trim() || "¡A ver quién cumple este reto primero!"}\n🎯 Dirigido a: ${targetsDisplayStr}\n✨ Recompensa: +${newChallengeReward} PTS${newChallengeBet.trim() ? `\n🌮 Apuesta amistosa: ${newChallengeBet.trim()}` : ""}\n\n¡Acepta el duelo en la pestaña de Liga y Retos! 💪`,
      evidenceUrl: null,
      createdAt: new Date().toISOString(),
      activityType: "Reto Familiar ⚔️",
      durationSeconds: null,
      distanceMeters: null,
      steps: null,
      calories: null,
      likes: 1,
      comments: 0,
      likedByMe: true,
    };

    setFeedPosts((prev) => [challengePost, ...prev]);

    if (typeof window !== "undefined") {
      try {
        const savedFeed = localStorage.getItem("4x7_family_feed");
        const parsed = savedFeed ? JSON.parse(savedFeed) : [];
        localStorage.setItem("4x7_family_feed", JSON.stringify([challengePost, ...parsed]));
      } catch {}
    }

    setShowNewChallengeModal(false);
    setNewChallengeTitle("");
    setNewChallengeDesc("");
    setNewChallengeBet("Unos tacos o cena 🌮");
    notify("⚔️ ¡Reto publicado en la Liga y anunciado en el Muro Familiar! 🎉");
  };

  const toggleTargetMember = (name: string) => {
    if (name === "Toda la Familia") {
      setNewChallengeTargets(["Toda la Familia"]);
      return;
    }
    const filtered = newChallengeTargets.filter((t) => t !== "Toda la Familia");
    if (filtered.includes(name)) {
      const next = filtered.filter((t) => t !== name);
      setNewChallengeTargets(next.length ? next : ["Toda la Familia"]);
    } else {
      setNewChallengeTargets([...filtered, name]);
    }
  };

  const handleCompleteChallenge = (id: number) => {
    const rawName = session?.user.name.split(" ")[0] || "Pedro";
    const userName = currentUserName === "Pedro" || rawName === "Pedro" ? "Pedcaz" : rawName;
    const ch = customChallenges.find((c) => c.id === id);
    if (!ch) return;

    if (ch.completedBy.includes(userName) || ch.completedBy.includes(rawName)) {
      notify("Ya habías marcado este reto como cumplido.");
      return;
    }

    const updatedChallenges = customChallenges.map((c) =>
      c.id === id ? { ...c, completedBy: [...c.completedBy, userName] } : c
    );
    setCustomChallenges(updatedChallenges);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("4x7_custom_challenges", JSON.stringify(updatedChallenges));
      } catch {}
    }
    setUserBonusPoints((pts) => pts + ch.rewardPoints);

    // Publicar logro en el Muro Familiar
    const victoryPost: FeedPost = {
      id: Date.now(),
      userId: session?.user.id || 1,
      userName: userName,
      caption: `👑🎉 ¡RETO FAMILIAR CUMPLIDO! 🏆\n"${ch.title}"\n¡Misión superada con éxito ganando +${ch.rewardPoints} PTS! ${ch.bet ? `\n🌮 Ya me gané: ${ch.bet}` : ""}\n¡A ver quién más se anima! 🔥💪`,
      evidenceUrl: null,
      createdAt: new Date().toISOString(),
      activityType: "Reto Cumplido 👑",
      durationSeconds: null,
      distanceMeters: null,
      steps: null,
      calories: null,
      likes: 2,
      comments: 0,
      likedByMe: true,
    };
    setFeedPosts((prev) => [victoryPost, ...prev]);

    notify(`🎉 ¡Felicidades! Cumpliste el reto "${ch.title}", ganaste +${ch.rewardPoints} PTS y se publicó en el Muro`);
  };

  // Render helper for posts - Modern Facebook/Instagram Feed Style
  const renderPostCard = (post: FeedPost) => {
    const minutes = Math.max(1, Math.round((post.durationSeconds ?? 0) / 60));
    let meta = "Reciente";
    try {
      const d = new Date(post.createdAt);
      if (!isNaN(d.getTime())) {
        meta = new Intl.DateTimeFormat("es-MX", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(d);
      } else {
        meta = String(post.createdAt || "Reciente");
      }
    } catch {
      meta = String(post.createdAt || "Reciente");
    }
    const visualStat = post.distanceMeters
      ? `${(post.distanceMeters / 1000).toFixed(1)} KM`
      : `${minutes} MIN`;

    return (
      <article className="fb-post-card" key={post.id}>
        {/* 1. Header estilo Red Social */}
        <div className="fb-post-header">
          <div className="fb-author-row">
            <span className={`avatar ${post.userName === "Pedro" ? "mint" : post.userName === "Ana" ? "coral" : post.userName === "Sofi" ? "lilac" : "sun"}`}>
              {post.userName.charAt(0).toUpperCase()}
            </span>
            <div className="fb-author-info">
              <div className="fb-name-row">
                <b>{post.userName}</b>
                <span className="fb-checkin-badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Check-In 4×7
                </span>
              </div>
              <span className="fb-post-time">{meta}</span>
            </div>
          </div>
        </div>

        {/* 2. Texto y Frase del Usuario (Arriba de la foto) */}
        <div className="fb-post-body-text">
          {post.activityType && (
            <div className="fb-activity-pill">
              <span className="fb-act-dot" />
              <b>{post.activityType}</b>
              {post.durationSeconds ? <span>· {minutes} min</span> : null}
            </div>
          )}
          {post.caption && (
            <p className="fb-caption-text">{post.caption}</p>
          )}
        </div>

        {/* 3. Imagen / Foto de Evidencia (100% responsive sin cortes forzados) */}
        {post.evidenceUrl ? (
          <div className="fb-post-photo-wrap">
            <img src={post.evidenceUrl} alt={`Evidencia de entrenamiento de ${post.userName}`} />
            <span className="fb-photo-stat-badge">{visualStat}</span>
          </div>
        ) : (
          <div className={`fb-post-visual-banner visual-${(post.id % 3) + 1}`}>
            <span className="fb-banner-label">{post.activityType?.toUpperCase() || "ENTRENAMIENTO 4×7"}</span>
            <span className="fb-photo-stat-badge">{visualStat}</span>
          </div>
        )}

        {/* 4. Contador de Reacciones / Comentarios */}
        <div className="fb-reactions-bar">
          <div className="fb-reactions-count">
            <span className="fb-reaction-icons">🔥👏</span>
            <small>{post.likes} {post.likes === 1 ? "motivación" : "motivaciones"}</small>
          </div>
          <div className="fb-comments-count" onClick={() => toggleCommentSection(post.id)}>
            <small>{post.comments} {post.comments === 1 ? "comentario" : "comentarios"}</small>
          </div>
        </div>

        {/* 5. Barra de Botones de Acción */}
        <div className="fb-action-buttons-strip">
          <button
            type="button"
            className={`fb-action-btn ${post.likedByMe ? "active-like" : ""}`}
            onClick={() => toggleLike(post.id)}
          >
            <span>{post.likedByMe ? "🔥" : "⚡"}</span>
            <b>{post.likedByMe ? "¡Motivado!" : "Motivar"}</b>
          </button>
          <button
            type="button"
            className={`fb-action-btn ${commentOpen === post.id ? "active-comment" : ""}`}
            onClick={() => toggleCommentSection(post.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <b>Comentar</b>
          </button>
          <button
            type="button"
            className="fb-action-btn"
            title="Compartir enlace"
            onClick={() =>
              navigator.clipboard
                ?.writeText(`${window.location.origin}/#muro`)
                .then(() => notify("Enlace del post copiado"))
            }
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            <b>Compartir</b>
          </button>
        </div>

        {/* 6. Hilo de Comentarios Desplegable */}
        {commentOpen === post.id && (
          <div className="fb-comments-section">
            <div className="fb-comments-thread">
              {commentsByPost[post.id] && commentsByPost[post.id].length > 0 ? (
                commentsByPost[post.id].map((comm) => (
                  <div key={comm.id} className="fb-comment-bubble">
                    <span className="avatar tiny mint">
                      {comm.userName ? comm.userName.charAt(0).toUpperCase() : "F"}
                    </span>
                    <div className="fb-comment-text-box">
                      <b>{comm.userName}</b>
                      <span>{comm.body}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: "10px 14px", fontSize: "12.5px", color: "var(--muted)", fontStyle: "italic" }}>
                  Sé el primero en dejar porras o un comentario familiar 👏
                </div>
              )}
            </div>

            {/* Input para agregar comentario */}
            <div className="fb-comment-input-row">
              <span className="avatar tiny mint">
                {session?.user.name.charAt(0).toUpperCase() || "P"}
              </span>
              <div className="fb-input-wrapper">
                <input
                  autoFocus
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addComment(post.id)}
                  placeholder="Escribe un comentario o porras..."
                />
                <button
                  type="button"
                  className="fb-comment-send-btn"
                  onClick={() => addComment(post.id)}
                  disabled={!commentText.trim()}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    );
  };

  // Unified Master Hero Card (Combina Check-in diario + Anillo de Progreso + Días Reales de la Semana)
  const renderHeroCheckInCard = () => {
    const firstName = session?.user.name.split(" ")[0] || "Compañero";
    const gdlInfo = getGdlDateInfo();
    const thisWeekDoneCount = gdlInfo.currentWeekDays.filter(
      (d) => completedCheckInDates.includes(d.dateKey) || (d.isToday && logged)
    ).length;
    const nextReward = getWorkoutReward(thisWeekDoneCount + 1);

    return (
      <section className="unified-hero-card">
        {/* Top Section: Check-In State */}
        <div className="unified-top-section">
          {logged ? (
            <div className="checkin-success-compact" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "2px 0 0" }}>
              <div className="success-icon-badge" style={{ width: "38px", height: "38px", fontSize: "19px", flexShrink: 0 }}>🏆</div>
              <h2 style={{ color: "#ffffff", fontSize: "21px", margin: 0, fontWeight: "800", letterSpacing: "-0.03em" }}>
                ¡Entrenamiento de hoy completado, {firstName}!
              </h2>
            </div>
          ) : (
            <div>
              <div className="hero-checkin-header">
                <div>
                  <div className="mini-label">
                    <span className="live-dot" /> HOY EN GUADALAJARA (GDL) · {gdlInfo.fullDateStr} · {gdlInfo.currentTimeStr}
                  </div>
                  <h2 style={{ color: "#ffffff", fontSize: "24px", margin: "8px 0 4px", fontWeight: "800", letterSpacing: "-0.04em" }}>
                    ¿Ya entrenaste hoy, {firstName}?
                  </h2>
                  <p className="hero-subtext" style={{ color: "rgba(255,255,255,0.78)", fontSize: "13px", margin: 0 }}>
                    {thisWeekDoneCount === 3
                      ? "Llevas 3 entrenamientos. ¡Haz tu 4° check-in hoy para cumplir tu meta obligatoria 4×7 y ganar +300 PTS!"
                      : thisWeekDoneCount >= 4
                      ? `¡Llevas ${thisWeekDoneCount} días! Este siguiente entrenamiento suma ${nextReward.label} extra.`
                      : `Llevas ${thisWeekDoneCount} de 4 días obligatorios. Te faltan ${Math.max(0, 4 - thisWeekDoneCount)} días antes del domingo.`}
                  </p>
                </div>
                <div className="checkin-streak-pill">
                  <span>🔥</span>
                  <div>
                    <b>Racha activa</b>
                    <small>6 semanas</small>
                  </div>
                </div>
              </div>

              {/* 1. Quick Activity Selector */}
              <div className="activity-pills-row" style={{ marginTop: "14px" }}>
                {activityOptions.map((act) => (
                  <button
                    key={act.name}
                    type="button"
                    className={`activity-pill ${selectedActivity === act.name ? "active" : ""}`}
                    onClick={() => setSelectedActivity(act.name)}
                  >
                    <span className="pill-icon">{act.icon}</span>
                    <span className="pill-name">{act.name}</span>
                    <span className="pill-time">{act.time}m</span>
                  </button>
                ))}
              </div>

              {/* 2. Optional Photo and Motivational Note */}
              <div className="checkin-inputs-grid" style={{ marginTop: "12px" }}>
                <div className="photo-upload-zone">
                  {evidencePreview ? (
                    <div className="preview-container">
                      <img src={evidencePreview} alt="Evidencia seleccionada" />
                      <button type="button" className="remove-photo-btn" onClick={clearPhoto} title="Quitar foto">
                        ✕ Quitar foto
                      </button>
                    </div>
                  ) : (
                    <label className="photo-drop-button">
                      <span className="camera-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </span>
                      <div>
                        <b>Foto de evidencia</b>
                        <small>Selfie, gimnasio o reloj (opcional)</small>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  )}
                </div>

                <div className="quote-input-zone">
                  <label>
                    <span className="quote-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </span>
                    <input
                      value={checkInNote}
                      onChange={(e) => setCheckInNote(e.target.value)}
                      placeholder="¿Qué rutina hiciste hoy o qué mensaje compartes?"
                      maxLength={180}
                    />
                  </label>
                </div>
              </div>

              {/* 3. Big Action Check-In Button */}
              <button
                type="button"
                className="main-checkin-submit"
                style={{ marginTop: "14px" }}
                disabled={savingWorkout}
                onClick={handleCheckIn}
              >
                {savingWorkout ? (
                  <span>Guardando tu check-in...</span>
                ) : (
                  <>
                    <span>⚡</span>
                    <b>¡HACER CHECK-IN DE HOY!</b>
                    <small>({thisWeekDoneCount + 1}/4 DÍAS · {nextReward.label})</small>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Integrated Section: Progress Ring + Real Week Days Strip */}
        <div className="unified-bottom-progress">
          <div className="progress-ring-box" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div className={thisWeekDoneCount >= 4 ? "progress-ring complete" : "progress-ring"}>
              <div>
                <strong>{thisWeekDoneCount}</strong>
                <span>de 4 obligatorios</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", color: "#34d399" }}>
                {thisWeekDoneCount >= 4 ? "🏆 ¡Meta cumplida!" : "Semana en curso"}
              </span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#ffffff" }}>
                {thisWeekDoneCount >= 4
                  ? `4 de 4 completados`
                  : `Llevas ${thisWeekDoneCount} de 4 días`}
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.68)" }}>
                {thisWeekDoneCount >= 4
                  ? "¡Excelente constancia! Sumando puntos."
                  : `Faltan ${Math.max(0, 4 - thisWeekDoneCount)} días antes del domingo.`}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
            <div className="days-row">
              {gdlInfo.currentWeekDays.map((item) => {
                const isDone = completedCheckInDates.includes(item.dateKey) || (item.isToday && logged);
                const isToday = item.isToday;
                const isPast = item.isPast && !isDone;

                let stateClass = "";
                if (isDone) stateClass = "done";
                else if (isToday) stateClass = "today";
                else if (isPast) stateClass = "rest";
                else stateClass = "empty";

                return (
                  <div
                    className={`day ${stateClass}`}
                    key={item.dateKey}
                    title={`${item.label} ${item.dayNumber} · ${isDone ? "Completado ✓" : isToday ? "Hoy (Pendiente)" : isPast ? "Descanso" : "Programado"}`}
                  >
                    <span>{item.label}</span>
                    <b>{isDone ? "✓" : item.dayNumber}</b>
                    {isToday && (
                      <small style={{ fontSize: "8.5px", color: "#fbbf24", fontWeight: "800", marginTop: "1px", lineHeight: "1" }}>
                        Hoy
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="streak-line" style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>
              <span>🔥 Racha activa</span>
              <span className="best" style={{ color: "rgba(255,255,255,0.5)" }}>· Objetivo: 4 de 7 días</span>
            </div>
          </div>
        </div>
      </section>
    );
  };

  // Dynamic Family Check-In Live Tracker Card (Regresado a Inicio: El Alma de la App)
  const renderFamilyCheckInLiveCard = () => {
    return (
      <article className="family-live-tracker-card" style={{ marginTop: "24px" }}>
        {/* Card Header with Direct WhatsApp Group Access */}
        <div className="tracker-header-row" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div className="tracker-pill-badge">
              <span className="live-dot-green" /> MONITOREO EN VIVO · SEMANA ACTUAL
            </div>
            <h2>Mi familia 4×7</h2>
            <p>Monitorea cuántos check-ins lleva cada familiar, motívalos o échales carrilla en el Grupo de WhatsApp</p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="open-wa-group-btn"
              onClick={() => window.open(FAMILY_WHATSAPP_GROUP_URL, "_blank")}
              title="Abrir el grupo de WhatsApp de la Familia 4×7"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              <span>💬 Grupo 4×7</span>
            </button>

            <button
              type="button"
              className="send-report-group-btn"
              onClick={handleSendWeeklyReportToGroup}
              title="Mandar el marcador y posiciones semanales al grupo de WhatsApp"
            >
              <span>📊 Mandar Marcador al Grupo</span>
            </button>
          </div>
        </div>

        {/* Family Dynamic Member Cards */}
        <div className="family-members-dynamic-list">
          {familyCheckInData.map((member) => {
            const isCompleted = member.workouts >= 4;
            const isNear = member.workouts === 3;
            const isPending = member.workouts < 2;

            return (
              <div
                key={member.name}
                className={`family-member-row-card ${isCompleted ? "status-completed" : isNear ? "status-near" : isPending ? "status-pending" : "status-progress"} ${member.name === "Pedro" ? "is-you" : ""}`}
              >
                <div className="row-left-user">
                  <div className={`avatar-ring-box ${isCompleted ? "gold-ring" : ""}`}>
                    <span className={`avatar ${member.color}`}>
                      {(member.nickname || member.name).charAt(0).toUpperCase()}
                    </span>
                    {isCompleted && <span className="trophy-badge-mini">🏆</span>}
                  </div>
                  <div className="user-details-col">
                    <div className="user-name-line">
                      <b style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>
                        {member.nickname || member.name}
                      </b>
                      {member.name === "Pedro" && <span className="you-chip">TÚ</span>}
                      {member.relation && member.relation !== "Familia" && (
                        <span className="relation-tag">({member.relation})</span>
                      )}
                    </div>
                    <span className="activity-line-sub">
                      {member.activity ? (
                        <>
                          <b style={{ color: "var(--ink)", fontWeight: 700 }}>{member.activity}</b> · <small>{member.lastCheckIn}</small>
                        </>
                      ) : (
                        <small style={{ color: "#71897d" }}>
                          {member.workouts > 0 ? member.lastCheckIn : "Sin deporte registrado aún"}
                        </small>
                      )}
                      {(isCurrentUser || session?.user?.name?.toLowerCase().includes("pedro")) && (
                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "0 4px",
                            fontSize: "12px",
                            opacity: 0.8,
                          }}
                          onClick={() => setEditingActivityMember({ name: member.nickname || member.name, currentActivity: member.activity || "" })}
                          title="Cambiar o elegir deporte/disciplina"
                        >
                          ✏️
                        </button>
                      )}
                    </span>
                  </div>
                </div>

                <div className="row-right-actions">
                  {member.name !== "Pedro" && (
                    <button
                      type="button"
                      className={`whatsapp-motivate-btn ${isCompleted ? "completed" : isNear ? "near" : member.workouts === 2 ? "mid" : member.activity ? "completed" : "carrilla"}`}
                      onClick={() => handleSendWhatsApp(member)}
                      title={`Enviar anuncio sobre ${member.nickname || member.name} al Grupo de WhatsApp`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>
                        {isCompleted
                          ? "Felicitar 🎉"
                          : isNear
                          ? "Porras ⚡"
                          : member.workouts === 2
                          ? "Motivar 💪"
                          : member.activity
                          ? "Felicitar 🎉"
                          : "Carrilla 🔥"}
                      </span>
                    </button>
                  )}
                </div>

                <div className="row-center-progress">
                  <div className="checkin-pills-sequence">
                    {[1, 2, 3, 4].map((stepNum) => {
                      const done = stepNum <= member.workouts;
                      return (
                        <div
                          key={stepNum}
                          className={`step-pill ${done ? "done" : "empty"}`}
                          title={`Check-in ${stepNum} ${done ? "completado" : "pendiente"}`}
                        >
                          {done ? "✓" : stepNum}
                        </div>
                      );
                    })}
                  </div>
                  <div className="status-label-badge">
                    {isCompleted ? (
                      <span className="badge-done">🏆 4/4 ¡META CUMPLIDA!</span>
                    ) : isNear ? (
                      <span className="badge-near">⚡ 3/4 (A 1 día)</span>
                    ) : member.workouts === 2 ? (
                      <span className="badge-mid">🟡 2/4 (A 2 días)</span>
                    ) : (
                      <span className="badge-need">🔴 {member.workouts}/4 (¡A motivar!)</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    );
  };

  // Dashboard Tab ("Hoy")
  const renderTodayDashboard = () => {
    return (
      <div className="dashboard-grid">
        <section className="main-column">
          {/* 0. Challenge Start Countdown Banner (Septiembre 1-15) */}
          {daysUntilStart > 0 && (
            <div
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "18px",
                background: "linear-gradient(135deg, #133324 0%, #206d4a 100%)",
                color: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: "0 6px 20px rgba(24, 59, 43, 0.25)",
                overflow: "hidden",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", minWidth: 0 }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    flexShrink: 0,
                    borderRadius: "12px",
                    background: "rgba(255, 255, 255, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  🚀
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85, fontWeight: 800, display: "block" }}>
                    CUENTA REGRESIVA · RETO 4×7 SEPTIEMBRE
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "15px", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Tu Reto arranca el {startDayNumber} de Septiembre
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.9 }}>
                    {daysUntilStart === 1
                      ? "¡Falta 1 solo día! Prepárate para el arranque oficial."
                      : `¡Faltan ${daysUntilStart} días para el inicio! Puedes ir calentando con fotos.`}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", width: "100%" }}>
                <div style={{ background: "rgba(255, 255, 255, 0.2)", border: "1px solid rgba(255,255,255,0.3)", padding: "6px 14px", borderRadius: "999px", fontWeight: 800, fontSize: "12px", whiteSpace: "nowrap" }}>
                  ⏳ {daysUntilStart} {daysUntilStart === 1 ? "día restante" : "días restantes"}
                </div>
                <div style={{ flex: "1 1 180px", minWidth: 0, maxWidth: "100%" }}>
                  <select
                    value={challengeStartDate}
                    onChange={async (e) => {
                      const nextDate = e.target.value;
                      setChallengeStartDate(nextDate);
                      if (typeof window !== "undefined") {
                        try {
                          localStorage.setItem("four_seven_challenge_start_date", nextDate);
                        } catch {}
                      }
                      try {
                        await clientApi.saveProfile({ challengeStartDate: nextDate });
                        notify(`🗓️ Inicio actualizado al ${nextDate.split("-")[2]} de Septiembre.`);
                      } catch {
                        notify(`🗓️ Inicio guardado en este dispositivo.`);
                      }
                    }}
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      background: "#ffffff",
                      color: "#166534",
                      border: 0,
                      padding: "8px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      outline: "none",
                      textOverflow: "ellipsis",
                    }}
                    title="Ajustar fecha de inicio del reto"
                  >
                    {START_DATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        📅 Inicio: {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 1. Unified Master Hero Card (Check-in + Progreso + Días Reales) */}
          {renderHeroCheckInCard()}

          {/* 2. Dynamic Family Check-In Tracker Card (El Alma de la App: Familia, Avances y WhatsApp) */}
          {renderFamilyCheckInLiveCard()}

          {/* 3. Monthly Raffle Prize Card (Rifa del Mes) */}
          <article className="monthly-prize-card" style={{ marginTop: "24px" }}>
            <div className="prize-square-box">
              <img src={monthlyPrize.imageUrl} alt={monthlyPrize.title} />
              <span className="prize-badge">RIFA {monthlyPrize.month.toUpperCase()}</span>
            </div>
            <div className="prize-info-box">
              <p className="eyebrow">PREMIO DEL MES A LA CONSTANCIA</p>
              <h2>{monthlyPrize.title}</h2>
              <p className="prize-desc">{monthlyPrize.description}</p>
              <div className="prize-status-strip">
                <span className={weeklyWorkoutsCount >= 4 ? "ticket-pill active" : "ticket-pill"}>
                  {weeklyWorkoutsCount >= 4
                    ? "¡Boleto de la semana asegurado!"
                    : `Llevas ${weeklyWorkoutsCount}/4 días · ¡A ${Math.max(0, 4 - weeklyWorkoutsCount)} de asegurar boleto!`}
                </span>
                <small>Se rifa a fin de mes entre los que cumplan su 4×7</small>
              </div>
            </div>
          </article>

          {/* 4. Live Family Feed - Todas las publicaciones del muro en la pantalla de Inicio */}
          <section className="section-block" style={{ marginTop: "28px" }}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">MURO DEL DÍA · ACTIVIDAD FAMILIAR</p>
                <h2>Publicaciones y Check-ins de Hoy</h2>
              </div>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--green)" }}>
                {feedPosts.length} publicaciones
              </span>
            </div>
            {feedPosts.length ? (
              <div className="feed">
                {feedPosts.map((post) => renderPostCard(post))}
              </div>
            ) : (
              <EmptyFeed compact />
            )}
          </section>
        </section>

        <aside className="right-column">
          {renderLeagueCard()}
          {renderChallengeMini()}
        </aside>
      </div>
    );
  };

  const renderLeagueCard = () => (
    <article className="family-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">LIGA FAMILIAR</p>
          <h2>Posiciones de la semana</h2>
        </div>
        <button
          type="button"
          className="custom-info-pill-btn"
          title="¿Cómo funcionan los puntos?"
          onClick={() => setShowPointsModal(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Puntos
        </button>
      </div>
      <div className="family-total">
        <span>Puntos acumulados en familia</span>
        <strong>{totalPoints.toLocaleString("es-MX")}</strong>
        <small>+740 esta semana</small>
      </div>
      <ol className="leaderboard">
        {familyScores.map((member, index) => (
          <li key={member.name} className={member.rawName === "Pedro" || member.name === "Pedcaz" ? "you" : ""}>
            <span className="rank">{index + 1}</span>
            <span className={`avatar small ${member.color}`}>{member.initials}</span>
            <span className="member">
              <b>{member.name}</b>
              <small>{member.trend} pts</small>
            </span>
            <strong>{member.points}</strong>
          </li>
        ))}
      </ol>
      <button className="text-button" onClick={() => setActive("Liga y Retos")}>
        Ver podio y retos completos →
      </button>
    </article>
  );

  const renderChallengeMini = () => {
    const activeCh = customChallenges[0];
    return (
      <article className="challenge-card">
        <div className="challenge-art">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="14.5 17.5 3 6 6 3 17.5 14.5 14.5 17.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
          <small>DUELO</small>
        </div>
        <p className="eyebrow">RETOS ENTRE FAMILIARES</p>
        <h2>{activeCh ? activeCh.title : "¿Listo para retar a alguien?"}</h2>
        <p>
          {activeCh
            ? activeCh.desc
            : "Lanza un duelo amistoso a cualquier miembro de López y Amigos: ¡el que pierda paga los tacos o el café!"}
        </p>
        {activeCh ? (
          <div className="challenge-meta" style={{ marginTop: "12px" }}>
            <span>Recompensa: <strong>+{activeCh.rewardPoints} pts</strong></span>
            {activeCh.bet && <small>{activeCh.bet}</small>}
          </div>
        ) : (
          <div style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="primary-button"
              style={{ width: "100%", justifyContent: "center", fontSize: "12.5px", padding: "8px 10px" }}
              onClick={() => setShowNewChallengeModal(true)}
            >
              ⚔️ Lanzar el Primer Reto Familiar
            </button>
          </div>
        )}
        <button
          className="text-button"
          style={{ marginTop: "12px", width: "100%", textAlign: "center" }}
          onClick={() => setActive("Liga y Retos")}
        >
          Ver todos los retos familiares →
        </button>
      </article>
    );
  };

  const EmptyFeed = ({ compact = false }: { compact?: boolean }) => (
    <div className={`feed-empty ${compact ? "compact" : ""}`}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#257853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <div>
        <h3>El Muro está esperando el primer check-in</h3>
        <p>Haz tu check-in de hoy con una foto o frase para motivar a la familia.</p>
      </div>
      <button onClick={() => { setActive("Hoy"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
        ⚡ Hacer Check-In Ahora
      </button>
    </div>
  );

  const renderWall = () => (
    <section className="module-page">
      {renderHeroCheckInCard()}
      <div className="wall-layout" style={{ marginTop: "24px" }}>
        <div>
          <div className="module-toolbar">
            <div>
              <p>Las evidencias y frases de la familia aparecen aquí para que nadie entrene solo.</p>
            </div>
          </div>
          {feedLoading ? (
            <div className="feed-loading">Actualizando el muro familiar…</div>
          ) : feedPosts.length ? (
            <div className="feed wall-feed">
              {feedPosts.map((post) => renderPostCard(post))}
            </div>
          ) : (
            <EmptyFeed />
          )}
        </div>
        <aside className="wall-side">
          <article className="family-prompt">
            <span>🔥</span>
            <p className="eyebrow">APOYO FAMILIAR</p>
            <h3>La racha se construye juntos</h3>
            <p>Reacciona a los check-ins de tu familia y motívalos a cumplir su 4×7.</p>
          </article>
          {renderLeagueCard()}
        </aside>
      </div>
    </section>
  );

  // Weight Tracker & Photo Progress State
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [weightInputValue, setWeightInputValue] = useState("82.4");
  const [waistInputValue, setWaistInputValue] = useState("");
  const [weeklyPhotoFile, setWeeklyPhotoFile] = useState<File | null>(null);
  const [weeklyPhotoPreview, setWeeklyPhotoPreview] = useState<string | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightHistory, setWeightHistory] = useState<Array<{ week: number; date: string; weightKg: number; waistCm?: number; photoUrl?: string }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("4x7_weight_history");
        if (saved) {
          const parsed = JSON.parse(saved);
          const isMock = Array.isArray(parsed) && parsed.some((p: any) => typeof p.date === "string" && (p.date.includes("Jul") || p.date.includes("Ago")));
          if (!isMock) return parsed;
          localStorage.removeItem("4x7_weight_history");
        }
      } catch {}
    }
    return [];
  });

  // Body Measurements State
  const [bodyMeasurements, setBodyMeasurements] = useState<{
    waistCm: number;
    chestCm: number;
    hipsCm: number;
    armCm: number;
    thighCm: number;
    updatedAt: string;
  }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("4x7_body_measurements");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      waistCm: 0,
      chestCm: 0,
      hipsCm: 0,
      armCm: 0,
      thighCm: 0,
      updatedAt: "Sin registrar",
    };
  });

  const [measWaist, setMeasWaist] = useState(bodyMeasurements.waistCm > 0 ? String(bodyMeasurements.waistCm) : "");
  const [measChest, setMeasChest] = useState(bodyMeasurements.chestCm > 0 ? String(bodyMeasurements.chestCm) : "");
  const [measHips, setMeasHips] = useState(bodyMeasurements.hipsCm > 0 ? String(bodyMeasurements.hipsCm) : "");
  const [measArm, setMeasArm] = useState(bodyMeasurements.armCm > 0 ? String(bodyMeasurements.armCm) : "");
  const [measThigh, setMeasThigh] = useState(bodyMeasurements.thighCm > 0 ? String(bodyMeasurements.thighCm) : "");

  const handleSaveMeasurements = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      waistCm: parseFloat(measWaist) || bodyMeasurements.waistCm,
      chestCm: parseFloat(measChest) || bodyMeasurements.chestCm,
      hipsCm: parseFloat(measHips) || bodyMeasurements.hipsCm,
      armCm: parseFloat(measArm) || bodyMeasurements.armCm,
      thighCm: parseFloat(measThigh) || bodyMeasurements.thighCm,
      updatedAt: new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date()),
    };
    setBodyMeasurements(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("4x7_body_measurements", JSON.stringify(next));
      } catch {}
    }
    setShowMeasurementsModal(false);
    notify("📏 ¡Medidas corporales actualizadas con éxito!");
  };

  const handleWeeklyPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWeeklyPhotoFile(file);
      setWeeklyPhotoPreview(URL.createObjectURL(file));
      notify("Foto semanal seleccionada 📸");
    }
  };

  const handleSaveWeeklyWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = parseFloat(weightInputValue);
    if (!parsedWeight || parsedWeight < 30 || parsedWeight > 300) {
      notify("Ingresa un peso válido en kg");
      return;
    }
    setSavingWeight(true);
    try {
      const parsedWaist = waistInputValue ? parseFloat(waistInputValue) : undefined;
      const updatedProfile = await clientApi.addMeasurement({
        weightKg: parsedWeight,
        waistCm: parsedWaist,
      });
      setFitness(updatedProfile);

      const nextWeekNumber = weightHistory.length + 1;
      const todayStr = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date());
      setWeightHistory([
        ...weightHistory,
        {
          week: nextWeekNumber,
          date: todayStr,
          weightKg: parsedWeight,
          waistCm: parsedWaist,
          photoUrl: weeklyPhotoPreview || undefined,
        },
      ]);

      setShowWeightModal(false);
      setWeeklyPhotoFile(null);
      setWeeklyPhotoPreview(null);
      notify(`⚖️ ¡Peso de ${parsedWeight} kg guardado! Gráfica actualizada.`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "No pudimos guardar la medición");
    } finally {
      setSavingWeight(false);
    }
  };

  const renderProgress = () => {
    const currentWeight = fitness?.profile?.measurement?.weightKg ?? fitness?.measurements?.[0]?.weightKg ?? 70;
    const targetWeight = fitness?.profile?.targetWeightKg ?? 65;
    const objective = fitness?.profile?.objective || "lose_fat";
    const advice = fitness?.projection?.advice || {
      title: "Guía de Quema de Grasa Saludable",
      goalSummary: "Reducir porcentaje de grasa corporal protegiendo tu masa muscular y energía.",
      doList: [
        "Mantén la regla 4×7: 4 entrenamientos por semana combinando fuerza con cardio moderado.",
        "Aumenta el consumo de proteína y vegetales con fibra para mantener saciedad durante el día.",
        "Bebe de 2.5 a 3.5 litros de agua diarios para optimizar tu metabolismo y lipólisis celular.",
        "Registra tu peso una vez por semana en las mismas condiciones (en ayunas al despertar).",
      ],
      dontList: [
        "Evita dietas extremas o pasar hambre (provocan efecto rebote y pérdida de masa muscular).",
        "No te obsesiones con pesarte todos los días (el agua y la digestión varían de 1 a 2 kg diario).",
        "No elimines por completo los carbohidratos, son tu fuente principal de energía para entrenar.",
        "No sustituyas el descanso por suplementos 'milagro': la constancia 4×7 es la clave.",
      ],
    };

    const initialWeight = weightHistory.length > 0 ? weightHistory[0].weightKg : currentWeight;
    const totalLost = (initialWeight - currentWeight).toFixed(1);
    const remainingToTarget = Math.abs(currentWeight - targetWeight).toFixed(1);
    const isAhead = objective === "lose_fat" ? currentWeight <= initialWeight : currentWeight >= initialWeight;

    // Cálculo dinámico para la gráfica de 8 Semanas arrancando exactamente en Semana 1
    const weeklyLossRate = fitness?.projection?.weeklyPaceKg || 0.6;
    const weeksCount = 8;
    const weekLabels = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

    // Proyección de Semana 1 a Semana 8
    const projectedWeights = Array.from({ length: weeksCount }, (_, i) => {
      const p = objective === "lose_fat"
        ? Math.max(targetWeight, currentWeight - i * weeklyLossRate)
        : currentWeight + i * weeklyLossRate;
      return Number(p.toFixed(1));
    });

    // Puntos reales: inicia en Semana 1 con el peso actual del usuario (+ historial si existe)
    const realHistoryWeights: number[] = weightHistory.length > 0
      ? weightHistory.slice(0, weeksCount).map((h) => h.weightKg)
      : [currentWeight]; // Inicia exactamente en Semana 1

    const allWeights = [...projectedWeights, ...realHistoryWeights];
    const rawMin = Math.min(...allWeights);
    const rawMax = Math.max(...allWeights);
    const minY = Math.floor(rawMin - 1.5);
    const maxY = Math.ceil(rawMax + 1.5);
    const yRange = Math.max(4, maxY - minY);

    const getSvgY = (w: number) => 22 + (1 - (w - minY) / yRange) * 115;
    const weekX = (i: number) => 36 + i * 43;

    // Ticks legibles para el eje Y ajustados al rango real de peso
    const gridTicks = [
      maxY,
      Math.round(maxY - yRange * 0.25),
      Math.round(maxY - yRange * 0.5),
      Math.round(maxY - yRange * 0.75),
      minY,
    ];

    const projectedPathD = projectedWeights
      .map((w, i) => `${i === 0 ? "M" : "L"} ${weekX(i)} ${getSvgY(w).toFixed(1)}`)
      .join(" ");

    const realPathD = realHistoryWeights.length > 1
      ? realHistoryWeights
          .map((w, i) => `${i === 0 ? "M" : "L"} ${weekX(i)} ${getSvgY(w).toFixed(1)}`)
          .join(" ")
      : "";

    const realAreaD = realHistoryWeights.length > 1
      ? `${realPathD} L ${weekX(realHistoryWeights.length - 1)} 140 L ${weekX(0)} 140 Z`
      : "";

    const activeWeekIndex = realHistoryWeights.length - 1;

    return (
      <section className="module-page">
        {/* 1. Header & AI ETA Prediction */}
        <div className="progress-summary">
          <article className="progress-hero">
            <div className="progress-weight-display-card">
              <p className="eyebrow">PESO ACTUAL & COMPOSICIÓN</p>
              <div className="weight-main-row">
                <div className="weight-num-group">
                  <span className="weight-huge-num">{currentWeight}</span>
                  <span className="weight-unit-badge">kg</span>
                </div>
                <div className="bmi-status-badge">
                  <span className="bmi-dot" />
                  <span>IMC {fitness?.projection?.bmi ?? "24.5"}</span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{fitness?.projection?.bmiCategory ?? "Rango saludable"}</span>
                </div>
              </div>
              <button
                type="button"
                className="register-weight-main-btn"
                onClick={() => {
                  setWeightInputValue(String(currentWeight));
                  setWaistInputValue(String(bodyMeasurements.waistCm));
                  setShowWeightModal(true);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
                <span>Registrar peso de esta semana</span>
              </button>
            </div>

            {/* AI Estimation Banner */}
            <div className="ai-eta-banner">
              <span className="ai-badge">🤖 ANÁLISIS & PREDICCIÓN IA</span>
              <p>
                {fitness?.projection?.etaSummary ||
                  `A un ritmo saludable de 4 entrenamientos por semana, alcanzarías tu meta de ${targetWeight} kg en aproximadamente ${fitness?.projection?.estimatedWeeks || 10} a 12 semanas (cambio de ~${fitness?.projection?.weeklyPaceKg || 0.55} kg/sem).`}
              </p>
            </div>
          </article>

          <article className="goal-card">
            <p className="eyebrow">TU OBJETIVO</p>
            <h2>{targetWeight} kg</h2>
            <p>
              {objective === "lose_fat"
                ? `Llevas ${totalLost} kg bajados. Te faltan ${remainingToTarget} kg para llegar a tu meta.`
                : objective === "gain_muscle"
                ? `Construyendo masa muscular limpia. Te faltan ${remainingToTarget} kg para tu peso meta.`
                : "Manteniendo hábitos 4×7 para máxima energía y salud."}
            </p>
            <div className="goal-line">
              <i style={{ width: `${Math.min(100, Math.max(15, (Number(totalLost) / (Number(totalLost) + Number(remainingToTarget))) * 100))}%` }} />
            </div>
            <small>Ritmo saludable estimado: ~{fitness?.projection?.weeklyPaceKg || 0.55} kg por semana</small>
          </article>
        </div>

        {/* 2. Banner Motivacional: Lunes de Peso Nuevo */}
        <article className="monday-weight-banner" style={{ marginTop: "18px" }}>
          <div className="monday-banner-left">
            <span className="monday-badge">📅 LUNES DE PESO NUEVO</span>
            <h3>¡Es momento de registrar tu nuevo peso y ver tus avances! ⚖️</h3>
            <p>
              Los lunes son el día oficial de pesaje en 4×7 (en ayunas al despertar) para calibrar tu evolución semanal, medir tus avances y ajustar la proyección de la IA.
            </p>
          </div>
          <div className="monday-banner-actions">
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                setWeightInputValue(String(currentWeight));
                setWaistInputValue(String(bodyMeasurements.waistCm));
                setShowWeightModal(true);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "4px" }}><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
              Registrar mi peso hoy
            </button>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => {
                setMeasWaist(String(bodyMeasurements.waistCm));
                setMeasChest(String(bodyMeasurements.chestCm));
                setMeasHips(String(bodyMeasurements.hipsCm));
                setMeasArm(String(bodyMeasurements.armCm));
                setMeasThigh(String(bodyMeasurements.thighCm));
                setShowMeasurementsModal(true);
              }}
            >
              📏 Actualizar medidas
            </button>
          </div>
        </article>

        {/* 3. Weekly Visual Gallery (Before vs Now / Week by Week) - MOVED ABOVE CHART */}
        <article className="weekly-gallery-card" style={{ marginTop: "22px" }}>
          <div className="compare-head">
            <div>
              <p className="eyebrow">HISTORIAL & FOTOS DE EVOLUCIÓN</p>
              <h2>Tu Transformación Semana a Semana</h2>
            </div>
            <button
              className="secondary-action-btn"
              onClick={() => {
                setWeightInputValue(String(currentWeight));
                setWaistInputValue(String(bodyMeasurements.waistCm));
                setShowWeightModal(true);
              }}
            >
              ＋ Añadir nuevo registro
            </button>
          </div>

          <div className="gallery-timeline-row">
            {weightHistory.map((item, index) => {
              const prev = weightHistory[index - 1];
              const diff = prev ? (item.weightKg - prev.weightKg).toFixed(1) : null;

              return (
                <div className="gallery-item-card" key={item.week}>
                  <div className="gallery-photo-box">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={`Foto semana ${item.week}`} />
                    ) : (
                      <div className="photo-placeholder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <small>Sem {item.week}</small>
                      </div>
                    )}
                  </div>
                  <div className="gallery-item-info">
                    <div className="gallery-info-top">
                      <b>Semana {item.week}</b>
                      <small>{item.date}</small>
                    </div>
                    <strong>{item.weightKg} kg</strong>
                    {item.waistCm && <p>Cintura: {item.waistCm} cm</p>}
                    {diff && (
                      <span className={`diff-pill ${Number(diff) <= 0 ? "negative" : "positive"}`}>
                        {Number(diff) <= 0 ? `${diff} kg` : `+${diff} kg`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        {/* 4. Mis Medidas Corporales (A la vista para actualizar) */}
        <article className="measurements-card" style={{ marginTop: "22px" }}>
          <div className="measurements-header">
            <div>
              <p className="eyebrow">SEGUIMIENTO DE MEDIDAS</p>
              <h2>Mis Medidas Corporales 📏</h2>
              <p className="measurements-sub">
                Última actualización: <b>{bodyMeasurements.updatedAt}</b>. Ideal para medir reducción de tallas y tonificación.
              </p>
            </div>
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                setMeasWaist(String(bodyMeasurements.waistCm));
                setMeasChest(String(bodyMeasurements.chestCm));
                setMeasHips(String(bodyMeasurements.hipsCm));
                setMeasArm(String(bodyMeasurements.armCm));
                setMeasThigh(String(bodyMeasurements.thighCm));
                setShowMeasurementsModal(true);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "4px" }}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
              Actualizar Medidas
            </button>
          </div>

          <div className="measurements-grid">
            <div className="measure-item">
              <span className="measure-icon">◎</span>
              <div>
                <small>Cintura</small>
                <strong>{bodyMeasurements.waistCm} <span className="unit">cm</span></strong>
              </div>
              <em className="measure-trend green">-3 cm</em>
            </div>

            <div className="measure-item">
              <span className="measure-icon">🫁</span>
              <div>
                <small>Pecho / Torso</small>
                <strong>{bodyMeasurements.chestCm} <span className="unit">cm</span></strong>
              </div>
              <em className="measure-trend">+1.5 cm</em>
            </div>

            <div className="measure-item">
              <span className="measure-icon">👖</span>
              <div>
                <small>Cadera</small>
                <strong>{bodyMeasurements.hipsCm} <span className="unit">cm</span></strong>
              </div>
              <em className="measure-trend green">-2 cm</em>
            </div>

            <div className="measure-item">
              <span className="measure-icon">💪</span>
              <div>
                <small>Brazo</small>
                <strong>{bodyMeasurements.armCm} <span className="unit">cm</span></strong>
              </div>
              <em className="measure-trend">+1 cm</em>
            </div>

            <div className="measure-item">
              <span className="measure-icon">🦵</span>
              <div>
                <small>Muslo</small>
                <strong>{bodyMeasurements.thighCm} <span className="unit">cm</span></strong>
              </div>
              <em className="measure-trend green">-1.5 cm</em>
            </div>
          </div>
        </article>

        {/* 5. Comparison Chart: Real vs Proyección */}
        <article className="chart-comparison-card" style={{ marginTop: "22px" }}>
          <div className="compare-head">
            <div>
              <p className="eyebrow">EVOLUCIÓN SEMANA A SEMANA</p>
              <h2>Tu Peso vs Proyección</h2>
            </div>
            <div className="chart-legend-row">
              <span><i className="legend-dot real" /> Real</span>
              <span><i className="legend-dot projected" /> Proyección</span>
            </div>
          </div>

          {/* AI Comparison Feedback */}
          <div className={`ai-comparison-feedback ${isAhead ? "ahead" : "ontrack"}`}>
            <span>🎯</span>
            <p>
              <strong>¡Semana 1 del Reto!</strong> Tu hábito de 4 entrenamientos por semana te mantiene en ruta hacia tu meta de {targetWeight} kg.
            </p>
          </div>

          {/* SVG Line Chart */}
          <div className="svg-chart-wrapper">
            <svg viewBox="0 0 360 170" className="weight-line-svg">
              <defs>
                <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1c5a40" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#1c5a40" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines adaptadas a tu rango real de peso */}
              {gridTicks.map((w, idx) => {
                const y = getSvgY(w);
                return (
                  <g key={`${w}-${idx}`}>
                    <line x1="32" y1={y} x2="340" y2={y} stroke="#edf3ef" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="26" y={y + 3} textAnchor="end" fontSize="8.5" fill="#8d9d94" fontWeight="600">
                      {w}k
                    </text>
                  </g>
                );
              })}

              {/* Projected Line (Dashed Mint) de Semana 1 a Semana 8 */}
              <path
                d={projectedPathD}
                fill="none"
                stroke="#68d598"
                strokeWidth="2.5"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />

              {/* Real Area Gradient (si hay más de 1 semana registrada) */}
              {realAreaD && (
                <path d={realAreaD} fill="url(#realGrad)" />
              )}

              {/* Real Line (Solid Emerald, si hay más de 1 semana registrada) */}
              {realPathD && (
                <path
                  d={realPathD}
                  fill="none"
                  stroke="#1c5a40"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Real Points: Inicia exactamente en Semana 1 con el peso actual */}
              {realHistoryWeights.map((w, i) => {
                const cx = weekX(i);
                const cy = getSvgY(w);
                const isLatest = i === activeWeekIndex;
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r="5" fill="#1c5a40" stroke="#ffffff" strokeWidth="2.5" />
                    {isLatest && (
                      <g transform={`translate(${cx}, ${cy - 12})`}>
                        <rect x="-22" y="-12" width="44" height="15" rx="5" fill="#1c5a40" />
                        <text x="0" y="-2" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="850">
                          {w} kg
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* X Axis Week Labels (Sem 1 destacada, Sem 2-8 como proyección futura) */}
              {weekLabels.map((label, i) => {
                const x = weekX(i);
                const isDone = i <= activeWeekIndex;
                return (
                  <text
                    key={label}
                    x={x}
                    y="160"
                    textAnchor="middle"
                    fontSize="8.5"
                    fill={isDone ? "#1c5a40" : "#92a299"}
                    fontWeight={isDone ? "850" : "600"}
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
          </div>
        </article>

        {/* 6. Intelligent Do & Don't Guide (Personalized to Objective) */}
        <article className="advice-guide-card" style={{ marginTop: "24px" }}>
          <div className="guide-header">
            <div>
              <p className="eyebrow">ESTRATEGIA RECOMENDADA POR IA</p>
              <h2>{advice.title}</h2>
              <p className="guide-subtitle">{advice.goalSummary}</p>
            </div>
            <span className="guide-icon-badge">{objective === "gain_muscle" ? "💪" : "🥗"}</span>
          </div>

          <div className="do-dont-grid">
            <div className="do-column">
              <div className="col-header-badge do-badge">
                <span>✓</span> QUÉ HACER
              </div>
              <ul>
                {advice.doList.map((item, i) => (
                  <li key={i}>
                    <span className="bullet-check">✓</span>
                    <p>{item}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="dont-column">
              <div className="col-header-badge dont-badge">
                <span>✕</span> QUÉ EVITAR
              </div>
              <ul>
                {advice.dontList.map((item, i) => (
                  <li key={i}>
                    <span className="bullet-cross">✕</span>
                    <p>{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>
    );
  };



  const renderRecords = () => {
    const registeredCount = personalRecords.filter((r) => r.weightLbs > 0).length;
    const maxRecord = personalRecords.reduce((max, r) => (r.weightLbs > max.weightLbs ? r : max), { weightLbs: 0, machineName: "Ninguno" });

    const categories = ["Todos", "Pecho", "Pierna", "Espalda", "Hombros y Brazos"];
    const equipmentList = recordsCategoryFilter === "Todos"
      ? gymEquipmentCatalog
      : gymEquipmentCatalog.filter((e) => e.category === recordsCategoryFilter);

    return (
      <section className="module-page">
        {/* Hero Banner */}
        <div className="records-hero">
          <div className="records-hero-left">
            <span className="hero-status-pill-gold">🏆 VITRINA DE MÁXIMAS CARGAS EN LIBRAS</span>
            <h2>Mis Récords Personales (PRs)</h2>
            <p>
              Registra el peso máximo que puedes cargar en cada aparato, supera tus marcas semana a semana y comparte tu buena vibra con tu familia en el Muro.
            </p>
          </div>
          <div className="records-hero-stats">
            <div className="record-kpi-pill">
              <small>Récords Registrados</small>
              <strong>{registeredCount} PRs</strong>
            </div>
            <div className="record-kpi-pill">
              <small>Máxima Carga</small>
              <strong>{maxRecord?.weightLbs || 0} <span style={{ fontSize: "12px", color: "#e2e8f0" }}>lbs</span></strong>
            </div>
          </div>
        </div>

        {/* Action Button & Categories */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginTop: "20px" }}>
          <div className="records-category-filter" style={{ margin: 0 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`f-filter-pill ${recordsCategoryFilter === cat ? "active" : ""}`}
                onClick={() => setRecordsCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => handleOpenNewRecordModal()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "5px" }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ＋ Registrar Nuevo Récord / PR
          </button>
        </div>

        {/* Records Grid */}
        <div className="records-grid" style={{ marginTop: "18px" }}>
          {equipmentList.map((eq) => {
            const rec = personalRecords.find((p) => p.machineId === eq.id);
            const hasRecord = rec && rec.weightLbs > 0;
            const weightLbs = hasRecord ? rec.weightLbs : 0;
            const reps = hasRecord ? rec.reps : 0;
            const date = hasRecord ? rec.date : "Sin registrar";
            const gain = hasRecord && rec.previousWeightLbs ? rec.weightLbs - rec.previousWeightLbs : null;

            return (
              <article className="record-card" key={eq.id} style={{ opacity: hasRecord ? 1 : 0.96 }}>
                {/* 3D Machine Image Render */}
                <div className="record-card-media">
                  <img
                    src={eq.imageUrl || "/images/machines/bench_flat.jpg"}
                    alt={eq.name}
                    loading="lazy"
                  />
                </div>

                <div className="record-card-top">
                  <div className="record-apparatus-info">
                    <span className="record-icon-box">{eq.icon}</span>
                    <div>
                      <h3>{eq.name}</h3>
                      <span className="record-cat-tag">{eq.category}</span>
                    </div>
                  </div>
                </div>

                <div className="record-main-display">
                  <div className="record-weight-val" style={{ color: hasRecord ? "var(--ink)" : "#94a3b8" }}>
                    {weightLbs}
                    <small>lbs</small>
                  </div>
                  <span
                    className="record-reps-chip"
                    style={{
                      background: hasRecord ? "#e6f6ee" : "#f1f5f9",
                      color: hasRecord ? "#175239" : "#64748b",
                    }}
                  >
                    {hasRecord ? `${reps} reps` : "0 reps"}
                  </span>
                </div>

                <div className="record-meta-line">
                  {hasRecord ? (
                    gain && gain > 0 ? (
                      <span className="record-gain-badge">🔥 +{gain} lbs superadas</span>
                    ) : (
                      <span className="record-gain-badge" style={{ background: "#f0fdf4", color: "#166534" }}>✓ Récord activo</span>
                    )
                  ) : (
                    <span className="record-gain-badge" style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
                      ⚪ En ceros (Listo para ti)
                    </span>
                  )}
                  <span className="record-date-sub">📅 {date}</span>
                </div>

                {rec?.note && (
                  <p style={{ margin: "0", fontSize: "11px", color: "var(--muted)", fontStyle: "italic" }}>
                    "{rec.note}"
                  </p>
                )}

                <div className="record-card-actions">
                  <button
                    type="button"
                    className="record-action-update"
                    onClick={() => handleOpenNewRecordModal(eq.id)}
                    title={hasRecord ? "Actualizar o subir carga" : "Registrar peso en este aparato"}
                    style={{ width: hasRecord ? "auto" : "100%", justifyContent: "center" }}
                  >
                    <span>{hasRecord ? "⚡ Subir carga" : "＋ Registrar mi récord"}</span>
                  </button>
                  {hasRecord && (
                    <button
                      type="button"
                      className="record-action-share"
                      onClick={() => handleShareRecordDirect(rec)}
                      title="Compartir en el Muro Familiar"
                    >
                      <span>📣 Compartir</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Quick Add Banner for Remaining Equipment */}
        <article className="challenge-banner" style={{ marginTop: "28px" }}>
          <div>
            <span className="banner-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M6 8v8"/><path d="M4 9v6"/><path d="M18 8v8"/><path d="M20 9v6"/></svg>
            </span>
            <div>
              <p className="eyebrow">AMPLÍA TU VITRINA DE FUERZA</p>
              <h2>¿Probaste un aparato nuevo en el gimnasio?</h2>
              <p>Registra tu carga máxima en Sentadilla Hack, Hip Thrust, Poleas o Mancuernas para monitorear tu progresión de sobrecarga.</p>
            </div>
          </div>
          <button
            type="button"
            className="primary-button"
            style={{ alignSelf: "center" }}
            onClick={() => handleOpenNewRecordModal()}
          >
            ＋ Registrar otro aparato
          </button>
        </article>
      </section>
    );
  };



  const renderLeagueAndChallenges = () => {
    const currentUserName = session?.user.name.split(" ")[0] || "Pedro";

    return (
      <section className="module-page">
        <div className="league-hero">
          <div>
            <p className="eyebrow">PUNTOS TOTALES EN FAMILIA</p>
            <strong>{totalPoints.toLocaleString("es-MX")}</strong>
            <span>+740 esta semana</span>
          </div>
          <div className="podium">
            <div>
              <span className={`avatar ${familyScores[1]?.color || "mint"}`}>
                {familyScores[1]?.initials || "P"}
              </span>
              <b>{familyScores[1]?.name || "Pedro"}</b>
              <i>2</i>
            </div>
            <div className="winner">
              <span className="crown">♛</span>
              <span className={`avatar ${familyScores[0]?.color || "coral"}`}>
                {familyScores[0]?.initials || "A"}
              </span>
              <b>{familyScores[0]?.name || "Ana"}</b>
              <i>1</i>
            </div>
            <div>
              <span className={`avatar ${familyScores[2]?.color || "lilac"}`}>
                {familyScores[2]?.initials || "S"}
              </span>
              <b>{familyScores[2]?.name || "Sofi"}</b>
              <i>3</i>
            </div>
          </div>
        </div>

        <div className="league-grid">
          <article className="ranking-full">
            <div className="card-heading" style={{ marginBottom: "12px" }}>
              <p className="eyebrow" style={{ margin: 0 }}>CLASIFICACIÓN DE LA SEMANA</p>
              <button
                type="button"
                className="custom-info-pill-btn"
                onClick={() => setShowPointsModal(true)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                ¿Cómo se ganan puntos?
              </button>
            </div>
            {familyScores.map((member, index) => (
              <div key={member.name} className={member.rawName === currentUserName || member.name === "Pedcaz" ? "you" : ""}>
                <b className="rank">{index + 1}</b>
                <span className={`avatar ${member.color}`}>{member.initials}</span>
                <p>
                  <strong>
                    {member.name}
                    {member.rawName === currentUserName || member.name === "Pedcaz" ? " · Tú" : ""}
                  </strong>
                  <small>{member.workouts}/4 entrenamientos de la semana</small>
                </p>
                <em>{member.points} pts</em>
              </div>
            ))}
          </article>
        </div>

        {/* Family Challenges Header & Action Button */}
        <div className="challenge-banner" style={{ marginTop: "24px" }}>
          <div>
            <span className="banner-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="14.5 17.5 3 6 6 3 17.5 14.5 14.5 17.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
            </span>
            <div>
              <p className="eyebrow">RETOS FAMILIARES (OPCIONALES)</p>
              <h2>Duelos y Retos entre la Familia</h2>
              <p>Reta a uno o a todos tus familiares con una apuesta sana para motivarse a entrenar.</p>
            </div>
          </div>
          <button
            className="primary-button"
            style={{ alignSelf: "center" }}
            onClick={() => setShowNewChallengeModal(true)}
          >
            ＋ Lanzar Reto Familiar
          </button>
        </div>

        {/* Custom Challenges List */}
        {customChallenges.length === 0 ? (
          <div
            style={{
              padding: "42px 24px",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "24px",
              border: "1.5px dashed #cbd5e1",
              marginTop: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "38px" }}>⚔️</span>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#1e293b" }}>
              Aún no hay retos activos en la familia
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", maxWidth: "440px", lineHeight: "1.55" }}>
              Esta sección está limpia y en ceros para que ustedes inicien sus propios duelos. Reta a cualquier miembro de López y Amigos: ¡el que no cumpla sus 4 días paga los tacos o el café!
            </p>
            <button
              type="button"
              className="primary-button"
              style={{ marginTop: "4px" }}
              onClick={() => setShowNewChallengeModal(true)}
            >
              ＋ Lanzar el Primer Reto Familiar
            </button>
          </div>
        ) : (
          <div className="challenge-grid">
            {customChallenges.map((challenge) => {
              const isCompleted = challenge.completedBy.includes(currentUserName);
              const isTargeted =
                challenge.targets.includes("Toda la Familia") ||
                challenge.targets.includes(currentUserName) ||
                challenge.creator === currentUserName;

              return (
                <article className="challenge-full" key={challenge.id}>
                  <div className="challenge-full-top">
                    <span className="challenge-creator-tag">De: {challenge.creator}</span>
                    <b className="challenge-reward-badge">+{challenge.rewardPoints} PTS</b>
                  </div>
                  <h2>{challenge.title}</h2>
                  <p>{challenge.desc}</p>
                  
                  <div className="challenge-target-row">
                    <small>Dirigido a:</small>
                    {challenge.targets.map((t) => (
                      <span key={t} className="target-pill">
                        {t}
                      </span>
                    ))}
                  </div>

                  {challenge.bet && (
                    <div className="challenge-bet-box">
                      <span>Apuesta amistosa:</span>
                      <strong>{challenge.bet}</strong>
                    </div>
                  )}

                  <div className="challenge-action-row">
                    {isCompleted ? (
                      <button className="completed-btn" disabled>
                        ✓ ¡Reto Cumplido! (+{challenge.rewardPoints} pts ganados)
                      </button>
                    ) : (
                      <button
                        className="primary-challenge-btn"
                        onClick={() => handleCompleteChallenge(challenge.id)}
                      >
                        ✓ Marcar como Cumplido (+{challenge.rewardPoints} PTS)
                      </button>
                    )}
                  </div>

                  {challenge.completedBy.length > 0 && (
                    <div className="challenge-achievers">
                      <small>Cumplido por:</small>
                      <b>{challenge.completedBy.join(", ")} 🎉</b>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  // Dedicated Full-Screen Executive Admin Panel
  const renderAdminDashboardView = () => {
    return (
      <section className="module-page admin-full-dashboard">
        {/* Top Header of Admin View */}
        <div className="admin-hero-banner">
          <div className="admin-hero-left">
            <button
              type="button"
              className="admin-back-app-btn"
              onClick={() => {
                setInAdminView(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ← Volver a la App 4×7
            </button>
            <div style={{ marginTop: "12px" }}>
              <span className="admin-pro-pill">👑 PANEL DE CONTROL PRIVADO</span>
              <h2>Administración del Sistema</h2>
              <p>Control de usuarios, seguridad de contraseñas y premio del mes de la familia.</p>
            </div>
          </div>
          <div className="admin-hero-badge-box">
            <span className="avatar mint mini" style={{ width: 28, height: 28, fontSize: 12 }}>P</span>
            <div>
              <b>{session?.user.name}</b>
              <small>Administrador Principal</small>
            </div>
          </div>
        </div>

        {/* Executive KPI Stats Cards */}
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <span className="kpi-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <div>
              <p>USUARIOS REGISTRADOS</p>
              <strong>{adminUsers.length}</strong>
              <small>Miembros activos</small>
            </div>
          </div>
          <div className="admin-kpi-card">
            <span className="kpi-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1a2 2 0 0 0-2.83 0l-2.34 2.34a2 2 0 0 1-2.83 0l-7.17-7.17a2 2 0 0 1 0-2.83L7.17 9.17a2 2 0 0 0 0-2.83L6.17 5.34a2 2 0 0 1 0-2.83l.83-.83a2 2 0 0 1 2.83 0l1.17 1.17a2 2 0 0 0 2.83 0l2.34-2.34a2 2 0 0 1 2.83 0l7.17 7.17a2 2 0 0 1 0 2.83l-2.34 2.34a2 2 0 0 0 0 2.83l1 1"/></svg>
            </span>
            <div>
              <p>CHECK-INS TOTALES</p>
              <strong>{adminUsers.reduce((acc, u) => acc + (u.workoutCount || 0), 0)}</strong>
              <small>Entrenamientos registrados</small>
            </div>
          </div>
          <div className="admin-kpi-card">
            <span className="kpi-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2"/></svg>
            </span>
            <div>
              <p>CALIFICADOS A LA RIFA</p>
              <strong>{adminUsers.filter((u) => u.eligibleForPrize).length}</strong>
              <small>Cumplen meta 4×7</small>
            </div>
          </div>
          <div className="admin-kpi-card highlight">
            <span className="kpi-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
            </span>
            <div>
              <p>RIFA ACTIVA</p>
              <strong style={{ fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                {monthlyPrize.title}
              </strong>
              <small>{monthlyPrize.month}</small>
            </div>
          </div>
        </div>

        {/* Large Navigation Tabs */}
        <div className="admin-tabs-bar">
          <button
            type="button"
            className={adminTab === "prize" ? "admin-tab-btn active" : "admin-tab-btn"}
            onClick={() => setAdminTab("prize")}
          >
            Rifa y Premio del Mes
          </button>
          <button
            type="button"
            className={adminTab === "users" ? "admin-tab-btn active" : "admin-tab-btn"}
            onClick={() => setAdminTab("users")}
          >
            Usuarios & Contraseñas ({adminUsers.length})
          </button>
          <button
            type="button"
            className={adminTab === "family" ? "admin-tab-btn active" : "admin-tab-btn"}
            onClick={() => setAdminTab("family")}
          >
            Familia & Miembros
          </button>
        </div>

        {/* TAB 1: PREMIO DEL MES */}
        {adminTab === "prize" && (
          <div className="admin-tab-content-card">
            <div className="admin-pane-header">
              <div>
                <h3>Configuración de la Rifa Mensual</h3>
                <p>El premio que configures aquí aparecerá en la pantalla de Inicio para motivar a toda la familia a cumplir sus 4 días.</p>
              </div>
            </div>

            <form onSubmit={handleSavePrize} className="admin-prize-pro-form">
              <div className="prize-pro-grid">
                {/* Square Photo Uploader & Live Preview */}
                <div className="prize-pro-uploader">
                  <p className="eyebrow" style={{ marginBottom: "6px" }}>FOTO CUADRADA DEL PREMIO (1:1)</p>
                  <div className="square-prize-frame">
                    <img src={prizeImgEdit} alt="Foto del premio" />
                    <span className="badge-preview-tag">VISTA PREVIA</span>
                  </div>
                  <label className="primary-upload-square-btn">
                    <span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "6px" }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Subir foto desde mi Celular
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePrizePhotoSelect}
                      style={{ display: "none" }}
                    />
                  </label>
                  <small className="field-hint">Se muestra en la pantalla de inicio con formato cuadrado.</small>
                </div>

                {/* Form fields */}
                <div className="prize-pro-fields">
                  <label className="pro-label">
                    <span>Título del premio de la rifa *</span>
                    <input
                      type="text"
                      required
                      className="pro-input"
                      value={prizeTitleEdit}
                      onChange={(e) => setPrizeTitleEdit(e.target.value)}
                      placeholder="Ej. Smartwatch Deportivo o Audífonos Pro"
                    />
                  </label>

                  <div className="pro-row-2">
                    <label className="pro-label">
                      <span>Mes del sorteo</span>
                      <input
                        type="text"
                        className="pro-input"
                        value={prizeMonthEdit}
                        onChange={(e) => setPrizeMonthEdit(e.target.value)}
                        placeholder="Ej. Agosto 2026"
                      />
                    </label>

                    <label className="pro-label">
                      <span>Mínimo de check-ins semanales</span>
                      <input
                        type="number"
                        className="pro-input"
                        disabled
                        value={4}
                      />
                    </label>
                  </div>

                  <label className="pro-label">
                    <span>URL de la imagen (opcional si no subes archivo)</span>
                    <input
                      type="url"
                      className="pro-input"
                      value={prizeImgEdit}
                      onChange={(e) => setPrizeImgEdit(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                    />
                  </label>

                  <label className="pro-label">
                    <span>Descripción y reglas de la rifa</span>
                    <textarea
                      rows={3}
                      className="pro-textarea"
                      value={prizeDescEdit}
                      onChange={(e) => setPrizeDescEdit(e.target.value)}
                      placeholder="Cumple mínimo tus 4 check-ins por semana en Agosto y participa automáticamente en la rifa familiar del mes."
                    />
                  </label>

                  <button type="submit" className="primary-button full" style={{ marginTop: "10px", padding: "14px" }}>
                    ✓ Guardar y Publicar Premio del Mes
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: GESTIÓN DE USUARIOS Y CONTRASEÑAS */}
        {adminTab === "users" && (
          <div className="admin-tab-content-card">
            <div className="admin-pane-header">
              <div>
                <h3>Directorio de Usuarios Registrados</h3>
                <p>Puedes restablecer contraseñas de cualquier familiar si la olvidan o gestionar las cuentas del sistema.</p>
              </div>
            </div>

            <div className="admin-users-table-list">
              {adminUsers.map((u) => (
                <div className="admin-user-card-item" key={u.id}>
                  <div className="user-card-main-info">
                    <span className="avatar mint" style={{ width: 42, height: 42, fontSize: 16 }}>
                      {u.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h4>{u.name}</h4>
                        {u.email === session?.user.email && <span className="current-admin-pill">Tú (Admin)</span>}
                      </div>
                      <p className="user-email-text">{u.email}</p>
                      <div className="user-meta-pills">
                        <span>Registrado: {u.createdAt}</span>
                        <span>{u.workoutCount} Entrenamientos</span>
                        <span className={u.eligibleForPrize ? "ticket-status-pill done" : "ticket-status-pill"}>
                          {u.eligibleForPrize ? "Boleto Ganado" : "Boleto Pendiente"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="user-card-actions">
                    <button
                      type="button"
                      className="admin-action-btn reset"
                      onClick={() => {
                        setSelectedUserForPassword({ id: u.id, name: u.name });
                        setNewPasswordVal("familia123");
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "4px" }}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
                      Restablecer Contraseña
                    </button>
                    {u.email !== session?.user.email && (
                      <button
                        type="button"
                        className="admin-action-btn delete"
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        title="Eliminar usuario"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "4px" }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Sub-card to reset password */}
            {selectedUserForPassword && (
              <div className="reset-pass-pro-modal-box" style={{ marginTop: "20px" }}>
                <div className="reset-pass-top">
                  <div>
                    <h4>Restablecer Contraseña de: <u>{selectedUserForPassword.name}</u></h4>
                    <p>Ingresa la nueva contraseña con la que podrá iniciar sesión.</p>
                  </div>
                  <button type="button" className="close-mini-btn" onClick={() => setSelectedUserForPassword(null)}>✕</button>
                </div>
                <form onSubmit={handleResetPasswordSubmit} className="reset-pass-pro-form">
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      required
                      minLength={6}
                      className="pro-input"
                      style={{ flex: 1, minWidth: "200px" }}
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      placeholder="Escribe la nueva contraseña..."
                    />
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={() => setNewPasswordVal("familia" + Math.floor(100 + Math.random() * 900))}
                    >
                      🎲 Generar Fácil
                    </button>
                    <button type="submit" className="primary-button">
                      ✓ Guardar Contraseña
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FAMILIA Y AJUSTES */}
        {adminTab === "family" && (
          <div className="admin-tab-content-card">
            <div className="admin-pane-header">
              <div>
                <h3>Información de tu Familia 4×7 🏷️</h3>
                <p>Grupo oficial y espacio privado para los entrenamientos y la liga.</p>
              </div>
            </div>

            <div className="admin-family-info-box">
              <p className="eyebrow">EQUIPO ACTIVO</p>
              <h2>{session?.family.name || "López y Amigos"}</h2>
              <p>Todos los integrantes que se registren quedan automáticamente unidos a este equipo y compiten en la liga familiar.</p>
              <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", background: "#eef8f2", color: "var(--green-dark)", fontSize: "12px", fontWeight: 700 }}>
                ✓ Registro automático predeterminado a López y Amigos
              </div>
            </div>

            <div className="admin-family-info-box" style={{ marginTop: "16px", border: "1px solid #fee2e2", background: "#fffaf0" }}>
              <p className="eyebrow" style={{ color: "#dc2626" }}>OPERACIÓN OFICIAL Y LIMPIEZA</p>
              <h3 style={{ margin: "4px 0 8px 0", color: "#991b1b" }}>Reiniciar Marcador y Limpiar Pruebas 🧹</h3>
              <p style={{ fontSize: "13px", color: "#7f1d1d", margin: 0 }}>
                Elimina todas las publicaciones, entrenamientos y comentarios de prueba para dejar la Liga y el Muro 100% limpios en ceros para el inicio oficial del reto.
              </p>
              <button
                type="button"
                className="secondary-action-btn"
                style={{ marginTop: "12px", background: "#ef4444", color: "#ffffff", border: "0", fontWeight: 800, padding: "9px 18px", borderRadius: "10px", cursor: "pointer", fontSize: "12px" }}
                onClick={handleClearTestData}
              >
                🧹 Limpiar Pruebas y Dejar en Ceros
              </button>
            </div>
          </div>
        )}
      </section>
    );
  };

  if (sessionLoading || (session && profileLoading)) {
    return (
      <main className="app-loading">
        <div className="auth-brand">
          <span>4×7</span>
          <i />
        </div>
        <p>Preparando el espacio de tu familia…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={(current) => {
          setSession(current);
          setSessionLoading(false);
          setProfileLoading(true);

          const cachedProfile = getStoredProfile(current?.user?.name);
          if (cachedProfile?.profile) {
            setFitness(cachedProfile);
          }

          Promise.all([clientApi.profile(), clientApi.feed()])
            .then(([profile, feed]) => {
              const finalProf = profile?.profile ? profile : cachedProfile;
              if (finalProf?.profile) {
                try {
                  if (current?.user?.name) {
                    localStorage.setItem(`four_seven_profile_${current.user.name}`, JSON.stringify(finalProf));
                  }
                  localStorage.setItem("four_seven_saved_profile", JSON.stringify(finalProf));
                } catch {}
                setFitness(finalProf);
              }
              const finalFeed = feed?.posts && Array.isArray(feed.posts) ? feed.posts : [];
              setFeedPosts(finalFeed);
              if (feed?.familyProfiles) {
                setFamilyProfiles((prev) => ({ ...prev, ...feed.familyProfiles }));
              }
              if (feed?.familyStats) {
                setFamilyStats((prev) => ({ ...prev, ...feed.familyStats }));
              }
              syncUserCheckInState(current.user.email, current.user.id, finalFeed);
            })
            .catch((err) => {
              console.warn("Post-auth sync fallback:", err);
            })
            .finally(() => setProfileLoading(false));
        }}
      />
    );
  }

  if (profileLoading) {
    return (
      <main className="app-loading">
        <div className="auth-brand">
          <span>4×7</span>
          <i />
        </div>
        <p>Preparando tu espacio familiar…</p>
      </main>
    );
  }

  if (!fitness?.profile) {
    return (
      <ProfileOnboarding
        name={session.user.name}
        onComplete={(result) => {
          try {
            const localKey = `four_seven_profile_${session.user.name}`;
            localStorage.setItem(localKey, JSON.stringify(result));
            localStorage.setItem("four_seven_saved_profile", JSON.stringify(result));
          } catch {}
          setFitness(result);
        }}
      />
    );
  }

  const page = inAdminView
    ? renderAdminDashboardView()
    : active === "Hoy"
    ? renderTodayDashboard()
    : active === "Muro"
    ? renderWall()
    : active === "Liga y Retos"
    ? renderLeagueAndChallenges()
    : active === "Mis Récords"
    ? renderRecords()
    : renderProgress();

  const userName = session?.user?.name || "Usuario";
  const familyName = session?.family?.name || "López y Amigos";

  const currentTitle = inAdminView
    ? "Panel de Control Administrador"
    : active === "Hoy"
    ? `Buenas tardes, ${userName.split(" ")[0]}`
    : titleCopy[active][1];

  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const copyInvite = async () => {
    const link = typeof window !== "undefined" ? window.location.origin : "https://4x7.vercel.app";
    await navigator.clipboard?.writeText(`¡Únete a nuestro reto familiar 4×7 en ${familyName}! Regístrate aquí: ${link}`);
    notify(`Enlace de invitación a ${familyName} copiado 📋`);
  };

  const logout = async () => {
    await clientApi.logout().catch(() => undefined);
    setSession(null);
    setLogged(false);
    setWeeklyWorkoutsCount(0);
    setCompletedCheckInDates([]);
    setFeedPosts(INITIAL_FAMILY_FEED);
    setActive("Hoy");
  };

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand" onClick={handleLogoClick} style={{ cursor: "pointer" }} title="4×7 Familiar">
          <span className="brand-mark">4×7</span>
          <span className="brand-dot" />
        </div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              className={!inAdminView && active === item ? "nav-item active" : "nav-item"}
              key={item}
              onClick={() => {
                setInAdminView(false);
                setActive(item);
                if (item === "Muro" || item === "Hoy") loadFeed();
              }}
            >
              <Glyph label={item} />
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <button className="family-pulse family-code" onClick={copyInvite}>
          <div className="pulse-top">
            <span>{session.family.name}</span>
            <b>COMPARTIR</b>
          </div>
          <div className="pulse-bar">
            <i />
          </div>
          <p>
            Equipo: <strong>{session.family.name}</strong>
          </p>
        </button>

        <div className="profile-card">
          <span className="avatar mint">{initials}</span>
          <span>
            <b>{session.user.name}</b>
            <small>{session.user.email}</small>
          </span>
          <button className="logout-mini" onClick={logout} aria-label="Cerrar sesión">
            ↪
          </button>
        </div>
      </aside>

      <section className="workspace">
        {/* Topbar with 4×7 Brand Badge and Discreet Logout */}
        <header className="topbar">
          <div className="topbar-left-titles">
            <p className="eyebrow">
              {inAdminView ? "ZONA PRIVADA" : titleCopy[active][0]}
            </p>
            <h1>{currentTitle}</h1>
          </div>
          <div className="top-actions-cluster">
            {/* 1. Reglas & Sistema de Puntos */}
            <button
              type="button"
              className="top-pill-btn rules-pill"
              onClick={() => setShowPointsModal(true)}
              title="Reglas 4×7 y Sistema de Puntos"
            >
              <span className="pill-star-icon">⚡</span>
              <span className="pill-text-label">Reglas</span>
            </button>

            {/* 2. User & Logout Action */}
            <button
              type="button"
              className="top-pill-btn user-logout-btn"
              onClick={logout}
              title="Cerrar sesión"
            >
              <span className="user-initial-dot">{session.user.name.charAt(0).toUpperCase()}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>

            {/* 3. Official 4×7 League Badge */}
            <button
              type="button"
              className="top-league-badge-btn"
              onClick={handleLogoClick}
              title="4×7 Liga Familiar (Toca 3 veces para Admin)"
            >
              <span className="badge-flame">🔥</span>
              <span className="badge-brand-text">4×7</span>
            </button>
          </div>
        </header>
        {page}
      </section>

      <nav className="mobile-nav">
        {navItems.map((item) => (
          <button
            key={item}
            className={active === item ? "active" : ""}
            onClick={() => {
              setActive(item);
              if (item === "Muro" || item === "Hoy") loadFeed();
            }}
          >
            <Glyph label={item} />
            <small>{item}</small>
          </button>
        ))}
      </nav>

      {/* Points System Explanation Modal with Progressive Ladder */}
      {showPointsModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowPointsModal(false)}>
          <section
            className="points-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close-button" onClick={() => setShowPointsModal(false)} aria-label="Cerrar">
              ✕
            </button>
            <p className="eyebrow">ESCALERA DE PUNTOS Y RECOMPENSAS</p>
            <h2>¿Cómo funcionan los puntos en 4×7?</h2>
            <p className="modal-intro">
              El objetivo obligatorio son 4 días a la semana (de lunes a domingo). Cada día adicional te da más puntos para premiar tu constancia.
            </p>

            <div className="points-rules-grid">
              <article className="points-rule-item">
                <div className="rule-item-top">
                  <span className="rule-badge soft-mint">Días 1, 2 y 3</span>
                  <strong className="rule-pts-val">+100 pts / día</strong>
                </div>
                <div className="rule-item-body">
                  <b>Check-in diario normal</b>
                  <p>Sumas 100 puntos por cada sesión de ejercicio que registres.</p>
                </div>
              </article>

              <article className="points-rule-item highlight-target">
                <div className="rule-item-top">
                  <span className="rule-badge soft-sun">Día 4 · Meta 4×7</span>
                  <strong className="rule-pts-val gold">+300 pts</strong>
                </div>
                <div className="rule-item-body">
                  <b>Meta Obligatoria (+100 check-in + 200 Bono)</b>
                  <p>Al cumplir los 4 días obligatorios de la semana, aseguras tu racha familiar, tu boleto de la rifa y sumas el bono semanal.</p>
                </div>
              </article>

              <article className="points-rule-item">
                <div className="rule-item-top">
                  <span className="rule-badge soft-fire">Día 5 · Modo Bestia</span>
                  <strong className="rule-pts-val fire">+250 pts extra</strong>
                </div>
                <div className="rule-item-body">
                  <b>Bono por dar la milla extra</b>
                  <p>Por dar la milla extra y entrenar un 5° día en la semana (+100 check-in + 150 Bono).</p>
                </div>
              </article>

              <article className="points-rule-item">
                <div className="rule-item-top">
                  <span className="rule-badge soft-fire">Día 6 · Nivel Leyenda</span>
                  <strong className="rule-pts-val fire">+350 pts extra</strong>
                </div>
                <div className="rule-item-body">
                  <b>Superconstancia</b>
                  <p>Por meter un 6° día de ejercicio antes del domingo (+100 check-in + 250 Bono).</p>
                </div>
              </article>

              <article className="points-rule-item highlight-gold">
                <div className="rule-item-top">
                  <span className="rule-badge soft-gold">Día 7 · Semana Perfecta</span>
                  <strong className="rule-pts-val gold">+500 pts Supremo</strong>
                </div>
                <div className="rule-item-body">
                  <b>Máxima Puntuación de la Liga</b>
                  <p>¡Entrenar los 7 días de lunes a domingo te da la máxima puntuación semanal!</p>
                </div>
              </article>

              <article className="points-rule-item">
                <div className="rule-item-top">
                  <span className="rule-badge soft-lilac">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "4px" }}><polygon points="14.5 17.5 3 6 6 3 17.5 14.5 14.5 17.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
                    Retos Familiares
                  </span>
                  <strong className="rule-pts-val lilac">+150 a +500 pts</strong>
                </div>
                <div className="rule-item-body">
                  <b>Duelos opcionales y apuestas sanas</b>
                  <p>Reta a alguien de la familia o cumple un reto para ganar puntos y apostar tacos o cafés.</p>
                </div>
              </article>
            </div>

            <button className="primary-button full" onClick={() => setShowPointsModal(false)}>
              ✓ ¡Entendido, a sumar puntos!
            </button>
          </section>
        </div>
      )}

      {/* Modal to Create New Custom Family Challenge */}
      {showNewChallengeModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowNewChallengeModal(false)}>
          <section
            className="points-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close-button" onClick={() => setShowNewChallengeModal(false)}>
              ×
            </button>
            <p className="eyebrow">LANZAR RETO FAMILIAR</p>
            <h2>Reta a tu familia</h2>
            <p className="modal-intro">
              Crea un reto divertido. Quien lo cumpla se llevará los puntos y la apuesta acordada.
            </p>

            <form onSubmit={handleCreateChallenge} className="challenge-form">
              <label>
                Título del reto
                <input
                  type="text"
                  required
                  placeholder="Ej. ¿Quién hace 5 días esta semana? o Caminata de 5km"
                  value={newChallengeTitle}
                  onChange={(e) => setNewChallengeTitle(e.target.value)}
                />
              </label>

              <label>
                Descripción / Instrucción
                <textarea
                  rows={4}
                  style={{
                    minHeight: "95px",
                    padding: "12px 14px",
                    lineHeight: "1.5",
                    fontSize: "14px",
                    borderRadius: "14px",
                    border: "1.5px solid #dce5e0",
                    width: "100%",
                    boxSizing: "border-box",
                    resize: "vertical",
                    fontFamily: "inherit",
                    marginTop: "4px",
                  }}
                  placeholder="Ej. Completar al menos 30 min de cardio, salir a correr 5km o no fallar ningún día de la semana..."
                  value={newChallengeDesc}
                  onChange={(e) => setNewChallengeDesc(e.target.value)}
                />
              </label>

              <div className="form-group" style={{ marginTop: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <label style={{ margin: 0, fontWeight: 750, fontSize: "14px", color: "var(--ink)" }}>
                    ¿A quién quieres retar? *
                  </label>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 750,
                    color: newChallengeTargets.includes("Toda la Familia") ? "#166534" : "#1d4ed8",
                    background: newChallengeTargets.includes("Toda la Familia") ? "#dcfce7" : "#dbeafe",
                    padding: "3px 10px",
                    borderRadius: "12px",
                  }}>
                    {newChallengeTargets.includes("Toda la Familia")
                      ? "🌟 Reto Abierto a Todos"
                      : `🎯 ${newChallengeTargets.length} seleccionado${newChallengeTargets.length > 1 ? "s" : ""}`}
                  </span>
                </div>

                {/* Opción De Lujo: Toda la Familia */}
                <button
                  type="button"
                  onClick={() => toggleTargetMember("Toda la Familia")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "11px 14px",
                    borderRadius: "14px",
                    border: newChallengeTargets.includes("Toda la Familia") ? "2px solid #10b981" : "1.5px solid #e2e8f0",
                    background: newChallengeTargets.includes("Toda la Familia") ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" : "#ffffff",
                    color: newChallengeTargets.includes("Toda la Familia") ? "#065f46" : "#334155",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    marginBottom: "10px",
                    boxShadow: newChallengeTargets.includes("Toda la Familia") ? "0 4px 12px rgba(16, 185, 129, 0.18)" : "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>🌟</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 800, fontSize: "13.5px", letterSpacing: "-0.2px" }}>
                        Toda la Familia (Duelo Abierto)
                      </div>
                      <div style={{ fontSize: "11px", opacity: 0.82, marginTop: "1px" }}>
                        Cualquier miembro de López y Amigos puede sumarse y ganar los puntos
                      </div>
                    </div>
                  </div>
                  <div style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: newChallengeTargets.includes("Toda la Familia") ? "#10b981" : "#e2e8f0",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 900,
                  }}>
                    {newChallengeTargets.includes("Toda la Familia") ? "✓" : ""}
                  </div>
                </button>

                {/* Cuadrícula De Lujo con los 12 usuarios reales */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: "8px",
                  maxHeight: "220px",
                  overflowY: "auto",
                  padding: "2px",
                }}>
                  {familyMembersList.map((m) => {
                    const isSelected = newChallengeTargets.includes(m.name);
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => toggleTargetMember(m.name)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 10px",
                          borderRadius: "12px",
                          border: isSelected ? "2px solid #257853" : "1.5px solid #e2e8f0",
                          background: isSelected ? "#f0fdf4" : "#ffffff",
                          color: isSelected ? "#166534" : "#334155",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          textAlign: "left",
                          boxShadow: isSelected ? "0 2px 8px rgba(37, 120, 83, 0.16)" : "none",
                        }}
                      >
                        <span className={`avatar mini ${m.color}`} style={{ width: "26px", height: "26px", fontSize: "11px", flexShrink: 0 }}>
                          {m.initials}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                          <div style={{ fontSize: "12.5px", fontWeight: isSelected ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {m.name}
                          </div>
                        </div>
                        <div style={{
                          width: "17px",
                          height: "17px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isSelected ? "#257853" : "#f1f5f9",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: 900,
                          flexShrink: 0,
                        }}>
                          {isSelected ? "✓" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-grid-2">
                <label>
                  Recompensa en Puntos
                  <select
                    value={newChallengeReward}
                    onChange={(e) => setNewChallengeReward(Number(e.target.value))}
                  >
                    <option value={150}>+150 pts (Reto Fácil)</option>
                    <option value={300}>+300 pts (Reto Medio)</option>
                    <option value={500}>+500 pts (Reto Pro / Épico)</option>
                  </select>
                </label>

                <label>
                  Apuesta amistosa (Opcional)
                  <input
                    type="text"
                    placeholder="Ej. Un helado, café o tacos 🌮"
                    value={newChallengeBet}
                    onChange={(e) => setNewChallengeBet(e.target.value)}
                  />
                </label>
              </div>

              <button type="submit" className="primary-button full" style={{ marginTop: "14px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "6px" }}><polygon points="14.5 17.5 3 6 6 3 17.5 14.5 14.5 17.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
                ¡Publicar Reto en la Familia!
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Modal to Log Weekly Weight & Progress Photo */}
      {showWeightModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowWeightModal(false)}>
          <section
            className="points-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close-button" onClick={() => setShowWeightModal(false)}>
              ×
            </button>
            <p className="eyebrow">REGISTRO SEMANAL DE EVOLUCIÓN</p>
            <h2>Actualizar Peso de la Semana</h2>
            <p className="modal-intro">
              Registra tu nuevo peso para actualizar tu gráfica comparativa vs. la proyección de la IA y ajustar tu ruta a la meta.
            </p>

            <form onSubmit={handleSaveWeeklyWeight} className="challenge-form">
              <div className="form-grid-2">
                <label>
                  Peso actual (kg) *
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="300"
                    required
                    placeholder="Ej. 81.8"
                    value={weightInputValue}
                    onChange={(e) => setWeightInputValue(e.target.value)}
                  />
                </label>

                <label>
                  Cintura en cm (Opcional)
                  <input
                    type="number"
                    step="0.5"
                    min="30"
                    max="200"
                    placeholder="Ej. 87.5"
                    value={waistInputValue}
                    onChange={(e) => setWaistInputValue(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-group" style={{ marginTop: "6px" }}>
                <label>Foto de progreso semanal (Opcional)</label>
                {weeklyPhotoPreview ? (
                  <div className="preview-container" style={{ marginTop: "8px" }}>
                    <img src={weeklyPhotoPreview} alt="Foto semanal de progreso" />
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={() => {
                        setWeeklyPhotoFile(null);
                        setWeeklyPhotoPreview(null);
                      }}
                    >
                      ✕ Quitar foto
                    </button>
                  </div>
                ) : (
                  <label className="photo-drop-button" style={{ marginTop: "8px" }}>
                    <span className="camera-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </span>
                    <div>
                      <b>Subir foto de la semana</b>
                      <small>Selfie de frente o perfil (privada)</small>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleWeeklyPhotoSelect}
                    />
                  </label>
                )}
              </div>

              <button
                type="submit"
                className="primary-button full"
                disabled={savingWeight}
                style={{ marginTop: "16px" }}
              >
                {savingWeight ? "Guardando medición..." : "✓ Guardar peso y actualizar gráfica"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Modal to Update Body Measurements */}
      {showMeasurementsModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowMeasurementsModal(false)}>
          <section
            className="points-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close-button" onClick={() => setShowMeasurementsModal(false)} aria-label="Cerrar">
              ✕
            </button>
            <p className="eyebrow">SEGUIMIENTO DE MEDIDAS CORPORALES</p>
            <h2>Actualizar Medidas (cm) 📏</h2>
            <p className="modal-intro">
              Registra tus medidas en centímetros para medir tu reducción de tallas y progreso semana a semana.
            </p>

            <form onSubmit={handleSaveMeasurements} className="challenge-form">
              <div className="form-grid-2">
                <label>
                  Cintura (cm) *
                  <input
                    type="number"
                    step="0.5"
                    min="30"
                    max="200"
                    required
                    placeholder="Ej. 87.5"
                    value={measWaist}
                    onChange={(e) => setMeasWaist(e.target.value)}
                  />
                </label>

                <label>
                  Pecho / Torso (cm)
                  <input
                    type="number"
                    step="0.5"
                    min="30"
                    max="200"
                    placeholder="Ej. 102.0"
                    value={measChest}
                    onChange={(e) => setMeasChest(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-grid-2" style={{ marginTop: "6px" }}>
                <label>
                  Cadera (cm)
                  <input
                    type="number"
                    step="0.5"
                    min="30"
                    max="200"
                    placeholder="Ej. 98.0"
                    value={measHips}
                    onChange={(e) => setMeasHips(e.target.value)}
                  />
                </label>

                <label>
                  Brazo (cm)
                  <input
                    type="number"
                    step="0.5"
                    min="15"
                    max="100"
                    placeholder="Ej. 34.0"
                    value={measArm}
                    onChange={(e) => setMeasArm(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-group" style={{ marginTop: "6px" }}>
                <label>
                  Muslo (cm)
                  <input
                    type="number"
                    step="0.5"
                    min="20"
                    max="120"
                    placeholder="Ej. 56.0"
                    value={measThigh}
                    onChange={(e) => setMeasThigh(e.target.value)}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="primary-button full"
                style={{ marginTop: "16px" }}
              >
                ✓ Guardar medidas corporales
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Modal to Register or Update Personal Record (PR in LBS) */}
      {showRecordModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowRecordModal(false)}>
          <section
            className="points-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close-button" onClick={() => setShowRecordModal(false)} aria-label="Cerrar">
              ✕
            </button>
            <p className="eyebrow">VITRINA DE FUERZA EN LIBRAS (LBS)</p>
            <h2>Registrar Récord Personal (PR) 🏆</h2>
            <p className="modal-intro">
              Registra el peso máximo que pudiste cargar en este aparato para guardar tu progresión y motivar a tu familia.
            </p>

            {/* 3D Selected Machine Visual Banner */}
            {(() => {
              const selectedEq = gymEquipmentCatalog.find((e) => e.id === selectedEquipmentId) || gymEquipmentCatalog[0];
              const existingRecord = personalRecords.find((r) => r.machineId === selectedEq.id);
              return (
                <div className="record-modal-preview">
                  <img
                    src={selectedEq.imageUrl}
                    alt={selectedEq.name}
                    className="record-modal-preview-thumb"
                  />
                  <div className="record-modal-preview-info">
                    <h4>{selectedEq.name}</h4>
                    <span className="record-cat-tag">
                      {selectedEq.category} · {existingRecord && existingRecord.weightLbs > 0 ? `Récord actual: ${existingRecord.weightLbs} lbs (${existingRecord.reps} reps)` : "En ceros (Sin récord registrado aún)"}
                    </span>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSaveRecord} className="challenge-form">
              <label>
                Aparato o Ejercicio del Gimnasio *
                <select
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                >
                  <optgroup label="Pecho">
                    {gymEquipmentCatalog.filter((e) => e.category === "Pecho").map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.icon} {eq.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Pierna y Glúteos">
                    {gymEquipmentCatalog.filter((e) => e.category === "Pierna").map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.icon} {eq.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Espalda">
                    {gymEquipmentCatalog.filter((e) => e.category === "Espalda").map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.icon} {eq.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Hombros y Brazos">
                    {gymEquipmentCatalog.filter((e) => e.category === "Hombros y Brazos").map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.icon} {eq.name}</option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <div className="form-grid-2" style={{ marginTop: "6px" }}>
                <label>
                  Peso Máximo (Libras / lbs) *
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="1500"
                    required
                    placeholder="0 lbs"
                    value={recordWeightInput}
                    onChange={(e) => setRecordWeightInput(e.target.value)}
                  />
                </label>

                <label>
                  Repeticiones logradas *
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="50"
                    required
                    placeholder="0 reps"
                    value={recordRepsInput}
                    onChange={(e) => setRecordRepsInput(e.target.value)}
                  />
                </label>
              </div>

              <label style={{ marginTop: "6px" }}>
                Sensación / Nota motivacional (Opcional)
                <input
                  type="text"
                  placeholder="Ej. ¡Salieron limpias las 8 reps, la próxima voy por más!"
                  value={recordNoteInput}
                  onChange={(e) => setRecordNoteInput(e.target.value)}
                />
              </label>

              <div style={{ marginTop: "12px", padding: "10px 12px", background: "#edf9f2", borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px", border: "1px solid #bfead0" }}>
                <input
                  type="checkbox"
                  id="shareToWallCheck"
                  checked={recordShareToWall}
                  onChange={(e) => setRecordShareToWall(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#10b981", cursor: "pointer" }}
                />
                <label htmlFor="shareToWallCheck" style={{ margin: 0, fontSize: "12px", fontWeight: "750", color: "#134e32", cursor: "pointer" }}>
                  📣 Publicar logro en el Muro Familiar con buena vibra
                </label>
              </div>

              <button
                type="submit"
                className="primary-button full"
                style={{ marginTop: "16px" }}
              >
                ✓ Guardar Récord Personal
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Luxury Full-Screen Numeric PIN Pad Modal */}
      {showPinModal && (
        <div className="modal-backdrop luxury-lock-screen" onMouseDown={() => setShowPinModal(false)}>
          <section
            className="pro-pin-pad-card"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="pro-close-lock-btn"
              onClick={() => setShowPinModal(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>

            <div className="pin-lock-header">
              <div className="lock-emblem">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <span className="pro-lock-eyebrow">MODO ADMINISTRADOR</span>
              <h2>Ingresa tu PIN</h2>
              <p>Acceso confidencial para gestionar usuarios, contraseñas y premio mensual.</p>
            </div>

            {/* 6-Digit Circle Indicators */}
            <div className="pin-dots-row">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <span
                  key={idx}
                  className={`pin-dot ${idx < adminPinInput.length ? "filled" : ""}`}
                />
              ))}
            </div>

            {pinError && <p className="pin-error-alert">{pinError}</p>}

            {/* On-screen Numeric Keypad for fast mobile tapping */}
            <div className="pro-numeric-keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="keypad-num-btn"
                  onClick={() => handleKeypadPress(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="keypad-action-btn clear"
                onClick={() => handleKeypadPress("clear")}
              >
                C
              </button>
              <button
                type="button"
                className="keypad-num-btn"
                onClick={() => handleKeypadPress("0")}
              >
                0
              </button>
              <button
                type="button"
                className="keypad-action-btn del"
                onClick={() => handleKeypadPress("backspace")}
              >
                ⌫
              </button>
            </div>

            <div className="pin-footer-hint">
              <small>PIN maestro por defecto: <b>123456</b></small>
            </div>
          </section>
        </div>
      )}

      {/* WhatsApp Phone Number Configuration Modal */}
      {phoneEditMember && (
        <div className="modal-backdrop" onMouseDown={() => setPhoneEditMember(null)}>
          <section
            className="phone-modal-card"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close-button" onClick={() => setPhoneEditMember(null)}>
              ×
            </button>
            <span className="eyebrow">CONFIGURACIÓN DE CONTACTO</span>
            <h2>WhatsApp de {phoneEditMember.name} 💬</h2>
            <p>
              Ingresa el número de celular para que al pulsar el botón de WhatsApp se abra directamente el chat con su mensaje de motivación personalizado listo para enviar.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePhone(phoneEditMember.name, editPhoneValue);
              }}
            >
              <div className="phone-input-field">
                <label>Número de WhatsApp (con código de país o 10 dígitos)</label>
                <input
                  type="tel"
                  autoFocus
                  placeholder="Ej. 5215512345678 o 5512345678"
                  value={editPhoneValue}
                  onChange={(e) => setEditPhoneValue(e.target.value)}
                />
                <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "3px" }}>
                  En México puedes usar: 52 + 10 dígitos (ej. 5215512345678).
                </small>
              </div>

              <div className="phone-modal-actions">
                <button
                  type="button"
                  className="phone-modal-cancel-btn"
                  onClick={() => setPhoneEditMember(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="phone-modal-save-btn">
                  ✓ Guardar Número
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingActivityMember && (
        <div className="phone-modal-backdrop" onClick={() => setEditingActivityMember(null)}>
          <section
            className="phone-modal-card"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: "420px" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-button" onClick={() => setEditingActivityMember(null)}>
              ×
            </button>
            <span className="eyebrow">DISCIPLINA / DEPORTE</span>
            <h2>Actividad de {editingActivityMember.name} 🏃‍♂️</h2>
            <p>
              Selecciona el deporte o actividad principal que realiza en el Reto 4×7:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px", margin: "16px 0" }}>
              {ALL_DISCIPLINES.map((disc) => (
                <button
                  key={disc.id}
                  type="button"
                  style={{
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: editingActivityMember.currentActivity === disc.name ? "2px solid #00c982" : "1px solid var(--line, #e2e8f0)",
                    background: editingActivityMember.currentActivity === disc.name ? "rgba(0,201,130,0.1)" : "var(--card-bg, #ffffff)",
                    color: "var(--ink, #0f172a)",
                    fontWeight: editingActivityMember.currentActivity === disc.name ? 700 : 500,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => handleUpdateMemberActivity(editingActivityMember.name, disc.name)}
                >
                  {disc.name}
                </button>
              ))}
            </div>

            <div className="phone-modal-actions">
              <button
                type="button"
                className="phone-modal-cancel-btn"
                onClick={() => setEditingActivityMember(null)}
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
