import { getSupabase } from "../../../../db/supabase";
import {
  apiError,
  cleanText,
  familyProfilesCache,
  json,
  options,
  requireMobileUser,
  SharedFeedPost,
  sharedMemberStatsCache,
  sharedPostsCache,
} from "../_shared";

export const OPTIONS = options;

export async function GET(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    // Fast client-to-server state synchronization
    const clientSyncHeader = request.headers.get("x-client-sync");
    if (clientSyncHeader) {
      try {
        const clientSync = JSON.parse(clientSyncHeader);
        if (clientSync?.nickname && typeof clientSync.workouts === "number") {
          const key = clientSync.nickname.toLowerCase();
          const existing = sharedMemberStatsCache.get(key);
          const maxWorkouts = Math.max(existing?.workouts || 0, clientSync.workouts);
          const mergedDates = Array.from(new Set([...(existing?.completedDates || []), ...(clientSync.completedDates || [])]));
          const updatedStat = {
            nickname: clientSync.nickname,
            fullName: clientSync.fullName || existing?.fullName || current.name,
            workouts: maxWorkouts,
            completedDates: mergedDates,
            points: maxWorkouts * 100 + (maxWorkouts >= 4 ? 300 : 0),
            activity: clientSync.activity || existing?.activity || "Entrenamiento",
            lastCheckinDate: clientSync.lastCheckinDate || existing?.lastCheckinDate || new Date().toISOString().split("T")[0],
          };
          sharedMemberStatsCache.set(key, updatedStat);
          if (current.name) sharedMemberStatsCache.set(current.name.toLowerCase(), updatedStat);
          if (current.email) sharedMemberStatsCache.set(current.email.toLowerCase(), updatedStat);
        }
      } catch {}
    }
    const supabase = getSupabase();
    let dbPosts: any[] = [];
    try {
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id,
          user_id,
          caption,
          evidence_key,
          created_at,
          users (name),
          workouts (activity_type, duration_seconds, distance_meters, steps, calories)
        `)
        .eq("family_id", current.familyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map((p: any) => p.id);
        const { data: likesData } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds);
        const { data: commentsData } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);

        const likesByPost = new Map<number, number[]>();
        (likesData || []).forEach((l: any) => {
          const list = likesByPost.get(l.post_id) || [];
          list.push(l.user_id);
          likesByPost.set(l.post_id, list);
        });

        const commentsCountByPost = new Map<number, number>();
        (commentsData || []).forEach((c: any) => {
          commentsCountByPost.set(c.post_id, (commentsCountByPost.get(c.post_id) || 0) + 1);
        });

        dbPosts = postsData.map((row: any) => {
          const userLikes = likesByPost.get(row.id) || [];
          return {
            id: row.id,
            userId: row.user_id,
            userName: row.users?.name || "Familiar",
            caption: row.caption,
            evidenceKey: row.evidence_key,
            evidenceUrl: row.evidence_key ? `/api/mobile/evidence/${row.evidence_key}` : null,
            createdAt: row.created_at,
            activityType: row.workouts?.activity_type || null,
            durationSeconds: row.workouts?.duration_seconds || null,
            distanceMeters: row.workouts?.distance_meters || null,
            steps: row.workouts?.steps || null,
            calories: row.workouts?.calories || null,
            likes: userLikes.length,
            comments: commentsCountByPost.get(row.id) || 0,
            likedByMe: userLikes.includes(current.userId),
          };
        });
      }
    } catch (dbErr) {
      console.warn("Supabase feed query fallback:", dbErr);
    }

    let postsList: any[] = dbPosts;
    if (postsList.length === 0) {
      postsList = Array.from(sharedPostsCache.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((p) => ({
          ...p,
          likedByMe: p.likedUserIds?.includes(current.userId) || false,
        }));
    }

    const familyProfilesObj: Record<string, any> = {};
    for (const [key, val] of familyProfilesCache.entries()) {
      familyProfilesObj[key] = val;
    }

    // Include all registered users & synchronized stats from Supabase
    const familyStatsObj: Record<string, any> = {};

    try {
      const { data: allUsers } = await supabase.from("users").select("id, name, email");
      const { data: allProfiles } = await supabase.from("user_profiles").select("*");
      const { data: allWorkouts } = await supabase.from("workouts").select("id, user_id, activity_type, started_at, created_at").eq("family_id", current.familyId);
      const { data: allPoints } = await supabase.from("points_ledger").select("user_id, points");

      const profileByUser = new Map((allProfiles || []).map((p: any) => [p.user_id, p]));

      // Group workouts by user
      const workoutsByUser = new Map<number, any[]>();
      (allWorkouts || []).forEach((w: any) => {
        const list = workoutsByUser.get(w.user_id) || [];
        list.push(w);
        workoutsByUser.set(w.user_id, list);
      });

      // Sum points by user
      const pointsByUser = new Map<number, number>();
      (allPoints || []).forEach((pt: any) => {
        const curr = pointsByUser.get(pt.user_id) || 0;
        pointsByUser.set(pt.user_id, curr + (Number(pt.points) || 0));
      });

      // Current week bounds (Guadalajara GDL time)
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      monday.setHours(0, 0, 0, 0);

      (allUsers || []).forEach((u: any) => {
        const prof = profileByUser.get(u.id);
        const nameParts = (u.name || "").split(" ");
        const nickname = (prof as any)?.nickname || nameParts[0] || u.name;

        const summary = {
          name: nameParts[0] || u.name,
          fullName: u.name,
          nickname,
          preferredActivity: "",
          objective: prof?.objective || "general_fitness",
          challengeStartDate: prof?.challenge_start_date || "2026-09-01",
          updatedAt: prof?.updated_at || new Date().toISOString(),
        };

        familyProfilesObj[u.name.toLowerCase()] = summary;
        familyProfilesObj[nickname.toLowerCase()] = summary;
        if (u.email) familyProfilesObj[u.email.toLowerCase()] = summary;

        const userWorkouts = workoutsByUser.get(u.id) || [];
        const completedDates = Array.from(new Set(userWorkouts.map((w: any) => {
          const d = new Date(w.started_at || w.created_at);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })));

        // Week workouts count
        const weekWorkouts = userWorkouts.filter((w: any) => {
          const d = new Date(w.started_at || w.created_at);
          return d >= monday;
        });

        const weekCount = Array.from(new Set(weekWorkouts.map((w: any) => {
          const d = new Date(w.started_at || w.created_at);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }))).length;

        const hasProfile = Boolean(prof && (prof.height_cm || prof.weight_kg || prof.target_weight_kg || prof.objective));
        const profileBonus = hasProfile ? 50 : 0;

        const ledgerPoints = pointsByUser.get(u.id);
        const computedPoints = ledgerPoints !== undefined && ledgerPoints > 0
          ? ledgerPoints
          : (weekCount * 100) + (weekCount >= 4 ? 300 : 0) + profileBonus;

        const lastWorkout = userWorkouts[userWorkouts.length - 1];

        const statEntry = {
          userId: u.id,
          nickname,
          fullName: u.name,
          workouts: weekCount,
          totalWorkouts: userWorkouts.length,
          completedDates,
          points: computedPoints,
          hasProfile,
          activity: lastWorkout?.activity_type || "",
          lastCheckinDate: completedDates[completedDates.length - 1] || "",
        };

        familyStatsObj[u.name.toLowerCase()] = statEntry;
        familyStatsObj[nickname.toLowerCase()] = statEntry;
        if (u.email) familyStatsObj[u.email.toLowerCase()] = statEntry;
      });
    } catch (e) {
      console.warn("Supabase family stats aggregation error:", e);
    }

    return json({
      posts: postsList,
      familyProfiles: familyProfilesObj,
      familyStats: familyStatsObj,
    });
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

    const newPostId = Date.now();
    const nick = current.name.includes("Pedro") ? "Pedcaz" : current.name.includes("Judith") ? "JuuGlez" : current.name.split(" ")[0];
    const newPost: SharedFeedPost = {
      id: newPostId,
      userId: current.userId,
      userName: nick,
      caption,
      evidenceKey,
      evidenceUrl: evidenceKey ? `/api/mobile/evidence/${evidenceKey}` : null,
      createdAt: new Date().toISOString(),
      activityType: null,
      durationSeconds: null,
      distanceMeters: null,
      steps: null,
      calories: null,
      likes: 0,
      comments: 0,
      likedUserIds: [],
    };
    sharedPostsCache.set(newPostId, newPost);

    try {
      await getDb().insert(posts).values({ familyId: current.familyId, userId: current.userId, caption, evidenceKey });
    } catch {}

    return json({ post: newPost }, 201);
  } catch (error) {
    return apiError(error);
  }
}
