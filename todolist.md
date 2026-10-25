# Todolist — Audit dan Refactor ERP Produksi RSV

> Status terbaru: pengguna secara eksplisit menyetujui reset dan seed ulang hanya untuk database Docker lokal `express_api`; seluruh 50 migration telah diterapkan dan seed WIP per divisi berhasil diverifikasi. Database produksi tidak diubah atau diverifikasi.
> Batas keselamatan: jangan mengarahkan reset ke target selain container API `backend-api-1` yang terhubung ke service DB Docker lokal `db` dan database `express_api`. Saldo pembuka legacy dan cutover produksi tetap belum disetujui.
> Jangan menggabungkan fitur RFID/IoT.

## 0. Kondisi Awal yang Sudah Diketahui

- [x] `prisma/schema.prisma` lolos `npx prisma validate`.
- [x] Sudah ada model perencanaan/realisasi: `ProductionOrder`, `ProductionRealization`, `ProductionRealizationStage`, dan `ProductionCapacity`.
- [x] Sudah ada pencatatan item/stok: `Item`, `StokItemMutasi`, `StokOpnameSesi`, `PermintaanBarang`, dan `PemakaianMaterial`.
- [x] Sudah ada pencatatan WIP/transaksi produksi: `WipTransfer`, `WipTransferItem`, `WipTransferAlokasi`, `HasilProduksiHarian`, `HasilProduksiHarianItem`, dan `HasilProduksiPemakaian`.
- [x] `Barang` merepresentasikan unit helm dengan varian, status, dan lokasi gudang; riwayat status dan mutasi gudang sudah tersedia.
- [x] Audit statis API, hak akses, proses transaksi, serta UI selesai; hasilnya dicatat di bagian 1.
- [x] Database Docker lokal dapat diverifikasi; 50 migration berstatus up to date setelah reset dan seed ulang yang disetujui pengguna.
- [x] Rancangan konseptual disetujui sebagai dasar verifikasi database dan perencanaan.
- [x] Pengguna memberi persetujuan untuk implementasi kode/schema/API/UI dan pembuatan migration aditif, dengan larangan menjalankan migration/mengubah database tanpa persetujuan cutover terpisah.

## 1. Audit Sistem yang Berjalan

- [x] Petakan model Prisma dan 50 migration yang relevan dengan produksi, stok, WIP, QC, repair, Finish Good, dan pengiriman.
- [x] Periksa urutan migration dan validitas schema secara statis (`npx prisma validate` lulus).
- [x] Periksa status migration database Docker lokal: dari container API, `npx prisma migrate status` menyatakan 50 migration ditemukan dan database `express_api` up to date. Hasil ini bukan verifikasi database produksi.
- [x] Identifikasi relasi yang tumpang tindih atau berpotensi menggandakan sumber kebenaran, khususnya:
  - [x] `ProductionRealization` / `ProductionRealizationStage` dibandingkan dengan `HasilProduksiHarian`.
  - [x] `StokItemMutasi` dibandingkan dengan saldo `PemakaianMaterialItem.jumlahSisa`.
  - [x] Transfer WIP dan pengeluaran/penerimaan WIP dalam transaksi produksi.
  - [x] Status/lokasi saat ini dibandingkan dengan catatan riwayat barang.
- [x] Tetapkan perilaku aktual stok item gudang, WIP per divisi, dan unit helm individual.
- [x] Petakan route, controller, model, validasi, transaksi database, idempotensi, dan otorisasi backend.
- [x] Petakan halaman frontend, pemanggil API, pengguna/role, serta laporan yang terdampak.
- [x] Cari fitur QC Akhir, repair, Finish Good, dan pengiriman yang sudah ada; cakupannya dicatat di bawah.
- [x] Catat model yang dipertahankan, diperluas, berpotensi diganti, maupun yang belum boleh dihentikan tanpa bukti penggunaan.

### Hasil audit statis

#### Model dan sumber kebenaran saat ini

