import { getSupabase } from "../../../../db/supabase";
import { apiError, cleanText, json, options, requireMobileUser } from "../_shared";

export const OPTIONS = options;

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("custom_challenges")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;

    const formatted = (rows || []).map((row: any) => ({
      id: row.id,
      creator: row.creator_name,
      targets: Array.isArray(row.targets) ? row.targets : ["Toda la Familia"],
      title: row.title,
      desc: row.description,
      rewardPoints: Number(row.reward_points) || 100,
      bet: row.bet || undefined,
      completedBy: Array.isArray(row.completed_by) ? row.completed_by : [],
      acceptedBy: Array.isArray(row.accepted_by) ? row.accepted_by : [],
      createdAt: row.created_at ? new Date(row.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Reciente",
    }));

    return json({ challenges: formatted });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = cleanText(payload.action, 50) || "create";
    const supabase = getSupabase();

    if (action === "create") {
      const title = cleanText(payload.title, 120);
      const desc = cleanText(payload.desc, 300) || "¡A ver quién cumple este reto familiar primero!";
      const rewardPoints = Math.max(50, Math.min(2000, Number(payload.rewardPoints) || 300));
      const bet = cleanText(payload.bet, 100) || undefined;
      const targets = Array.isArray(payload.targets) && payload.targets.length ? payload.targets : ["Toda la Familia"];
      const creator = cleanText(payload.creator, 50) || current.name.split(" ")[0];

      if (!title) {
        return json({ error: "El título del reto es obligatorio." }, 400);
      }

      const insertData = {
        creator_name: creator,
        targets,
        title,
        description: desc,
        reward_points: rewardPoints,
        bet: bet || null,
        completed_by: [],
        accepted_by: [creator],
      };

      const { data: created, error } = await supabase
        .from("custom_challenges")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Announce on the family feed wall!
      const targetsStr = targets.includes("Toda la Familia") ? "Toda la Familia 👥" : targets.join(", ");
      await supabase.from("posts").insert({
        family_id: current.familyId,
        user_id: current.userId,
        caption: `⚔️🔥 ¡NUEVO RETO FAMILIAR LANZADO! 🏆\n"${title}"\n\n📌 Objetivo: ${desc}\n🎯 Dirigido a: ${targetsStr}\n✨ Recompensa: +${rewardPoints} PTS${bet ? `\n🌮 Apuesta amistosa: ${bet}` : ""}\n\n¡Acepta el duelo en la pestaña de Liga y Retos! 💪`,
        activity_type: "Reto Familiar ⚔️",
        evidence_url: null,
        likes_count: 0,
        comments_count: 0,
      }).catch((e) => console.warn("Could not insert challenge announcement post:", e));

      return json({
        ok: true,
        challenge: {
          id: created.id,
          creator: created.creator_name,
          targets: created.targets,
          title: created.title,
          desc: created.description,
          rewardPoints: created.reward_points,
          bet: created.bet || undefined,
          completedBy: created.completed_by || [],
          acceptedBy: created.accepted_by || [],
          createdAt: "Justo ahora",
        },
      });
    }

    if (action === "complete") {
      const challengeId = Number(payload.id);
      const userName = cleanText(payload.userName, 50) || current.name.split(" ")[0];
      if (!challengeId) return json({ error: "ID de reto requerido." }, 400);

      const { data: ch, error: chErr } = await supabase
        .from("custom_challenges")
        .select("*")
        .eq("id", challengeId)
        .single();

      if (chErr || !ch) return json({ error: "Reto no encontrado." }, 404);

      const completedBy: string[] = Array.isArray(ch.completed_by) ? ch.completed_by : [];
      let isNewlyAdded = false;
      if (!completedBy.includes(userName)) {
        completedBy.push(userName);
        await supabase
          .from("custom_challenges")
          .update({ completed_by: completedBy })
          .eq("id", challengeId);
        isNewlyAdded = true;

        // Announce completion on feed
        await supabase.from("posts").insert({
          family_id: current.familyId,
          user_id: current.userId,
          caption: `👑🎉 ¡RETO FAMILIAR CUMPLIDO! 🏆\n"${ch.title}"\n¡Misión superada con éxito ganando +${ch.reward_points} PTS! ${ch.bet ? `\n🌮 Ya me gané: ${ch.bet}` : ""}\n¡A ver quién más se anima! 🔥💪`,
          activity_type: "Reto Cumplido 👑",
          evidence_url: null,
          likes_count: 0,
          comments_count: 0,
        }).catch((e) => console.warn("Could not insert challenge victory post:", e));
      }

      // Check if already in points_ledger; if not, insert it!
      const { data: existingLedger } = await supabase
        .from("points_ledger")
        .select("id")
        .eq("user_id", current.userId)
        .eq("source_type", "challenge")
        .eq("source_id", challengeId)
        .maybeSingle();

      if (!existingLedger) {
        await supabase.from("points_ledger").insert({
          family_id: current.familyId,
          user_id: current.userId,
          points: Number(ch.reward_points) || 100,
          reason: `Reto cumplido: ${ch.title}`,
          source_type: "challenge",
          source_id: challengeId,
        }).catch((e) => console.warn("Could not insert challenge points into ledger:", e));
      }

      return json({ ok: true, completedBy });
    }

    if (action === "sync_local") {
      const localChallenges = Array.isArray(payload.challenges) ? payload.challenges : [];
      if (localChallenges.length > 0) {
        const { data: existing } = await supabase.from("custom_challenges").select("title, creator_name");
        const existingSet = new Set((existing || []).map((e: any) => `${e.creator_name}:::${e.title}`));

        for (const loc of localChallenges) {
          const key = `${loc.creator}:::${loc.title}`;
          if (!existingSet.has(key) && loc.title && loc.creator) {
            await supabase.from("custom_challenges").insert({
              creator_name: loc.creator,
              targets: Array.isArray(loc.targets) ? loc.targets : ["Toda la Familia"],
              title: loc.title,
              description: loc.desc || "Reto familiar",
              reward_points: Number(loc.rewardPoints) || 100,
              bet: loc.bet || null,
              completed_by: Array.isArray(loc.completedBy) ? loc.completedBy : [],
              accepted_by: Array.isArray(loc.acceptedBy) ? loc.acceptedBy : [loc.creator],
            });
            existingSet.add(key);

            // Announce on feed
            const targetsStr = Array.isArray(loc.targets) && loc.targets.includes("Toda la Familia") ? "Toda la Familia 👥" : (loc.targets || []).join(", ");
            await supabase.from("posts").insert({
              family_id: current.familyId,
              user_id: current.userId,
              caption: `⚔️🔥 ¡NUEVO RETO FAMILIAR LANZADO! 🏆\n"${loc.title}"\n\n📌 Objetivo: ${loc.desc || "¡A ver quién cumple este reto primero!"}\n🎯 Dirigido a: ${targetsStr}\n✨ Recompensa: +${loc.rewardPoints || 100} PTS${loc.bet ? `\n🌮 Apuesta amistosa: ${loc.bet}` : ""}\n\n¡Acepta el duelo en la pestaña de Liga y Retos! 💪`,
              activity_type: "Reto Familiar ⚔️",
              evidence_url: null,
              likes_count: 0,
              comments_count: 0,
            }).catch(() => {});
          }
        }
      }

      const { data: all } = await supabase.from("custom_challenges").select("*").order("id", { ascending: false });
      return json({ ok: true, challenges: all });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    return apiError(error);
  }
}
