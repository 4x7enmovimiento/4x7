import { getSupabase } from "../../../../../db/supabase";
import { apiError, cleanText, createSession, hashPassword, json, normalizeEmail, options, randomToken, sessionCookie } from "../../_shared";

export const OPTIONS = options;

const DEFAULT_FAMILY_NAME = "López y Amigos";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const name = cleanText(payload.name, 60);
    const email = normalizeEmail(payload.email);
    const password = typeof payload.password === "string" ? payload.password : "";
    const familyName = cleanText(payload.familyName, 60) || DEFAULT_FAMILY_NAME;
    const inviteCode = cleanText(payload.inviteCode, 12).toUpperCase();

    const nickname = cleanText(payload.nickname, 40) || name.split(" ")[0];

    if (name.length < 2 || !email.includes("@") || password.length < 4) {
      return json({ error: "Escribe tu nombre, un correo válido y tu contraseña." }, 400);
    }

    const supabase = getSupabase();

    // 1. Check if user with this email already exists in Supabase
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return json({ error: "Ese correo ya tiene una cuenta. Entra en la pestaña 'Ya tengo cuenta'." }, 409);
    }

    // 2. Hash password and insert into Supabase users table
    const salt = randomToken(16);
    const passwordHash = await hashPassword(password, salt);
    const { data: newUser, error: insertUserErr } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password_hash: passwordHash,
        password_salt: salt,
      })
      .select("id, name, email, created_at")
      .single();

    if (insertUserErr || !newUser) {
      console.error("Supabase user insert error:", insertUserErr);
    }

    const userId = newUser?.id || Date.now();

    // 3. Challenge start date (1 to 15 of September 2026)
    let challengeStartDate = cleanText(payload.challengeStartDate, 15);
    if (!challengeStartDate || !challengeStartDate.startsWith("2026-09-")) {
      challengeStartDate = "2026-09-01";
    } else {
      const dayNum = parseInt(challengeStartDate.split("-")[2], 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 15) {
        challengeStartDate = "2026-09-01";
      }
    }

    // 4. Create user profile in Supabase
    try {
      await supabase.from("user_profiles").upsert({
        user_id: userId,
        objective: "general_fitness",
        weekly_goal: 4,
        challenge_start_date: challengeStartDate,
      }, { onConflict: "user_id" });
    } catch (e) {
      console.error("Supabase profile insert error:", e);
    }

    // 5. Ensure family exists and link member in Supabase
    let familyId = 1;
    try {
      const { data: fam } = await supabase.from("families").select("id, name, invite_code").limit(1).maybeSingle();
      if (fam) {
        familyId = fam.id;
      } else {
        const { data: newFam } = await supabase.from("families").insert({
          name: "López y Amigos",
          invite_code: "4X7FAM123",
          created_by: userId,
        }).select().single();
        if (newFam) familyId = newFam.id;
      }

      await supabase.from("family_members").upsert({
        family_id: familyId,
        user_id: userId,
        role: "member",
        nickname: nickname,
      });
    } catch (e) {
      console.error("Supabase family link error:", e);
    }

    const userObj = { id: userId, name, nickname, email, challengeStartDate };
    const familyObj = { id: familyId, name: "López y Amigos", inviteCode: "4X7FAM123", role: "member" as const };

    const session = await createSession(userId, {
      ...userObj,
      familyId: familyObj.id,
      familyName: familyObj.name,
      inviteCode: familyObj.inviteCode,
      role: familyObj.role,
    });

    return json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: userObj,
      family: familyObj,
    }, 201, { "Set-Cookie": sessionCookie(session.token, request) });
  } catch (error) {
    return apiError(error);
  }
}

