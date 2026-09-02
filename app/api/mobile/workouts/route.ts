import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { pointsLedger, posts, users, workouts } from "../../../../db/schema";
import { apiError, cleanText, json, options, requireMobileUser } from "../_shared";

export const OPTIONS = options;

export async function GET(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const rows = await getDb()
      .select({
        id: workouts.id,
        userId: workouts.userId,
        userName: users.name,
        activityType: workouts.activityType,
        startedAt: workouts.startedAt,
        endedAt: workouts.endedAt,
        durationSeconds: workouts.durationSeconds,
        distanceMeters: workouts.distanceMeters,
        steps: workouts.steps,
        calories: workouts.calories,
        evidenceKey: workouts.evidenceKey,
      })
      .from(workouts)
      .innerJoin(users, eq(workouts.userId, users.id))
      .where(eq(workouts.familyId, current.familyId))
      .orderBy(desc(workouts.startedAt))
      .limit(50);
    return json({ workouts: rows.map((row) => ({
      ...row,
      evidenceUrl: row.evidenceKey ? `/api/mobile/evidence/${row.evidenceKey}` : null,
    })) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const payload = await request.json() as Record<string, unknown>;
    const activityType = cleanText(payload.activityType, 40);
    const startedAt = cleanText(payload.startedAt, 40);
    const endedAt = cleanText(payload.endedAt, 40);
    const durationSeconds = Math.max(1, Math.min(86_400, Number(payload.durationSeconds) || 0));
    const distanceMeters = Math.max(0, Math.min(500_000, Number(payload.distanceMeters) || 0));
    const steps = Math.max(0, Math.min(200_000, Math.round(Number(payload.steps) || 0)));
    const calories = Math.max(0, Math.min(20_000, Math.round(Number(payload.calories) || 0)));
    const evidenceKey = cleanText(payload.evidenceKey, 220) || null;

    if (!activityType || !startedAt || !endedAt || !Number.isFinite(durationSeconds)) {
      return json({ error: "Faltan datos del entrenamiento." }, 400);
    }
    if (evidenceKey && !evidenceKey.startsWith(`${current.familyId}/${current.userId}/`)) {
      return json({ error: "La evidencia no pertenece a esta cuenta." }, 403);
    }

    const customCaption = cleanText(payload.caption, 280);
    const caption = customCaption || `Completó ${activityType.toLowerCase()} y sumó un día a su meta 4×7.`;

    const [workout] = await getDb().insert(workouts).values({
      userId: current.userId,
      familyId: current.familyId,
      activityType,
      startedAt,
      endedAt,
      durationSeconds,
      distanceMeters,
      steps,
      calories,
      evidenceKey,
    }).returning();
    await getDb().insert(posts).values({
      familyId: current.familyId,
      userId: current.userId,
      workoutId: workout.id,
      caption,
      evidenceKey,
    });
    await getDb().insert(pointsLedger).values({
      familyId: current.familyId,
      userId: current.userId,
      points: 100,
      reason: "Entrenamiento completado",
      sourceType: "workout",
      sourceId: workout.id,
    });
    return json({ workout }, 201);
  } catch (error) {
    return apiError(error);
  }
}
