import { getSupabase } from "../../../../../../db/supabase";
import { apiError, json, options, requireMobileUser, sharedPostsCache } from "../../../_shared";

export const OPTIONS = options;

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const postId = Number((await context.params).postId);

    const supabase = getSupabase();
    // 1. Check if like exists in Supabase
    const { data: existing } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", current.userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("post_likes").delete().eq("id", existing.id);
      
      const post = sharedPostsCache.get(postId);
      if (post) {
        const idx = post.likedUserIds.indexOf(current.userId);
        if (idx >= 0) post.likedUserIds.splice(idx, 1);
        post.likes = Math.max(0, post.likes - 1);
      }

      return json({ liked: false });
    } else {
      await supabase.from("post_likes").insert({
        post_id: postId,
        user_id: current.userId,
      });

      const post = sharedPostsCache.get(postId);
      if (post) {
        if (!post.likedUserIds.includes(current.userId)) post.likedUserIds.push(current.userId);
        post.likes += 1;
      }

      return json({ liked: true });
    }
  } catch (error) {
    return apiError(error);
  }
}
