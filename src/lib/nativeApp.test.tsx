import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Modal from '@/components/common/Modal';

const native = vi.hoisted(() => ({ value: true, back: undefined as (() => void) | undefined }));
const app = vi.hoisted(() => ({ addListener: vi.fn(), minimizeApp: vi.fn() }));
vi.mock('./platform', () => ({ isNativeApp: () => native.value }));
vi.mock('@capacitor/app', () => ({ App: app }));
import { initializeNativeApp } from './nativeApp';

describe('native Android modal back navigation', () => {
  beforeEach(() => {
    native.value = true;
    native.back = undefined;
    app.addListener.mockReset();
    app.minimizeApp.mockReset();
    app.addListener.mockImplementation((_name, callback) => {
      native.back = callback;
      return Promise.resolve({ remove: vi.fn() });
    });
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
    window.history.replaceState({ idx: 2 }, '', '/team');
  });

  it('closes a photo modal through React state before navigating back', async () => {
    function Photo() {
      const [open, setOpen] = useState(true);
      return <Modal open={open} onClose={() => setOpen(false)} title="Profile photo"><button>Photo action</button></Modal>;
    }
    render(<Photo />);
    screen.getByRole('button', { name: 'Photo action' }).focus();
    const dialog = screen.getByRole('dialog', { name: 'Profile photo' });
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    await initializeNativeApp();
    act(() => native.back!());
    expect(dialog).not.toHaveAttribute('open');
    expect(back).not.toHaveBeenCalled();
    expect(app.minimizeApp).not.toHaveBeenCalled();
    act(() => native.back!());
    expect(back).toHaveBeenCalledOnce();
  });

  it('respects a close handler that refuses dismissal while a form is busy', async () => {
    const close = vi.fn();
    render(<Modal open onClose={close} title="Unsaved form"><button>Keep editing</button></Modal>);
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const replace = vi.spyOn(window.history, 'replaceState');
    await initializeNativeApp();
    act(() => native.back!());
    expect(close).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(back).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(app.minimizeApp).not.toHaveBeenCalled();
  });

  it('targets the focused modal when another dialog appears later in the DOM', async () => {
    const activeClose = vi.fn();
    const otherClose = vi.fn();
    render(<>
      <Modal open onClose={activeClose} title="Active"><button>Active action</button></Modal>
      <Modal open onClose={otherClose} title="Other"><button>Other action</button></Modal>
    </>);
    screen.getByRole('button', { name: 'Active action' }).focus();
    await initializeNativeApp();
    act(() => native.back!());
    expect(activeClose).toHaveBeenCalledOnce();
    expect(otherClose).not.toHaveBeenCalled();
  });

  it('does not register a hardware-back handler for the website', async () => {
    native.value = false;
    await initializeNativeApp();
    expect(app.addListener).not.toHaveBeenCalled();
  });
});
