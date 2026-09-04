import { getSupabase } from "../../../../../db/supabase";
import { apiError, json, options, requireMobileUser, sharedPostsCache } from "../../_shared";

export const OPTIONS = options;

export async function DELETE(
  request: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const params = await context.params;
    const postId = Number(params.postId);

    if (!postId || isNaN(postId)) {
      return json({ error: "ID de publicación no válido." }, 400);
    }

    const supabase = getSupabase();

    // 1. Check if post exists in Supabase
    const { data: post, error: fetchErr } = await supabase
      .from("posts")
      .select("id, user_id, family_id, workout_id")
      .eq("id", postId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Fetch post error:", fetchErr);
      return json({ error: "Error al consultar la publicación." }, 500);
    }

    if (post) {
      // Permission check: only author or family admin can delete
      if (post.user_id !== current.userId && current.role !== "admin") {
        return json({ error: "Solo puedes eliminar tus propias publicaciones." }, 403);
      }

      // Delete comments & likes belonging to this post
      await supabase.from("post_comments").delete().eq("post_id", postId);
      await supabase.from("post_likes").delete().eq("post_id", postId);

      // Delete ONLY the post row
      // CRITICAL: We DO NOT touch the workouts or points_ledger tables. Check-in and points remain 100% intact!
      const { error: delErr } = await supabase.from("posts").delete().eq("id", postId);
      if (delErr) {
        console.error("Delete post error:", delErr);
        return json({ error: "No se pudo eliminar la publicación." }, 500);
      }
    } else {
      // Check in-memory fallback cache
      if (sharedPostsCache.has(postId)) {
        const cached = sharedPostsCache.get(postId);
        if (cached && (cached.userId === current.userId || current.role === "admin")) {
          sharedPostsCache.delete(postId);
          return json({
            success: true,
            message: "Publicación eliminada del muro. Tu check-in y puntos siguen intactos.",
          });
        }
      }
    }

    // Remove from in-memory cache if present
    sharedPostsCache.delete(postId);

    return json({
      success: true,
      message: "Publicación eliminada del muro. Tu check-in y puntos siguen intactos.",
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const params = await context.params;
    const postId = Number(params.postId);

    if (!postId || isNaN(postId)) {
      return json({ error: "ID de publicación no válido." }, 400);
    }

    const payload = await request.json() as Record<string, unknown>;
    const evidenceUrl = typeof payload.evidenceUrl === "string" ? payload.evidenceUrl.trim() : "";

    if (!evidenceUrl) {
      return json({ error: "Falta la URL de la evidencia." }, 400);
    }

    const supabase = getSupabase();

    // 1. Check if post exists in Supabase
    const { data: post, error: fetchErr } = await supabase
      .from("posts")
      .select("id, user_id, family_id, workout_id")
      .eq("id", postId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Fetch post error:", fetchErr);
      return json({ error: "Error al consultar la publicación." }, 500);
    }

    if (post) {
      // Permission check: only author or family admin can update
      if (post.user_id !== current.userId && current.role !== "admin") {
        return json({ error: "Solo puedes agregar foto a tus propias publicaciones." }, 403);
      }

      // Update posts table in Supabase
      const { error: updatePostErr } = await supabase
        .from("posts")
        .update({ evidence_url: evidenceUrl })
        .eq("id", postId);

      if (updatePostErr) {
        console.error("Update post photo error:", updatePostErr);
      }

      // If linked to a workout, also update workouts table in Supabase
      if (post.workout_id) {
        const { error: updateWorkoutErr } = await supabase
          .from("workouts")
          .update({ evidence_url: evidenceUrl })
          .eq("id", post.workout_id);

        if (updateWorkoutErr) {
          console.error("Update workout photo error:", updateWorkoutErr);
        }
      }
    }

    // Update in-memory fallback cache
    if (sharedPostsCache.has(postId)) {
      const cached = sharedPostsCache.get(postId);
      if (cached) {
        cached.evidenceUrl = evidenceUrl;
      }
    }

    return json({
      success: true,
      evidenceUrl,
      message: "¡Foto agregada con éxito al check-in!",
    });
  } catch (error) {
    return apiError(error);
  }
}
