import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { families, familyMembers, users } from "../../../../../db/schema";
import { apiError, cleanText, createSession, hashPassword, json, normalizeEmail, options, randomToken } from "../../_shared";

export const OPTIONS = options;

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const name = cleanText(payload.name, 60);
    const email = normalizeEmail(payload.email);
    const password = typeof payload.password === "string" ? payload.password : "";
    const familyName = cleanText(payload.familyName, 60);
    const inviteCode = cleanText(payload.inviteCode, 12).toUpperCase();

    if (name.length < 2 || !email.includes("@") || password.length < 8) {
      return json({ error: "Escribe tu nombre, un correo válido y una contraseña de al menos 8 caracteres." }, 400);
    }
    if (!familyName && !inviteCode) {
      return json({ error: "Crea una familia o escribe un código de invitación." }, 400);
    }

    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return json({ error: "Ese correo ya tiene una cuenta." }, 409);

    const salt = randomToken(16);
    const passwordHash = await hashPassword(password, salt);
    const [user] = await db.insert(users).values({ name, email, passwordHash, passwordSalt: salt }).returning();

    let family: typeof families.$inferSelect | undefined;
    let role: "admin" | "member" = "member";
    if (inviteCode) {
      [family] = await db.select().from(families).where(eq(families.inviteCode, inviteCode)).limit(1);
      if (!family) {
        await db.delete(users).where(eq(users.id, user.id));
        return json({ error: "El código de familia no existe." }, 404);
      }
    } else {
      role = "admin";
      const code = `4X7${randomToken(3).toUpperCase()}`;
      [family] = await db.insert(families).values({ name: familyName, inviteCode: code, createdBy: user.id }).returning();
    }

    await db.insert(familyMembers).values({ familyId: family.id, userId: user.id, role });
    const session = await createSession(user.id);
    return json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, name: user.name, email: user.email },
      family: { id: family.id, name: family.name, inviteCode: family.inviteCode, role },
    }, 201);
  } catch (error) {
    return apiError(error);
  }
}
