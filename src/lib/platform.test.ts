import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ value: false }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), minimizeApp: vi.fn() } }));
import { installationOrigin, PUBLIC_WEB_ORIGIN, shouldRegisterWebWorker } from './platform';
import { isStandalone } from '@/features/install/usePwaInstall';
import { backAction } from './nativeApp';

describe('web and bundled native isolation', () => {
  beforeEach(() => { native.value = false; });
  it('retains the web PWA worker and current preview/share origin', () => {
    expect(shouldRegisterWebWorker(true)).toBe(true);
    expect(shouldRegisterWebWorker(false)).toBe(false);
    expect(installationOrigin('https://preview.example.test')).toBe('https://preview.example.test');
  });
  it('never registers a website worker in native or shares its localhost origin', () => {
    native.value = true;
    expect(shouldRegisterWebWorker(true)).toBe(false);
    expect(installationOrigin('capacitor://localhost')).toBe(PUBLIC_WEB_ORIGIN);
    expect(installationOrigin('https://localhost')).toBe(PUBLIC_WEB_ORIGIN);
    expect(isStandalone()).toBe(true);
  });
  it('uses router history, falls back to home, and minimizes only at the root', () => {
    expect(backAction('/me', 2)).toBe('back');
    expect(backAction('/me', null)).toBe('home');
    expect(backAction('/', 0)).toBe('minimize');
    expect(backAction('/', 3)).toBe('back');
  });
});
