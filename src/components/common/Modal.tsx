import { useId, type ReactNode } from 'react';
import Dialog from './Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: Props) {
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={title ? titleId : undefined} label="Dialog" className="px-4">
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-card animate-fade-up"
      >
        {title && <h3 id={titleId} className="mb-3 text-lg font-bold text-zinc-900">{title}</h3>}
        {children}
      </div>
    </Dialog>
  );
}
