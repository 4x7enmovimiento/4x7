import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { postComments, postLikes, posts, users, workouts } from "../../../../db/schema";
import { apiError, cleanText, familyProfilesCache, json, options, requireMobileUser } from "../_shared";

export const OPTIONS = options;

export async function GET(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const rows = await getDb()
      .select({
        id: posts.id,
        userId: posts.userId,
        userName: users.name,
        caption: posts.caption,
        evidenceKey: posts.evidenceKey,
        createdAt: posts.createdAt,
        activityType: workouts.activityType,
        durationSeconds: workouts.durationSeconds,
        distanceMeters: workouts.distanceMeters,
        steps: workouts.steps,
        calories: workouts.calories,
        likes: sql<number>`(select count(*) from ${postLikes} where ${postLikes.postId} = ${posts.id})`,
        comments: sql<number>`(select count(*) from ${postComments} where ${postComments.postId} = ${posts.id})`,
        likedByMe: sql<number>`(select count(*) from ${postLikes} where ${postLikes.postId} = ${posts.id} and ${postLikes.userId} = ${current.userId})`,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(workouts, eq(posts.workoutId, workouts.id))
      .where(eq(posts.familyId, current.familyId))
      .orderBy(desc(posts.createdAt))
      .limit(50);

    const dbPosts = rows.map((row) => ({
      ...row,
      likedByMe: Boolean(row.likedByMe),
      evidenceUrl: row.evidenceKey ? `/api/mobile/evidence/${row.evidenceKey}` : null,
    }));

    const familyProfilesObj: Record<string, any> = {};
    for (const [key, val] of familyProfilesCache.entries()) {
      familyProfilesObj[key] = val;
    }

    return json({ posts: dbPosts, familyProfiles: familyProfilesObj });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const payload = await request.json() as Record<string, unknown>;
    const caption = cleanText(payload.caption, 500);
    const evidenceKey = cleanText(payload.evidenceKey, 220) || null;
    if (!caption && !evidenceKey) return json({ error: "Escribe algo o agrega una evidencia." }, 400);
    if (evidenceKey && !evidenceKey.startsWith(`${current.familyId}/${current.userId}/`)) {
      return json({ error: "La evidencia no pertenece a esta cuenta." }, 403);
    }
    const [post] = await getDb().insert(posts).values({ familyId: current.familyId, userId: current.userId, caption, evidenceKey }).returning();
    return json({ post }, 201);
  } catch (error) {
    return apiError(error);
  }
}
