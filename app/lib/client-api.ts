export type Session = {
  user: { id: number; name: string; email: string };
  family: { id: number; name: string; inviteCode: string; role: "admin" | "member" };
};

export type FeedPost = {
  id: number;
  userId: number;
  userName: string;
  caption: string;
  evidenceUrl: string | null;
  createdAt: string;
  activityType: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  steps: number | null;
  calories: number | null;
  likes: number;
  comments: number;
  likedByMe: boolean;
};

export type BodyMeasurement = {
  id?: number;
  weightKg: number;
  waistCm?: number | null;
  chestCm?: number | null;
  hipCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  calfCm?: number | null;
  neckCm?: number | null;
  bodyFatPercent?: number | null;
  recordedAt?: string;
};

export type ObjectiveAdvice = {
  title: string;
  goalSummary: string;
  doList: string[];
  dontList: string[];
};

export type Projection = {
  bmi: number;
  bmiCategory: string;
  weeklyPaceKg: number;
  estimatedWeeks: number;
  etaSummary: string;
  weeks: Array<{ week: number; weightKg: number; phase: string; focus: string; workoutGoal: number }>;
  advice: ObjectiveAdvice;
};

export type FitnessProfile = {
  objective: "lose_fat" | "gain_muscle" | "maintain" | "general_fitness";
  birthDate: string;
  sex: "female" | "male" | "other" | "prefer_not";
  heightCm: number;
  targetWeightKg: number | null;
  challengeStartDate?: string;
  measurement: BodyMeasurement;
};

export type ProfileResponse = {
  profile: FitnessProfile | null;
  measurements: BodyMeasurement[];
  projection: Projection | null;
};

type ApiError = { error?: string };

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  // Always send token if available in localStorage
  if (typeof window !== "undefined") {
    try {
      const token = localStorage.getItem("four_seven_auth_token");
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch {}
  }

  const response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(payload.error || "No pudimos completar la operación.");
  return payload;
}

export const clientApi = {
  me: () => request<Session>("/api/mobile/me"),
  login: async (email: string, password: string) => {
    const res = await request<Session>("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res?.token && typeof window !== "undefined") {
      try {
        localStorage.setItem("four_seven_auth_token", res.token);
        localStorage.setItem("four_seven_active_session", JSON.stringify(res));
      } catch {}
    }
    return res;
  },
  register: async (data: { name: string; email: string; password: string; familyName?: string; inviteCode?: string; challengeStartDate?: string }) => {
    const res = await request<Session>("/api/mobile/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res?.token && typeof window !== "undefined") {
      try {
        localStorage.setItem("four_seven_auth_token", res.token);
        localStorage.setItem("four_seven_active_session", JSON.stringify(res));
      } catch {}
    }
    return res;
  },
  logout: async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("four_seven_auth_token");
        localStorage.removeItem("four_seven_active_session");
      } catch {}
    }
    return request<{ ok: boolean }>("/api/mobile/auth/logout", { method: "POST" });
  },
  profile: () => request<ProfileResponse>("/api/mobile/profile"),
  saveProfile: (data: Record<string, string | number | null>) => request<ProfileResponse>("/api/mobile/profile", { method: "POST", body: JSON.stringify(data) }),
  addMeasurement: (data: { weightKg: number; waistCm?: number | null }) => request<ProfileResponse>("/api/mobile/profile", {
    method: "POST",
    body: JSON.stringify({ action: "add_measurement", ...data }),
  }),
  feed: (clientSyncData?: Record<string, any>) =>
    request<{ posts: FeedPost[]; familyProfiles?: Record<string, any>; familyStats?: Record<string, any> }>("/api/mobile/feed", {
      headers: clientSyncData ? { "x-client-sync": JSON.stringify(clientSyncData) } : undefined,
    }),
  comments: (postId: number) => request<{ comments: Array<{ id: number; postId: number; userId: number; userName: string; body: string; createdAt: string }> }>(`/api/mobile/feed/${postId}/comments`),
  toggleLike: (postId: number) => request<{ liked: boolean }>(`/api/mobile/feed/${postId}/like`, { method: "POST" }),
  comment: (postId: number, body: string) => request<{ comment: { id: number; postId: number; userId: number; userName: string; body: string; createdAt: string } }>(`/api/mobile/feed/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  }),
  uploadEvidence: async (photo: File) => {
    const form = new FormData();
    form.append("photo", photo);
    return request<{ evidenceKey: string; evidenceUrl: string }>("/api/mobile/evidence", { method: "POST", body: form });
  },
  workout: (data: {
    activityType: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    distanceMeters: number;
    steps: number;
    calories: number;
    evidenceKey: string | null;
    caption?: string | null;
  }) => request<{ workout: { id: number } }>("/api/mobile/workouts", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  getPrize: () => request<{ prize: { title: string; description: string; imageUrl: string; month: string; minWeeklyCheckIns: number } }>("/api/mobile/admin?action=prize"),
  adminListUsers: (pin: string) => request<{
    users: Array<{
      id: number;
      name: string;
      nickname?: string;
      email: string;
      createdAt: string;
      objective?: string;
      challengeStartDate?: string;
      heightCm?: number | null;
      weightKg?: number | null;
      targetWeightKg?: number | null;
      workoutCount: number;
      eligibleForPrize: boolean;
    }>;
    prize: { title: string; description: string; imageUrl: string; month: string };
  }>("/api/mobile/admin", {
    method: "POST",
    body: JSON.stringify({ pin, action: "list_users" }),
  }),
  adminResetPassword: (pin: string, targetUserId: number, newPassword: string) => request<{ ok: boolean; message: string }>("/api/mobile/admin", {
    method: "POST",
    body: JSON.stringify({ pin, action: "reset_password", targetUserId, newPassword }),
  }),
  adminDeleteUser: (pin: string, targetUserId: number) => request<{ ok: boolean; message: string }>("/api/mobile/admin", {
    method: "POST",
    body: JSON.stringify({ pin, action: "delete_user", targetUserId }),
  }),
  adminUpdateUserData: (pin: string, targetUserId: number, data: {
    name?: string;
    nickname?: string;
    email?: string;
    objective?: string;
    challengeStartDate?: string;
    heightCm?: number | null;
    targetWeightKg?: number | null;
    weightKg?: number | null;
  }) => request<{ ok: boolean; message: string }>("/api/mobile/admin", {
    method: "POST",
    body: JSON.stringify({ pin, action: "update_user_data", targetUserId, ...data }),
  }),
  adminSavePrize: (pin: string, data: { title: string; description: string; imageUrl: string; month?: string }) => request<{
    ok: boolean;
    prize: { title: string; description: string; imageUrl: string; month: string };
    message: string;
  }>("/api/mobile/admin", {
    method: "POST",
    body: JSON.stringify({ pin, action: "save_prize", ...data }),
  }),
};

