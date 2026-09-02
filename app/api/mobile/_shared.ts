import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { families, familyMembers, sessions, users } from "../../../db/schema";

const encoder = new TextEncoder();
const SESSION_DAYS = 365;
const PASSWORD_HASH_ITERATIONS = 100_000;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

export function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return Response.json(data, { status, headers: { ...corsHeaders, ...Object.fromEntries(new Headers(extraHeaders).entries()) } });
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
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PASSWORD_HASH_ITERATIONS },
    material,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export interface CachedUserSession {
  userId: number;
  name: string;
  email: string;
  familyId: number;
  familyName: string;
  inviteCode: string;
  role: "admin" | "member";
  expiresAt: string;
}

const sessionStore = globalThis as unknown as { __sessionCache?: Map<string, CachedUserSession> };
sessionStore.__sessionCache ||= new Map();
const sessionCache = sessionStore.__sessionCache;

export interface FamilyMemberSummary {
  name: string;
  fullName: string;
  nickname: string;
  preferredActivity: string;
  objective?: string;
  updatedAt?: string;
}

const familyProfilesStore = globalThis as unknown as {
  __familyProfiles?: Map<string, FamilyMemberSummary>;
};
familyProfilesStore.__familyProfiles ||= new Map();
export const familyProfilesCache = familyProfilesStore.__familyProfiles;

// Seed with JuuGlez and Pedcaz who have already registered their profiles
if (!familyProfilesCache.has("juuglez")) {
  const judithSummary: FamilyMemberSummary = {
    name: "Judith",
    fullName: "Judith González López",
    nickname: "JuuGlez",
    preferredActivity: "",
    objective: "lose_fat",
    updatedAt: new Date().toISOString(),
  };
  familyProfilesCache.set("juuglez", judithSummary);
  familyProfilesCache.set("judith", judithSummary);
  familyProfilesCache.set("emilyalejandra01@gmail.com", judithSummary);
}

if (!familyProfilesCache.has("pedcaz")) {
  const pedroSummary: FamilyMemberSummary = {
    name: "Pedro",
    fullName: "Pedro Humberto González López",
    nickname: "Pedcaz",
    preferredActivity: "Gimnasio / Pesas 🏋️‍♂️",
    objective: "lose_fat",
    updatedAt: new Date().toISOString(),
  };
  familyProfilesCache.set("pedcaz", pedroSummary);
  familyProfilesCache.set("pedro", pedroSummary);
  familyProfilesCache.set("p.glez.lpz92@gmail.com", pedroSummary);
}

export interface SharedFeedPost {
  id: number;
  userId: number;
  userName: string;
  caption: string;
  evidenceKey: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  activityType: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  steps: number | null;
  calories: number | null;
  likes: number;
  comments: number;
  likedUserIds: number[];
}

export interface SharedComment {
  id: number;
  postId: number;
  userId: number;
  userName: string;
  body: string;
  createdAt: string;
}

export interface SharedMemberStats {
  nickname: string;
  fullName: string;
  workouts: number;
  completedDates: string[];
  points: number;
  activity: string;
  lastCheckinDate: string;
}

const socialStore = globalThis as unknown as {
  __sharedPosts?: Map<number, SharedFeedPost>;
  __sharedComments?: Map<number, SharedComment[]>;
  __sharedMemberStats?: Map<string, SharedMemberStats>;
};
socialStore.__sharedPosts ||= new Map();
socialStore.__sharedComments ||= new Map();
socialStore.__sharedMemberStats ||= new Map();

export const sharedPostsCache = socialStore.__sharedPosts;
export const sharedCommentsCache = socialStore.__sharedComments;
export const sharedMemberStatsCache = socialStore.__sharedMemberStats;

const todayStr = new Date().toISOString().split("T")[0];

if (!sharedMemberStatsCache.has("juuglez")) {
  const judithStats: SharedMemberStats = {
    nickname: "JuuGlez",
    fullName: "Judith González López",
    workouts: 0,
    completedDates: [],
    points: 0,
    activity: "",
    lastCheckinDate: "",
  };
  sharedMemberStatsCache.set("juuglez", judithStats);
  sharedMemberStatsCache.set("judith", judithStats);
  sharedMemberStatsCache.set("emilyalejandra01@gmail.com", judithStats);
}

if (!sharedMemberStatsCache.has("pedcaz")) {
  const pedroStats: SharedMemberStats = {
    nickname: "Pedcaz",
    fullName: "Pedro Humberto González López",
    workouts: 1,
    completedDates: [todayStr],
    points: 100,
    activity: "Gimnasio / Pesas 🏋️‍♂️",
    lastCheckinDate: todayStr,
  };
  sharedMemberStatsCache.set("pedcaz", pedroStats);
  sharedMemberStatsCache.set("pedro", pedroStats);
  sharedMemberStatsCache.set("p.glez.lpz92@gmail.com", pedroStats);
}

if (!sharedPostsCache.has(1001)) {
  sharedPostsCache.set(1001, {
    id: 1001,
    userId: 1,
    userName: "Pedcaz",
    caption: "¡Entrenamiento de Gimnasio y Fuerza completado! 💪 Poniendo el ejemplo en el Reto 4×7.",
    evidenceKey: null,
    evidenceUrl: "/images/machines/bench_flat.jpg",
    createdAt: new Date().toISOString(),
    activityType: "Gimnasio / Pesas 🏋️‍♂️",
    durationSeconds: 2700,
    distanceMeters: null,
    steps: null,
    calories: 320,
    likes: 1,
    comments: 0,
    likedUserIds: [2],
  });
}

export async function createSession(userId: number, userInfo?: Partial<CachedUserSession>) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();

  if (userInfo) {
    sessionCache.set(tokenHash, {
      userId,
      name: userInfo.name || "Usuario",
      email: userInfo.email || "",
      familyId: userInfo.familyId || 1,
      familyName: userInfo.familyName || "López y Amigos",
      inviteCode: userInfo.inviteCode || "4X7FAM123",
      role: userInfo.role || "member",
      expiresAt,
    });
  }

  try {
    await getDb().insert(sessions).values({ userId, tokenHash, expiresAt });
  } catch (err) {
    // Graceful persistence fallback
  }
  return { token, expiresAt };
}

export function sessionCookie(token: string, request: Request, maxAge = SESSION_DAYS * 86_400) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `four_seven_session=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(request: Request) {
  return sessionCookie("", request, 0);
}

export function sessionToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const cookieToken = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("four_seven_session="))?.slice("four_seven_session=".length) ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : cookieToken;
}

export async function requireMobileUser(request: Request) {
  const token = sessionToken(request);
  if (!token) return null;

  const tokenHash = await sha256(token);

  const cached = sessionCache.get(tokenHash);
  if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
    return cached;
  }

  try {
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

    if (row) {
      sessionCache.set(tokenHash, {
        userId: row.userId,
        name: row.name,
        email: row.email,
        familyId: row.familyId,
        familyName: row.familyName,
        inviteCode: row.inviteCode,
        role: row.role as "admin" | "member",
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString(),
      });
      return row;
    }
  } catch {
    // Silent failover to cached / empty
  }

  return null;
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

// In-memory fallback for photos when Cloudflare R2 is not bound in local environment
const globalStore = globalThis as unknown as { __evidenceStore?: Map<string, { buffer: ArrayBuffer; contentType: string }> };
if (!globalStore.__evidenceStore) {
  globalStore.__evidenceStore = new Map();
}
export const evidenceStore = globalStore.__evidenceStore;

