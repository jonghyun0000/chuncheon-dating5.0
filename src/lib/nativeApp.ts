import { App } from '@capacitor/app';
import { isNativeApp } from './platform';

export function backAction(path: string, historyIndex: unknown): 'back' | 'home' | 'minimize' {
  if (typeof historyIndex === 'number' && historyIndex > 0) return 'back';
  return path === '/' ? 'minimize' : 'home';
}

export async function initializeNativeApp() {
  if (!isNativeApp()) return;
  await App.addListener('backButton', () => {
    const action = backAction(window.location.pathname, window.history.state?.idx);
    if (action === 'back') window.history.back();
    else if (action === 'minimize') void App.minimizeApp();
    else {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
}
