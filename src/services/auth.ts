import { reactive } from 'vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5118';

const TOKEN_KEY = 'auth.token';
const EXPIRES_KEY = 'auth.expiresAt';
const USER_KEY = 'auth.user';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
}

interface AuthResponse {
  token: string;
  expiresAt: string;
  userId: string;
  email: string;
  displayName: string;
}

interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]> | null;
}

export const authState = reactive<{
  user: AuthUser | null;
  token: string | null;
}>({
  user: loadUser(),
  token: localStorage.getItem(TOKEN_KEY),
});

function loadUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function persist(res: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, res.token);
  localStorage.setItem(EXPIRES_KEY, res.expiresAt);
  const user: AuthUser = {
    userId: res.userId,
    email: res.email,
    displayName: res.displayName,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  authState.token = res.token;
  authState.user = user;
}

export function isAuthenticated(): boolean {
  if (!authState.token) return false;
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(USER_KEY);
  authState.token = null;
  authState.user = null;
}

export class AuthError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

async function parseError(response: Response): Promise<string> {
  let body: ErrorResponse | null = null;
  try {
    body = await response.json();
  } catch {
    // ignore
  }
  if (body?.errors) {
    const messages = Object.values(body.errors).flat();
    if (messages.length) return messages.join(' ');
  }
  return body?.message ?? `Request failed (${response.status}).`;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new AuthError(await parseError(response), response.status);
  const data = (await response.json()) as AuthResponse;
  persist(data);
  return authState.user!;
}

export async function register(displayName: string, email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, email, password }),
  });
  if (!response.ok) throw new AuthError(await parseError(response), response.status);
  const data = (await response.json()) as AuthResponse;
  persist(data);
  return authState.user!;
}

export async function fetchMe(): Promise<AuthUser> {
  if (!authState.token) throw new AuthError('Not signed in.', 401);
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${authState.token}` },
  });
  if (response.status === 401) {
    logout();
    throw new AuthError('Session expired.', 401);
  }
  if (!response.ok) throw new AuthError(await parseError(response), response.status);
  return (await response.json()) as AuthUser;
}
