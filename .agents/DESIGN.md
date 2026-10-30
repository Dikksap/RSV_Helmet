# Design Document: Helmet ERP Manufacturing

**Versi:** 1.0  
**Tanggal:** 28 Oktober 2026  
**Status:** Draft untuk implementasi  
**Bahasa:** Indonesia  
**Target:** Aplikasi ERP internal untuk pengelolaan persediaan, produksi helm, WIP, QC, traceability batch, dan laporan operasional.

---

## 1. Overview

### 1.1 Tujuan

Dokumen ini menjadi acuan desain UI/UX dan implementasi frontend Helmet ERP. Aplikasi dirancang agar operator, gudang, QC, supervisor, dan manajemen dapat menjalankan proses kerja secara konsisten, cepat, dan mudah ditelusuri.

Tujuan utama:

- Memudahkan input dan pemantauan aktivitas produksi harian.
- Menampilkan status persediaan dan WIP secara akurat.
- Meminimalkan kesalahan input, transaksi ganda, dan perubahan stok yang tidak sah.
- Menyediakan traceability batch dari bahan/batok hingga barang jadi.
- Memperjelas alur QC, reject, repair, dan hasil produksi.
- Menyajikan informasi sesuai tanggung jawab dan hak akses pengguna.
- Mengoptimalkan penggunaan aplikasi pada desktop, tablet, dan perangkat operator.

### 1.2 Target Pengguna

- **Admin:** konfigurasi master data, pengguna, role, dan pengaturan sistem.
- **Supervisor:** pemantauan produksi, WIP, QC, dan persetujuan sesuai kewenangan.
- **Operator:** input aktivitas produksi pada divisi yang ditugaskan.
- **Warehouse:** penerimaan, pengeluaran, dan pemantauan persediaan.
- **QC:** pencatatan pemeriksaan, reject, repair, dan keputusan QC.
- **Manager:** dashboard, laporan, dan pemantauan kinerja.

### 1.3 Prinsip Desain

1. **Operational clarity:** status, jumlah, dan tindakan berikutnya harus mudah dipahami.
2. **Consistency:** pola navigasi, form, tabel, dan status harus seragam.
3. **Data integrity:** UI tidak boleh memberi kesan transaksi berhasil sebelum server mengonfirmasi.
4. **Role-based experience:** pengguna hanya melihat fitur dan tindakan yang relevan dengan kewenangannya.
5. **Traceability:** batch, proses, QC, dan pergerakan stok dapat ditelusuri.
6. **Error prevention:** validasi, konfirmasi, dan batasan input membantu mencegah kesalahan.
7. **Efficiency:** input transaksi rutin harus cepat dengan navigasi dan keyboard yang baik.
8. **Responsive usability:** layar tetap dapat digunakan pada desktop, tablet, dan smartphone.

---

## 2. Product Scope dan Konteks

### 2.1 Modul Utama

- Dashboard operasional.
- Master data.
- Persediaan dan mutasi stok.
- Produksi dan batch.
- WIP / Work in Process.
- Quality Control.
- Repair dan reject.
- Barang jadi.
- Traceability.
- Laporan operasional.
- Manajemen pengguna dan hak akses.

### 2.2 Alur Produksi yang Ditampilkan

Alur visual produksi mengikuti proses bisnis yang ditetapkan:

**Batok / bahan awal → Buffing → Basecoat → Decal → Topcoat → QC awal → Poles (jika diperlukan) → Assembly → QC2 → Packing → Finished Goods**

Desain harus mendukung variasi alur yang ditetapkan sistem, termasuk:

- WIP menunggu proses berikutnya.
- QC awal yang menghasilkan status pass, reject, atau repair.
- Reject yang dicatat dengan divisi sumber dan alasan.
- Repair yang dikembalikan ke proses terkait.
- QC2 yang menghasilkan pass atau repair.
- Barang jadi yang telah lolos pemeriksaan dan packing.

UI tidak boleh membuat pengguna menganggap semua batch harus melewati jalur identik jika aturan proses mengizinkan jalur alternatif.

### 2.3 Batasan

