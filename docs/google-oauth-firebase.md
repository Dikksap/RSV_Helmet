# Google OAuth dengan Firebase — RSV Helmet

Dokumen ini menjelaskan implementasi login Google memakai Firebase Authentication.
Firebase **hanya** menjadi penyedia identitas Google. Autentikasi aplikasi tetap
memakai JWT RSV, role/permission dari database, dan middleware yang sudah ada.

## 1. Arsitektur singkat

```text
Browser
  └─ Firebase Web SDK: signInWithPopup(GoogleAuthProvider)
       └─ Firebase ID Token (sementara)
            └─ POST /api/auth/google { idToken }
                 └─ Firebase Admin SDK: verifyIdToken(idToken, checkRevoked=true)
                      ├─ cek audience + issuer = Firebase project yang dikonfigurasi
                      ├─ cek provider = google.com
                      ├─ cek email tersedia + email_verified = true
                      ├─ cari User RSV berdasarkan email (lowercase)
                      ├─ tolak jika tidak terdaftar / tidak aktif
                      └─ signToken(...) → JWT RSV (sama seperti login email/password)
                           └─ Frontend setAuth(token, user) → checkSession() → redirect
```

Yang **tidak** dilakukan: auto-register, pembuatan user, pemberian role default,
role dari email Google, atau permission dari body request. Semua role/permission
dibaca dari database RSV.

## 2. Setup Firebase project

1. Buka <https://console.firebase.google.com>, buat project (mis. `rsv-helemet`).
2. **Project settings → General → Your apps → Add app → Web**.
3. Salin nilai konfigurasi web:
   - `apiKey` → `VITE_FIREBASE_API_KEY`
   - `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `VITE_FIREBASE_PROJECT_ID`
   - `storageBucket` → `VITE_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `VITE_FIREBASE_APP_ID`

Nilai web config bersifat publik (bukan service account). Jangan pernah menaruh
service account JSON di frontend, Git, atau image frontend.

## 3. Aktifkan provider Google

1. **Authentication → Sign-in method → Google → Enable**.
2. Isi email support dan simpan.
3. **Authentication → Settings → Authorized domains**, tambahkan:
   - `localhost` (development)
   - domain staging (mis. `staging.rsv.example.com`)
   - domain production (mis. `rsv.example.com`)

Jika frontend diakses lewat IP/LAN (mis. `http://192.168.1.20:5173`), tambahkan
IP tersebut ke authorized domains atau gunakan domain yang terdaftar. Firebase
menolak popup dari domain yang tidak terdaftar (`auth/unauthorized-domain`).

## 4. Buat Service Account (backend)

1. **Project settings → Service accounts → Generate new private key**.
2. Simpan file JSON di luar source code, misalnya:
   - lokal: `secrets/firebase-service-account.json` (sudah di-`.gitignore`)
   - server: `/run/secrets/firebase-service-account.json` (mount read-only)
3. Isi environment backend:

```env
FIREBASE_PROJECT_ID=rsv-helemet
FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/firebase-service-account.json
```

Alternatif untuk platform tanpa mount file:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}
```

`FIREBASE_PROJECT_ID` harus sama dengan `project_id` di service account. Jika
berbeda, backend menolak start verifikasi (503) dan mencatat penyebabnya di log
server tanpa membocorkan credential ke response.

## 5. Environment variable

### Backend (`backend/.env`)

```env
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_PATH=
# FIREBASE_SERVICE_ACCOUNT_JSON=   # alternatif, jangan dipakai bersamaan
```

### Frontend (`frontend/.env`, `.env.production`, `.env.electron`)

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Frontend hanya boleh memakai web config. Service account tidak boleh masuk
bundel frontend.

## 6. Menjalankan lokal

1. Terapkan migration (wajib, karena kolom `User.isActive` ditambahkan):

```bash
cd backend
npx prisma migrate deploy
# atau di Docker Compose:
docker compose exec api npx prisma migrate deploy
```

2. Jalankan backend:

```bash
cd backend
npm run dev
```

3. Isi `frontend/.env` dengan web config Firebase, lalu:

```bash
cd frontend
npm run dev
```

4. Buka `http://localhost:5173/login`, klik **Login dengan Google**.
   Email Google harus sudah ada di tabel `User` RSV dan `isActive = true`.

