# TODO — Persistensi Form Permintaan Barang

Form `/permintaan-barang` (frontend) jalan penuh tapi hasil hanya jadi PDF —
tidak ada jejak di database. Operator gudang/manager tidak bisa melihat daftar
permintaan, dan tidak ada jalur approval.

Keputusan desain (sudah disepakati):

- **Nomor permintaan digenerate backend**, format `PR-YYYYMMDD-NNNN` (nomor urut
  per hari, bukan acak). Frontend berhenti generate sendiri.
- **Edit & hapus dikunci saat `DISETUJUI`** → `409`. Satu-satunya jalan ubah
  data setelah approval adalah revert status lewat endpoint approval.
- Enum approval dua nilai saja: `BELUM_DISETUJUI` (default) / `DISETUJUI`.
- Endpoint **tanpa auth middleware** — konsisten kontrak API saat ini
  (seluruh endpoint bisnis publik kecuali `/api/auth/logout`).
- **Tidak ada event WebSocket baru.** Dashboard LiveView tidak mengonsumsi
  permintaan barang; AGENTS.md backend melarang invent event.
- **Tidak ada kolom `disetujuiOleh` / `disetujuiPada`** — tidak diminta.
  Tambah nanti begitu approval butuh jejak siapa/ kapan.

Aturan repo yang dipatuhi: migration baru (jangan sentuh yang lama), jangan
edit `generated/prisma`, jangan `migrate reset`, schema + migration commit
dalam satu commit.

---

## Fase 1 — Schema & migration

- [x] **1. `backend/prisma/schema.prisma` — append 1 enum + 2 model (file berakhir di :393)**

      ```prisma
      enum StatusApprovalPermintaan {
        BELUM_DISETUJUI
        DISETUJUI
      }

      model PermintaanBarang {
        id                Int                      @id @default(autoincrement())
        noPermintaan      String                   @unique
        tanggal           DateTime
        departemen        String
        namaPeminta       String
        kebutuhanUntuk    String                   @default("Produksi")
        prioritas         String                   @default("Normal")
        tanggalDibutuhkan DateTime?
        alasan            String                   @db.Text
        approval          StatusApprovalPermintaan @default(BELUM_DISETUJUI)
        createdAt         DateTime                 @default(now())
        updatedAt         DateTime                 @updatedAt

        items PermintaanBarangItem[]

        @@index([tanggal])
        @@index([approval])
      }

      model PermintaanBarangItem {
        id           Int      @id @default(autoincrement())
        permintaanId Int
        nama         String
        spesifikasi  String?
        jumlah       Int
        satuan       String?
        createdAt    DateTime @default(now())
        updatedAt    DateTime @updatedAt

        permintaan PermintaanBarang @relation(fields: [permintaanId], references: [id], onDelete: Cascade)

        @@index([permintaanId])
      }
      ```

      Catatan pemilihan:
      - `nama`/`spesifikasi`/`satuan` item berupa `String`, bukan FK ke
        `ProductVariant` — form menerima barang apa pun termasuk bahan baku
        (Kertas A4, lem, dsb.) yang tidak ada di master variant.
      - `alasan` `@db.Text` karena textarea bebas panjang; default VARCHAR(191)
        MySQL akan memotong/error.
      - `onDelete: Cascade` header → items. Tidak ada histori terpisah seperti
        `RiwayatBarang`, jadi baris item yatim tidak berguna.
      - Index FK MariaDB bernama `<Tabel>_<kolom>_fkey` (catatan Prisma 7.9.1
        di AGENTS.md). Kalau `migrate diff` melaporkan drift index setelah
        migration, deklarasikan `@@index([permintaanId], map: "PermintaanBarangItem_permintaanId_fkey")`
        — jangan coba buang index-nya (FK menahannya).

- [x] **2. Buat migration**

      `npm run db:migrate` dari `backend/` (via Docker Compose, sesuai
      Prisma Workflow). `migrate dev` wajib TTY — kalau shell non-interaktif,
      `--create-only` di terminal lalu `migrate deploy`.

