import type { CapacitorConfig } from '@capacitor/cli';

// Provisional identifier: confirm ownership/name before the first store upload.
// Ship local assets; never point a production shell at the live website.
const config: CapacitorConfig = {
  appId: 'kr.hyundo.chuncheondating',
  appName: '춘천과팅',
  webDir: 'dist-native',
  server: { androidScheme: 'https', cleartext: false },
  ios: { contentInset: 'automatic' },
};

export default config;
