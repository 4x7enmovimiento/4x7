import { asc, desc, eq } from "drizzle-orm";
import { getDb, safeMigrate } from "../../../../db";
import { bodyMeasurements, userProfiles } from "../../../../db/schema";
import { apiError, cleanText, json, options, requireMobileUser } from "../_shared";

export const OPTIONS = options;

type Objective = "lose_fat" | "gain_muscle" | "maintain" | "general_fitness";
type Sex = "female" | "male" | "other" | "prefer_not";

function numberInRange(value: unknown, min: number, max: number, required = false) {
  if (value === "" || value === null || value === undefined) return required ? NaN : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : NaN;
}

function ageFromBirthDate(birthDate: string) {
  const born = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(born.getTime())) return NaN;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age--;
  return age;
}

function getObjectiveAdvice(objective: Objective) {
  if (objective === "gain_muscle") {
    return {
      title: "Guía de Hipertrofia & Fuerza",
      goalSummary: "Construir masa muscular limpia de forma progresiva sin ganar exceso de grasa.",
      doList: [
        "Prioriza ejercicios de fuerza y sobrecarga progresiva (subir peso o repeticiones cada 1-2 semanas).",
        "Consume entre 1.6 g y 2.0 g de proteína por cada kg de tu peso al día (pollo, huevo, atún, legumbres).",
        "Descansa al menos 7 a 8 horas por noche; el músculo crece y se repara mientras duermes.",
        "Mantén un ligero superávit calórico saludable con carbohidratos complejos (avena, arroz, camote).",
      ],
      dontList: [
        "Evita hacer cardio excesivo de alta intensidad antes de tu entrenamiento de fuerza.",
        "No entrenes el mismo grupo muscular dos días seguidos; dale 48 horas de recuperación.",
        "No descuides la hidratación ni te saltes la comida posterior a tu rutina.",
        "Evita compararte a diario en la báscula: el músculo es más denso que la grasa.",
      ],
    };
  }

  if (objective === "lose_fat") {
    return {
      title: "Guía de Quema de Grasa Saludable",
      goalSummary: "Reducir porcentaje de grasa corporal protegiendo tu masa muscular y energía.",
      doList: [
        "Mantén la regla 4×7: 4 entrenamientos por semana combinando fuerza con cardio moderado.",
        "Aumenta el consumo de proteína y vegetales con fibra para mantener saciedad durante el día.",
        "Bebe de 2.5 a 3 litros de agua diarios para optimizar tu metabolismo y digestión.",
        "Registra tu peso una vez por semana en las mismas condiciones (en ayunas al despertar).",
      ],
      dontList: [
        "Evita dietas extremas o pasar hambre (provocan efecto rebote y pérdida de masa muscular).",
        "No te obsesiones con pesarte todos los días (el agua y la digestión varían de 1 a 2 kg diario).",
        "No elimines por completo los carbohidratos, son tu fuente principal de energía para entrenar.",
        "No sustituyas el descanso por suplementos 'milagro': la constancia 4×7 es la clave.",
      ],
    };
  }

  return {
    title: "Guía de Hábitos y Condición Física",
    goalSummary: "Aumentar tu vitalidad, resistencia cardiovascular y salud metabólica integral.",
    doList: [
      "Cumple tus 4 días obligatorios combinando caminata rápida, ejercicios de fuerza y movilidad.",
      "Mantén variedad de actividades (pesas, cardio, deportes, estiramientos) para no aburrirte.",
      "Integra a tu familia en caminatas de fin de semana o retos conjuntos.",
      "Prioriza alimentos naturales y comidas preparadas en casa.",
    ],
    dontList: [
      "Evita el sedentarismo prolongado: camina al menos 10 minutos después de comer.",
      "No entrenes con dolor articular intenso; cambia a bajo impacto (caminata o movilidad).",
      "Evita trasnochar antes de días de entrenamiento.",
    ],
  };
}

