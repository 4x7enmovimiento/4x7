import { getSupabase } from "../../../../db/supabase";
import {
  apiError,
  cleanText,
  familyProfilesCache,
  getPersistedMonthlyPrize,
  json,
  options,
  requireMobileUser,
  SharedFeedPost,
  sharedMemberStatsCache,
  sharedPostsCache,
} from "../_shared";

export const OPTIONS = options;

const officialNickMap: Record<string, string> = {
  "p.glez.lpz92@gmail.com": "Pedcaz",
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
          activity_type,
          evidence_url,
          created_at,
          users (id, name, email),
          workouts (activity_type, duration_seconds, distance_meters, steps, calories)
        `)
        .eq("family_id", current.familyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map((p: any) => p.id);
        const postUserIds = Array.from(new Set(postsData.map((p: any) => p.user_id)));
        const { data: postProfiles } = await supabase.from("user_profiles").select("user_id, nickname").in("user_id", postUserIds);
        const postNickMap = new Map((postProfiles || []).map((p: any) => [p.user_id, p.nickname]));

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
          const userEmail = (row.users?.email || "").toLowerCase();
          const officialNick = userEmail ? officialNickMap[userEmail] : null;
          const userProfileNick = postNickMap.get(row.user_id);

          let displayNick = userProfileNick || officialNick;
          if (!displayNick) {
            const rawName = row.users?.name || "";
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
            else displayNick = rawName.split(" ")[0] || "Familiar";
          }

          return {
            id: row.id,
            userId: row.user_id,
            userName: displayNick,
            caption: row.caption,
            evidenceUrl: row.evidence_url || null,
            createdAt: row.created_at,
            activityType: row.activity_type || row.workouts?.activity_type || null,
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

      // Guadalajara / Mexico City Date & Current Week Bounds
      const toGdlDate = (raw: string | Date): string => {
        try {
          const d = typeof raw === "string" ? new Date(raw) : raw;
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Mexico_City",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).formatToParts(d);
          const y = parts.find((p) => p.type === "year")?.value;
          const m = parts.find((p) => p.type === "month")?.value;
          const day = parts.find((p) => p.type === "day")?.value;
          return `${y}-${m}-${day}`;
        } catch {
          return new Date(raw).toISOString().split("T")[0];
        }
      };

      const nowGdlParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).formatToParts(new Date());

      const gdlYear = parseInt(nowGdlParts.find((p) => p.type === "year")?.value || "2026", 10);
      const gdlMonth = parseInt(nowGdlParts.find((p) => p.type === "month")?.value || "9", 10) - 1;
      const gdlDay = parseInt(nowGdlParts.find((p) => p.type === "day")?.value || "7", 10);

      const gdlToday = new Date(gdlYear, gdlMonth, gdlDay);
      const dayOfWeek = (gdlToday.getDay() + 6) % 7; // Monday = 0, Sunday = 6
      const currentMonday = new Date(gdlYear, gdlMonth, gdlDay - dayOfWeek);
      const currentMondayKey = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, "0")}-${String(currentMonday.getDate()).padStart(2, "0")}`;
      const currentSunday = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 6);
      const currentSundayKey = `${currentSunday.getFullYear()}-${String(currentSunday.getMonth() + 1).padStart(2, "0")}-${String(currentSunday.getDate()).padStart(2, "0")}`;

      const WEEKS = [
        { id: "week1", label: "Semana 1", range: "1 - 6 Sep", start: "2026-09-01", end: "2026-09-06" },
        { id: "week2", label: "Semana 2", range: "7 - 13 Sep", start: "2026-09-07", end: "2026-09-13" },
        { id: "week3", label: "Semana 3", range: "14 - 20 Sep", start: "2026-09-14", end: "2026-09-20" },
        { id: "week4", label: "Semana 4", range: "21 - 27 Sep", start: "2026-09-21", end: "2026-09-27" },
        { id: "week5", label: "Semana 5", range: "28 - 30 Sep", start: "2026-09-28", end: "2026-09-30" },
      ];

      function computeWeekPoints(count: number): number {
        let pts = 0;
        for (let d = 1; d <= count; d++) {
          if (d <= 3) pts += 100;
          else if (d === 4) pts += 300;
          else if (d === 5) pts += 250;
          else if (d === 6) pts += 350;
          else if (d >= 7) pts += 500;
        }
        return pts;
      }

      (allUsers || []).forEach((u: any) => {
        const prof = profileByUser.get(u.id);
        const nameParts = (u.name || "").split(" ");
        const officialNick = u.email ? officialNickMap[u.email.toLowerCase()] : null;
        const nickname = (prof as any)?.nickname || officialNick || nameParts[0] || u.name;

        const summary = {
          userId: u.id,
          name: nameParts[0] || u.name,
          fullName: u.name,
          nickname,
          preferredActivity: "",
          objective: prof?.objective || "general_fitness",
          challengeStartDate: prof?.challenge_start_date || "2026-09-01",
          updatedAt: prof?.updated_at || new Date().toISOString(),
        };

        const cleanNick = nickname
          .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
          .trim()
          .toLowerCase();

        familyProfilesObj[u.id] = summary;
        familyProfilesObj[String(u.id)] = summary;
        familyProfilesObj[u.name.toLowerCase()] = summary;
        familyProfilesObj[nickname.toLowerCase()] = summary;
        if (cleanNick) familyProfilesObj[cleanNick] = summary;
        if (officialNick) familyProfilesObj[officialNick.toLowerCase()] = summary;
        if (u.email) familyProfilesObj[u.email.toLowerCase()] = summary;

        const userWorkouts = workoutsByUser.get(u.id) || [];
        const allCompletedDates = Array.from(
          new Set(userWorkouts.map((w: any) => toGdlDate(w.started_at || w.created_at)))
        );

        // Strict current week workouts (Monday 00:00 to Sunday 23:59 GDL)
        const currentWeekDates = allCompletedDates.filter(
          (dateKey) => dateKey >= currentMondayKey && dateKey <= currentSundayKey
        );
        const weekCount = currentWeekDates.length;

        // Compute week-by-week history with workouts count and points per week
        const weeklyHistory = WEEKS.map((w) => {
          const datesInWeek = allCompletedDates.filter((k) => k >= w.start && k <= w.end);
          const isCurrent = w.start <= currentMondayKey && currentMondayKey <= w.end;
          const weekPts = computeWeekPoints(datesInWeek.length);
          return {
            weekId: w.id,
            label: w.label,
            range: w.range,
            count: datesInWeek.length,
            dates: datesInWeek,
            points: weekPts,
            completed: datesInWeek.length >= 4,
            isCurrent,
          };
        });

        const hasProfile = Boolean(prof && (prof.height_cm || prof.weight_kg || prof.target_weight_kg || prof.objective));
        const profileBonus = hasProfile ? 50 : 0;

        // Weekly points strictly resets every Monday
        const currentWeekPoints = computeWeekPoints(weekCount);
        const totalHistoricalPoints = weeklyHistory.reduce((acc, wh) => acc + wh.points, 0) + profileBonus;

        const lastWorkout = userWorkouts[userWorkouts.length - 1];

        const statEntry = {
          userId: u.id,
          nickname,
          fullName: u.name,
          workouts: weekCount, // STRICT CURRENT WEEK COUNT (Resets every Monday)
          currentWeekDates, // ONLY THIS WEEK DATES
          completedDates: allCompletedDates, // ALL TIME DATES
          weeklyHistory, // WEEK-BY-WEEK HISTORY BREAKDOWN
          points: currentWeekPoints, // STRICT WEEKLY POINTS (Resets every Monday)
          weeklyPoints: currentWeekPoints,
          totalPoints: totalHistoricalPoints, // ALL-TIME CHALLENGE POINTS
          hasProfile,
          activity: lastWorkout?.activity_type || "",
          lastCheckinDate: allCompletedDates[allCompletedDates.length - 1] || "",
        };

        familyStatsObj[u.id] = statEntry;
        familyStatsObj[String(u.id)] = statEntry;
        familyStatsObj[u.name.toLowerCase()] = statEntry;
        familyStatsObj[nickname.toLowerCase()] = statEntry;
        if (cleanNick) familyStatsObj[cleanNick] = statEntry;
        if (officialNick) familyStatsObj[officialNick.toLowerCase()] = statEntry;
        if (u.email) familyStatsObj[u.email.toLowerCase()] = statEntry;
      });
    } catch (e) {
      console.warn("Supabase family stats aggregation error:", e);
    }

    const monthlyPrize = await getPersistedMonthlyPrize();

    return json({
      posts: postsList,
      familyProfiles: familyProfilesObj,
      familyStats: familyStatsObj,
      monthlyPrize,
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

export async function DELETE(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const url = new URL(request.url);
    const queryId = url.searchParams.get("postId");
    let postId = queryId ? parseInt(queryId, 10) : 0;

    if (!postId) {
      try {
        const body = await request.json();
        postId = Number(body?.postId);
      } catch {}
    }

    if (!postId || isNaN(postId)) {
      return json({ error: "ID de publicación no válido." }, 400);
    }

    const supabase = getSupabase();
    const { data: post } = await supabase
      .from("posts")
      .select("id, user_id, family_id")
      .eq("id", postId)
      .maybeSingle();

    if (post) {
      if (post.user_id !== current.userId && current.role !== "admin") {
        return json({ error: "Solo puedes eliminar tus propias publicaciones." }, 403);
      }
      await supabase.from("post_comments").delete().eq("post_id", postId);
      await supabase.from("post_likes").delete().eq("post_id", postId);
      await supabase.from("posts").delete().eq("id", postId);
    }

    sharedPostsCache.delete(postId);

    return json({
      success: true,
      message: "Publicación eliminada del muro. Tu check-in y puntos siguen intactos.",
    });
  } catch (error) {
    return apiError(error);
  }
}

