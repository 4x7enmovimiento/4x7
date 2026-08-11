import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { postLikes, posts } from "../../../../../../db/schema";
import { apiError, json, options, requireMobileUser } from "../../../_shared";

export const OPTIONS = options;

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const postId = Number((await context.params).postId);
    const [post] = await getDb().select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), eq(posts.familyId, current.familyId))).limit(1);
    if (!post) return json({ error: "Publicación no encontrada." }, 404);
    const [existing] = await getDb().select({ id: postLikes.id }).from(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, current.userId))).limit(1);
    if (existing) {
      await getDb().delete(postLikes).where(eq(postLikes.id, existing.id));
      return json({ liked: false });
    }
    await getDb().insert(postLikes).values({ postId, userId: current.userId });
    return json({ liked: true });
  } catch (error) {
    return apiError(error);
  }
}