function projection(currentWeight: number, heightCm: number, targetWeight: number | null, objective: Objective) {
  const bmi = currentWeight / ((heightCm / 100) ** 2);
  const bmiCategory = bmi < 18.5 ? "Bajo peso" : bmi < 24.9 ? "Rango saludable" : bmi < 29.9 ? "Sobrepeso" : "Obesidad";
  const direction = objective === "gain_muscle" ? 1 : objective === "lose_fat" ? -1 : targetWeight && Math.abs(targetWeight - currentWeight) >= 0.5 ? Math.sign(targetWeight - currentWeight) : 0;
  const pace = direction < 0 ? Math.min(0.85, Math.max(0.4, currentWeight * 0.006)) : direction > 0 ? Math.min(0.35, Math.max(0.15, currentWeight * 0.003)) : 0;
  
  const weightDiff = targetWeight ? Math.abs(currentWeight - targetWeight) : 0;
  const estimatedWeeks = pace > 0 && weightDiff > 0 ? Math.max(1, Math.ceil(weightDiff / pace)) : 12;

  let projected = currentWeight;
  const weeks = Array.from({ length: 12 }, (_, index) => {
    if (direction && (!targetWeight || (direction < 0 ? projected > targetWeight : projected < targetWeight))) {
      projected += direction * pace;
      if (targetWeight) projected = direction < 0 ? Math.max(projected, targetWeight) : Math.min(projected, targetWeight);
    }
    const week = index + 1;
    const phase = week <= 2 ? "Adaptación" : week <= 6 ? "Construcción" : "Consolidación";
    const focus = objective === "gain_muscle"
      ? (week <= 2 ? "Dominar técnica y sobrecarga ligera" : "Progresar fuerza e hipertrofia gradual")
      : objective === "lose_fat"
        ? (week <= 2 ? "Crear hábito 4×7 sin fatiga extrema" : "Déficit sostenido con fuerza y cardio")
        : "Sostener cuatro días con variedad y energía";
    return { week, weightKg: Number(projected.toFixed(1)), phase, focus, workoutGoal: 4 };
  });

  const advice = getObjectiveAdvice(objective);

  let etaSummary = "";
  if (targetWeight && weightDiff > 0.5) {
    if (objective === "lose_fat") {
      etaSummary = `A un ritmo constante y saludable de 4 entrenamientos por semana, alcanzarías tu meta de ${targetWeight} kg en aproximadamente ${estimatedWeeks} a ${estimatedWeeks + 2} semanas (bajando ~${pace.toFixed(2)} kg/semana).`;
    } else if (objective === "gain_muscle") {
      etaSummary = `Ganando masa muscular limpia a un ritmo controlado de ~${pace.toFixed(2)} kg/semana, alcanzarías tu objetivo de ${targetWeight} kg en aproximadamente ${estimatedWeeks} a ${estimatedWeeks + 3} semanas.`;
    } else {
      etaSummary = `Tu proyección apunta a alcanzar ${targetWeight} kg en unas ${estimatedWeeks} semanas manteniendo tu hábito 4×7.`;
    }
  } else {
    etaSummary = `Tu enfoque actual es mantener tu peso y salud en ${currentWeight} kg a través del hábito semanal de 4 días de ejercicio.`;
  }

  return {
    bmi: Number(bmi.toFixed(1)),
    bmiCategory,
    weeklyPaceKg: Number(pace.toFixed(2)),
    estimatedWeeks,
    etaSummary,
    weeks,
    advice,
  };
}

