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

    if (name.length < 2 || !email.includes("@") || password.length < 4) {
      return json({ error: "Escribe tu nombre, un correo válido y tu contraseña." }, 400);
    }

    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return json({ error: "Ese correo ya tiene una cuenta." }, 409);

    const salt = randomToken(16);
    const passwordHash = await hashPassword(password, salt);
    const [user] = await db.insert(users).values({ name, email, passwordHash, passwordSalt: salt }).returning();

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
        userId: user.id,
        objective: "general_fitness",
        weeklyGoal: 4,
        challengeStartDate,
      }).onConflictDoNothing();
    } catch {
      // Ignore if already set
    }

    let family: typeof families.$inferSelect | undefined;
    let role: "admin" | "member" = "member";

    if (inviteCode) {
      [family] = await db.select().from(families).where(eq(families.inviteCode, inviteCode)).limit(1);
    }

    if (!family) {
      // Look for the default family "López y Amigos" or the first family
      [family] = await db.select().from(families).where(eq(families.name, familyName)).limit(1);
    }

    if (!family) {
      // If no family exists at all, look for any family in DB
      const allFamilies = await db.select().from(families).limit(1);
      if (allFamilies.length > 0) {
        family = allFamilies[0];
      }
    }

    if (!family) {
      // Create the default family
      role = "admin";
      const code = `4X7LOPEZ`;
      [family] = await db.insert(families).values({ name: familyName, inviteCode: code, createdBy: user.id }).returning();
    }

    await db.insert(familyMembers).values({ familyId: family.id, userId: user.id, role });
    const session = await createSession(user.id);
    return json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, name: user.name, email: user.email, challengeStartDate },
      family: { id: family.id, name: family.name, inviteCode: family.inviteCode, role },
    }, 201, { "Set-Cookie": sessionCookie(session.token, request) });
  } catch (error) {
    return apiError(error);
  }
}

