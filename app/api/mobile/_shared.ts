import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { families, familyMembers, sessions, users } from "../../../db/schema";
import { getSupabase } from "../../../db/supabase";

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

// All social caches start 100% clean for authentic live user registrations
sharedPostsCache.clear();
sharedCommentsCache.clear();
sharedMemberStatsCache.clear();
familyProfilesCache.clear();

export async function createSession(userId: number, userInfo?: Partial<CachedUserSession>) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const sessionData: CachedUserSession = {
    userId,
    name: userInfo?.name || "Usuario",
    email: userInfo?.email || "",
    familyId: userInfo?.familyId || 1,
    familyName: userInfo?.familyName || "López y Amigos",
    inviteCode: userInfo?.inviteCode || "4X7FAM123",
    role: userInfo?.role || "member",
    expiresAt,
  };

  const payloadB64 = Buffer.from(JSON.stringify(sessionData)).toString("base64url");
  const randPart = randomToken(16);
  const token = `${payloadB64}.${randPart}`;
  const tokenHash = await sha256(token);

  sessionCache.set(tokenHash, sessionData);

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

  // 1. Try decoding self-contained token payload (for distributed Vercel lambdas)
  try {
    if (token.includes(".")) {
      const [payloadB64] = token.split(".");
      const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
      const decoded = JSON.parse(jsonStr) as CachedUserSession;
      if (decoded && decoded.userId && new Date(decoded.expiresAt).getTime() > Date.now()) {
        sessionCache.set(tokenHash, decoded);
        return decoded;
      }
    }
  } catch {}

  // 2. Fallback to DB query
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
    // Silent failover
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

export interface MonthlyPrize {
  title: string;
  description: string;
  imageUrl: string;
  month: string;
  minWeeklyCheckIns: number;
  updatedAt?: string;
}

export const defaultMonthlyPrize: MonthlyPrize = {
  title: "Smartwatch Deportivo o Audífonos Pro 🎧",
  description: "Cumple mínimo tus 4 check-ins por semana en Septiembre y participa en la rifa familiar del mes.",
  imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
  month: "Septiembre 2026",
  minWeeklyCheckIns: 4,
};

let cachedMonthlyPrize: MonthlyPrize | null = null;
let lastPrizeFetchTime = 0;
const PRIZE_CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

export async function getPersistedMonthlyPrize(forceRefresh = false): Promise<MonthlyPrize> {
  const now = Date.now();
  if (!forceRefresh && cachedMonthlyPrize && now - lastPrizeFetchTime < PRIZE_CACHE_TTL_MS) {
    return cachedMonthlyPrize;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from("evidence").download("config/monthly_prize.json");
    if (data && !error) {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && parsed.title) {
        cachedMonthlyPrize = {
          title: String(parsed.title || defaultMonthlyPrize.title),
          description: String(parsed.description || defaultMonthlyPrize.description),
          imageUrl: String(parsed.imageUrl || defaultMonthlyPrize.imageUrl),
          month: String(parsed.month || defaultMonthlyPrize.month),
          minWeeklyCheckIns: Number(parsed.minWeeklyCheckIns) || 4,
          updatedAt: parsed.updatedAt || undefined,
        };
        lastPrizeFetchTime = now;
        return cachedMonthlyPrize;
      }
    }
  } catch (e) {
    console.warn("Error reading monthly prize from storage:", e);
  }

  return cachedMonthlyPrize || defaultMonthlyPrize;
}

export async function savePersistedMonthlyPrize(prizeData: Partial<MonthlyPrize>): Promise<MonthlyPrize> {
  const current = await getPersistedMonthlyPrize();
  const updated: MonthlyPrize = {
    title: prizeData.title ? String(prizeData.title).trim() : current.title,
    description: prizeData.description ? String(prizeData.description).trim() : current.description,
    imageUrl: prizeData.imageUrl ? String(prizeData.imageUrl).trim() : current.imageUrl,
    month: prizeData.month ? String(prizeData.month).trim() : current.month,
    minWeeklyCheckIns: 4,
    updatedAt: new Date().toISOString(),
  };

  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from("evidence").upload(
      "config/monthly_prize.json",
      Buffer.from(JSON.stringify(updated, null, 2)),
      { upsert: true, contentType: "application/json" }
    );

    if (error) {
      console.error("Error saving monthly prize to Supabase storage:", error);
      throw new Error(`No se pudo guardar el premio en Supabase: ${error.message}`);
    }
  } catch (err) {
    console.error("Supabase storage upload failed:", err);
    throw err;
  }

  cachedMonthlyPrize = updated;
  lastPrizeFetchTime = Date.now();
  return updated;
}

