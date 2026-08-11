import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { postComments, posts, users } from "../../../../../../db/schema";
import { apiError, cleanText, json, options, requireMobileUser } from "../../../_shared";

export const OPTIONS = options;

async function visiblePost(postId: number, familyId: number) {
  const [post] = await getDb().select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), eq(posts.familyId, familyId))).limit(1);
  return post;
}

export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const postId = Number((await context.params).postId);
    if (!await visiblePost(postId, current.familyId)) return json({ error: "Publicación no encontrada." }, 404);
    const comments = await getDb().select({ id: postComments.id, userId: postComments.userId, userName: users.name, body: postComments.body, createdAt: postComments.createdAt }).from(postComments).innerJoin(users, eq(postComments.userId, users.id)).where(eq(postComments.postId, postId)).orderBy(asc(postComments.createdAt));
    return json({ comments });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const postId = Number((await context.params).postId);
    if (!await visiblePost(postId, current.familyId)) return json({ error: "Publicación no encontrada." }, 404);
    const payload = await request.json() as Record<string, unknown>;
    const body = cleanText(payload.body, 300);
    if (!body) return json({ error: "Escribe un comentario." }, 400);
    const [comment] = await getDb().insert(postComments).values({ postId, userId: current.userId, body }).returning();
    return json({ comment: { ...comment, userName: current.name } }, 201);
  } catch (error) {
    return apiError(error);
  }
}
