import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { sessions } from "../../../../../db/schema";
import { clearSessionCookie, json, options, sessionToken, sha256 } from "../../_shared";

export const OPTIONS = options;

export async function POST(request: Request) {
  const token = sessionToken(request);
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
