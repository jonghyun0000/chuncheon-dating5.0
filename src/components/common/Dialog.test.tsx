import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Modal from './Modal';
import TermsModal from './TermsModal';
import { ko } from '@/i18n/ko';

beforeEach(() => {
  // jsdom does not implement native dialog methods. Browser tests cover focus containment.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
});

it('provides a named modal, handles Escape through controlled state, and restores focus/scroll', () => {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();
  const close = vi.fn();
  const content = <button>Continue</button>;
  const view = render(<Modal open onClose={close} title="Review">{content}</Modal>);
  const dialog = screen.getByRole('dialog', { name: 'Review' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
  expect(close).toHaveBeenCalledOnce();
  view.rerender(<Modal open={false} onClose={close} title="Review">{content}</Modal>);
  expect(dialog).not.toHaveAttribute('open');
  expect(document.body.style.overflow).toBe('');
  expect(trigger).toHaveFocus();
  trigger.remove();
});

it('does not dismiss when dialog content is clicked, but accepts a backdrop click', () => {
  const close = vi.fn();
  render(<Modal open onClose={close} title="Review"><button>Continue</button></Modal>);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('dialog').firstElementChild!);
  expect(close).toHaveBeenCalledOnce();
});

it('names the terms dialog and exposes both close buttons', () => {
  const doc = { key: 'privacy' as const, label: 'Privacy', title: 'Privacy policy', summary: 'Summary', sections: [] };
  render(<TermsModal doc={doc} onClose={vi.fn()} />);
  expect(screen.getByRole('dialog', { name: 'Privacy policy' })).toBeVisible();
  expect(screen.getAllByRole('button', { name: ko.common.close })).toHaveLength(2);
});
