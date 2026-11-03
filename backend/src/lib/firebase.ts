import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Kegagalan konfigurasi/credential Firebase. Pesan kelas ini hanya untuk log
 * server; controller membalas pesan generik agar detail credential tidak bocor.
 */
export class FirebaseConfigError extends Error {
  constructor(message = "Konfigurasi Firebase Admin tidak valid") {
    super(message);
    this.name = "FirebaseConfigError";
  }
}

/** Firebase ID Token tidak valid, kedaluwarsa, atau sudah dicabut. */
export class FirebaseTokenError extends Error {
  constructor(message = "Firebase ID Token tidak valid") {
    super(message);
    this.name = "FirebaseTokenError";
  }
}

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
}

interface FirebaseAdminConfig {
  projectId: string;
  serviceAccount: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
}

const FIREBASE_APP_NAME = "rsv-firebase-admin";
const TOKEN_ERROR_CODES = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/user-disabled",
  "auth/user-not-found",
]);
const CONFIG_ERROR_CODES = new Set([
  "app/invalid-credential",
  "app/network-error",
  "auth/internal-error",
  "auth/network-request-failed",
  "auth/project-not-found",
]);

let cachedConfig: FirebaseAdminConfig | null = null;
let cachedAuth: Auth | null = null;

function readServiceAccountJson(): Record<string, unknown> {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  if (!inline && !path) {
    throw new FirebaseConfigError(
      "FIREBASE_SERVICE_ACCOUNT_PATH atau FIREBASE_SERVICE_ACCOUNT_JSON belum diatur",
    );
  }

  let raw: string;
  if (inline) {
    raw = inline;
  } else {
    const absolutePath = resolve(path!);
    try {
      raw = readFileSync(absolutePath, "utf8");
    } catch {
      throw new FirebaseConfigError(`File service account Firebase tidak dapat dibaca: ${absolutePath}`);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FirebaseConfigError("Service account Firebase bukan JSON yang valid");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FirebaseConfigError("Service account Firebase harus berupa objek JSON");
  }

  return parsed as Record<string, unknown>;
}

function loadFirebaseAdminConfig(): FirebaseAdminConfig {
  if (cachedConfig) return cachedConfig;

  const raw = readServiceAccountJson();
  const projectIdFromAccount = typeof raw.project_id === "string" ? raw.project_id.trim() : "";
  const clientEmail = typeof raw.client_email === "string" ? raw.client_email.trim() : "";
  const privateKey = typeof raw.private_key === "string" ? raw.private_key : "";

  if (!projectIdFromAccount || !clientEmail || !privateKey) {
    throw new FirebaseConfigError(
      "Service account Firebase harus memiliki project_id, client_email, dan private_key",
    );
  }

  const projectIdFromEnv = process.env.FIREBASE_PROJECT_ID?.trim() ?? "";
  if (projectIdFromEnv && projectIdFromEnv !== projectIdFromAccount) {
    throw new FirebaseConfigError("FIREBASE_PROJECT_ID tidak cocok dengan project_id service account");
  }

  cachedConfig = {
    projectId: projectIdFromEnv || projectIdFromAccount,
    serviceAccount: {
      projectId: projectIdFromAccount,
      clientEmail,
      privateKey,
    },
  };
  return cachedConfig;
}

function loadFirebaseApp(): App {
  const config = loadFirebaseAdminConfig();
  const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existing) return existing;

  return initializeApp(
    {
      credential: cert(config.serviceAccount),
      projectId: config.projectId,
    },
    FIREBASE_APP_NAME,
  );
}

function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(loadFirebaseApp());
  return cachedAuth;
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

/**
 * Verifikasi dilakukan sepenuhnya di server dengan Firebase Admin SDK.
 * `checkRevoked` memastikan token yang sudah dicabut tidak bisa dipakai ulang.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const auth = getFirebaseAuth();
  const projectId = loadFirebaseAdminConfig().projectId;

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch (error) {
    const code = errorCode(error);
    if (code && CONFIG_ERROR_CODES.has(code)) {
      throw new FirebaseConfigError(`Firebase Admin gagal memverifikasi token (${code})`);
    }
    if (code && TOKEN_ERROR_CODES.has(code)) {
      throw new FirebaseTokenError(`Firebase ID Token ditolak (${code})`);
    }
    throw new FirebaseTokenError("Firebase ID Token tidak valid atau kedaluwarsa");
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (decoded.aud !== projectId || decoded.iss !== expectedIssuer) {
    throw new FirebaseTokenError("Firebase ID Token berasal dari project lain");
  }

  if (!decoded.uid) {
    throw new FirebaseTokenError("Firebase ID Token tidak memiliki UID");
  }

  return {
    uid: decoded.uid,
    email: typeof decoded.email === "string" ? decoded.email : null,
    emailVerified: decoded.email_verified === true,
    signInProvider: decoded.firebase?.sign_in_provider ?? null,
  };
}