| Area | Implementasi yang ditemukan | Penilaian awal |
| --- | --- | --- |
| Master | `Item`, `ProductVariant`, `Barang`, `Divisi`, `Gudang`, `ProductionBatch`, `Role`/`Permission` | Pertahankan sebagai master yang ada; `Item` untuk material/WIP kuantitas dan `Barang` untuk helm individual. |
| Rencana | `ProductionOrder`, `ProductionOrderItem`, `ProductionCapacity`, `ProductionScheduleTargetEdit`, `ProductionScheduleAllocEdit` | Pertahankan untuk target, kapasitas, dan jadwal; bukan bukti realisasi fisik. |
| Realisasi terjadwal | `ProductionRealization` per order/variant/hari dan `ProductionRealizationStage` per order/tahap/hari | Aktif dipakai halaman Realisasi Produksi. Dapat tumpang tindih dalam laporan aktual dengan transaksi produksi divisi; perlu tetapkan mana yang resmi untuk KPI produksi. Data dapat disimpan ulang per hari dengan mengganti baris hari tersebut. |
| Transaksi proses | `HasilProduksiHarian` dan `HasilProduksiHarianItem` merekam `MASUK`, `KELUAR`, `HASIL`; `HasilProduksiPemakaian` menghubungkan konsumsi dengan lot WIP | Pertahankan sebagai jalur transaksi proses divisi. Hasil non-SM dicatat ke ledger stok; hasil item jenis SM diarahkan menjadi WIP divisi. |
| Stok item gudang | `StokItemMutasi`; saldo dihitung `SUM(MASUK) - SUM(KELUAR)`. Approval permintaan, opname, dan hasil produksi dapat membuat mutasi | Sumber saldo gudang yang paling eksplisit. `StokOpnameSesi` menyimpan hitung fisik dan menyeimbangkan selisih melalui mutasi dalam transaksi. |
| WIP divisi | `PemakaianMaterialItem` menyimpan `jumlahDiterima`, `jumlahDipakai`, `jumlahSisa`; produksi merekam konsumsi melalui `HasilProduksiPemakaian`; transfer memakai `WipTransferAlokasi` dan penerimaan lot di divisi tujuan | Saldo WIP dihitung dari dokumen/lokasi, konsumsi, dan alokasi; bukan ledger mutasi append-only tunggal. `jumlahSisa` juga diperbarui sebagai saldo berjalan. Perlu satu aturan rekonsiliasi yang eksplisit sebelum memperluas. |
| Helm individual/lokasi | `Barang` memegang status dan `gudangId`; `RiwayatBarang` merekam perubahan status; `RiwayatMutasiGudang` merekam perpindahan gudang | Pertahankan riwayat yang ada. Schema tidak menunjukkan lokasi fisik divisi untuk unit `Barang`; mutasi gudang tidak menggantikan alur transfer antar-divisi. |
| QC, repair, pengiriman | Tidak ditemukan model transaksi khusus pemeriksaan/defect, tugas/siklus repair, atau shipment. `qc` ada sebagai tahap jadwal/realisasi agregat dan role frontend; status barang bersifat generik/dinamis. | Kapabilitas belum terbukti cukup untuk keputusan QC akhir, atribusi asal cacat, repair berulang, dan bukti pengiriman. Jangan menambah model pengganti sebelum proses bisnis dikonfirmasi. |
| Finish Good | Status `FINISHGOOD` dan query/view agregat sudah ada. Rekap produksi mengambil jumlah barang yang saat ini berstatus `FINISHGOOD`, dikelompokkan berdasarkan tanggal `Barang` dan varian. | Bukan bukti terpisah mengenai kapan QC meloloskan, kapan barang diterima fisik ke gudang FG, atau kapan barang dikirim. Pertahankan endpoint kompatibilitas sambil menentukan sumber fakta yang benar. |

Tidak ada model yang dinyatakan aman untuk dihapus sebagai “tidak digunakan” pada tahap audit ini. Perubahan `DROP` historis memang ada di migration lama, termasuk penggantian `BarangCounter`; jangan mengulang pola destruktif untuk refactor ini. Migration baru di worktree untuk hasil produksi/WIP perlu ikut ditinjau dan diverifikasi terhadap database setelah koneksi tersedia.

#### Route, otorisasi, dan permukaan UI/API

- `/api/production-orders`: CRUD order, item order, kapasitas, jadwal, dan realisasi; route dibatasi `adminOnly`.
- `/api/hasil-produksi-harian`: input transaksi, riwayat, rekap, ringkasan WIP, dan ledger WIP harian; create memerlukan `KELOLA_ITEM` dan scope divisi.
- `/api/wip-transfer`: opsi, list/detail, buat, approval, hapus; route memerlukan autentikasi/otorisasi dan model memvalidasi scope divisi, approval, saldo, serta transaksi atomik.
- `/api/permintaan-barang`, `/api/pemakaian-material`, `/api/stok-opname`, `/api/items`, `/api/mutasi-gudang`, dan `/api/barang` membentuk permintaan/penerimaan, ledger item, opname, status helm, dan perpindahan gudang. Permintaan publik dapat dibuat tanpa login; approval dan pengubahan stok memakai permission/admin sesuai route.
- Halaman/konsumen yang terkait saat ini: perencanaan/SPK dan `/admin/realisasi-produksi`; `/admin/hasil-produksi-divisi`; halaman pemakaian material, stok item/opname/produksi, daftar barang, gudang dan riwayat mutasi; `/divisi/produksi`, `/divisi/transfer-wip`, `/divisi/home`; serta form permintaan publik.
- Role `qc` tersedia pada routing/layout dan QC muncul pada jadwal/SPK, tetapi pencarian route/schema/frontend tidak menemukan antrean/form QC akhir atau workflow repair khusus. Otorisasi perubahan status barang memakai permission generik `BARANG_UBAH_STATUS`; belum membuktikan kewenangan keputusan QC final secara khusus.
- Tes yang sudah ada mencakup production order/schedule, permintaan/approval, stok item/opname, hasil produksi harian, WIP dan transfer. Belum ditemukan tes untuk keputusan QC akhir, siklus repair, penerimaan Finish Good berbasis QC, atau pengiriman.

#### Batas audit

- Temuan di atas berasal dari schema, migration, source, route, consumer, dan tes di worktree saat ini; banyak file backend/frontend sedang memiliki perubahan lokal, sehingga audit menggambarkan versi lokal tersebut, bukan hanya commit terakhir.
- `npx prisma validate` berhasil. Setelah pengguna menyetujui reset target Docker lokal `express_api`, seluruh 50 migration diterapkan dan seed selesai; database produksi tidak disentuh.
- Audit repository dan profil database lokal selesai secara read-only; database produksi/cutover belum dapat diidentifikasi atau diverifikasi.

