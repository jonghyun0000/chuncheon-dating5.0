import { App } from '@capacitor/app';
import { isNativeApp } from './platform';

export function backAction(path: string, historyIndex: unknown): 'back' | 'home' | 'minimize' {
  if (typeof historyIndex === 'number' && historyIndex > 0) return 'back';
  return path === '/' ? 'minimize' : 'home';
}

export async function initializeNativeApp() {
  if (!isNativeApp()) return;
  await App.addListener('backButton', () => {
    // Android's hardware back button must follow the same controlled close path
    // as Escape. Calling dialog.close() directly would bypass React state and
    // upload/unsaved-form guards in the existing onClose handlers.
    const selector = 'dialog[open][aria-modal="true"]';
    const focusedDialog = document.activeElement?.closest<HTMLDialogElement>(selector);
    const dialogs = document.querySelectorAll<HTMLDialogElement>(selector);
    const activeDialog = focusedDialog ?? dialogs.item(dialogs.length - 1);
    if (activeDialog) {
      activeDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      return;
    }
    const action = backAction(window.location.pathname, window.history.state?.idx);
    if (action === 'back') window.history.back();
    else if (action === 'minimize') void App.minimizeApp();
    else {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
}
