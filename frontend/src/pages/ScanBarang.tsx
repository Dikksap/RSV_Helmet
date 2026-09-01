import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import jsQR from "jsqr";
import { bulkScanBarang, getScanBarang, type Barang } from "../api/barang";
import Navbar from "../components/Navbar";

const STATUS_OPTIONS = [
  { value: "FINISHGOOD", label: "Finish Good" },
  { value: "RETUR", label: "Retur" },
  { value: "BAD", label: "Bad" },
] as const;

type ScanStatus = (typeof STATUS_OPTIONS)[number]["value"];

const STATUS_META: Record<ScanStatus, { dot: string; badge: string }> = {
  FINISHGOOD: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  RETUR: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  BAD: { dot: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-200" },
};

let beepAudio: HTMLAudioElement | null = null;

function playBeep() {
  try {
    beepAudio ??= new Audio("assets/sound/beep.mp3");
    beepAudio.currentTime = 0;
    void beepAudio.play().catch(() => undefined);
  } catch {
    // Audio gagal diputar — abaikan, scan tetap lanjut.
  }
}

function ScanBarang() {
  const [kodeInput, setKodeInput] = useState("");
  const [status, setStatus] = useState<ScanStatus>("FINISHGOOD");
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookup, setLookup] = useState<Barang | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const tickRef = useRef<() => void>(() => undefined);
  const lastDetectRef = useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });

  const stopCamera = useCallback(() => {
    if (rafRef.current !== undefined) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (!message && !error) return;
    const timeoutId = window.setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [error, message]);

  const handleDetected = useCallback((code: string) => {
    const now = Date.now();
    if (
      code === lastDetectRef.current.code &&
      now - lastDetectRef.current.time < 1500
    ) {
      return;
    }
    lastDetectRef.current = { code, time: now };
    playBeep();
    setKodeInput(code);
    setLookup(null);
    setMessage(null);
    setError(null);
    getScanBarang(code)
      .then(setLookup)
      .catch((requestError: Error) =>
        setError(requestError.message || "Barang tidak ditemukan"),
      );
  }, []);

  const tick = useCallback(() => {
    rafRef.current = window.requestAnimationFrame(() => tickRef.current());
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    const detected = jsQR(image.data, image.width, image.height, {
      inversionAttempts: "dontInvert",
    });
    if (detected?.data) {
      handleDetected(detected.data.trim());
    }
  }, [handleDetected]);

  const startCamera = async () => {
    setError(null);
    setMessage(null);
    if (!window.isSecureContext) {
      setError(
        "Kamera butuh HTTPS. Jalankan 'npm run dev:mobile' lalu buka lewat https://<ip-server>:5173.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser tidak mendukung akses kamera.");
      return;
    }
    const constraints: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: true, audio: false },
    ];
    let stream: MediaStream | null = null;
    for (const constraint of constraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        break;
      } catch {
        continue;
      }
    }
    if (!stream) {
      setError("Kamera tidak dapat diakses. Berikan izin kamera pada browser.");
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        // Sebagian browser menuntut gesture penuh; autoplay attr tetap jalan.
      }
    }
    setIsScanning(true);
    tickRef.current = tick;
    rafRef.current = window.requestAnimationFrame(() => tickRef.current());
  };

  const handleLookup = () => {
    const kode = kodeInput.trim();
    if (!kode) return;
    setLookup(null);
    setMessage(null);
    setError(null);
    getScanBarang(kode)
      .then(setLookup)
      .catch((requestError: Error) =>
        setError(requestError.message || "Barang tidak ditemukan"),
      );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const kode = kodeInput.trim();
    if (!kode) {
      setError("Kode barang belum diisi.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await bulkScanBarang([kode], status);
      if (result.success.length > 0) {
        setMessage(`Status "${status}" tersimpan untuk ${kode}.`);
        setKodeInput("");
        setLookup(null);
      } else {
        setError(
          result.failed[0]?.reason ?? `Gagal simpan status untuk ${kode}.`,
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal simpan hasil scan",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Navbar />

      {/* Container */}
      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        {/* Header — match CetakBarang rhythm */}
        <div className="border-b border-zinc-200 py-8 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                Product Inventory / Scan
              </p>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
                SCAN BARANG
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
                Scan QR code barang dengan kamera, pilih status, lalu simpan. Hasil scan akan beep otomatis.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${isScanning ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-600"}`}>
                <span className={`h-2 w-2 rounded-full ${isScanning ? "animate-pulse bg-emerald-500" : "bg-zinc-300"}`} />
                {isScanning ? "Kamera Aktif" : "Kamera Nonaktif"}
              </span>
            </div>
          </div>
        </div>

        {/* Toast */}
        {(error || message) && (
          <div
            className={`fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur sm:right-6 sm:top-24 ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
            role={error ? "alert" : "status"}
            aria-live="polite"
          >
            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${error ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
              {error ? "!" : "✓"}
            </span>
            <span className="flex-1 leading-6">{error ?? message}</span>
            <button
              type="button"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/5 text-current transition hover:bg-black/10"
              aria-label="Tutup notifikasi"
              onClick={() => {
                setMessage(null);
                setError(null);
              }}
            >
              ×
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* LEFT: Camera card */}
          <section
            className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-900 shadow-sm lg:col-span-7"
            aria-label="Kamera scanner"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Kamera</p>
                <p className="mt-0.5 text-xs text-zinc-500">Arahkan QR ke dalam bingkai • beep = terdeteksi</p>
              </div>
              <div className={`hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${isScanning ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20" : "bg-zinc-800 text-zinc-400"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isScanning ? "animate-pulse bg-emerald-400" : "bg-zinc-500"}`} />
                {isScanning ? "Scanning" : "Standby"}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-zinc-800 bg-black">
                <video
                  className="h-full w-full object-cover"
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                />
                {/* Idle */}
                {!isScanning && (
                  <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-zinc-900/40 px-6 text-center backdrop-blur-[1px]">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
                        <path d="M3 10a2 2 0 0 1 2-2h2l1.5-1.5h3L13 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-white">Kamera nonaktif</p>
                    <p className="max-w-xs text-xs leading-5 text-zinc-400">Tekan “Mulai scan” untuk mengaktifkan kamera. Beri izin jika browser meminta.</p>
                  </div>
                )}

                {/* Frame corners */}
                <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/20" />
                <div className="pointer-events-none absolute left-3 top-3 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-white" />
                <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-white" />
                <div className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-white" />
                <div className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-white" />

                {/* Scan line */}
                {isScanning && (
                  <div className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80 shadow-[0_0_12px_rgba(16,185,129,0.8)]">
                    <div className="h-full w-full animate-pulse bg-emerald-400" />
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              <div className="mt-4 grid grid-cols-2 gap-3">
                {!isScanning ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:scale-[0.98]"
                    type="button"
                    onClick={() => void startCamera()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7z" /></svg>
                    Mulai scan
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-500 active:scale-[0.98]"
                    type="button"
                    onClick={stopCamera}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                    Stop scan
                  </button>
                )}
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-transparent px-4 py-3 text-sm font-bold text-white transition hover:border-white hover:bg-white hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={!kodeInput.trim()}
                  onClick={handleLookup}
                >
                  Cek kode
                </button>
              </div>

              <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
                Tips: pastikan QR jelas, cahaya cukup, dan tidak blur. Duplikat scan diabaikan 1.5 detik.
              </p>
            </div>
          </section>

          {/* RIGHT: Form + Result */}
          <div className="space-y-6 lg:col-span-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Form hasil scan">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900">Detail Scan</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${STATUS_META[status].badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot}`} />
                  {status}
                </span>
              </div>

              <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">Kode Barang</span>
                  <div className="relative">
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 pr-9 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      name="kode_barang"
                      value={kodeInput}
                      onChange={(event) => setKodeInput(event.target.value)}
                      placeholder="Hasil scan masuk otomatis ke sini"
                      autoComplete="off"
                    />
                    {kodeInput && (
                      <button
                        type="button"
                        onClick={() => { setKodeInput(""); setLookup(null); }}
                        className="absolute inset-y-0 right-2 grid h-7 w-7 place-self-center place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label="Hapus kode"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">Bisa scan kamera atau ketik manual lalu “Cek kode”.</span>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">Status</span>
                  <div className="relative">
                    <select
                      className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3.5 pr-8 text-sm font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as ScanStatus)}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-zinc-400">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                  </div>
                </label>

                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  type="submit"
                  disabled={isSubmitting || !kodeInput.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" className="opacity-75" /></svg>
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Status"
                  )}
                </button>
              </form>

              {/* Lookup result */}
              <div className="mt-6">
                {!lookup ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-zinc-700">Belum ada hasil</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-zinc-500">Scan QR atau masukkan kode lalu tekan “Cek kode” untuk melihat detail barang.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Hasil Scan</p>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${STATUS_META[lookup.status as ScanStatus]?.badge ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[lookup.status as ScanStatus]?.dot ?? "bg-zinc-400"}`} />
                        {lookup.status}
                      </span>
                    </div>
                    <div className="space-y-0 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-xs font-medium text-zinc-500">Kode</span>
                        <span className="max-w-[60%] truncate text-right font-mono text-sm font-bold text-zinc-900">{lookup.kodeBarang}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-xs font-medium text-zinc-500">Produk</span>
                        <span className="text-right text-sm font-semibold text-zinc-900">{lookup.variant.product.nama}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-xs font-medium text-zinc-500">Variant</span>
                        <span className="text-right font-mono text-xs font-bold text-zinc-700">{lookup.variant.kodeVariant}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-xs font-medium text-zinc-500">Style / Warna / Size</span>
                        <span className="text-right text-xs font-semibold text-zinc-700">
                          {lookup.variant.style.nama} / {lookup.variant.color.nama} / {lookup.variant.size.nama}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-center text-xs text-zinc-500">Periksa kembali sebelum simpan. Status akan tercatat di histori.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Help card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900">Bantuan Cepat</h3>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-600">
                <li className="flex gap-2"><span className="text-zinc-900">•</span> Gunakan HTTPS saat di HP: <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">npm run dev:mobile</code></li>
                <li className="flex gap-2"><span className="text-zinc-900">•</span> Jika kamera blur, dekatkan QR 15–25 cm dari lensa.</li>
                <li className="flex gap-2"><span className="text-zinc-900">•</span> Suara <em>beep</em> berarti kode tertangkap, cek otomatis.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanBarang;