#### Verifikasi read-only database Docker lokal

Service DB lokal terdeteksi sehat. Query berikut hanya `SELECT` agregat; hasil ini adalah snapshot `express_api` lokal, bukan klaim tentang database produksi:

- `StokItemMutasi`: 418 baris untuk 172 item; 365 baris tidak memiliki referensi permintaan/opname/hasil produksi. Model mutasi tidak menyimpan lokasi gudang.
- `PemakaianMaterialItem`: 103 lot, semuanya memiliki `itemId`. Setiap lot memenuhi `jumlahSisa = jumlahDiterima - jumlahDipakai` hingga presisi 6 desimal. Ada 6 alokasi transfer WIP. Ini memvalidasi aritmetika record, bukan hitung fisik.
- Produksi: 28 header dan 59 detail `HasilProduksiHarian`; `ProductionRealization` dan `ProductionRealizationStage` masing-masing 0 baris; ada 1 `ProductionOrder`.
- Gudang: tidak ada baris `Gudang` (0 total/aktif).
- Helm individual: 5.010 baris `Barang`; semuanya berstatus `FINISHGOOD` dan `gudangId`-nya `NULL`. Data ini tidak membuktikan semuanya telah melewati QC Akhir, berada di satu gudang, atau masih tersedia untuk dikirim.

Temuan gudang/barang menghalangi penetapan saldo pembuka FG dan pemetaan stok lama ke lokasi. Jangan otomatis membuat gudang, mengisi `gudangId`, mengubah keputusan QC, atau memasukkan semua unit ke saldo tersedia hanya dari status `FINISHGOOD`.

## 2. Rancangan Target dan Persetujuan

- [x] Susun usulan sumber kebenaran saldo untuk material gudang, WIP divisi, helm individual, Finish Good, dan pengiriman.
- [x] Definisikan pemisahan fakta perencanaan, realisasi proses, perpindahan fisik, dan keputusan kualitas.
- [x] Rancang alur konseptual transaksi input-output produksi, konsumsi aktual, hasil, sisa WIP, dan jejak asal input.
- [x] Rancang lifecycle konseptual QC Akhir, defect, atribusi asal, repair, repair ulang, dan pemeriksaan ulang.
- [x] Rancang pemisahan lokasi fisik, tahap, kualitas, status repair, dan pengiriman.
- [x] Rancang penerimaan Finish Good dan pengiriman dengan pemakaian model/perpindahan barang yang telah ada.
- [x] Susun ERD konseptual, lifecycle, dan aturan rekonsiliasi untuk persetujuan.
- [x] Catat keputusan pemilik proses untuk unit tracking, KPI aktual, ledger stok, jalur FG/pengiriman, dan kewenangan QC.
- [x] Sajikan audit, ERD/rancangan, dampak API/frontend, dan risiko kepada pengguna.
- [x] Pengguna menyetujui rancangan konseptual v0 sebagai dasar verifikasi database dan penyusunan rencana migrasi.
- [x] Verifikasi status migration dan profil agregat database Docker lokal secara read-only.
- [ ] Verifikasi database yang benar untuk cutover; susun rencana backfill/rekonsiliasi/rollback spesifik setelah keputusan lokasi dan saldo legacy tersedia.
- [x] Sajikan rancangan teknis dan dapatkan persetujuan implementasi kode/schema/API/UI serta pembuatan migration aditif; cutover/migration tetap memerlukan persetujuan terpisah.

### Usulan rancangan target v0 — disetujui sebagai dasar langkah berikutnya

#### Batas desain

- `Item` tetap mewakili material/WIP kuantitas; `Barang` tetap mewakili satu helm individual; `ProductVariant` tetap identitas varian.
- Model rencana, master, permintaan, BOM, serta riwayat lama dipertahankan. BOM hanya acuan kebutuhan, bukan transaksi konsumsi.
- Pengguna menyetujui: WIP tetap berupa lot sampai lolos QC Akhir lalu dikonversi menjadi unit `Barang`; jurnal `HasilProduksiHarian` menjadi sumber fakta fisik/KPI; ledger lokasi terpadu untuk gudang dan divisi; workflow shipment aplikasi untuk pengiriman ke pelanggan; role `qc` berwenang menetapkan asal cacat/reject final dan membuka ulang reject dengan alasan serta jejak audit.
- Pengguna mengonfirmasi Docker lokal `express_api` sebagai database sumber untuk perencanaan cutover, memilih menahan 5.010 helm legacy sebagai belum tersedia sampai lokasi/QC/hitung fisik diverifikasi, dan meminta workflow shipment aplikasi untuk pengiriman ke pelanggan.
- Pengguna memilih master gudang ditentukan setelah inventarisasi fisik, serta mengizinkan QC membuka ulang reject final dengan alasan dan jejak audit.
- Pengguna menyetujui reset database Docker lokal `express_api` dan seed ulang; persetujuan ini tidak mencakup database produksi atau saldo pembuka/cutover produksi.
- Shipment menyimpan snapshot nama/alamat penerima tanpa master customer baru; pengiriman parsial diizinkan; shipment hanya dapat dibatalkan saat draft sebelum stok diposting; retur dicatat sebagai penerimaan terpisah yang merujuk shipment asal.
- Repair dikerjakan role `produksi` dengan permission repair dan scope divisi; QC menyetujui hasil dan tetap memegang keputusan kualitas.
- Persetujuan implementasi kode/schema/API/UI dan pembuatan migration aditif sudah diberikan. Persetujuan tersebut tidak mencakup menjalankan migration, mengubah database, atau cutover.
- Rancangan ini konseptual, bukan keputusan schema/migrasi final. Nama model/field dan backfill baru ditetapkan setelah database aktual diverifikasi.

