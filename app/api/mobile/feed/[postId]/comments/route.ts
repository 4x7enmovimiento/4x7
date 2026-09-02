import { apiError, cleanText, json, options, requireMobileUser, SharedComment, sharedCommentsCache, sharedPostsCache } from "../../../_shared";

export const OPTIONS = options;

export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const postId = Number((await context.params).postId);
    const comments = sharedCommentsCache.get(postId) || [];
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
    const payload = await request.json() as Record<string, unknown>;
    const body = cleanText(payload.body, 300);
    if (!body) return json({ error: "Escribe un comentario." }, 400);

    const nick = current.name.includes("Pedro") ? "Pedcaz" : current.name.includes("Judith") ? "JuuGlez" : current.name.split(" ")[0];
    const comment: SharedComment = {
      id: Date.now(),
      postId,
      userId: current.userId,
      userName: nick,
      body,
      createdAt: new Date().toISOString(),
    };

    const list = sharedCommentsCache.get(postId) || [];
    list.push(comment);
    sharedCommentsCache.set(postId, list);

    const post = sharedPostsCache.get(postId);
    if (post) {
      post.comments = list.length;
    }

    return json({ comment }, 201);
  } catch (error) {
    return apiError(error);
  }
}
