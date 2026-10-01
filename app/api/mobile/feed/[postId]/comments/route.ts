import { getSupabase } from "../../../../../../db/supabase";
import { apiError, cleanText, json, options, requireMobileUser, SharedComment, sharedCommentsCache, sharedPostsCache } from "../../../_shared";

export const OPTIONS = options;

const officialNickMap: Record<string, string> = {
  "p.glez.lpz92@gmail.com": "Pedcaz",
  "pedcaz_19@hotmail.com": "Pedcaz",
  "emilyalejandra01@gmail.com": "JuuGlez",
  "hackyan4@gmail.com": "Baby",
  "marbelen.chaz@gmail.com": "Mabel",
  "edgar.lopez8983@alumnos.udg.mx": "Wero LM",
  "lucymatdan@gmail.com": "Lucy",
  "lucyramirezsolutec@gmail.com": "Lucy",
  "valhumrh@gmail.com": "CristinaFit",
  "chzivan@gmail.com": "Ivanovich",
  "estefanylome@gmail.com": "EstefanyLM",
  "eloalvarez.e@gmail.com": "Ely",
  "emmanuellopez3911@gmail.com": "Emanuelle",
  "viridiana.ca@icloud.com": "Virinovich",
  "lupitatp@live.com.mx": "Pita",
  "holobas12@gmail.com": "Holobas",
  "alvarezset1984@gmail.com": "Set",
  "fernando.life18@gmail.com": "Fercho",
};

export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);
    const postId = Number((await context.params).postId);

    const supabase = getSupabase();
    const { data: rows } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, body, created_at, users(name, email)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    const commentUserIds = Array.from(new Set((rows || []).map((r: any) => r.user_id)));
    const { data: commentProfiles } = await supabase
      .from("user_profiles")
      .select("user_id, nickname")
      .in("user_id", commentUserIds);
    const commentNickMap = new Map((commentProfiles || []).map((p: any) => [p.user_id, p.nickname]));

    const comments = (rows || []).map((r: any) => {
      const userEmail = (r.users?.email || "").toLowerCase();
      const officialNick = userEmail ? officialNickMap[userEmail] : null;
      const userProfileNick = commentNickMap.get(r.user_id);
      let displayNick = userProfileNick || officialNick;
      if (!displayNick) {
        const rawName = r.users?.name || "";
        if (rawName.includes("Pedro")) displayNick = "Pedcaz";
        else if (rawName.includes("Cristina")) displayNick = "CristinaFit";
        else if (rawName.includes("Guadalupe")) displayNick = "Pita";
        else if (rawName.includes("Belén") || rawName.includes("Belen")) displayNick = "Mabel";
        else if (rawName.includes("Judith")) displayNick = "JuuGlez";
        else if (rawName.includes("Ian")) displayNick = "Baby";
        else if (rawName.includes("Ivan")) displayNick = "Ivanovich";
        else if (rawName.includes("Estefany")) displayNick = "EstefanyLM";
        else if (rawName.includes("Edgar")) displayNick = "Wero LM";
        else if (rawName.includes("Elizabeth")) displayNick = "Ely";
        else if (rawName.includes("Emmanuel")) displayNick = "Emanuelle";
        else if (rawName.includes("Viridiana")) displayNick = "Virinovich";
        else if (rawName.includes("Horacio")) displayNick = "Holobas";
        else if (rawName.includes("Fernando")) displayNick = "Fercho";
        else if (rawName.includes("Valentina") || rawName.includes("Vale")) displayNick = "Vale";
        else if (rawName.includes("Luz") || rawName.includes("Lucy")) displayNick = "Lucy";
        else displayNick = rawName.split(" ")[0] || "Familiar";
      }

      return {
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        userName: displayNick,
        avatarUrl: `https://lhrdapdtcrjqlbjozmjc.supabase.co/storage/v1/object/public/avatars/${r.user_id}.jpg`,
        body: r.body,
        createdAt: r.created_at,
      };
    });

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