#### Sumber kebenaran per fakta

| Fakta | Sumber yang diusulkan | Aturan |
| --- | --- | --- |
| Rencana, kapasitas, jadwal | `ProductionOrder`, item, kapasitas, dan schedule edits yang sudah ada | Target tidak menambah atau mengurangi stok dan tidak dianggap hasil aktual. |
| Produksi fisik per divisi | `HasilProduksiHarian` sebagai jurnal transaksi proses yang dikembangkan | Setiap posting mencatat tahap, waktu, divisi, petugas, konsumsi input aktual, output aktual per jenis, dan referensi order/transaksi sumber bila ada. Tidak boleh diposting dua kali; koreksi lewat transaksi pembalik. |
| KPI realisasi order/tahap | Proyeksi/rekap dari jurnal `HasilProduksiHarian` setelah mapping disetujui; endpoint lama dipertahankan sebagai adapter kompatibilitas | Sumber KPI ini telah dipilih pengguna. `ProductionRealization` dan `ProductionRealizationStage` tidak menjadi jurnal stok kedua. Penulisan manual/overwrite lama perlu dibekukan atau dipetakan setelah persetujuan dan backfill. |
| Stok material di gudang | `StokItemMutasi` tetap dipertahankan sebagai histori lama; target memakai gerakan bertanggal, lokasi, kuantitas, referensi sumber, serta koreksi append-only | Strategi ledger lokasi terpadu dipilih pengguna. Mutasi lama tidak menyimpan lokasi dan 365/418 baris lokal tanpa referensi sumber; jangan menebak lokasi historis. Gunakan saldo pembuka per item/lokasi pada tanggal cutover setelah master gudang dan hitung fisik tersedia. |
| WIP per divisi | Ledger lokasi terpadu append-only dengan lokasi divisi dan referensi transaksi/lot; dokumen `PemakaianMaterialItem`, `HasilProduksiPemakaian`, serta alokasi transfer tetap menjadi bukti asal/alokasi | Strategi ledger terpadu dipilih pengguna. `jumlahSisa` tidak menjadi sumber kebenaran; jika dipertahankan untuk performa, hanya cache/proyeksi yang dapat diverifikasi dari gerakan. Metode saldo pembuka per item/lokasi masih harus dirancang setelah data aktual diperiksa. |
| Posisi dan status helm | `Barang` tetap memegang status/lokasi terkini; `RiwayatBarang` dan `RiwayatMutasiGudang` tetap menjadi jejak audit | Tambahkan identitas lokasi produksi/divisi hanya jika keputusan unit tracking mengharuskannya. Setiap perubahan state/lokasi dan riwayatnya harus satu transaksi. |
| QC, defect, repair | Model pemeriksaan QC, detail defect/keputusan, penugasan repair, serta percobaan repair yang terhubung ke lot WIP dan unit `Barang` | Helm baru dikonversi menjadi unit `Barang` setelah lolos QC Akhir; inspeksi/defect sebelum lolos harus dapat merujuk lot dan kuantitas. Role `qc` berwenang menetapkan asal cacat dan reject final. Repair tidak membuat produksi baru. |
| Finish Good dan pengiriman | Gudang yang ditetapkan setelah inventarisasi; workflow shipment aplikasi untuk pengiriman ke pelanggan | Shipment pelanggan belum ada di schema/route yang ditemukan. Hanya unit/kuantitas lolos QC dan diterima fisik dapat dihitung sebagai FG; shipment parsial tidak menghapus unit/riwayat. Identitas tujuan/customer dan retur/pembatalan masih perlu dirancang. |

#### ERD konseptual (usulan)

```text
ProductionOrder ──< ProductionOrderItem ── ProductVariant
       │
       └──< HasilProduksiHarian (tahap, divisi, waktu, petugas, status posting)
                    ├──< HasilProduksiHarianItem (input/output Item, jumlah aktual)
                    ├──< HasilProduksiPemakaian >── lot WIP asal
                    └──< gerakan item (lokasi asal/tujuan, Item, jumlah, sumber)

LokasiStok ──< gerakan item >── Item
    ├── gudang (Gudang yang sudah ada)
    └── divisi (Divisi yang sudah ada)

Barang (1 helm/unit, ProductVariant, lokasi/status kini)
  ├──< RiwayatBarang / RiwayatMutasiGudang (tetap dipakai)
  ├──< QcInspection ──< QcInspectionLine ──< QcDefect
  │                                  ├── Barang individual, atau
  │                                  └── lot Item/WIP + kuantitas (jalur lot)
  ├──< RepairAssignment (asal cacat, divisi repair, kuantitas)
  │       └──< RepairAttempt (hasil, sisa, kembali ke antrean QC)
  └──> penerimaan Finish Good ──< Shipment ──< ShipmentLine
```