- [x] **3. Generate client + cek drift**

      ```bash
      docker exec -it backend-api-1 npx prisma generate
      docker exec -it backend-api-1 npx prisma migrate status
      docker exec -it backend-api-1 npx prisma migrate diff \
        --from-schema prisma/schema.prisma --to-config-datasource --exit-code
      ```

      Exit `0` = sinkron. Drift = bereskan sebelum lanjut Fase 2.

---

## Fase 2 — Backend model

- [x] **4. `backend/src/model/permintaanBarang/permintaanBarang.ts` (baru)**

      Pakai instance Prisma dari `src/lib/prisma.ts` (jangan `PrismaClient`
      baru). Fungsi:

      - `generateNoPermintaan(tx)` — dalam transaction: `findFirst` dengan
        `where: { noPermintaan: { startsWith: "PR-YYYYMMDD-" } }`,
        `orderBy: { noPermintaan: "desc" }`, ambil suffix 4 digit, `+1`,
        padStart 4. Tabel kosong hari ini → `0001`.
        `PR-...` + 8 digit + `-` + 4 digit = panjang tetap 19, jadi `desc`
        leksikografis == numerik. Aman.
      - `createPermintaan(data)` — `prisma.$transaction`: generate nomor →
        `permintaanBarang.create({ data: { ..., items: { create: [...] } } })`.
        Atomic: header + items + nomor satu transaction. Retry sekali pada
        `P2002` (nomor kembar karena race) dengan nomor baru.
      - `listPermintaan({ page, limit, approval })` — default `1`/`20`,
        `limit` maksimum `100` (konvensi `GET /api/barang`), `include: { items: true }`,
        `orderBy: { createdAt: "desc" }`, kembalikan `{ data, meta }`.
      - `getPermintaanById(id)` — `include items`, `null` jika tidak ada.
      - `updatePermintaan(id, data)` — tolak jika `approval === DISETUJUI`
        (lempar `Error` bertanda `LOCKED`, lihat poin 6). Dalam transaction:
        `items.deleteMany({ permintaanId })` + `update` header + `createMany`
        items. `noPermintaan` **tidak** ikut berubah.
      - `setApproval(id, approval)` — hanya ubah kolom `approval`.
      - `deletePermintaan(id)` — tolak jika `DISETUJUI`; selain itu `delete`
        (items ikut cascade).

- [x] **5. Type domain**

      Hindari `any`. Pakai `Prisma.PermintaanBarangGetPayload<{ include: { items: true } }>`
      untuk shape list/detail, dan type input eksplisit untuk create/update.

---

## Fase 3 — Backend controller

- [x] **6. `backend/src/controller/permintaanBarang/permintaanBarang.ts` (baru)**

      Validasi sebelum query DB (pola controller barang/karyawan):

      - `tanggal` wajib, parse `Date` valid.
      - `departemen`, `namaPeminta`, `alasan` wajib non-empty setelah `trim`.
      - `kebutuhanUntuk` ∈ `Produksi|Maintenance|Proyek`; `prioritas` ∈
        `Normal|Urgent` (sama dengan opsi `<select>` frontend). Default bila
        absen.
      - `tanggalDibutuhkan` opsional; kalau ada harus tanggal valid.
      - `items` array, panjang ≥ 1. Tiap item: `nama` non-empty, `jumlah`
        integer `> 0`, `spesifikasi`/`satuan` opsional.
      - `approval` pada body PATCH ∈ `DISETUJUI|BELUM_DISETUJUI` (terima juga
        bentuk snake_case mana pun yang dikirim client — normalize eksplisit).

      Pemetaan status:

      | Kondisi | Code |
      | --- | --- |
      | invalid input | `400` |
      | id tidak ada | `404` |
      | `PUT`/`DELETE` saat `DISETUJUI` | `409` `{ message: "Permintaan sudah disetujui, tidak dapat diubah." }` |
      | sukses create | `201` |
      | error tak terduga | `500` |

      Handler: `listPermintaanHandler`, `getPermintaanHandler`,
      `createPermintaanHandler`, `updatePermintaanHandler`,
      `setApprovalHandler`, `deletePermintaanHandler`.
      Bedakan error kunci (`LOCKED` → 409) dari error lain lewat marker di
      model (mis. subclass/`code` properti), bukan cek string message.

---

## Fase 4 — Wiring route