Catatan Docker development: `backend/docker-compose.yml` me-mount `../secrets`
ke `/app/secrets` (read-only). Di dalam container, isi:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=/app/secrets/firebase-service-account.json
```

Catatan Electron/Android: popup OAuth membutuhkan origin web yang terdaftar di
Firebase. Build Electron (`file://`) dan WebView Capacitor memerlukan penanganan
OAuth native/deep-link tersendiri; fitur ini divalidasi untuk deployment web
(Vite/nginx). Di platform tersebut tombol tetap tampil dan akan menampilkan pesan
error yang sesuai.

## 7. Deployment staging dan production

### Frontend

Nilai `VITE_FIREBASE_*` dibaca saat **build**, bukan runtime. Pilih salah satu:

- Isi `frontend/.env.production` sebelum build, atau
- Lewatkan Docker build args:

```bash
docker build \
  --build-arg VITE_FIREBASE_API_KEY=... \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
  --build-arg VITE_FIREBASE_PROJECT_ID=... \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=... \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=... \
  --build-arg VITE_FIREBASE_APP_ID=... \
  -f dockerfile -t rsv-frontend .
```

GitHub Actions (`.github/workflows/docker.yml`) membaca **Repository Variables**
`VITE_FIREBASE_*`. Set variabel berbeda per environment/repo staging dan
production. Build arg kosong tidak menimpa `.env.production`.

Gunakan project Firebase terpisah untuk staging dan production agar user,
authorized domain, dan service account tidak tercampur.

### Backend

Set `FIREBASE_PROJECT_ID` dan `FIREBASE_SERVICE_ACCOUNT_PATH` di `.env` server,
lalu mount file read-only. Contoh untuk `docker-compose.prod.yml`:

```yaml
services:
  backend:
    environment:
      FIREBASE_PROJECT_ID: rsv-helemet-prod
      FIREBASE_SERVICE_ACCOUNT_PATH: /run/secrets/firebase-service-account.json
    volumes:
      - ./secrets/firebase-service-account.json:/run/secrets/firebase-service-account.json:ro
```

Pastikan file hanya dapat dibaca proses backend dan tidak ikut image/backup publik.

## 8. Kontrak endpoint

### `POST /api/auth/google`

Request:

```json
{ "idToken": "FIREBASE_ID_TOKEN" }
```

Sukses (`200`) — bentuknya sama persis dengan `POST /api/auth/login`:

```json
{
  "message": "Login berhasil",
  "token": "<JWT RSV>",
  "user": {
    "id": 7,
    "name": "Budi",
    "email": "budi@example.com",
    "role": "gudang",
    "divisiId": 2,
    "divisi": { "id": 2, "nama": "Gudang" },
    "avatarUrl": null
  }
}
```

Kegagalan:

| Status | Kondisi | Pesan |
| --- | --- | --- |
| 400 | `idToken` tidak ada / bukan string | `Field 'idToken' wajib diisi` |
| 401 | token invalid, expired, revoked, atau project lain | `Token Google tidak valid atau kedaluwarsa` |
| 403 | email belum terverifikasi / tidak ada | `Email Google belum terverifikasi` |
| 403 | provider bukan `google.com` | `Gunakan Login dengan Google untuk masuk` |
| 403 | email tidak ada di database RSV | `Akun Google belum terdaftar di sistem RSV. Hubungi administrator.` |
| 403 | `User.isActive = false` | `Akun Anda tidak aktif. Hubungi administrator.` |
| 503 | Firebase Admin belum dikonfigurasi | `Login Google belum dapat digunakan. Hubungi administrator.` |
| 500 | error tak terduga | `Gagal login dengan Google` |