Relasi unit/lot pada baris QC harus tervalidasi tepat satu jenis target: lot WIP sebelum lolos QC, atau unit `Barang` setelah lolos QC. `LokasiStok` adalah konsep usulan, bukan tabel yang sudah ada. Constraint DB dan strategi migrasinya wajib dirancang sebelum implementasi.

#### Lifecycle dan rekonsiliasi

1. **Rencana** tidak memutasi saldo.
2. **Produksi** diposting atomik: validasi input tersedia di lokasi pelaksana; catat konsumsi dan output per jenis/lokasi; simpan asal input. Input yang belum diproses tetap saldo WIP.
3. **Transfer** memindahkan jumlah dari lokasi asal ke tujuan; persetujuan, alokasi lot, dan penerimaan dicatat sekali. Transfer bukan output produksi.
4. **QC Akhir** menerima barang/lot setelah tahap yang ditetapkan perusahaan. Setiap pemeriksaan menyimpan kuantitas diperiksa dan pembagian hasil yang tidak melebihi kuantitas tersebut.
5. **Lolos** dapat masuk antrean penerimaan FG; hanya transaksi penerimaan fisik di gudang FG yang menambah saldo FG.
6. **Repair** membuat penugasan berdasarkan keputusan QC. Mutasi ke lokasi repair, hasil kerja, sisa, dan pengembalian ke antrean QC tercatat; pemeriksaan ulang merujuk pemeriksaan/penugasan sebelumnya. Tidak ada unit produksi baru.
7. **Reject final** hanya ditetapkan QC Akhir. Role `qc` dapat membuka ulang keputusan dengan alasan dan jejak audit; unit yang dibuka ulang tidak tersedia untuk FG sampai ada keputusan QC baru. Barang reject tidak masuk saldo FG; scrap/pemusnahan adalah gerakan terpisah.
8. **Shipment pelanggan** mengalokasikan unit/kuantitas aktual dari gudang FG yang terverifikasi. Status terkirim dan shipment harus diperbarui dalam satu transaksi.

Saldo dihitung sebagai gerakan masuk dikurangi gerakan keluar per item/lokasi. Transfer harus bernilai nol secara global; transformasi harus dapat dirunut dari input yang dikonsumsi ke output; repair/QC hanya memindahkan atau mengklasifikasi unit; shipment mengurangi FG sesuai jumlah yang benar-benar dikirim. Mutasi terposting bersifat append-only dan dibalik dengan transaksi koreksi yang saling mereferensikan.

#### Dampak API, UI, risiko, dan transisi

- Endpoint rencana `/api/production-orders` tetap untuk order/jadwal; `/api/hasil-produksi-harian` menjadi jalur pencatatan fakta proses; route lama realisasi dipertahankan sebagai adapter saat pemetaan dan migrasi berlangsung.
- Tambahan API yang mungkin diperlukan: antrean/detail/pemeriksaan QC; penugasan, pencatatan, dan pengembalian repair; penerimaan FG; shipment serta pengiriman. Hak akses harus ditegakkan backend untuk `produksi`, `qc`, `repair`, dan `gudang`.
- UI terdampak: input produksi, WIP/transfer, realisasi/rekap, QC, repair, penerimaan FG, shipment, barang/mutasi, dan dashboard. Perlu mempertahankan kontrak konsumen lama selama transisi.
- Implementasi sebaiknya aditif: buat gerakan/lifecycle baru, verifikasi rekonsiliasi dan backfill pada salinan DB, pertahankan tabel serta API lama, lakukan cutover bertahap, lalu hapus/deprecate hanya setelah bukti tidak ada consumer/data yang tertinggal dan persetujuan eksplisit.
- Risiko tertinggi: tidak ada master gudang pada snapshot lokal; semua 5.010 `Barang` berstatus `FINISHGOOD` tetapi tanpa gudang/QC/pengiriman yang dapat diverifikasi; histori mutasi item tidak memiliki lokasi dan 365/418 baris lokal tanpa referensi sumber; WIP memiliki saldo lot mutable; serta `ProductionRealization*` kosong sedangkan ada 28 transaksi produksi harian. Temuan lokal wajib dikonfirmasi terhadap database yang benar sebelum cutover.

#### Keputusan yang telah dikonfirmasi dan keputusan cutover yang masih terbuka

