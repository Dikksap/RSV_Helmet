import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFloppyDisk,
  faIdBadge,
  faImage,
  faKey,
  faTrash,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import {
  deleteProfileAvatar,
  getProfileAvatar,
  getUser,
  getUserPermissions,
  updateProfile,
  uploadProfileAvatar,
} from "../api/auth";
import { inputCls, labelCls } from "../components/admin/VariantProduk/constants";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";

const cardCls = "rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  gudang: "Warehouse",
  user: "Operator",
  produksi: "Produksi",
  qc: "QC",
};

export default function Profil() {
  const [user, setUser] = useState(() => getUser());
  const permissions = getUserPermissions();

  const [nama, setNama] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarReload, setAvatarReload] = useState(0);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void getProfileAvatar()
      .then((blob) => {
        if (!active) return;
        objectUrl = blob ? URL.createObjectURL(blob) : null;
        setAvatarUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Gagal memuat avatar.");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarReload]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const saveProfile = async () => {
    if (!nama.trim()) return setError("Nama wajib diisi.");
    if (!email.trim()) return setError("Email wajib diisi.");
    setError(null);
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ name: nama.trim(), email: email.trim() });
      setUser(updated);
      setNama(updated.name);
      setEmail(updated.email);
      flash("Profil diperbarui.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword) return setError("Password lama wajib diisi.");
    if (newPassword.length < 6) return setError("Password baru minimal 6 karakter.");
    if (newPassword !== konfirmasi) return setError("Konfirmasi password tidak cocok.");
    setError(null);
    setSavingPassword(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setKonfirmasi("");
      flash("Password diperbarui.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const pilihAvatar = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format gambar harus JPEG, PNG, atau WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const simpanAvatar = async () => {
    if (!avatarFile) return;
    setSavingAvatar(true);
    setError(null);
    try {
      await uploadProfileAvatar(avatarFile);
      setAvatarFile(null);
      setAvatarPreview(null);
      setUser((current) => current ? { ...current, avatarUrl: "/api/auth/me/avatar" } : current);
      setAvatarReload((value) => value + 1);
      flash("Foto profil diperbarui.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mengunggah foto profil.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const hapusAvatar = async () => {
    if (!window.confirm("Hapus foto profil?")) return;
    setSavingAvatar(true);
    setError(null);
    try {
      await deleteProfileAvatar();
      setAvatarUrl(null);
      setAvatarFile(null);
      setAvatarPreview(null);
      setUser((current) => current ? { ...current, avatarUrl: null } : current);
      flash("Foto profil dihapus.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menghapus foto profil.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const gambarProfil = avatarPreview ?? avatarUrl;

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Akun</p>
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Profil</h1>
        <p className="mt-2 text-base text-[#6B7280]">Data akun dan pengaturan password Anda.</p>
      </header>

      <div aria-live="polite" className="space-y-3">
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardCls} aria-labelledby="profil-info">
          <h2 id="profil-info" className="flex items-center gap-2 text-lg font-semibold text-[#1E3A5F]">
            <FontAwesomeIcon icon={faIdBadge} className="h-4 w-4 text-[#00A8E8]" /> Informasi Akun
          </h2>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            {gambarProfil ? (
              <img src={gambarProfil} alt="Foto profil" className="h-20 w-20 rounded-full border border-slate-200 object-cover" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-sky-50 text-2xl text-sky-700">
                <FontAwesomeIcon icon={faImage} />
              </div>
            )}
            <div className="space-y-2">
              <label className={`${primaryBtn} cursor-pointer`}>
                <FontAwesomeIcon icon={faUpload} className="h-4 w-4" />
                {avatarFile ? "Pilih gambar lain" : "Pilih foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={savingAvatar}
                  onChange={(event) => {
                    pilihAvatar(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {avatarFile && (
                  <>
                    <button type="button" className={primaryBtn} disabled={savingAvatar} onClick={() => void simpanAvatar()}>
                      {savingAvatar ? "Menyimpan..." : "Simpan foto"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      disabled={savingAvatar}
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(null);
                      }}
                    >
                      Batalkan pilihan
                    </button>
                  </>
                )}
                {avatarUrl && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={savingAvatar}
                    onClick={() => void hapusAvatar()}
                  >
                    <FontAwesomeIcon icon={faTrash} /> Hapus
                  </button>
                )}
              </div>
              <p className="text-xs text-[#6B7280]">JPEG, PNG, atau WebP · maksimal 5 MB</p>
            </div>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-[#6B7280]">ID</dt>
              <dd className="font-medium text-[#1F2937]">{user?.id ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-[#6B7280]">Role</dt>
              <dd className="font-medium text-[#1F2937]">{ROLE_LABELS[user?.role ?? ""] ?? (user?.role || "-")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">Email</dt>
              <dd className="truncate font-medium text-[#1F2937]">{user?.email ?? "-"}</dd>
            </div>
          </dl>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[#6B7280]">Permission</p>
          {permissions.length === 0 ? (
            <p className="mt-2 text-sm text-[#6B7280]">Tidak ada permission khusus.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {permissions.map((kode) => (
                <li key={kode} className="rounded-full bg-[#F5F7FA] px-3 py-1 text-xs font-medium text-[#1E3A5F]">
                  {kode}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <section className={cardCls} aria-labelledby="profil-nama">
            <h2 id="profil-nama" className="text-lg font-semibold text-[#1E3A5F]">Ubah Data</h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void saveProfile();
              }}
            >
              <div className={labelCls}>
                <label htmlFor="profil-name">Nama</label>
                <input id="profil-name" className={inputCls} value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" />
              </div>
              <div className={labelCls}>
                <label htmlFor="profil-email">Email</label>
                <input id="profil-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <button type="submit" className={primaryBtn} disabled={savingProfile}>
                <FontAwesomeIcon icon={faFloppyDisk} className="h-4 w-4" /> {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </form>
          </section>

          <section className={cardCls} aria-labelledby="profil-password">
            <h2 id="profil-password" className="flex items-center gap-2 text-lg font-semibold text-[#1E3A5F]">
              <FontAwesomeIcon icon={faKey} className="h-4 w-4 text-[#00A8E8]" /> Ganti Password
            </h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void savePassword();
              }}
            >
              <div className={labelCls}>
                <label htmlFor="profil-current">Password lama</label>
                <input
                  id="profil-current"
                  type="password"
                  className={inputCls}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className={labelCls}>
                <label htmlFor="profil-new">Password baru</label>
                <input
                  id="profil-new"
                  type="password"
                  className={inputCls}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className={labelCls}>
                <label htmlFor="profil-confirm">Ulangi password baru</label>
                <input
                  id="profil-confirm"
                  type="password"
                  className={inputCls}
                  value={konfirmasi}
                  onChange={(e) => setKonfirmasi(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className={primaryBtn} disabled={savingPassword}>
                <FontAwesomeIcon icon={faKey} className="h-4 w-4" /> {savingPassword ? "Menyimpan..." : "Ganti Password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