- [x] **7. `backend/src/routes/permintaan-barang.ts` (baru)**

      Pola 1:1 `src/routes/karyawan.ts`:

      ```
      GET    /                listPermintaanHandler
      GET    /:id             getPermintaanHandler
      POST   /                createPermintaanHandler
      PUT    /:id             updatePermintaanHandler
      PATCH  /:id/approval    setApprovalHandler
      DELETE /:id             deletePermintaanHandler
      ```

- [x] **8. `backend/src/app.ts` — impor + daftar**

      Tambah `import permintaanBarangRouter from "./routes/permintaan-barang.js";`
      dan `app.use("/api/permintaan-barang", permintaanBarangRouter);`
      (blok registrasi `:33-48`). Import wajib berekstensi `.js` (ESM).

---

## Fase 5 — Test backend

- [x] **9. `backend/tests/permintaan-barang.test.ts` (baru)**

      Vitest + Supertest, mock model + WebSocket mengikuti pola
      `tests/barang.test.ts`. Cakupan minimal:

      - create valid → `201`, `noPermintaan` format `PR-YYYYMMDD-NNNN`,
        items tersimpan.
      - create tanpa `items` / `items` kosong → `400`.
      - create `jumlah` 0 atau negatif → `400`.
      - create `alasan` kosong → `400`.
      - list → bentuk `{ data, meta }`, filter `approval` bekerja.
      - detail id tidak ada → `404`.
      - `PUT` saat `BELUM_DISETUJUI` → `200`, items terganti, `noPermintaan`
        tetap.
      - `PUT` / `DELETE` saat `DISETUJUI` → `409`.
      - `PATCH approval` dua arah → `200` + status berubah.

- [x] **10. Validasi penuh**

      ```bash
      cd backend && npm run build && npm test
      ```

      Hijau sebelum sentuh frontend.

---

## Fase 6 — Frontend API client

- [x] **11. `frontend/src/api/permintaanBarang.ts` (baru)**

      Pola `src/api/barang.ts`: `const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api"`.

      ```ts
      export type ApprovalPermintaan = "BELUM_DISETUJUI" | "DISETUJUI";

      export interface PermintaanItem {
        nama: string; spesifikasi: string | null;
        jumlah: number; satuan: string | null;
      }

      export interface PermintaanBarangRecord extends PermintaanItemPayload {
        id: number; noPermintaan: string; approval: ApprovalPermintaan;
        createdAt: string; updatedAt: string;
      }

      export async function createPermintaan(payload): Promise<PermintaanBarangRecord>
      ```

      `createPermintaan` POST ke `${apiUrl}/permintaan-barang`. Parse error
      seperti `parseApiError` di `barang.ts` (bawa `message` backend).
      Hanya `create` yang dibuat sekarang — list/approve butuh UI admin
      tersendiri (YAGNI, lihat Fase 8).

---

## Fase 7 — Kabelkan form

- [x] **12. `frontend/src/pages/public/PermintaanBarang.tsx` — simpan dulu, baru cetak**

      - Hapus `generateNoPermintaan` (`:31-37`) dan `useState` `noPermintaan`
        (`:66`). Ganti dengan `const [noPermintaan, setNoPermintaan] = useState("")`.
      - Step A: field "No. Permintaan" jadi `readOnly` dengan placeholder
        `"Otomatis saat disimpan"` (`:222-224`).
      - Header kartu (`:212-214`) dan pratinjau PDF (`:369`, `:437`) menampilkan
        `noPermintaan || "OTOMATIS SAAT DISIMPAN"`.
      - `onSubmit` (`:151-154`) jadi async:

        ```ts
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          const rec = await createPermintaan({ ...payload });
          setNoPermintaan(rec.noPermintaan);
          // tunggu React commit nomor ke DOM pratinjau sebelum cetak
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          printFn();
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "Gagal menyimpan permintaan.");
        } finally {
          setSaving(false);
        }
        ```

        **Gagal simpan = tidak cetak.** Ini yang membedakan dari versi sekarang.
      - `documentTitle: noPermintaan` (`:82`) sudah benar begitu state terisi;
        fallback bila kosong: `PR-BELUM-DISIMPAN`.
      - Tombol submit step D: `disabled={saving}`, teks
        `saving ? "Menyimpan..." : "📄 Simpan & Cetak PDF"`.
      - Payload `tanggalDibutuhkan` kosong → kirim `null` (kolom `DateTime?`).
      - `useReactToPrint` membaca `contentRef` saat dipanggil, jadi urutan
        `setState` → rAF → `printFn()` wajib; tanpa itu PDF tercetak dengan
        nomor kosong.

