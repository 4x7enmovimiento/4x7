import { getSupabase } from "../../../../db/supabase";
import { apiError, cleanText, json, options, requireMobileUser, SharedFeedPost, sharedMemberStatsCache, SharedMemberStats, sharedPostsCache } from "../_shared";

export const OPTIONS = options;

export async function GET(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    
    const supabase = getSupabase();
    const { data: rows } = await supabase
      .from("workouts")
      .select("id, user_id, activity_type, started_at, ended_at, duration_seconds, distance_meters, steps, calories, evidence_key, users(name)")
      .eq("family_id", current.familyId)
      .order("started_at", { ascending: false })
      .limit(50);

    const formatted = (rows || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.users?.name || "Familiar",
      activityType: row.activity_type,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds,
      distanceMeters: row.distance_meters,
      steps: row.steps,
      calories: row.calories,
      evidenceKey: row.evidence_key,
      evidenceUrl: row.evidence_key ? `/api/mobile/evidence/${row.evidence_key}` : null,
    }));

    return json({ workouts: formatted });
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

    const workoutId = Date.now();
    const workout = {
      id: workoutId,
      userId: current.userId,
      activityType,
      startedAt,
      endedAt,
      durationSeconds,
      distanceMeters,
      steps,
      calories,
      evidenceKey,
    };

    const nick = (current as any).nickname || (current.name.includes("Pedro") ? "Pedcaz" : current.name.includes("Judith") ? "JuuGlez" : current.name.split(" ")[0]);

    const feedPost: SharedFeedPost = {
      id: workoutId,
      userId: current.userId,
      userName: nick,
      caption,
      evidenceKey,
      evidenceUrl: evidenceKey ? `/api/mobile/evidence/${evidenceKey}` : null,
      createdAt: new Date().toISOString(),
      activityType,
      durationSeconds,
      distanceMeters,
      steps,
      calories,
      likes: 0,
      comments: 0,
      likedUserIds: [],
    };
    sharedPostsCache.set(workoutId, feedPost);

    // Update shared stats for this member so everyone sees their check-ins and points!
    const key = nick.toLowerCase();
    const existingStats = sharedMemberStatsCache.get(key) || {
      nickname: nick,
      fullName: current.name,
      workouts: 0,
      completedDates: [],
      points: 0,
      activity: activityType,
      lastCheckinDate: new Date().toISOString().split("T")[0],
    };
    const today = new Date().toISOString().split("T")[0];
    const nextDates = Array.from(new Set([...existingStats.completedDates, today]));
    const nextWorkouts = nextDates.length;
    const updatedStats: SharedMemberStats = {
      ...existingStats,
      activity: activityType,
      workouts: nextWorkouts,
      completedDates: nextDates,
      points: nextWorkouts * 100 + (nextWorkouts >= 4 ? 300 : 0),
      lastCheckinDate: today,
    };
    sharedMemberStatsCache.set(key, updatedStats);
    sharedMemberStatsCache.set(current.name.toLowerCase(), updatedStats);
    sharedMemberStatsCache.set(current.email.toLowerCase(), updatedStats);

    // Persist to Supabase
    try {
      const supabase = getSupabase();
      const photoUrl = evidenceKey ? `/api/mobile/evidence/${evidenceKey}` : null;
      const { data: insertedWorkout, error: wErr } = await supabase.from("workouts").insert({
        user_id: current.userId,
        family_id: current.familyId,
        activity_type: activityType,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        distance_meters: distanceMeters,
        steps,
        calories,
        evidence_url: photoUrl,
      }).select().single();

      if (wErr) {
        console.error("Supabase workout insert error:", wErr);
      }

      const workoutRecordId = insertedWorkout?.id || null;

      const { error: pErr } = await supabase.from("posts").insert({
        family_id: current.familyId,
        user_id: current.userId,
        workout_id: workoutRecordId,
        activity_type: activityType,
        caption,
        evidence_url: photoUrl,
      });

      if (pErr) {
        console.error("Supabase post insert error:", pErr);
      }

      await supabase.from("points_ledger").insert({
        family_id: current.familyId,
        user_id: current.userId,
        points: 100,
        reason: "Entrenamiento completado",
      });
    } catch (err) {
      console.warn("Supabase workout save warning:", err);
    }

    return json({ workout }, 201);
  } catch (error) {
    return apiError(error);
  }
}
