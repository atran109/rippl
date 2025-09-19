import { z } from 'zod';
import * as SecureStore from 'expo-secure-store';

// Base API configuration
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'rippl_jwt_token';

// Zod schemas for API responses
export const WaveSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  impactUnit: z.string(),
  impactSource: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string().optional(),
  dream: z.string().nullable(),
  createdAt: z.string(),
});

export const MicroActionSchema = z.object({
  id: z.string(),
  text: z.string(),
  bucket: z.string(),
});

export const RippleSchema = z.object({
  id: z.string(),
  title: z.string(),
  wave: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional(),
  }),
});

//Change later when things like impact and trending are done
export const HomeResponseSchema = z.object({
  wave: WaveSchema.nullable().optional(),
  primary_ripple: RippleSchema.nullable().optional(),
  today_action: MicroActionSchema.nullable().optional(),
  impact_chip: z.any().nullable().optional(), // TODO: refine when implemented
  message: z.string().optional(),
  has_wave: z.boolean().optional(), // Whether user has joined a wave
});

export const AuthResponseSchema = z.object({
  token: z.string(),
});

export const RegisterResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  token: z.string(),
});

export const JoinWaveResponseSchema = z.object({
  ok: z.boolean(),
  primary_ripple_id: z.string(),
});

export const TrendingRippleSchema = z.object({
  rank: z.number(),
  ripple: z.object({
    id: z.string(),
    title: z.string(),
  }),
  wave: z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string().optional(),
  }),
  participants: z.number(),
  growth_today: z.number(),
  actions_24h: z.number(),
  score: z.number(),
  impact_chip: z.object({
    value: z.number(),
    unit: z.string(),
    source: z.string(),
  }).nullable().optional(),
});

// New schemas for profile features
export const PastMicroActionSchema = z.object({
  id: z.string(),
  action_text: z.string(),
  wave_name: z.string(),
  wave_color: z.string(),
  ripple_title: z.string(),
  note: z.string().optional().nullable(),
  completed_at: z.string(),
});

export const ProfileStatsSchema = z.object({
  ripples_joined: z.number(),
  actions_taken: z.number(),
  impact_index: z.number(),
});

export const CommunalStatsSchema = z.object({
  actions_taken: z.number(),
  impact_index: z.number(),
});

// Types inferred from schemas
export type Wave = z.infer<typeof WaveSchema>;
export type User = z.infer<typeof UserSchema>;
export type MicroAction = z.infer<typeof MicroActionSchema>;
export type Ripple = z.infer<typeof RippleSchema>;
export type HomeResponse = z.infer<typeof HomeResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type JoinWaveResponse = z.infer<typeof JoinWaveResponseSchema>;
export type TrendingRipple = z.infer<typeof TrendingRippleSchema>;
export type PastMicroActionType = z.infer<typeof PastMicroActionSchema>;
export type ProfileStats = z.infer<typeof ProfileStatsSchema>;
export type CommunalStats = z.infer<typeof CommunalStatsSchema>;

// Auth token management
export const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store token:', error);
    throw error;
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to remove token:', error);
  }
};

// Generic fetch function with type safety
export const fetchJson = async <T>(
  path: string,
  options: RequestInit = {},
  schema?: z.ZodSchema<T>
): Promise<T> => {
  const token = await getToken();
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_URL}${path}`, config);

  if (response.status === 401) {
    // Token expired or invalid, remove it
    await removeToken();
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Ignore JSON parse errors for error responses
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Validate response with Zod schema if provided
  if (schema) {
    try {
      return schema.parse(data);
    } catch (error) {
      console.error('Schema validation failed:', error);
      throw new Error('Invalid response format from server');
    }
  }

  return data;
};

// Specific API calls
export const api = {
  // Auth
  register: (email: string, username: string, password: string) =>
    fetchJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    }, RegisterResponseSchema),

  login: (email: string, password: string) =>
    fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, AuthResponseSchema),

  // Onboarding
  getWaves: () =>
    fetchJson('/waves', {}, z.array(WaveSchema)),

  joinWave: (waveId: string) =>
    fetchJson('/join-wave', {
      method: 'POST',
      body: JSON.stringify({ waveId }),
    }, JoinWaveResponseSchema),

  // Home
  getHome: () =>
    fetchJson('/me/home', {}, HomeResponseSchema),

  // Profile
  getProfile: () =>
    fetchJson('/me/profile', {}, UserSchema),

  updateDream: (dream: string) =>
    fetchJson('/me/dream', {
      method: 'PUT',
      body: JSON.stringify({ dream }),
    }, UserSchema),

  updateUsername: (username: string) =>
    fetchJson('/me/username', {
      method: 'PUT',
      body: JSON.stringify({ username }),
    }, UserSchema),

  // Profile stats and history
  getPastActions: () =>
    fetchJson('/me/actions/history', {}, z.array(PastMicroActionSchema)),

  getProfileStats: () =>
    fetchJson('/me/stats', {}, ProfileStatsSchema),

  getCommunalStats: () =>
    fetchJson('/community/stats', {}, CommunalStatsSchema),

  // Actions
  generateAction: () =>
    fetchJson('/actions/generate', {
      method: 'POST',
    }, z.object({ today_action: MicroActionSchema })),

  completeAction: (microActionId: string, city?: string, noteText?: string, shareAnonymously?: boolean) =>
    fetchJson('/actions/complete', {
      method: 'POST',
      body: JSON.stringify({
        microActionId,
        ...(city && { city }),
        ...(noteText && { note_text: noteText }),
        ...(shareAnonymously !== undefined && { share_anonymously: shareAnonymously }),
      }),
    }, z.object({ ok: z.boolean() })),

  // Trending
  getTrendingRipples: (scope: 'my_waves' | 'all' = 'my_waves', limit: number = 10) =>
    //problem might be here
    fetchJson(`/community/trending?scope=${scope}&limit=${limit}`, {}, z.array(TrendingRippleSchema)),
};
