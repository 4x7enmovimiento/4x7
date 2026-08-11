import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
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

function projection(currentWeight: number, heightCm: number, targetWeight: number | null, objective: Objective) {
  const bmi = currentWeight / ((heightCm / 100) ** 2);
  const bmiCategory = bmi < 18.5 ? "Peso bajo" : bmi < 25 ? "Rango saludable" : bmi < 30 ? "Sobrepeso" : "Obesidad";
  const direction = objective === "gain_muscle" ? 1 : objective === "lose_fat" ? -1 : targetWeight && Math.abs(targetWeight - currentWeight) >= 0.5 ? Math.sign(targetWeight - currentWeight) : 0;
  const pace = direction < 0 ? Math.min(0.9, Math.max(0.25, currentWeight * 0.006)) : direction > 0 ? Math.min(0.3, Math.max(0.1, currentWeight * 0.002)) : 0;
  let projected = currentWeight;
  const weeks = Array.from({ length: 12 }, (_, index) => {
    if (direction && (!targetWeight || (direction < 0 ? projected > targetWeight : projected < targetWeight))) {
      projected += direction * pace;
      if (targetWeight) projected = direction < 0 ? Math.max(projected, targetWeight) : Math.min(projected, targetWeight);
    }
    const week = index + 1;
    const phase = week <= 2 ? "Adaptación" : week <= 6 ? "Construcción" : "Consolidación";
    const focus = objective === "gain_muscle"
      ? (week <= 2 ? "Dominar técnica y recuperar bien" : "Progresar fuerza de forma gradual")
      : objective === "lose_fat"
        ? (week <= 2 ? "Crear constancia sin extremos" : "Combinar fuerza, cardio y recuperación")
        : "Sostener cuatro días con variedad y descanso";
    return { week, weightKg: Number(projected.toFixed(1)), phase, focus, workoutGoal: 4 };
  });
  return { bmi: Number(bmi.toFixed(1)), bmiCategory, weeklyPaceKg: Number(pace.toFixed(2)), weeks };
}

export async function GET(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const [profile] = await getDb().select().from(userProfiles).where(eq(userProfiles.userId, current.userId)).limit(1);
    const [measurement] = await getDb().select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, current.userId)).orderBy(desc(bodyMeasurements.recordedAt)).limit(1);
    if (!profile || !measurement?.weightKg || !profile.heightCm) return json({ profile: null, projection: null });
    return json({ profile: { ...profile, measurement }, projection: projection(measurement.weightKg, profile.heightCm, profile.targetWeightKg, profile.objective as Objective) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const payload = await request.json() as Record<string, unknown>;
    const objective = cleanText(payload.objective, 30) as Objective;
    const sex = cleanText(payload.sex, 20) as Sex;
    const birthDate = cleanText(payload.birthDate, 10);
    const age = ageFromBirthDate(birthDate);
    const heightCm = numberInRange(payload.heightCm, 120, 230, true);
    const weightKg = numberInRange(payload.weightKg, 30, 350, true);
    const targetWeightKg = numberInRange(payload.targetWeightKg, 30, 350);
    const allowedObjectives: Objective[] = ["lose_fat", "gain_muscle", "maintain", "general_fitness"];
    const allowedSex: Sex[] = ["female", "male", "other", "prefer_not"];
    if (!allowedObjectives.includes(objective) || !allowedSex.includes(sex) || age < 18 || age > 100 || Number.isNaN(heightCm) || Number.isNaN(weightKg) || Number.isNaN(targetWeightKg ?? 0)) {
      return json({ error: "Revisa edad, peso, estatura, sexo y objetivo." }, 400);
    }
    if ((objective === "lose_fat" || objective === "gain_muscle") && !targetWeightKg) return json({ error: "Agrega un peso objetivo para calcular tu proyección." }, 400);
    const optional = {
      waistCm: numberInRange(payload.waistCm, 30, 250), chestCm: numberInRange(payload.chestCm, 30, 250),
      hipCm: numberInRange(payload.hipCm, 30, 250), armCm: numberInRange(payload.armCm, 10, 100),
      thighCm: numberInRange(payload.thighCm, 15, 150), calfCm: numberInRange(payload.calfCm, 10, 100),
      neckCm: numberInRange(payload.neckCm, 15, 100), bodyFatPercent: numberInRange(payload.bodyFatPercent, 2, 70),
    };
    if (Object.values(optional).some(Number.isNaN)) return json({ error: "Revisa las medidas opcionales; usa centímetros y solo números." }, 400);
    const db = getDb();
    await db.insert(userProfiles).values({ userId: current.userId, objective, birthDate, sex, heightCm, targetWeightKg, weeklyGoal: 4 })
      .onConflictDoUpdate({ target: userProfiles.userId, set: { objective, birthDate, sex, heightCm, targetWeightKg, weeklyGoal: 4, updatedAt: new Date().toISOString() } });
    const [measurement] = await db.insert(bodyMeasurements).values({ userId: current.userId, weightKg, ...optional, source: "manual", recordedAt: new Date().toISOString() }).returning();
    return json({ profile: { objective, birthDate, sex, heightCm, targetWeightKg, measurement }, projection: projection(weightKg, heightCm as number, targetWeightKg, objective) }, 201);
  } catch (error) { return apiError(error); }
}
