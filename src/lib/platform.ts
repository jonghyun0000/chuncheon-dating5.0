import { Capacitor } from '@capacitor/core';

export const PUBLIC_WEB_ORIGIN = 'https://chuncheon-dating5-0.vercel.app';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function shouldRegisterWebWorker(production: boolean): boolean {
  return production && !isNativeApp();
}

export function installationOrigin(webOrigin: string): string {
  return isNativeApp() ? PUBLIC_WEB_ORIGIN : webOrigin;
}
