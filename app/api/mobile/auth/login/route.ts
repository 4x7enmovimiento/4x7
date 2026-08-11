import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { families, familyMembers, users } from "../../../../../db/schema";
import { apiError, createSession, hashPassword, json, normalizeEmail, options } from "../../_shared";

export const OPTIONS = options;

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(payload.email);
    const password = typeof payload.password === "string" ? payload.password : "";
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || await hashPassword(password, user.passwordSalt) !== user.passwordHash) {
      return json({ error: "Correo o contraseña incorrectos." }, 401);
    }

    const [membership] = await db
      .select({ familyId: families.id, familyName: families.name, inviteCode: families.inviteCode, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(families, eq(familyMembers.familyId, families.id))
      .where(eq(familyMembers.userId, user.id))
      .limit(1);
    if (!membership) return json({ error: "Tu cuenta todavía no pertenece a una familia." }, 403);

    const session = await createSession(user.id);
    return json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, name: user.name, email: user.email },
      family: { id: membership.familyId, name: membership.familyName, inviteCode: membership.inviteCode, role: membership.role },
    });
  } catch (error) {
    return apiError(error);
  }
}