- Aplikasi merupakan ERP internal berbasis web.
- Desain tidak mencakup integrasi RFID/IoT.
- Desain tidak mencakup akuntansi penuh, pembelian/penjualan penuh, atau native mobile.
- Perubahan stok harus dilakukan melalui transaksi backend yang tervalidasi.
- UI tidak menghitung atau mengubah stok secara independen dari aturan backend.

---

## 3. Brand Identity dan Design System

### 3.1 Arah Visual

Gunakan gaya **industrial, modern, clean, dan data-oriented**. Antarmuka harus terlihat profesional dan mendukung pekerjaan operasional yang padat, bukan seperti website pemasaran.

Karakter visual:

- Layout dashboard yang rapi dan padat namun mudah dipindai.
- Warna netral untuk area kerja utama.
- Warna status digunakan konsisten dan tidak berlebihan.
- Tabel dan form mengutamakan keterbacaan.
- Hindari dekorasi, animasi, gradient, dan shadow yang tidak membantu pekerjaan.

### 3.2 Color Palette

| Token | Hex | Penggunaan |
|---|---|---|
| Primary | `#1E3A5F` | Navigasi utama, heading, elemen identitas |
| Primary Dark | `#0F1C2E` | Sidebar atau area navigasi gelap |
| Accent | `#2563EB` | CTA utama, link, elemen aktif |
| Accent Hover | `#1D4ED8` | Hover dan active |
| Background | `#F8FAFC` | Latar aplikasi |
| Surface | `#FFFFFF` | Card, tabel, panel, form |
| Border | `#E2E8F0` | Border dan pemisah |
| Text Primary | `#0F172A` | Teks utama |
| Text Secondary | `#64748B` | Label dan teks pendukung |
| Success | `#16A34A` | Selesai, lolos QC, transaksi berhasil |
| Warning | `#D97706` | Menunggu, perhatian, stok menipis |
| Error | `#DC2626` | Reject, error, stok tidak cukup |
| Info | `#0284C7` | Informasi, status proses |
| WIP | `#7C3AED` | Status WIP atau proses berjalan |

Ketentuan:

- Warna status selalu disertai label teks.
- Warna tidak menjadi satu-satunya cara membedakan status.
- Gunakan warna merah hanya untuk error, reject, atau tindakan berisiko.
- Periksa kontras teks dan elemen interaktif.

### 3.3 Typography

Font utama: **Inter**  
Fallback: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

| Elemen | Desktop | Tablet/Mobile | Weight |
|---|---:|---:|---:|
| Page title | 28 px | 22–24 px | 600–700 |
| Section title | 20 px | 18 px | 600 |
| Card title | 16 px | 16 px | 600 |
| Body | 14–16 px | 14–16 px | 400 |
| Label | 13–14 px | 13–14 px | 500 |
| Table data | 13–14 px | 13–14 px | 400 |
| Caption | 12 px | 12 px | 400 |

Aturan tipografi:

- Gunakan hierarki heading yang konsisten.
- Gunakan angka tabular untuk kuantitas, stok, dan nilai.
- Hindari teks panjang pada kolom tabel.
- Tampilkan label field secara eksplisit; placeholder bukan pengganti label.

### 3.4 Spacing, Radius, dan Elevation

Gunakan spacing berbasis kelipatan 4 px:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`

- Padding halaman: 24 px desktop, 16–20 px tablet, 12–16 px mobile.
- Jarak antarsection: 24–32 px.
- Padding card: 16–24 px.
- Radius input/button: 8 px.
- Radius card/panel: 10–12 px.
- Border: 1 px solid `#E2E8F0`.
- Shadow ringan hanya untuk elemen yang perlu terangkat dari layout.

---

## 4. Layout dan Navigasi

### 4.1 App Shell

Struktur utama aplikasi:

1. Sidebar navigasi.
2. Topbar.
3. Breadcrumb.
4. Judul halaman dan aksi utama.
5. Area konten.
6. Notifikasi/toast.
7. Dialog atau drawer untuk tindakan kontekstual.

### 4.2 Sidebar

Menu disusun berdasarkan aktivitas pengguna:

- Dashboard
- Produksi
  - Batch Produksi
  - Input Produksi
  - WIP
  - Repair
- Quality Control
  - QC Awal
  - QC2
  - Riwayat QC
- Persediaan
  - Stok
  - Mutasi Stok
  - Gudang
- Barang Jadi
  - Packing
  - Finished Goods
