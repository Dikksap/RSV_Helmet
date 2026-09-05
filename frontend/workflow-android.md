# Android Development Workflow

Dokumentasi workflow development Android untuk project **React + Vite + Capacitor**.

Project menggunakan **ADB melalui USB** untuk menghubungkan HP Android ke komputer dan **Vite Live Reload** untuk development frontend tanpa perlu build APK setiap kali ada perubahan kode.

---

## 1. Stack

* React
* Vite
* Capacitor
* Android SDK
* ADB
* JDK 21
* Android Device via USB

---

# 2. Struktur Project

```text
frontend/
├── android/                    # Native Android project dari Capacitor
├── src/                        # Source code React
├── public/
├── dist/
│   └── app/                    # Hasil build Vite
│       ├── index.html
│       └── assets/
├── capacitor.config.ts
├── package.json
└── ...
```

Output frontend menggunakan:

```text
dist/app
```

Sehingga `capacitor.config.ts` menggunakan:

```ts
webDir: 'dist/app'
```

---

# 3. Konfigurasi Capacitor

File:

```text
capacitor.config.ts
```

## Development

Gunakan konfigurasi berikut untuk Live Reload:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rsvhelmet.app',
  appName: 'RSV Helmet',
  webDir: 'dist/app',

  server: {
    url: 'http://localhost:5173',
    cleartext: true,
  },
};

export default config;
```

> `server.url` digunakan hanya untuk development dengan Live Reload.

---

# 4. Persyaratan

Cek Node.js:

```powershell
node -v
npm -v
```

Cek Java:

```powershell
java -version
```

Project Android menggunakan **JDK 21**.

Contoh lokasi JDK:

```text
C:\Program Files\Java\jdk-21
```

Jika terminal masih menggunakan Java 17:

```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-21"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

Verifikasi:

```powershell
java -version
```

Kemudian dari folder `android`:

```powershell
.\gradlew.bat -version
```

Pastikan JVM yang digunakan adalah Java 21.

---

# 5. Hubungkan HP Android

Aktifkan pada HP:

```text
Developer Options
└── USB Debugging
```

Hubungkan HP menggunakan kabel USB.

Cek perangkat:

```powershell
adb devices
```

Contoh:

```text
List of devices attached
XXXXXXXXXXXX    device
```

Jika muncul:

```text
unauthorized
```

lihat HP dan tekan **Allow** pada dialog USB Debugging.

---

# 6. Development dengan Live Reload

Live Reload digunakan untuk development React sehari-hari.

Dengan Live Reload, perubahan kode React tidak perlu melakukan:

```text
npm run build
npx cap sync android
gradlew assembleDebug
adb install
```

setiap kali kode berubah.

---

## 6.1 Jalankan Vite

Dari folder `frontend`:

```powershell
npm run dev -- --host 0.0.0.0
```

Vite akan menjalankan development server, biasanya:

```text
http://localhost:5173
```

---

## 6.2 Aktifkan ADB Reverse

Buka terminal PowerShell lain:

```powershell
adb reverse tcp:5173 tcp:5173
```

Fungsinya membuat koneksi:

```text
HP
 │
 │ localhost:5173
 │
 ▼
ADB Reverse
 │
 │ USB
 ▼
PC
 │
 ▼
Vite :5173
```

Dengan cara ini HP dapat mengakses Vite Development Server melalui USB.

---

# 7. Menjalankan Aplikasi Android

Jika konfigurasi Live Reload baru saja dibuat atau project Android belum di-sync:

```powershell
npm run build
npx cap sync android
```

Kemudian build APK:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Kembali ke folder `frontend`:

```powershell
cd ..
```

Install APK:

```powershell
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

Jalankan aplikasi:

```powershell
adb shell monkey -p com.rsvhelmet.app 1
```

Setelah aplikasi terbuka, React akan mengambil halaman dari:

```text
http://localhost:5173
```

melalui ADB Reverse.

---

# 8. Workflow Development Harian

Gunakan **2 terminal**.

## Terminal 1 — Vite

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

## Terminal 2 — ADB

```powershell
adb reverse tcp:5173 tcp:5173
```

Kemudian buka aplikasi RSV Helmet di HP.

Sekarang workflow-nya:

```text
Edit React
    ↓
Save
    ↓
Vite HMR
    ↓
HP otomatis update
```

Tidak perlu build APK untuk setiap perubahan React.

---

# 9. Perubahan yang Tidak Membutuhkan Build APK

Dengan Live Reload, perubahan berikut biasanya langsung terlihat di HP:

```text
src/
├── components/
├── pages/
├── hooks/
├── services/
├── App.tsx
└── ...
```

Termasuk:

* React component
* JavaScript / TypeScript
* CSS
* Tailwind CSS
* Layout
* Form
* Routing
* API logic
* State management

Workflow:

```text
Edit
 ↓
Save
 ↓
Vite HMR
 ↓
HP update
```

---

# 10. Kapan Harus Menjalankan `npm run build`?

Build diperlukan ketika:

* Membuat APK baru
* Mengubah konfigurasi native Android
* Menambahkan plugin Capacitor
* Mengubah konfigurasi Capacitor yang membutuhkan sync
* Menguji aplikasi tanpa Live Reload
* Membuat production build

Command:

```powershell
npm run build
```

Pastikan hasilnya:

```text
dist/
└── app/
    ├── index.html
    └── assets/
```

**`index.html` harus berada di `dist/app/index.html`.**

---

# 11. Kapan Harus `npx cap sync android`?

Gunakan ketika ada perubahan yang perlu disinkronkan ke native Android.

Contoh setelah menambahkan plugin:

```powershell
npm install <capacitor-plugin>
```

Kemudian:

```powershell
npx cap sync android
```

Contoh workflow:

```text
Install Plugin
     ↓
