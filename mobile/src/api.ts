import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://familia-cuatro-por-siete.p-glez-lpz92.chatgpt.site';
const SESSION_KEY = '4x7:session';

export type Session = {
  token: string;
  expiresAt: string;
  user: { id: number; name: string; email: string };
  family: { id: number; name: string; inviteCode: string; role: 'admin' | 'member' };
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  familyName?: string;
  inviteCode?: string;
};

type WorkoutPayload = {
  activityType: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  steps: number;
  calories: number;
  evidenceKey?: string | null;
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

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'No pudimos conectar con 4x7.');
  return data;
}

async function storeSession(session: Session | null) {
  if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else await AsyncStorage.removeItem(SESSION_KEY);
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then(async (saved) => {
        if (!saved) return;
        const cached = JSON.parse(saved) as Session;
        try {
          const fresh = await request<Omit<Session, 'token' | 'expiresAt'>>('/api/mobile/me', {}, cached.token);
          setSession({ ...cached, ...fresh });
        } catch {
          await storeSession(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = await request<Session>('/api/mobile/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await storeSession(next);
    setSession(next);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const next = await request<Session>('/api/mobile/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    await storeSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    await storeSession(null);
    setSession(null);
  }, []);

  return { session, loading, login, register, logout };
}

export async function uploadEvidence(token: string, uri: string) {
  const form = new FormData();
  form.append('photo', { uri, name: `evidencia-${Date.now()}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  return request<{ evidenceKey: string; evidenceUrl: string }>('/api/mobile/evidence', { method: 'POST', body: form }, token);
}

export function saveWorkout(token: string, workout: WorkoutPayload) {
  return request<{ workout: { id: number } }>('/api/mobile/workouts', { method: 'POST', body: JSON.stringify(workout) }, token);
}

export function getFeed(token: string) {
  return request<{ posts: FeedPost[] }>('/api/mobile/feed', {}, token);
}

export function togglePostLike(token: string, postId: number) {
  return request<{ liked: boolean }>(`/api/mobile/feed/${postId}/like`, { method: 'POST' }, token);
}

export function addPostComment(token: string, postId: number, body: string) {
  return request<{ comment: { id: number; userName: string; body: string } }>(`/api/mobile/feed/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }, token);
}