- Traceability
- Laporan
- Master Data
- Pengguna & Hak Akses
- Pengaturan

Ketentuan:

- Menu dan submenu mengikuti permission.
- Menu aktif memiliki indikator visual yang jelas.
- Sidebar dapat collapse pada desktop.
- Pada layar kecil, sidebar menjadi drawer.
- Jangan menampilkan menu yang tidak dapat diakses pengguna.

### 4.3 Topbar

Memuat:

- Tombol buka/tutup sidebar.
- Breadcrumb atau konteks halaman.
- Notifikasi bila fitur tersedia.
- Nama pengguna dan menu akun.
- Indikator lingkungan bila bukan produksi, misalnya staging.

### 4.4 Page Header

Setiap halaman operasional memiliki:

- Judul halaman.
- Deskripsi singkat opsional.
- Breadcrumb.
- Aksi utama di kanan atau pada area yang mudah dijangkau.
- Filter global hanya jika relevan dengan halaman tersebut.

---

## 5. Struktur Halaman

### 5.1 Dashboard

Dashboard menampilkan ringkasan operasional sesuai role.

Komponen yang direkomendasikan:

- KPI produksi hari ini.
- Jumlah batch aktif.
- WIP per proses/divisi.
- Jumlah hasil QC pass, reject, dan repair.
- Stok kritis atau stok menipis.
- Barang jadi yang tersedia.
- Aktivitas terbaru.
- Peringatan atau tugas yang membutuhkan tindakan.

Ketentuan:

- Data harus memiliki periode atau tanggal yang jelas.
- KPI dapat diklik menuju daftar data terkait jika tersedia.
- Jangan menampilkan angka dummy pada lingkungan produksi.
- Dashboard Manager berbeda dari dashboard Operator jika kebutuhan informasinya berbeda.

### 5.2 Master Data

Halaman master data menggunakan pola tabel dan form standar.

Fitur:

- Pencarian.
- Filter status atau kategori.
- Pagination.
- Tambah dan edit data sesuai permission.
- Detail data.
- Status aktif/nonaktif jika berlaku.

Master data dapat mencakup produk/variant, divisi/proses, gudang, item, alasan reject/repair, dan data pendukung lain sesuai PRD.

### 5.3 Persediaan

Halaman stok menampilkan:

- Item dan varian.
- Gudang.
- Kuantitas tersedia.
- Kuantitas reserved jika digunakan.
- Satuan.
- Status stok.
- Waktu pembaruan.

Halaman mutasi menampilkan ledger transaksi:

- Tanggal.
- Nomor transaksi.
- Item.
- Gudang.
- Jenis mutasi.
- Qty masuk.
- Qty keluar.
- Referensi sumber.
- Pengguna.

UI harus membedakan stok saat ini dari riwayat mutasi. Riwayat transaksi tidak boleh diedit langsung; koreksi dilakukan melalui transaksi koreksi yang sah.

### 5.4 Produksi dan Batch

Halaman batch memuat:

- Nomor batch.
- Produk/varian.
- Jumlah rencana bila tersedia.
- Jumlah aktual.
- Tahap/status batch.
- Tanggal mulai.
- PIC atau divisi terkait.
- Aksi melihat detail dan traceability.

Detail batch menampilkan:

- Ringkasan batch.
- Timeline proses.
- Pergerakan WIP.
- Hasil produksi.
- QC.
- Reject/repair.
- Riwayat pengguna dan perubahan.

### 5.5 Input Produksi

Form input produksi harus disesuaikan dengan proses/divisi.

Ketentuan:

- Pilih batch atau sumber WIP yang valid.
- Tampilkan sisa kuantitas yang dapat diproses.
- Qty input tidak boleh melebihi batas valid.
- Tampilkan hasil, reject, dan repair sebagai field terpisah bila aturan proses memerlukannya.
- Validasi dilakukan server-side.
- Setelah berhasil, tampilkan nomor transaksi dan status hasil.
- Hindari pengiriman ulang transaksi saat pengguna menekan tombol berulang.

### 5.6 WIP

Halaman WIP berfungsi sebagai pusat pemantauan barang dalam proses.

Tampilkan:

