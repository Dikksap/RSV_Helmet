import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rsvhelmet.app',
  appName: 'rsv-operator',
  webDir: 'dist/app',
};

// Live-reload ke HP dev HANYA saat CAP_LIVE=1 (lihat script android:dev).
// Default tanpa server.url agar APK hasil android:build jalan standalone
// (sebelumnya server.url ikut ke-sync ke APK -> blank di luar jaringan dev).
if (process.env.CAP_LIVE === '1') {
  config.server = {
    url: process.env.CAP_SERVER_URL ?? 'http://192.168.100.250:5173',
    cleartext: true,
  };
}

export default config;
