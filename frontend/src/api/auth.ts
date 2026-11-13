import { getApiErrorMessage, getHttpErrorMessage, reportApiConnection } from "./errors";
import { signInWithGoogle, signOutFirebase } from "../lib/firebase";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(`${apiUrl}${path}`, init);
    reportApiConnection(null);
    return response;
  } catch (error) {
    const message = getApiErrorMessage(error, "Gagal menghubungi server API");
    reportApiConnection(message);
    throw new Error(message, { cause: error });
  }
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  divisiId?: number | null;
  divisi?: { id: number; nama: string } | null;
  avatarUrl?: string | null;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await authFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getHttpErrorMessage(response.status, payload?.message, "Email atau password salah"));
  }

  try {
    return (await response.json()) as LoginResponse;
  } catch {
    throw new Error("Respons server tidak valid. Silakan coba kembali.");
  }
}

/**
 * Login Google: Firebase membuktikan identitas, lalu backend menukar Firebase
 * ID Token dengan JWT RSV. Token RSV disimpan lewat `setAuth` oleh pemanggil,
 * sama seperti login email/password.
 */
export async function loginWithGoogle(): Promise<LoginResponse> {
  const idToken = await signInWithGoogle();

  let response: Response;
  try {
    response = await authFetch("/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch (error) {
    await signOutFirebase();
    throw error;
  }

  if (!response.ok) {
    await signOutFirebase();
    const payload = await response.json().catch(() => null);
    throw new Error(
      getHttpErrorMessage(response.status, payload?.message, "Gagal masuk dengan Google"),
    );
  }

  try {
    return (await response.json()) as LoginResponse;
  } catch {
    await signOutFirebase();
    throw new Error("Respons server tidak valid. Silakan coba kembali.");
  }
}

export async function logout(token: string): Promise<void> {
  const response = await authFetch("/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getHttpErrorMessage(response.status, payload?.message, "Gagal mengakhiri sesi"));
  }
}

const PERM_KEY = "rsv_auth_permissions";
const AVATAR_CACHE_PREFIX = "rsv_auth_avatar_";

export interface ProfileUpdate {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

/** Ubah profil sendiri. User hasil server disimpan ke localStorage agar header ikut berubah. */
export async function updateProfile(body: ProfileUpdate): Promise<User> {
  const token = getToken();
  const response = await authFetch("/auth/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getHttpErrorMessage(response.status, payload?.message, "Gagal memperbarui profil"));
  }

  const { user } = (await response.json()) as { message: string; user: User };
  if (token) setAuth(token, user);
  return user;
}

async function profileAvatarRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const response = await authFetch(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Sesi telah berakhir. Silakan login ulang.");
  }
  return response;
}

export async function getProfileAvatar(): Promise<Blob | null> {
  const user = getUser();
  const cacheKey = user ? `${AVATAR_CACHE_PREFIX}${user.id}` : null;
  if (cacheKey) {
    const cachedAvatar = localStorage.getItem(cacheKey);
    if (cachedAvatar) {
      try {
        const cachedResponse = await fetch(cachedAvatar);
        if (!cachedResponse.ok) throw new Error("Cache avatar lokal tidak valid.");
        return await cachedResponse.blob();
      } catch (error) {
        localStorage.removeItem(cacheKey);
        console.error("Gagal membaca cache avatar lokal:", error);
      }
    }
  }

  const response = await profileAvatarRequest("/auth/me/avatar");
  if (response.status === 404) {
    if (cacheKey) localStorage.removeItem(cacheKey);
    return null;
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getHttpErrorMessage(response.status, payload?.message, "Gagal mengambil avatar"));
  }
  const blob = await response.blob();
  if (cacheKey) {
    try {
      const dataUrl = await blobToDataUrl(blob);
      localStorage.setItem(cacheKey, dataUrl);
    } catch (error) {
      console.error("Gagal menyimpan cache avatar lokal:", error);
    }
  }
  return blob;
}

export async function uploadProfileAvatar(file: File): Promise<void> {
  const form = new FormData();
  form.append("image", file);
  const response = await profileAvatarRequest("/auth/me/avatar", { method: "POST", body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getHttpErrorMessage(response.status, payload?.message, "Gagal mengunggah avatar"));
  }
  updateStoredAvatarUrl("/api/auth/me/avatar");
}

export async function deleteProfileAvatar(): Promise<void> {
  const response = await profileAvatarRequest("/auth/me/avatar", { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getHttpErrorMessage(response.status, payload?.message, "Gagal menghapus avatar"));
  }
  updateStoredAvatarUrl(null);
}

function updateStoredAvatarUrl(avatarUrl: string | null): void {
  const user = getUser();
  if (user) {
    localStorage.removeItem(`${AVATAR_CACHE_PREFIX}${user.id}`);
    localStorage.setItem(USER_KEY, JSON.stringify({ ...user, avatarUrl }));
  }
  window.dispatchEvent(new Event("rsv:auth-updated"));
  window.dispatchEvent(new Event("rsv:avatar-updated"));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Hasil cache avatar bukan data URL."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca gambar avatar."));
    reader.readAsDataURL(blob);
  });
}

export async function checkSession(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const response = await authFetch("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) return null;
    if (!response.ok) return getUser()?.role ?? null;
    const { user, permissions } = (await response.json()) as { user: User; permissions?: string[] };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERM_KEY, JSON.stringify(permissions ?? []));
    window.dispatchEvent(new Event("rsv:auth-updated"));
    return user.role;
  } catch {
    return getUser()?.role ?? null;
  }
}

/** Permission user yang login (dari /auth/me terakhir). Admin mendapat seluruh permission dari backend. */
export function getUserPermissions(): string[] {
  try {
    const raw = localStorage.getItem(PERM_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasPermission(kode: string): boolean {
  return getUserPermissions().includes(kode);
}


const TOKEN_KEY = "rsv_auth_token";
const USER_KEY = "rsv_auth_user";

export function setAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("rsv:auth-updated"));
}

export function clearAuth() {
  const user = getUser();
  if (user) localStorage.removeItem(`${AVATAR_CACHE_PREFIX}${user.id}`);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERM_KEY);
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

export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

export function redirectToLogin(): void {
  clearAuth();
  void signOutFirebase();
  if (window.location.pathname.startsWith("/login")) return;
  const hash = window.location.protocol === "file:" ? "#" : "";
  window.location.assign(`${hash}/login?session=expired`);
}

export function homeForRole(role: string | undefined): string {
  if (role === "admin") return "/admin/home";
  if (role === "gudang") return "/gudang/home";
  if (role === "produksi") return "/produksi/home";
  if (role === "supervisor") return "/";
  if (role === "qc") return "/";
  if (role === "user") return "/scan-qr";
  return "/";
}