- [x] Helm tetap lot/kuantitas saat QC; setelah lolos QC Akhir, unit yang diterima dibuat sebagai `Barang` individual.
- [x] `HasilProduksiHarian` menjadi sumber fakta produksi fisik/KPI; `ProductionRealization*` direncanakan sebagai proyeksi/adapter kompatibilitas.
- [x] Gunakan strategi ledger mutasi lokasi terpadu untuk gudang dan divisi.
- [x] Rancang workflow shipment aplikasi untuk pengiriman ke pelanggan; belum ditemukan model/route setara.
- [x] Role `qc` berwenang menetapkan asal cacat dan reject final.
- [x] Role `qc` dapat membuka ulang reject final dengan alasan dan jejak audit.
- [x] Database sumber perencanaan cutover: Docker lokal `express_api`.
- [x] 5.010 helm `FINISHGOOD` tanpa gudang ditahan sebagai legacy/tidak tersedia sampai diverifikasi.
- [x] Tujuan shipment: pengiriman ke pelanggan.
- [x] Shipment menyimpan nama/alamat penerima sebagai snapshot, mengizinkan pengiriman parsial, hanya dapat dibatalkan saat draft sebelum stok diposting, dan retur dicatat terpisah.
- [x] Role produksi dengan permission dan scope divisi mengerjakan repair; QC menyetujui hasil dan memegang keputusan kualitas.
- [ ] Tentukan metode saldo pembuka dan rekonsiliasi berdasarkan database cutover; WIP lolos pemeriksaan aritmetika lokal, material dan FG belum dapat dipetakan ke lokasi.
- [ ] Tetapkan identitas/master gudang FG dan lokasi lain setelah inventarisasi fisik.

## 3. Migrasi dan Perlindungan Data

- [x] Reset, penerapan 50 migration, dan seed ulang database Docker lokal `express_api` setelah persetujuan eksplisit; tindakan ini tidak menjadi pengganti backup atau pemeriksaan database produksi.
- [x] Susun pendekatan transisi konseptual tanpa menebak data historis; pemetaan dan saldo pembuka final masih menunggu keputusan serta rekonsiliasi.
- [x] Konfirmasi Docker lokal `express_api` sebagai sumber database untuk perencanaan cutover.
- [ ] Tetapkan identitas/master gudang FG dan lokasi divisi; rekonsiliasi status fisik/QC barang legacy tetap diperlukan.
- [ ] Tetapkan saldo pembuka gudang dari hitung fisik per item/lokasi; jangan otomatis menetapkan 418 mutasi lama ke gudang karena model tidak punya lokasi dan 365 baris lokal tanpa referensi sumber.
- [ ] Tetapkan saldo pembuka WIP per lot/divisi dari snapshot yang disetujui; cocokkan jurnal baru dengan `jumlahSisa` lama saat cutover dan catat selisih sebagai koreksi yang disetujui.
- [x] Tetapkan kebijakan awal 5.010 helm `FINISHGOOD` tanpa gudang: tetap legacy/tidak tersedia sampai verifikasi lokasi, QC, dan hitung fisik.
- [x] Tetapkan kebijakan reject final: role `qc` dapat membuka ulang dengan alasan dan jejak audit.
- [x] Tetapkan tujuan shipment aplikasi sebagai pengiriman ke pelanggan.
- [ ] Buat pemetaan data lama ke target, strategi backfill, urutan deploy, kompatibilitas API, dan rollback yang dapat dijalankan setelah keputusan di atas.
- [ ] Konfirmasi master/customer tujuan dan aturan shipment parsial, pembatalan, retur, serta identitas gudang FG.
- [x] Migration ERP lolos penerapan pada database Docker lokal `express_api` (MariaDB 11) setelah menghapus CHECK yang melibatkan kolom foreign key; MariaDB menolak kombinasi tersebut saat FK ditambahkan. CHECK kuantitas yang kompatibel tetap ada dan validasi mutasi/QC dilakukan di model aplikasi.
- [ ] Pilih strategi kompatibilitas API selama masa transisi; perbarui semua konsumen bila format API berubah.
- [ ] Buat migration aditif dan dapat diuji terlebih dahulu; hindari reset database sebagai cara menerapkan perubahan.
- [ ] Uji migration pada salinan database dan verifikasi jumlah record, FK, duplikasi, serta saldo sebelum/sesudah.
- [ ] Jangan jalankan migration produksi sebelum backup, rencana rollback, dan prosedur verifikasi disetujui.

Rencana cutover sementara (belum dieksekusi): (1) konfirmasi database sumber dan backup teruji; (2) sepakati master lokasi internal; (3) snapshot dan rekonsiliasi saldo fisik gudang serta WIP; (4) pertahankan mutasi/riwayat lama, gunakan lokasi “legacy/tidak diketahui” hanya untuk histori yang tidak dapat dipetakan, bukan saldo tersedia; (5) mulai ledger lokasi baru dari saldo pembuka yang disetujui; (6) validasi pada salinan database; (7) cutover bertahap dengan feature gate dan rollback dengan menonaktifkan penulis baru tanpa menghapus data. Urutan, adapter kompatibilitas, dan batas dual-write masih harus dirinci sebelum implementasi.

Rencana transisi terarah berdasarkan snapshot lokal (masih draft, tidak dijalankan):