Response error tidak memuat stack trace, credential, atau detail internal.

## 9. Status akun

Login Google (dan login email/password) menolak user dengan `isActive = false`
(HTTP 403). Admin dapat menonaktifkan akun lewat API user yang sudah ada:

```bash
curl -X PUT http://localhost:8000/api/users/7 \
  -H "Authorization: Bearer <JWT admin>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

Aktifkan kembali dengan `{"isActive": true}`. Migration menambahkan kolom dengan
default `true`, sehingga semua user existing tetap aktif.

## 10. Troubleshooting

| Gejala | Penyebab umum | Tindakan |
| --- | --- | --- |
| Tombol Google → `Login Google belum dikonfigurasi pada aplikasi ini.` | `VITE_FIREBASE_*` kosong saat build | Isi `.env.production` / build args, lalu rebuild frontend |
| `auth/unauthorized-domain` | Domain belum terdaftar di Firebase | Tambahkan domain di Authentication → Settings → Authorized domains |
| `auth/operation-not-allowed` | Provider Google belum diaktifkan | Authentication → Sign-in method → Google → Enable |
| `auth/popup-blocked` | Browser memblokir popup | Izinkan popup untuk domain aplikasi |
| `auth/invalid-api-key` | Web API key salah / project beda | Samakan web config dengan project Firebase |
| `auth/configuration-not-found` | Firebase Authentication belum diinisialisasi untuk project, atau provider Google belum disiapkan | Firebase Console → Authentication → **Get started**, lalu Sign-in method → Google → Enable |
| 401 `Token Google tidak valid atau kedaluwarsa` | Token dari project lain, expired, atau revoked | Pastikan frontend dan backend memakai project Firebase yang sama |
| 403 `Akun Google belum terdaftar` | Email Google tidak ada di tabel `User` | Tambahkan user lewat menu Kelola User (bukan auto-register) |
| 403 `Akun Anda tidak aktif` | `User.isActive = false` | Aktifkan kembali lewat admin |
| 403 `Email Google belum terverifikasi` | Token tidak membawa `email_verified` | Gunakan akun Google dengan email terverifikasi |
| 503 `Login Google belum dapat digunakan` | Service account path salah, file tidak ada, project ID tidak cocok, atau Google tidak dapat dihubungi | Cek log server, path mount, dan `FIREBASE_PROJECT_ID` |
| Semua login gagal setelah update | Migration `isActive` belum diterapkan | Jalankan `npx prisma migrate deploy` |
| `Cannot find package 'firebase-admin'` di container dev | Anonymous volume `/app/node_modules` masih dependency lama | Rebuild API dengan volume baru: `docker compose up -d --build --force-recreate --renew-anon-volumes api` (volume DB/Redis tidak tersentuh) |
| Error `auth/id-token-revoked` | Sesi Firebase dicabut | Login ulang dengan Google |

## 11. Catatan keamanan

- Firebase ID Token selalu diverifikasi di backend dengan Firebase Admin SDK.
- `checkRevoked = true` memastikan token yang dicabut tidak dapat dipakai ulang.
- Audience dan issuer token harus milik project Firebase yang dikonfigurasi.
- Email dinormalisasi (`trim` + lowercase) sebelum pencarian user.
- Role/permission tidak pernah diambil dari token Google atau body request.
- Tidak ada auto-register dan tidak ada role default untuk akun Google baru.
- JWT RSV tetap ditandatangani `JWT_SECRET` dan diverifikasi middleware yang sama.
- Logout RSV tetap mem-blacklist JWT di Redis; logout Firebase dijalankan sebagai
  pembersihan tambahan.
- Service account hanya dibaca backend; jangan pernah mengirimkannya ke browser.
- Deaktivasi akun berlaku saat login berikutnya. JWT RSV yang sudah terbit tetap
  berlaku sampai `exp` (default 8 jam), sama seperti mekanisme JWT existing;
  middleware JWT tidak diubah oleh fitur ini.