export async function GET(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    await safeMigrate();
    const [profile] = await getDb().select().from(userProfiles).where(eq(userProfiles.userId, current.userId)).limit(1);
    const measurements = await getDb().select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, current.userId)).orderBy(asc(bodyMeasurements.recordedAt));
    const latestMeasurement = measurements[measurements.length - 1];

    if (!profile || !latestMeasurement?.weightKg || !profile.heightCm) {
      return json({ profile: null, measurements: [], projection: null });
    }

    return json({
      profile: { ...profile, measurement: latestMeasurement },
      measurements,
      projection: projection(latestMeasurement.weightKg, profile.heightCm, profile.targetWeightKg, profile.objective as Objective),
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    await safeMigrate();
    const payload = await request.json() as Record<string, unknown>;

    // Case 1: Just logging a new periodic measurement (e.g. from the Progress screen)
    if (payload.action === "add_measurement") {
      const weightKg = numberInRange(payload.weightKg, 25, 350, true);
      const waistCm = numberInRange(payload.waistCm, 25, 250);
      if (Number.isNaN(weightKg)) return json({ error: "Ingresa un peso válido en kilogramos." }, 400);

      const db = getDb();
      const [measurement] = await db.insert(bodyMeasurements).values({
        userId: current.userId,
        weightKg,
        waistCm: Number.isNaN(waistCm) ? null : waistCm,
        source: "manual",
        recordedAt: new Date().toISOString(),
      }).returning();

      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, current.userId)).limit(1);
      const measurements = await db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, current.userId)).orderBy(asc(bodyMeasurements.recordedAt));

      return json({
        profile: { ...profile, measurement },
        measurements,
        projection: profile?.heightCm ? projection(weightKg, profile.heightCm, profile.targetWeightKg, profile.objective as Objective) : null,
      }, 201);
    }

    // Case 2: Full profile onboarding / setup
    const objective = (cleanText(payload.objective, 30) || "general_fitness") as Objective;
    const sex = (cleanText(payload.sex, 20) || "other") as Sex;
    const birthDate = cleanText(payload.birthDate, 10) || "1995-01-01";
    const age = Number.isNaN(ageFromBirthDate(birthDate)) ? 25 : ageFromBirthDate(birthDate);
    const heightCm = numberInRange(payload.heightCm, 100, 250, true);
    const weightKg = numberInRange(payload.weightKg, 25, 350, true);
    let targetWeightKg = numberInRange(payload.targetWeightKg, 25, 350);

    const allowedObjectives: Objective[] = ["lose_fat", "gain_muscle", "maintain", "general_fitness"];
    const allowedSex: Sex[] = ["female", "male", "other", "prefer_not"];
    
    if (Number.isNaN(heightCm) || Number.isNaN(weightKg)) {
      return json({ error: "Por favor ingresa estatura y peso válidos." }, 400);
    }

    if (Number.isNaN(targetWeightKg)) {
      targetWeightKg = null;
    }

    if (!targetWeightKg && (objective === "lose_fat" || objective === "gain_muscle")) {
      targetWeightKg = objective === "lose_fat"
        ? Number((weightKg * 0.9).toFixed(1))
        : Number((weightKg * 1.05).toFixed(1));
    }

    const parseOptional = (val: unknown, min: number, max: number) => {
      const num = numberInRange(val, min, max);
      return Number.isNaN(num) ? null : num;
    };

    const optional = {
      waistCm: parseOptional(payload.waistCm, 25, 250),
      chestCm: parseOptional(payload.chestCm, 25, 250),
      hipCm: parseOptional(payload.hipCm, 25, 250),
      armCm: parseOptional(payload.armCm, 10, 100),
      thighCm: parseOptional(payload.thighCm, 15, 150),
      calfCm: parseOptional(payload.calfCm, 10, 100),
      neckCm: parseOptional(payload.neckCm, 15, 100),
      bodyFatPercent: parseOptional(payload.bodyFatPercent, 2, 70),
    };

    const db = getDb();
    const challengeStartDate = cleanText(payload.challengeStartDate, 15) || undefined;
    await db.insert(userProfiles).values({
      userId: current.userId,
      objective: allowedObjectives.includes(objective) ? objective : "general_fitness",
      birthDate,
      sex: allowedSex.includes(sex) ? sex : "other",
      heightCm,
      targetWeightKg,
      weeklyGoal: 4,
      ...(challengeStartDate ? { challengeStartDate } : {}),
    })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          objective: allowedObjectives.includes(objective) ? objective : "general_fitness",
          birthDate,
          sex: allowedSex.includes(sex) ? sex : "other",
          heightCm,
          targetWeightKg,
          weeklyGoal: 4,
          ...(challengeStartDate ? { challengeStartDate } : {}),
          updatedAt: new Date().toISOString(),
        },
      });

    const [measurement] = await db.insert(bodyMeasurements).values({
      userId: current.userId,
      weightKg,
      ...optional,
      source: "manual",
      recordedAt: new Date().toISOString(),
    }).returning();

    const measurements = await db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, current.userId)).orderBy(asc(bodyMeasurements.recordedAt));

    return json({
      profile: { objective, birthDate, sex, heightCm, targetWeightKg, measurement },
      measurements,
      projection: projection(weightKg, heightCm as number, targetWeightKg, objective),
    }, 201);
  } catch (error) {
    return apiError(error);
  }
}


