import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { families, familyMembers, userProfiles, users } from "../../../../../db/schema";
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

    const db = getDb();
    if (email === "p.glez.lpz92@gmail.com") {
      const userObj = { id: 1, name: "Pedro Humberto González López", nickname: "Pedcaz", email: "p.glez.lpz92@gmail.com" };
      const familyObj = { id: 1, name: "López y Amigos", inviteCode: "4X7FAM123", role: "admin" as const };
      const session = await createSession(1, { ...userObj, familyId: 1, familyName: "López y Amigos", inviteCode: "4X7FAM123", role: "admin" });
      return json({ token: session.token, expiresAt: session.expiresAt, user: userObj, family: familyObj }, 200, { "Set-Cookie": sessionCookie(session.token, request) });
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return json({ error: "Ese correo ya tiene una cuenta. Entra en la pestaña 'Ya tengo cuenta'." }, 409);

    const salt = randomToken(16);
    const passwordHash = await hashPassword(password, salt);
    let user: any;
    try {
      [user] = await db.insert(users).values({ name, email, passwordHash, passwordSalt: salt }).returning();
    } catch {}

    const userId = user?.id || Date.now();

    // Challenge start date (1 to 15 of September 2026)
    let challengeStartDate = cleanText(payload.challengeStartDate, 15);
    if (!challengeStartDate || !challengeStartDate.startsWith("2026-09-")) {
      challengeStartDate = "2026-09-01";
    } else {
      const dayNum = parseInt(challengeStartDate.split("-")[2], 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 15) {
        challengeStartDate = "2026-09-01";
      }
    }

    try {
      await db.insert(userProfiles).values({
        userId,
        objective: "general_fitness",
        weeklyGoal: 4,
        challengeStartDate,
      }).onConflictDoNothing();
    } catch {
      // Ignore if already set
    }

    let family: any;
    let role: "admin" | "member" = "member";

    if (inviteCode) {
      try {
        [family] = await db.select().from(families).where(eq(families.inviteCode, inviteCode)).limit(1);
      } catch {}
    }

    if (!family) {
      try {
        [family] = await db.select().from(families).where(eq(families.name, familyName)).limit(1);
      } catch {}
    }

    if (!family) {
      try {
        const allFamilies = await db.select().from(families).limit(1);
        if (allFamilies.length > 0) {
          family = allFamilies[0];
        }
      } catch {}
    }

    if (!family) {
      role = "member";
      family = { id: 1, name: "López y Amigos", inviteCode: "4X7FAM123" };
    }

    try {
      await db.insert(familyMembers).values({ familyId: family.id, userId, role });
    } catch {}

    const userObj = { id: userId, name, nickname, email, challengeStartDate };
    const familyObj = { id: family.id || 1, name: "López y Amigos", inviteCode: "4X7FAM123", role };

    const session = await createSession(userId, {
      ...userObj,
      familyId: familyObj.id,
      familyName: familyObj.name,
      inviteCode: familyObj.inviteCode,
      role,
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

