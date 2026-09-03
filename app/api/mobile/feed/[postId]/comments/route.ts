import { getSupabase } from "../../../../../../db/supabase";
import { apiError, cleanText, json, options, requireMobileUser, SharedComment, sharedCommentsCache, sharedPostsCache } from "../../../_shared";

export const OPTIONS = options;

export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const postId = Number((await context.params).postId);

    const supabase = getSupabase();
    const { data: rows } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, body, created_at, users(name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    const comments = (rows || []).map((r: any) => ({
      id: r.id,
      postId: r.post_id,
      userId: r.user_id,
      userName: r.users?.name || "Familiar",
      body: r.body,
      createdAt: r.created_at,
    }));

    if (comments.length === 0) {
      const fallbackComments = sharedCommentsCache.get(postId) || [];
      return json({ comments: fallbackComments });
    }

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

    const nick = (current as any).nickname || (current.name.includes("Pedro") ? "Pedcaz" : current.name.includes("Judith") ? "JuuGlez" : current.name.split(" ")[0]);

    let commentId = Date.now();
    let createdAt = new Date().toISOString();

    try {
      const supabase = getSupabase();
      const { data: insertedComment } = await supabase.from("post_comments").insert({
        post_id: postId,
        user_id: current.userId,
        body,
      }).select("id, post_id, user_id, body, created_at").single();

      if (insertedComment) {
        commentId = insertedComment.id;
        createdAt = insertedComment.created_at;
      }
    } catch (e) {
      console.warn("Supabase comment insert warning:", e);
    }

    const comment: SharedComment = {
      id: commentId,
      postId,
      userId: current.userId,
      userName: nick,
      body,
      createdAt,
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
