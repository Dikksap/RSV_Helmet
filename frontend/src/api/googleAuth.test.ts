import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/firebase", () => ({
  signInWithGoogle: vi.fn(),
  signOutFirebase: vi.fn(),
}));

import { loginWithGoogle } from "./auth";
import { signInWithGoogle, signOutFirebase } from "../lib/firebase";

const mockedSignInWithGoogle = vi.mocked(signInWithGoogle);
const mockedSignOutFirebase = vi.mocked(signOutFirebase);

const loginResponse = {
  message: "Login berhasil",
  token: "jwt-rsv",
  user: {
    id: 7,
    name: "Budi",
    email: "budi@example.com",
    role: "gudang",
    divisiId: 2,
    divisi: { id: 2, nama: "Gudang" },
    avatarUrl: null,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mockedSignInWithGoogle.mockResolvedValue("firebase-id-token");
  mockedSignOutFirebase.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loginWithGoogle", () => {
  it("menukar Firebase ID Token ke /auth/google dan mengembalikan JWT RSV", async () => {
    fetchMock.mockResolvedValue(jsonResponse(loginResponse));

    const result = await loginWithGoogle();

    expect(mockedSignInWithGoogle).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/auth/google");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ idToken: "firebase-id-token" });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    expect(result).toEqual(loginResponse);
    expect(mockedSignOutFirebase).not.toHaveBeenCalled();
  });

  it("menampilkan pesan backend dan logout Firebase jika akun belum terdaftar", async () => {
    const message = "Akun Google belum terdaftar di sistem RSV. Hubungi administrator.";
    fetchMock.mockResolvedValue(jsonResponse({ message }, 403));

    await expect(loginWithGoogle()).rejects.toThrow(message);
    expect(mockedSignOutFirebase).toHaveBeenCalledTimes(1);
  });

  it("menampilkan pesan backend jika akun tidak aktif", async () => {
    const message = "Akun Anda tidak aktif. Hubungi administrator.";
    fetchMock.mockResolvedValue(jsonResponse({ message }, 403));

    await expect(loginWithGoogle()).rejects.toThrow(message);
    expect(mockedSignOutFirebase).toHaveBeenCalled();
  });

  it("menampilkan pesan backend jika token Google ditolak", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "Token Google tidak valid atau kedaluwarsa" }, 401),
    );

    await expect(loginWithGoogle()).rejects.toThrow(
      "Token Google tidak valid atau kedaluwarsa",
    );
    expect(mockedSignOutFirebase).toHaveBeenCalled();
  });

  it("logout Firebase dan memberi pesan jika backend tidak dapat dihubungi", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(loginWithGoogle()).rejects.toThrow("Backend tidak dapat dihubungi");
    expect(mockedSignOutFirebase).toHaveBeenCalled();
  });

  it("logout Firebase jika respons server bukan JSON yang valid", async () => {
    fetchMock.mockResolvedValue(
      new Response("bukan-json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(loginWithGoogle()).rejects.toThrow("Respons server tidak valid");
    expect(mockedSignOutFirebase).toHaveBeenCalled();
  });

  it("meneruskan pembatalan popup tanpa memanggil backend", async () => {
    mockedSignInWithGoogle.mockRejectedValue(new Error("Login Google dibatalkan."));

    await expect(loginWithGoogle()).rejects.toThrow("Login Google dibatalkan.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedSignOutFirebase).not.toHaveBeenCalled();
  });
});