- Batch.
- Produk/varian.
- Proses/divisi saat ini.
- Qty WIP.
- Status menunggu, sedang diproses, atau tertahan.
- Waktu terakhir diperbarui.
- Aksi transfer/proses berikutnya sesuai permission.

WIP dapat disajikan dalam:

- Tabel untuk pencarian dan transaksi.
- Board per proses untuk pemantauan visual.
- Ringkasan jumlah per proses.

Board tidak boleh menggantikan ledger atau menjadi sumber stok alternatif.

### 5.7 Quality Control

Halaman QC menampilkan daftar batch atau item yang menunggu pemeriksaan.

Form QC:

- Batch dan proses terkait.
- Kuantitas diperiksa.
- Kuantitas pass.
- Kuantitas reject.
- Kuantitas repair jika berlaku.
- Kategori/cacat.
- Alasan atau catatan.
- Divisi sumber reject jika dibutuhkan aturan QC.
- Keputusan QC.
- Pengguna dan waktu pemeriksaan.

Keputusan QC harus jelas dan memerlukan konfirmasi sebelum transaksi disimpan jika berdampak pada alur produksi.

### 5.8 Repair dan Reject

Tampilkan:

- Referensi batch.
- Jumlah.
- Divisi sumber masalah.
- Proses repair yang dituju.
- Alasan.
- Status repair.
- Riwayat percobaan dan keputusan QC.

Reject dan repair tidak boleh digabung menjadi satu status ambigu. UI harus memperlihatkan apakah unit sedang menunggu repair, sedang repair, selesai repair, atau ditetapkan reject.

### 5.9 Packing dan Finished Goods

Halaman packing menampilkan unit yang telah memenuhi syarat proses sebelumnya.

Komponen:

- Batch.
- Produk/variant.
- Ukuran bila ditentukan pada tahap assembly.
- Qty siap packing.
- Qty packed.
- Status QC2.
- Kode/identitas barang jadi.
- QR code bila fitur tersebut diaktifkan sesuai PRD.

Finished Goods menampilkan stok barang jadi berdasarkan item, varian, ukuran, batch, dan lokasi yang relevan.

### 5.10 Traceability

Halaman traceability memungkinkan pengguna mencari batch atau kode barang dan melihat:

- Asal batch.
- Item/produk/varian.
- Tahapan proses.
- Transaksi produksi.
- Mutasi stok/WIP.
- QC dan reject/repair.
- Packing dan barang jadi.
- Waktu dan pengguna yang melakukan aktivitas.

Tampilan timeline harus menggunakan data transaksi yang tersimpan, bukan status buatan frontend.

### 5.11 Laporan

Laporan dapat mencakup:

- Produksi per periode.
- Produksi per divisi.
- WIP per proses.
- Reject dan repair.
- Stok dan mutasi.
- Barang jadi.
- Traceability.

Fitur:

- Filter periode, batch, produk, divisi, gudang, dan status sesuai laporan.
- Ringkasan dan tabel detail.
- Ekspor Excel/PDF jika disediakan.
- Periode filter ditampilkan pada hasil.
- Ekspor mengikuti filter dan permission yang sama.

---

## 6. Komponen UI

### 6.1 Buttons

| Variant | Penggunaan |
|---|---|
| Primary | Aksi utama seperti simpan atau buat transaksi |
| Secondary | Aksi alternatif |
| Outline | Aksi ringan pada tabel atau toolbar |
| Ghost | Aksi sekunder tanpa container |
| Destructive | Pembatalan atau tindakan berisiko yang memang diizinkan |

Ketentuan:

- Tinggi minimum 40–44 px.
- Loading state saat request berjalan.
- Disabled state harus terlihat.
- Tampilkan label aksi yang jelas.
- Jangan menggunakan tombol untuk navigasi halaman; gunakan link.

### 6.2 Cards

- Digunakan untuk KPI, ringkasan, atau kelompok informasi.
- Hindari membungkus semua bagian halaman dalam card.
- Card interaktif memiliki hover/focus state.
- Card tidak menjadi clickable jika mengandung kontrol lain tanpa pola interaksi yang jelas.

### 6.3 Tables

Tabel merupakan komponen utama aplikasi operasional.

Fitur standar:

- Header kolom konsisten.
- Sorting jika relevan.
- Search dan filter.
- Pagination.
- Empty state.
- Loading state.
- Error state.
- Row action menu.
- Pilihan kolom bila diperlukan.
- Responsive behavior yang sesuai.

