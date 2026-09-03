import { getSupabase } from "../../../../db/supabase";
import { apiError, cleanText, hashPassword, json, options, randomToken, requireMobileUser } from "../_shared";
import { OFFICIAL_FAMILY_USERS } from "../auth/login/route";

export const OPTIONS = options;

// Monthly prize
let monthlyPrize = {
  title: "Smartwatch Deportivo o Audífonos Pro 🎧",
  description: "Cumple mínimo tus 4 check-ins por semana en Septiembre y participa en la rifa familiar del mes.",
  imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
  month: "Septiembre 2026",
  minWeeklyCheckIns: 4,
};

const ADMIN_PIN = "123456";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "prize") {
      return json({ prize: monthlyPrize });
    }
    return json({ prize: monthlyPrize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const payload = await request.json() as Record<string, unknown>;
    const pin = cleanText(payload.pin, 10);
    const action = cleanText(payload.action, 50);

    // Validate 6-digit PIN
    if (pin !== ADMIN_PIN) {
      return json({ error: "PIN de administrador incorrecto." }, 403);
    }

    const supabase = getSupabase();

    // 1. List all users with complete profile & measurement data
    if (action === "list_users") {
      const { data: allUsers, error: usersErr } = await supabase
        .from("users")
        .select("id, name, email, created_at")
        .order("id", { ascending: true });

      if (usersErr) throw new Error(usersErr.message);

      const { data: allProfiles } = await supabase.from("user_profiles").select("*");
      const { data: allMeasurements } = await supabase.from("body_measurements").select("*").order("recorded_at", { ascending: true });
      const { data: allMembers } = await supabase.from("family_members").select("*");
      const { data: allWorkouts } = await supabase.from("workouts").select("id, user_id");

      const profileByUser = new Map((allProfiles || []).map((p: any) => [p.user_id, p]));
      const memberByUser = new Map((allMembers || []).map((m: any) => [m.user_id, m]));
      
      const measurementsByUser = new Map<number, any[]>();
      (allMeasurements || []).forEach((m: any) => {
        const list = measurementsByUser.get(m.user_id) || [];
        list.push(m);
        measurementsByUser.set(m.user_id, list);
      });

      const workoutsByUser = new Map<number, number>();
      (allWorkouts || []).forEach((w: any) => {
        const count = workoutsByUser.get(w.user_id) || 0;
        workoutsByUser.set(w.user_id, count + 1);
      });

      const usersWithStats = (allUsers || []).map((u: any) => {
        const prof = profileByUser.get(u.id);
        const mem = memberByUser.get(u.id);
        const uMeasurements = measurementsByUser.get(u.id) || [];
        const latestM = uMeasurements[uMeasurements.length - 1];
        const workoutCount = workoutsByUser.get(u.id) || 0;

        return {
          id: u.id,
          name: u.name,
          nickname: mem?.nickname || prof?.nickname || u.name.split(" ")[0],
          email: u.email,
          createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "Reciente",
          objective: prof?.objective || "general_fitness",
          challengeStartDate: prof?.challenge_start_date || "2026-09-01",
          heightCm: prof?.height_cm || null,
          weightKg: latestM?.weight_kg || null,
          targetWeightKg: prof?.target_weight_kg || null,
          role: mem?.role || "member",
          workoutCount,
          eligibleForPrize: workoutCount >= 4,
        };
      });

      return json({ users: usersWithStats, prize: monthlyPrize });
    }

    // 2. Reset user password
    if (action === "reset_password") {
      const targetUserId = Number(payload.targetUserId);
      const newPassword = cleanText(payload.newPassword, 100);

      if (!targetUserId || !newPassword || newPassword.length < 4) {
        return json({ error: "La nueva contraseña debe tener al menos 4 caracteres." }, 400);
      }

      const salt = randomToken(16);
      const passwordHash = await hashPassword(newPassword, salt);

      const { error: resetErr } = await supabase
        .from("users")
        .update({
          password_hash: passwordHash,
          password_salt: salt,
        })
        .eq("id", targetUserId);

      if (resetErr) throw new Error(resetErr.message);

      return json({ ok: true, message: `Contraseña restablecida exitosamente para el usuario #${targetUserId}.` });
    }

    // 3. Delete user completely from Supabase
    if (action === "delete_user") {
      const targetUserId = Number(payload.targetUserId || payload.userId);
      if (!targetUserId) {
        return json({ error: "ID de usuario no válido." }, 400);
      }
      if (targetUserId === current.userId) {
        return json({ error: "No puedes eliminar tu propia cuenta actual de administrador." }, 400);
      }

      // Cascading deletion
      await supabase.from("post_comments").delete().eq("user_id", targetUserId);
      await supabase.from("post_likes").delete().eq("user_id", targetUserId);
      await supabase.from("posts").delete().eq("user_id", targetUserId);
      await supabase.from("workouts").delete().eq("user_id", targetUserId);
      await supabase.from("body_measurements").delete().eq("user_id", targetUserId);
      await supabase.from("points_ledger").delete().eq("user_id", targetUserId);
      await supabase.from("user_profiles").delete().eq("user_id", targetUserId);
      await supabase.from("family_members").delete().eq("user_id", targetUserId);
      const { error: delErr } = await supabase.from("users").delete().eq("id", targetUserId);

      if (delErr) throw new Error(delErr.message);

      return json({ ok: true, message: `Usuario #${targetUserId} y todos sus datos fueron eliminados del sistema.` });
    }

    // 4. Update user registration data / profile in Supabase
    if (action === "update_user_data") {
      const targetUserId = Number(payload.targetUserId);
      if (!targetUserId) return json({ error: "ID de usuario requerido." }, 400);

      const name = cleanText(payload.name, 80);
      const nickname = cleanText(payload.nickname, 40);
      const email = cleanText(payload.email, 120)?.toLowerCase();
      const objective = cleanText(payload.objective, 40);
      const challengeStartDate = cleanText(payload.challengeStartDate, 20);
      const heightCm = payload.heightCm ? Number(payload.heightCm) : null;
      const weightKg = payload.weightKg ? Number(payload.weightKg) : null;
      const targetWeightKg = payload.targetWeightKg ? Number(payload.targetWeightKg) : null;

      // 1. Update users table
      if (name || email) {
        const updateObj: Record<string, any> = {};
        if (name) updateObj.name = name;
        if (email) updateObj.email = email;
        await supabase.from("users").update(updateObj).eq("id", targetUserId);
      }

      // 2. Update family_members table
      if (nickname) {
        await supabase.from("family_members").update({ nickname }).eq("user_id", targetUserId);
      }

      // 3. Update user_profiles table
      const profileUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (objective) profileUpdates.objective = objective;
      if (challengeStartDate) profileUpdates.challenge_start_date = challengeStartDate;
      if (heightCm && !isNaN(heightCm)) profileUpdates.height_cm = heightCm;
      if (targetWeightKg && !isNaN(targetWeightKg)) profileUpdates.target_weight_kg = targetWeightKg;

      await supabase.from("user_profiles").upsert({
        user_id: targetUserId,
        ...profileUpdates,
      }, { onConflict: "user_id" });

      // 4. Update body_measurements if weight given
      if (weightKg && !isNaN(weightKg)) {
        await supabase.from("body_measurements").insert({
          user_id: targetUserId,
          weight_kg: weightKg,
          recorded_at: new Date().toISOString(),
        });
      }

      return json({ ok: true, message: `Datos del usuario #${targetUserId} actualizados exitosamente en Supabase.` });
    }

    // 5. Save Monthly Prize
    if (action === "save_prize") {
      const title = cleanText(payload.title, 100) || monthlyPrize.title;
      const description = cleanText(payload.description, 250) || monthlyPrize.description;
      const imageUrl = cleanText(payload.imageUrl, 2000) || monthlyPrize.imageUrl;
      const month = cleanText(payload.month, 50) || monthlyPrize.month;

      monthlyPrize = {
        title,
        description,
        imageUrl,
        month,
        minWeeklyCheckIns: 4,
      };

      return json({ ok: true, prize: monthlyPrize, message: "¡Premio del mes actualizado exitosamente!" });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    return apiError(error);
  }
}