1. **Bekukan baseline**: buat backup terverifikasi sebelum perubahan; simpan hitungan agregat dan hasil rekonsiliasi per item/lokasi. Backup belum dibuat karena belum ada perubahan data yang disetujui.
2. **Master lokasi**: tentukan kode/nama Gudang FG serta gudang operasional lain; buat peta `LokasiStok` untuk Gudang/Divisi. Jangan membuat record master sampai identitas/lokasi dikonfirmasi.
3. **Item gudang**: pertahankan 418 baris `StokItemMutasi` sebagai histori. Karena semua baris tidak menyimpan gudang dan 365 tanpa sumber, jangan backfill per transaksi ke lokasi tebakan. Tetapkan opening movement per item/lokasi dari hitung fisik yang disahkan; rekonsiliasikan terhadap saldo legacy per item, dan dokumentasikan selisih.
4. **WIP**: buat snapshot per lot `PemakaianMaterialItem`/divisi pada cutover; 103 lot lokal konsisten secara aritmetika. Simpan opening movement yang dapat ditelusuri ke lot asal, pertahankan riwayat lama dan enam alokasi transfer; selisih fisik/sistem harus dikoreksi melalui bukti persetujuan, bukan overwrite `jumlahSisa`.
5. **Helm/FG**: jangan menganggap 5.010 `FINISHGOOD` sebagai tersedia, lolos QC, atau berada di gudang. Pertahankan sebagai legacy/tidak tersedia hingga lokasi, bukti QC, dan hitung fisik diverifikasi. Setelah keputusan dan bukti disetujui, buat pemetaan unit ke lokasi dan bukti penerimaan; jangan mengubah status massal otomatis.
6. **KPI produksi**: mulai KPI resmi dari jurnal `HasilProduksiHarian` setelah cutover dan mapping order/variant tersedia. Jangan memaksakan backfill ke 1 order lokal karena detail produksi saat ini berelasi ke `Item`, bukan langsung ke order/varian; endpoint lama perlu adapter/proyeksi.
7. **Shipment pelanggan**: rancang dokumen shipment, baris unit/kuantitas, tujuan/customer, waktu aktual, petugas, dan referensi dokumen; hanya unit FG yang telah diverifikasi dapat dialokasikan. Keberadaan master customer serta aturan pengiriman parsial, pembatalan, dan retur perlu dikonfirmasi sebelum schema final.
8. **Deploy/rollback**: migration aditif diuji pada salinan snapshot; validasi jumlah, FK, saldo, dan akses; gunakan feature gate untuk penulis/pembaca baru dan pertahankan API lama sebagai adapter. Rollback operasional menonaktifkan feature gate dan mempertahankan semua data baru; hindari migration turun yang menghapus tabel/data. Pemulihan backup hanya melalui prosedur yang disetujui.

#### Status implementasi

Reset lokal database Docker `express_api` telah dijalankan atas persetujuan pengguna; seluruh 50 migration diterapkan dan seed ulang selesai. Seed produksi membuat 32 routing aktif beserta BOM untuk seluruh varian/ukuran, 16 dokumen hasil produksi dengan input dan output per divisi, 15 transfer WIP, serta saldo ledger akhir satu unit untuk masing-masing dari delapan Item Top Coat. Kuantitas input dan hasil seimbang di setiap divisi pada fixture. Data mapping Base Coat → Decal merupakan contoh konsisten yang disetujui pengguna untuk seed, bukan konfirmasi BOM aktual. Database produksi tidak disentuh. Saldo pembuka legacy dan cutover/rekonsiliasi produksi belum disahkan.

## 4. Implementasi Setelah Persetujuan

- [x] Implementasikan schema dan migration ERP; diterapkan pada database Docker lokal `express_api` setelah persetujuan reset.
- [x] Implementasikan transaksi layanan produksi: input aktual, output aktual, sisa WIP, referensi transaksi, dan pencatatan petugas; gerakan WIP masuk/keluar tercermin di ledger.
- [ ] Implementasikan validasi saldo, transaksi database atomik, idempotensi, pembatasan saldo negatif, dan koreksi append-only.
- [x] Implementasikan QC Akhir sebagai satu-satunya pemegang keputusan reject final melalui endpoint QC berpermission.
- [x] Implementasikan pembukaan ulang reject final oleh QC dengan alasan, riwayat keputusan, dan validasi kuantitas.
- [x] Implementasikan atribusi cacat terpisah: lokasi temuan, divisi asal penyebab (dapat belum ditentukan), dan divisi pelaksana repair.
- [x] Implementasikan siklus repair: attempt dibatasi divisi, review QC tercatat, hasil disetujui dipindahkan ke lokasi QC, dan inspeksi ulang ditautkan ke attempt tanpa mengurangi saldo lot lagi.
- [x] Implementasikan lokasi, penerimaan Finish Good, alokasi/pengiriman melalui API ledger dan shipment; pemakaian operasional menunggu saldo pembuka dan integrasi penulis produksi/WIP.
- [x] Terapkan permission backend untuk inventory, QC, pemetaan lokasi, penerimaan gudang, shipment, retur, dan aksi posting.
- [x] Sesuaikan UI dan API consumer untuk inventory, QC, penerimaan Finish Good, shipment, dan retur.
- [ ] Implementasikan laporan produksi harian, WIP/material, QC, repair, aliran barang, reject unik vs kejadian, Finish Good, dan pengiriman.
- [ ] Lengkapi dokumentasi API, status/alur kerja, permission, migrasi, rollback, dan prosedur operasional. README telah memuat route/permission ERP dan alur repair; prosedur cutover/rekonsiliasi masih tertunda.

## 5. Pengujian dan Kriteria Penerimaan

Status validasi terakhir: Prisma schema valid; Prisma Client berhasil digenerate; seluruh migration diterapkan dan status up to date (50/50); backend dan frontend build lulus; tes model QC/repair terarah (5) dan suite frontend (41) lulus. Full suite backend menjalankan 578 tes: 575 lulus dan 3 tes penjadwalan produksi gagal pada ekspektasi tanggal/alokasi; kegagalan berulang pada file penjadwalan yang tidak terkait perubahan QC ini. Pengujian integrasi siklus repair, ledger, serta konkurensi masih perlu dilengkapi.

