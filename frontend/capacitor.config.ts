import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rsvhelmet.app',
  appName: 'rsv-operator',
  webDir: 'dist/app',

    server: {
    url: 'http://192.168.100.250:5173',
    cleartext: true,
  },
};

export default config;