npx cap sync android
     ↓
Build Android
     ↓
Install APK
```

---

# 12. Build APK Debug

Dari folder `frontend`:

```powershell
npm run build
npx cap sync android
```

Masuk ke Android:

```powershell
cd android
```

Build:

```powershell
.\gradlew.bat assembleDebug
```

APK berada di:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

---

# 13. Install APK ke HP

Dari folder `android`:

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Jika berhasil:

```text
Performing Streamed Install
Success
```

Jalankan:

```powershell
adb shell monkey -p com.rsvhelmet.app 1
```

---

# 14. Development Flow

## Development React/UI

```text
VS Code
   ↓
npm run dev
   ↓
Vite
   ↓
ADB Reverse
   ↓
USB
   ↓
HP Android
   ↓
Capacitor
   ↓
React
```

Perubahan kode:

```text
Edit
 ↓
Save
 ↓
HMR
 ↓
HP update
```

Tidak perlu build APK setiap perubahan.

---

# 15. Native Android Development

Jika mengembangkan fitur native seperti:

* Bluetooth
* Printer
* USB
* Kamera
* Barcode Scanner
* GPS
* File System
* Notification

mungkin diperlukan proses:

```text
Install / Update Plugin
        ↓
npx cap sync android
        ↓
Gradle Build
        ↓
ADB Install
        ↓
Test di HP
```

Karena fitur native Android tidak dapat sepenuhnya disimulasikan oleh browser.

---

# 16. Development vs Production

## Development

Gunakan:

```ts
server: {
  url: 'http://localhost:5173',
  cleartext: true,
}
```

dan:

```text
webDir: 'dist/app'
```

Development flow:

```text
React
 ↓
Vite
 ↓
Live Reload
 ↓
ADB Reverse
 ↓
USB
 ↓
HP
```

---

## Production

Untuk production, hapus konfigurasi:

```ts
server: {
  url: 'http://localhost:5173',
  cleartext: true,
}
```

Sehingga:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rsvhelmet.app',
  appName: 'RSV Helmet',
  webDir: 'dist/app',
};

export default config;
```

Kemudian:

```powershell
npm run build
npx cap sync android
```

Build Android:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Untuk release production, gunakan konfigurasi signing dan release build yang sesuai.

---

# 17. Troubleshooting

## HP tidak terdeteksi

```powershell
adb devices
```

Pastikan:

* USB Debugging aktif
* HP sudah memberikan izin USB Debugging
* Kabel USB mendukung data
* ADB berjalan dengan benar

---

## Live Reload tidak bekerja

Jalankan kembali:

```powershell
adb reverse tcp:5173 tcp:5173
```

Pastikan Vite dijalankan dengan:

```powershell
npm run dev -- --host 0.0.0.0
```

---

## Capacitor tidak menemukan `index.html`

Pastikan hasil build:

```text
dist/
└── app/
    └── index.html
```

dan `capacitor.config.ts`:

```ts
webDir: 'dist/app'
```

Kemudian:

```powershell
npm run build
npx cap sync android
```

---

## Error Java

Jika muncul:

```text
invalid source release: 21
```

cek:

```powershell
java -version
```

Pastikan Java 21.

Jika masih menggunakan Java 17:

```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-21"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

Kemudian:

```powershell
java -version
```

dan:

```powershell
cd android
.\gradlew.bat -version
```

Pastikan:

```text
Launcher JVM: 21...
Daemon JVM:   21...
```

---

# 18. Command Cheat Sheet

### Start development

```powershell
npm run dev -- --host 0.0.0.0
```

### Connect HP melalui USB

```powershell
adb devices
```

### Enable Live Reload melalui USB

```powershell
adb reverse tcp:5173 tcp:5173
```

### Build frontend

```powershell
npm run build
```

Output:

```text
dist/app/
```

### Sync Capacitor

```powershell
npx cap sync android
```

### Build APK

```powershell
cd android
.\gradlew.bat assembleDebug
```

### Install APK

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

### Jalankan aplikasi

```powershell
adb shell monkey -p com.rsvhelmet.app 1
```

---

# 19. Workflow Utama

### Untuk coding React sehari-hari

```text
1. Colok HP USB
2. adb devices
3. npm run dev -- --host 0.0.0.0
4. adb reverse tcp:5173 tcp:5173
5. Buka RSV Helmet di HP
6. Coding → Save → Live Reload
```

### Jika menambahkan plugin/native feature

```text
1. Install plugin
2. npx cap sync android
3. Build APK
4. adb install
5. Test di HP
```

### Jika membuat APK

```text
npm run build
        ↓
npx cap sync android
        ↓
cd android
        ↓
.\gradlew.bat assembleDebug
        ↓
app-debug.apk
        ↓
adb install
```

---

# 20. Prinsip Development

**Jangan build APK untuk setiap perubahan kode React.**

Gunakan **Vite Live Reload + ADB Reverse** untuk development sehari-hari.

Gunakan **Capacitor Sync + Gradle Build + ADB Install** ketika membutuhkan perubahan native Android atau APK baru.

Struktur output frontend tetap:

```text
dist/app/
├── index.html
└── assets/
```

dan Capacitor:

```ts
webDir: 'dist/app'
```

Dengan workflow ini, pengalaman development React + Capacitor di HP Android dapat dibuat mendekati workflow Flutter: **HP tersambung USB → development server berjalan → coding → perubahan langsung terlihat di HP.**
