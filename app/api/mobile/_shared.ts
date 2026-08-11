import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { families, familyMembers, sessions, users } from "../../../db/schema";

const encoder = new TextEncoder();
const SESSION_DAYS = 30;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

export function options() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export async function hashPassword(password: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120_000 },
    material,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function createSession(userId: number) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await getDb().insert(sessions).values({ userId, tokenHash, expiresAt });
  return { token, expiresAt };
}

export async function requireMobileUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const tokenHash = await sha256(token);
  const db = getDb();
  const [row] = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      familyId: families.id,
      familyName: families.name,
      inviteCode: families.inviteCode,
      role: familyMembers.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(familyMembers, eq(familyMembers.userId, users.id))
    .innerJoin(families, eq(familyMembers.familyId, families.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return row ?? null;
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  console.error("4x7 mobile API error", error);
  if (message.includes("UNIQUE constraint failed")) {
    return json({ error: "Ese correo o código ya está registrado." }, 409);
  }
  return json({ error: "No pudimos completar la operación. Intenta nuevamente." }, 500);
}