Ketentuan:

- Kuantitas dan angka rata kanan.
- Status menggunakan badge berlabel.
- Kolom penting tidak disembunyikan tanpa alasan.
- Tindakan berisiko tidak langsung dilakukan dari row tanpa konfirmasi.
- Tabel panjang menggunakan pagination atau virtualisasi jika diperlukan.

### 6.4 Forms

- Label berada di atas field.
- Field wajib ditandai.
- Validasi tampil dekat field.
- Pesan error menjelaskan cara memperbaiki.
- Input kuantitas memiliki satuan dan batas yang jelas.
- Select menampilkan nama yang mudah dikenali, bukan hanya ID.
- Form kompleks dikelompokkan per bagian.
- Pertahankan nilai input ketika validasi gagal jika memungkinkan.

### 6.5 Status Badge

Status utama:

- Draft.
- Menunggu.
- Sedang diproses.
- WIP.
- Lolos.
- Repair.
- Reject.
- Selesai.
- Dibatalkan.

Gunakan label yang sesuai dengan terminologi bisnis dan backend. Jangan memetakan status yang berbeda ke satu label generik.

### 6.6 Dialog dan Drawer

Gunakan dialog untuk:

- Konfirmasi tindakan berisiko.
- Input singkat.
- Detail ringkas.

Gunakan halaman penuh untuk:

- Form produksi kompleks.
- Detail batch.
- QC dengan banyak field.
- Traceability.

Dialog harus dapat dioperasikan dengan keyboard, menjaga fokus, dan memiliki tombol batal/konfirmasi yang jelas.

### 6.7 Toast dan Notifications

- Berhasil: jelaskan transaksi yang berhasil.
- Gagal: jelaskan masalah secara ringkas.
- Validasi: tampilkan pada field.
- Error server: jangan tampilkan stack trace.
- Hindari toast sebagai satu-satunya tempat untuk menampilkan informasi penting yang perlu ditindaklanjuti.

---

## 7. Interaction dan State

### 7.1 Loading

Gunakan skeleton atau indikator loading pada:

- Dashboard.
- Tabel.
- Detail batch.
- Laporan.

Hindari layar kosong tanpa penjelasan.

### 7.2 Empty State

Empty state harus menjelaskan:

- Tidak ada data.
- Filter yang sedang aktif jika ada.
- Aksi berikutnya, misalnya membuat batch atau menghapus filter, sesuai permission.

### 7.3 Error State

- Tampilkan pesan yang dapat dipahami.
- Sediakan aksi coba lagi jika aman.
- Jangan mengulang transaksi secara otomatis jika hasil request tidak pasti.
- Jika terjadi konflik stok atau status, minta pengguna memuat ulang data sebelum melanjutkan.

### 7.4 Confirmation

Konfirmasi diperlukan untuk tindakan yang berdampak pada:

- Stok.
- WIP.
- QC.
- Reject/repair.
- Penutupan batch.
- Pembatalan transaksi.

Dialog menyebutkan dampak tindakan secara spesifik.

### 7.5 Optimistic UI

Jangan menerapkan optimistic update untuk transaksi yang memengaruhi stok, WIP, batch, QC, atau barang jadi kecuali mekanisme rekonsiliasi yang aman telah dirancang. UI menunggu konfirmasi backend untuk menampilkan transaksi sebagai berhasil.

---

## 8. Responsive Design

### 8.1 Breakpoints

| Breakpoint | Lebar | Target |
|---|---:|---|
| Mobile | `< 640px` | Smartphone |
| Tablet | `640–1023px` | Tablet |
| Desktop | `≥ 1024px` | Laptop dan desktop |

### 8.2 Aturan Responsif

- Desktop menjadi target utama untuk transaksi kompleks dan laporan.
- Tablet dioptimalkan untuk operator dan supervisor di area produksi.
- Mobile mendukung pemantauan dan input sederhana yang memang diperlukan.
- Sidebar menjadi drawer pada layar kecil.
- Tabel dapat beralih ke horizontal scroll terkontrol atau tampilan card.
- Form satu kolom pada layar kecil.
- Tombol utama mudah dijangkau.
- Tidak boleh terjadi horizontal overflow pada layout utama.
- Jangan menyembunyikan informasi penting hanya untuk menyesuaikan layar.