- [ ] **13. Verifikasi manual**

      - Isi A→D, simpan → cek `201` + nomor `PR-YYYYMMDD-0001`, dialog print
        terbuka dengan nomor tercantum di header & footer PDF.
      - Simpan lagi hari yang sama → `0002`.
      - Matikan backend → alert gagal, dialog print **tidak** terbuka.
      - `cd frontend && npx tsc --noEmit -p tsconfig.app.json` + `npx eslint src/...`.

---

## Fase 8 — Daftar Permintaan di admin (dikerjakan 6 Okt 2026)

- [x] **14. `frontend/src/api/permintaanBarang.ts` — tambah client**

      `listPermintaan({page?, limit?, approval?})` (default limit 100, max 100),
      `setApprovalPermintaan(id, approval)`, `deletePermintaan(id)`.
      Error parsing ikut pola `parseApiError` (`barang.ts`).

- [x] **15. `frontend/src/pages/admin/DaftarPermintaan.tsx` (baru)**

      Satu file, meniru `KelolaBatch.tsx`: header Warehouse, notice/error,
      search client-side (no/peminta/departemen), select filter status
      (query `approval` ke backend), tabel `min-w-[860px]`.
      Kolom: No (mono, klik = expand) | Tanggal | Departemen/Peminta | Isi
      ("N barang · M pcs") | Prioritas | Status badge | Aksi.
      Expand inline: kebutuhan, tgl. dibutuhkan, alasan, tabel item.
      `BELUM_DISETUJUI` → Setujui (confirm) + Hapus (confirm);
      `DISETUJUI` → Batalkan persetujuan (confirm), tanpa tombol hapus.
      `void load()` ulang + notice tiap aksi, error → alert.
      Catatan lint: `react-hooks/set-state-in-effect` muncul 1x — sama
      persis seperti di `KelolaBatch.tsx` (pre-existing, pola repo).

- [x] **16. Route + nav**

      `main.tsx`: `<Route path="/admin/permintaan-barang" element={<DaftarPermintaan />} />`
      dalam grup `AdminLayout`. `navigation.tsx`: `WAREHOUSE.children`
      diisi 1 entry (label "Permintaan Barang", `faClipboardList`).
      `tsc` bersih.

## Fase 9 — Di luar scope (catatan, jangan kerjakan sekarang)

- ~~UI daftar/approval permintaan di `/admin` (butuh `GET` + `PATCH approval`
  yang sudah dirancang tapi belum dipanggil frontend).~~ → selesai Fase 8.
- Kolom `disetujuiOleh` / `disetujuiPada` + middleware auth pada endpoint
  approval.
- Notifikasi WebSocket `permintaan.created` — baru buat kalau ada konsumen.
- Relasi item ke `ProductVariant` untuk barang produksi (menahan bahan baku
  yang tidak punya variant).

---

## File yang disentuh

| File | Aksi |
| --- | --- |
| `backend/prisma/schema.prisma` | append enum + 2 model |
| `backend/prisma/migrations/<timestamp>_permintaan_barang/` | baru (generated) |
| `backend/src/model/permintaanBarang/permintaanBarang.ts` | baru |
| `backend/src/controller/permintaanBarang/permintaanBarang.ts` | baru |
| `backend/src/routes/permintaan-barang.ts` | baru |
| `backend/src/app.ts` | +2 baris (impor + `app.use`) |
| `backend/tests/permintaan-barang.test.ts` | baru |
| `frontend/src/api/permintaanBarang.ts` | baru (Fase 6: create; Fase 8: +list/approve/delete) |
| `frontend/src/pages/public/PermintaanBarang.tsx` | ubah alur simpan |
| `frontend/src/pages/admin/DaftarPermintaan.tsx` | baru (Fase 8) |
| `frontend/src/main.tsx` | +route admin (Fase 8, sebelumnya +route publik) |
| `frontend/src/layouts/admin/navigation.tsx` | +entry Warehouse (Fase 8) |
