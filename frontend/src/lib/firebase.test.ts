import { describe, expect, it } from "vitest";
import {
  FirebaseNotConfiguredError,
  GoogleSignInError,
  getGoogleAuthErrorMessage,
  isFirebaseWebConfigComplete,
  readFirebaseWebConfig,
} from "./firebase";

const completeConfig = {
  apiKey: "api-key",
  authDomain: "rsv.firebaseapp.com",
  projectId: "rsv-helemet",
  storageBucket: "rsv-helemet.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc",
};

describe("readFirebaseWebConfig", () => {
  it("membaca dan merapikan nilai environment", () => {
    const config = readFirebaseWebConfig({
      VITE_FIREBASE_API_KEY: "  api-key  ",
      VITE_FIREBASE_AUTH_DOMAIN: " rsv.firebaseapp.com ",
      VITE_FIREBASE_PROJECT_ID: " rsv-helemet ",
      VITE_FIREBASE_STORAGE_BUCKET: " rsv-helemet.appspot.com ",
      VITE_FIREBASE_MESSAGING_SENDER_ID: " 123 ",
      VITE_FIREBASE_APP_ID: " 1:123:web:abc ",
    });

    expect(config).toEqual({
      apiKey: "api-key",
      authDomain: "rsv.firebaseapp.com",
      projectId: "rsv-helemet",
      storageBucket: "rsv-helemet.appspot.com",
      messagingSenderId: "123",
      appId: "1:123:web:abc",
    });
  });

  it("mengubah nilai kosong menjadi string kosong", () => {
    const config = readFirebaseWebConfig({
      VITE_FIREBASE_API_KEY: "   ",
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
      VITE_FIREBASE_PROJECT_ID: false,
    });

    expect(config.apiKey).toBe("");
    expect(config.authDomain).toBe("");
    expect(config.projectId).toBe("");
    expect(config.appId).toBe("");
  });
});

describe("isFirebaseWebConfigComplete", () => {
  it("true hanya jika apiKey, authDomain, projectId, dan appId terisi", () => {
    expect(isFirebaseWebConfigComplete(completeConfig)).toBe(true);
    expect(isFirebaseWebConfigComplete({ ...completeConfig, apiKey: "" })).toBe(false);
    expect(isFirebaseWebConfigComplete({ ...completeConfig, authDomain: "" })).toBe(false);
    expect(isFirebaseWebConfigComplete({ ...completeConfig, projectId: "" })).toBe(false);
    expect(isFirebaseWebConfigComplete({ ...completeConfig, appId: "" })).toBe(false);
  });

  it("storageBucket dan messagingSenderId boleh kosong", () => {
    expect(
      isFirebaseWebConfigComplete({
        ...completeConfig,
        storageBucket: "",
        messagingSenderId: "",
      }),
    ).toBe(true);
  });
});

describe("getGoogleAuthErrorMessage", () => {
  it("menerjemahkan popup yang ditutup user", () => {
    expect(getGoogleAuthErrorMessage({ code: "auth/popup-closed-by-user" })).toBe(
      "Login Google dibatalkan.",
    );
  });

  it("menerjemahkan popup yang diblokir", () => {
    expect(getGoogleAuthErrorMessage({ code: "auth/popup-blocked" })).toContain("diblokir");
  });

  it("menerjemahkan domain yang belum diizinkan", () => {
    expect(getGoogleAuthErrorMessage({ code: "auth/unauthorized-domain" })).toContain(
      "belum diizinkan",
    );
  });

  it("menerjemahkan provider Google yang belum aktif", () => {
    expect(getGoogleAuthErrorMessage({ code: "auth/operation-not-allowed" })).toContain(
      "belum diaktifkan",
    );
  });

  it("menerjemahkan konfigurasi API key yang salah", () => {
    expect(getGoogleAuthErrorMessage({ code: "auth/invalid-api-key" })).toContain(
      "tidak valid",
    );
  });

  it("mengarahkan ke aktivasi Authentication jika project belum dikonfigurasi", () => {
    expect(getGoogleAuthErrorMessage({ code: "auth/configuration-not-found" })).toContain(
      "Authentication belum diaktifkan",
    );
  });

  it("mempertahankan pesan error aplikasi sendiri", () => {
    expect(getGoogleAuthErrorMessage(new FirebaseNotConfiguredError())).toContain(
      "belum dikonfigurasi",
    );
    expect(getGoogleAuthErrorMessage(new GoogleSignInError("Pesan khusus"))).toBe(
      "Pesan khusus",
    );
  });

  it("tidak membocorkan pesan teknis untuk error tak dikenal", () => {
    expect(getGoogleAuthErrorMessage(new Error("INTERNAL_FIREBASE_DETAIL"))).toBe(
      "Gagal masuk dengan Google. Silakan coba kembali.",
    );
  });
});
