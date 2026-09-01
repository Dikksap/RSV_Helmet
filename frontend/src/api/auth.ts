const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Email atau password salah");
  }

  return response.json() as Promise<LoginResponse>;
}

export async function logout(token: string): Promise<void> {
  await fetch(`${apiUrl}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

const TOKEN_KEY = "rsv_auth_token";
const USER_KEY = "rsv_auth_user";

export function setAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === "admin";
}