---

## 9. Accessibility

Target: WCAG 2.2 Level AA sejauh sesuai dengan aplikasi internal.

Persyaratan:

- Elemen semantik dan label yang tepat.
- Semua kontrol dapat diakses menggunakan keyboard.
- Focus indicator terlihat.
- Kontras teks memadai.
- Status tidak hanya dibedakan dengan warna.
- Field form memiliki label.
- Error dikaitkan dengan field terkait.
- Tabel memiliki header yang benar.
- Dialog memiliki fokus dan mekanisme penutupan yang sesuai.
- Target interaksi memiliki ukuran dan jarak yang memadai.

---

## 10. Performance

### 10.1 Prinsip

- Hindari memuat seluruh data transaksi sekaligus.
- Gunakan pagination server-side untuk tabel besar.
- Gunakan filter dan pencarian server-side jika volume data besar.
- Muat modul dan halaman secara lazy bila sesuai.
- Hindari dependensi frontend yang tidak diperlukan.
- Gunakan skeleton untuk menjaga persepsi responsif.
- Cache hanya data yang aman dan tidak menimbulkan stale data transaksi.

### 10.2 Target

| Metrik | Target |
|---|---|
| Navigasi halaman umum | Responsif pada jaringan internal yang normal |
| Tabel besar | Pagination server-side |
| Form transaksi | Mencegah submit ganda |
| UI | Tidak ada blocking error |
| Bundle | Tidak memuat modul yang tidak digunakan |

Target performa harus divalidasi pada data dan lingkungan deployment yang nyata.

---

## 11. Security dan Data Integrity pada UI

- Menu dan tombol mengikuti permission.
- Backend tetap menjadi sumber otorisasi utama.
- Jangan menyimpan secret di frontend.
- Jangan menganggap data tersembunyi berarti aman.
- Semua transaksi divalidasi di server.
- UI menampilkan konflik stok/status tanpa mencoba melewati aturan.
- Form transaksi memiliki idempotency atau mekanisme pencegahan submit ganda jika didukung backend.
- Riwayat transaksi ditampilkan read-only.
- Perubahan atau koreksi dilakukan melalui proses yang ditetapkan sistem.
- Log aktivitas ditampilkan hanya kepada role yang berwenang.

---

## 12. Struktur Frontend

Struktur implementasi mengikuti Laravel Vue Starter Kit + Inertia + Vue 3 + TypeScript yang ditetapkan PRD.

Contoh struktur:

```text
resources/
  js/
    app.ts
    layouts/
      AppLayout.vue
      AuthLayout.vue
    components/
      ui/
      data-table/
      forms/
      status/
      dialogs/
    pages/
      Dashboard/
      MasterData/
      Inventory/
      Production/
      WIP/
      QualityControl/
      Repair/
      FinishedGoods/
      Traceability/
      Reports/
      Users/
    composables/
    types/
    lib/
    routes/
  css/
    app.css
```

Ketentuan:

- Pisahkan komponen UI reusable dari komponen khusus domain.
- Gunakan TypeScript untuk tipe data dan props.
- Gunakan shared components untuk tabel, form, badge, dialog, dan layout.
- Hindari duplikasi pola UI antar modul.
- Jangan menempatkan aturan stok atau produksi pada komponen visual.
- Gunakan design tokens untuk warna, spacing, typography, dan radius.

---

## 13. Design Tokens

Contoh CSS custom properties:

```css
:root {
  --color-primary: #1e3a5f;
  --color-primary-dark: #0f1c2e;
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;

  --color-background: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;

  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;

  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #0284c7;
  --color-wip: #7c3aed;

  --font-sans: Inter, system-ui, sans-serif;
  --container-max: 1600px;

  --radius-input: 8px;
  --radius-card: 12px;
  --radius-panel: 16px;

  --transition-default: 150ms ease;
}
```

Tokens menjadi sumber utama agar penyesuaian desain dapat dilakukan secara konsisten.

---

## 14. Testing dan Quality Assurance

### 14.1 Functional UI Testing

