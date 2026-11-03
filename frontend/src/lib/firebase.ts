import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

type EnvRecord = Record<string, string | boolean | undefined>;

const FIREBASE_APP_NAME = "rsv-web";

/** Nilai kosong dianggap belum dikonfigurasi, bukan string kosong yang valid. */
export function readFirebaseWebConfig(env: EnvRecord): FirebaseWebConfig {
  const read = (key: string): string => {
    const value = env[key];
    return typeof value === "string" ? value.trim() : "";
  };

  return {
    apiKey: read("VITE_FIREBASE_API_KEY"),
    authDomain: read("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: read("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: read("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: read("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: read("VITE_FIREBASE_APP_ID"),
  };
}

export function isFirebaseWebConfigComplete(config: FirebaseWebConfig): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super("Login Google belum dikonfigurasi pada aplikasi ini.");
    this.name = "FirebaseNotConfiguredError";
  }
}

export class GoogleSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleSignInError";
  }
}

export const firebaseWebConfig = readFirebaseWebConfig(import.meta.env);
export const isFirebaseConfigured = isFirebaseWebConfigComplete(firebaseWebConfig);

let cachedAuth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) throw new FirebaseNotConfiguredError();
  if (cachedAuth) return cachedAuth;

  const options: FirebaseOptions = {
    apiKey: firebaseWebConfig.apiKey,
    authDomain: firebaseWebConfig.authDomain,
    projectId: firebaseWebConfig.projectId,
    ...(firebaseWebConfig.storageBucket ? { storageBucket: firebaseWebConfig.storageBucket } : {}),
    ...(firebaseWebConfig.messagingSenderId ? { messagingSenderId: firebaseWebConfig.messagingSenderId } : {}),
    appId: firebaseWebConfig.appId,
  };

  const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  const app = existing ?? initializeApp(options, FIREBASE_APP_NAME);
  cachedAuth = getAuth(app);
  return cachedAuth;
}

function firebaseErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

/** Terjemahan error Firebase Auth agar tidak menampilkan kode teknis ke operator. */
export function getGoogleAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseNotConfiguredError) return error.message;
  if (error instanceof GoogleSignInError) return error.message;

  switch (firebaseErrorCode(error)) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "Login Google dibatalkan.";
    case "auth/popup-blocked":
      return "Popup login Google diblokir browser. Izinkan popup lalu coba lagi.";
    case "auth/unauthorized-domain":
      return "Domain aplikasi ini belum diizinkan di Firebase Authentication.";
    case "auth/operation-not-allowed":
      return "Provider Google belum diaktifkan di Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "Email ini sudah terdaftar dengan metode login lain.";
    case "auth/network-request-failed":
      return "Tidak dapat menghubungi Google. Periksa koneksi jaringan lalu coba lagi.";
    case "auth/invalid-api-key":
      return "API key Firebase tidak valid atau dibatasi untuk domain ini.";
    case "auth/configuration-not-found":
      return "Firebase Authentication belum diaktifkan untuk project ini. Buka Firebase Console → Authentication → Get started, lalu aktifkan provider Google.";
    default:
      return "Gagal masuk dengan Google. Silakan coba kembali.";
  }
}

/**
 * Membuka popup Google, lalu mengambil Firebase ID Token. Token ini hanya
 * bukti identitas sementara; backend menukarnya dengan JWT RSV.
 */
export async function signInWithGoogle(): Promise<string> {
  const auth = getFirebaseAuth();

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const result = await signInWithPopup(auth, provider);

    if (!result.user.email) {
      await signOut(auth).catch(() => undefined);
      throw new GoogleSignInError(
        "Akun Google tidak memiliki alamat email yang dapat digunakan.",
      );
    }

    return await result.user.getIdToken();
  } catch (error) {
    if (auth.currentUser) {
      await signOut(auth).catch(() => undefined);
    }
    if (error instanceof GoogleSignInError) throw error;
    throw new GoogleSignInError(getGoogleAuthErrorMessage(error));
  }
}

/** Logout Firebase bersifat best-effort dan tidak boleh menggagalkan logout RSV. */
export async function signOutFirebase(): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    // Inisialisasi bila perlu agar sesi Firebase yang tersimpan setelah reload
    // tetap dibersihkan, bukan hanya sesi yang aktif di memori.
    await signOut(getFirebaseAuth());
  } catch (error) {
    console.error("Gagal logout dari Firebase:", error);
  }
}
