import { json, options, requireMobileUser } from "../_shared";

export const OPTIONS = options;

export async function GET(request: Request) {
  const user = await requireMobileUser(request);
  if (!user) return json({ error: "Sesión no válida." }, 401);
  return json({
    user: { id: user.userId, name: user.name, email: user.email },
    family: { id: user.familyId, name: user.familyName, inviteCode: user.inviteCode, role: user.role },
  });
}