- Navigasi sesuai role.
- CRUD master data sesuai permission.
- Input produksi dan mutasi berjalan.
- Validasi jumlah dan status ditampilkan.
- QC, reject, dan repair memiliki alur yang jelas.
- Detail batch dan traceability menampilkan riwayat.
- Form mencegah submit ganda.
- Error server ditangani dengan benar.

### 14.2 Responsive Testing

Uji pada:

- Smartphone kecil.
- Smartphone modern.
- Tablet.
- Laptop.
- Desktop.

### 14.3 Accessibility Testing

- Navigasi keyboard.
- Focus indicator.
- Kontras.
- Label dan error form.
- Dialog.
- Tabel.

### 14.4 Data Integrity UI Testing

- UI tidak menampilkan transaksi berhasil sebelum backend mengonfirmasi.
- Stok tidak berubah secara lokal ketika transaksi gagal.
- Konflik stok atau WIP ditampilkan sebagai error.
- Data setelah transaksi dimuat ulang dari sumber backend.
- Role yang tidak berwenang tidak dapat memicu aksi melalui UI.

---

## 15. Acceptance Criteria

- [ ] App shell, sidebar, topbar, dan breadcrumb konsisten.
- [ ] Semua modul menggunakan design system yang sama.
- [ ] Halaman operasional memiliki loading, empty, error, dan success state.
- [ ] Tabel mendukung pencarian/filter/pagination sesuai kebutuhan.
- [ ] Form memiliki label dan validasi yang jelas.
- [ ] Status produksi, WIP, QC, repair, reject, dan barang jadi dibedakan dengan benar.
- [ ] UI mengikuti permission pengguna.
- [ ] Layout responsif tanpa overflow yang tidak disengaja.
- [ ] Transaksi stok dan produksi menunggu konfirmasi backend.
- [ ] Traceability dapat diakses dari batch atau kode barang.
- [ ] Tidak ada data dummy pada environment produksi.
- [ ] Tidak ada error kritis di browser console.
- [ ] Pengujian utama terdokumentasi.

---

## 16. Implementation Roadmap

### Tahap 1 — Foundation

- Implementasikan app shell.
- Terapkan design tokens.
- Buat komponen dasar: button, input, select, badge, card, table, dialog, toast.
- Implementasikan auth layout dan navigasi berbasis role.

### Tahap 2 — Master Data dan Persediaan

- Buat pola tabel dan form master data.
- Implementasikan halaman stok dan ledger mutasi.
- Terapkan filter, pagination, dan empty/error states.

### Tahap 3 — Produksi dan WIP

- Implementasikan daftar batch dan detail batch.
- Buat input produksi.
- Buat tampilan WIP tabel dan board.
- Tampilkan timeline proses.

### Tahap 4 — QC, Repair, dan Finished Goods

- Implementasikan QC awal dan QC2.
- Buat alur reject dan repair.
- Implementasikan packing dan finished goods.
- Hubungkan halaman ke backend sesuai aturan transaksi.

### Tahap 5 — Traceability dan Laporan

- Implementasikan pencarian batch/kode.
- Buat timeline traceability.
- Implementasikan laporan dan ekspor sesuai kebutuhan.

### Tahap 6 — QA dan Release

- Jalankan pengujian fungsional dan responsive.
- Uji permission.
- Uji konflik stok/status.
- Perbaiki error kritis.
- Deploy ke staging untuk UAT.
- Rilis produksi setelah persetujuan.

---

## 17. Keputusan yang Harus Ditetapkan

Hal yang memerlukan keputusan bisnis/implementasi:

1. Logo dan identitas visual final.
2. Nama menu final sesuai terminologi operasional.
3. KPI yang ditampilkan untuk setiap role.
4. Apakah WIP menggunakan board, tabel, atau keduanya.
5. Kolom dan filter final pada laporan.
6. Kebutuhan QR pada barang jadi dan halaman cetak.
7. Perangkat utama operator: desktop, tablet, atau keduanya.
8. Apakah dashboard menggunakan refresh berkala atau data real-time.
9. Kebijakan ekspor laporan.
10. Alur approval yang benar-benar diperlukan.

---

**Dokumen ini menjadi acuan desain UI/UX dan implementasi frontend Helmet ERP.** Seluruh komponen dan interaksi harus mendukung proses bisnis yang ditetapkan PRD, menjaga integritas data, dan memudahkan pekerjaan operasional.