- [ ] Uji saldo WIP harian: saldo akhir hari sebelumnya sama dengan saldo awal hari berikutnya.
- [ ] Uji transformasi input-output multi-item dan pencatatan sisa, tanpa mengandalkan BOM sebagai bukti konsumsi.
- [ ] Uji transfer antar divisi: jumlah keluar/masuk seimbang dan tidak dihitung sebagai hasil produksi atau mutasi gudang ganda.
- [ ] Uji QC Akhir: lolos, repair, asal cacat belum ditentukan, atribusi lintas divisi, dan reject final.
- [ ] Uji integrasi repair berulang dan pemeriksaan ulang: jumlah unit fisik tetap konsisten serta riwayat tidak hilang.
- [ ] Uji penerimaan Finish Good dan pengiriman parsial; barang terkirim tidak lagi masuk saldo tersedia.
- [ ] Uji transaksi ganda, request berulang, konkurensi, kegagalan parsial, koreksi transaksi terposting, dan penolakan saldo negatif.
- [ ] Uji role: pengguna tanpa izin tidak dapat memutuskan reject final, menyelesaikan repair pihak lain, atau memosting mutasi yang tidak berwenang.
- [x] Jalankan Prisma validate/generate, backend/frontend build, tes model QC/repair (5), suite frontend (41), serta terapkan migration secara aditif pada `express_api`.
- [ ] Kriteria akhir: seluruh material dan unit dapat ditelusuri; saldo dapat direkonsiliasi; QC Akhir memegang keputusan kualitas; siklus repair, Finish Good, dan pengiriman tidak menggandakan hitungan.

## 6. Perbaikan QC Akhir dan Alur Batok

Keputusan proses untuk pekerjaan ini:

- QC Akhir hanya menerima hasil proses Topcoat.
- Jalur produksi: Buffing → Basecoat (batok hitam/putih/platinum grey) → Decal (varian decal aktif) → Topcoat (varian produk) → QC Akhir.
- QC menetapkan divisi asal defect. Jika hasil repair disetujui, kuantitas kembali ke tahap asal dan harus melewati tahap sesudahnya; repair Topcoat kembali langsung ke antrean QC.
- Tahap produksi dipetakan secara eksplisit. BOM aktif per varian wajib tersedia sebagai validasi konfigurasi/hasil; jangan menebak hubungan dari teks bebas.
- Target laporan: jumlah masuk, sedang beredar/WIP, diproses, reject, repair, saldo, dan selisih opname per tahap/item; selisih dicatat sebagai koreksi beralasan tanpa mengubah histori.
- Tidak boleh menjalankan migration atau mengubah database sampai pengguna memberikan persetujuan cutover terpisah.

- [x] Audit definisi Item WIP, varian, BOM aktif, serta hasil produksi/transfer yang tersedia; jangan mengubah atau seed master produksi tanpa persetujuan.
- [x] Tambahkan konfigurasi routing per varian dan tahap Buffing/Basecoat/Decal/Topcoat, termasuk pasangan Item input/output dan BOM aktif; validasi konfigurasi lengkap serta urutan tahap.
- [x] Batasi antrean QC Akhir ke saldo WIP output Topcoat yang benar-benar tersedia; tampilkan Item, varian, saldo, nomor dokumen, dan bukan ID lot internal.
- [x] Wajibkan QC memilih divisi asal defect dari tahap routing dan gunakan divisi yang sama sebagai tujuan repair.
- [x] Review repair sebelum Top Coat membuat lot WIP di tahap asal untuk proses berikutnya; repair Top Coat kembali ke inspeksi QC. Transfer WIP routed dibatasi ke tahap berikutnya.
- [x] Hubungkan hasil/opsi varian dengan BOM aktif; blokir konfigurasi/inspeksi jika routing/BOM aktif tidak tersedia atau pasangan input/output tidak cocok.
- [x] Buat laporan aliran WIP/QC/repair dengan saldo pembuka/penutup, mutasi produksi/transfer/QC/repair/penyesuaian, hasil inspeksi final, dan review repair per periode/divisi/item.
- [x] Tambahkan opname fisik khusus WIP per lokasi divisi/item; simpan saldo sistem, jumlah fisik, selisih, dan alasan wajib dalam sesi append-only.
- [x] Posting koreksi selisih sebagai mutasi inventory `ADJUSTMENT`; penambahan membuat lot WIP ber-sumber `OPNAME`, pengurangan mengurangi saldo lot FIFO dan ledger secara atomik. Tidak ada endpoint edit/hapus.
- [x] Tambahkan migration aditif, API, permission yang tersedia, dan UI laporan/opname di area admin dan gudang; migration diterapkan ke database Docker lokal setelah persetujuan.
- [ ] Tambahkan tes integrasi report dan transaksi koreksi lot/ledger beserta role database; lengkapi verifikasi manual alur opname end-to-end.
- [x] Dokumentasikan report, batas detail mutasi, setup opname, status migration lokal, dan batas cutover pada `backend/README.md`.

---
