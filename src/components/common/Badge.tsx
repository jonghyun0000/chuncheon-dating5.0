import type { ReactNode } from 'react';

interface Props {
  tone?: 'pink' | 'green' | 'gray' | 'amber' | 'sky';
  children: ReactNode;
  className?: string;
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  pink:  'bg-sakura-100 text-sakura-700 ring-sakura-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  gray:  'bg-zinc-100 text-zinc-700 ring-zinc-200',
  amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  sky:   'bg-sky-100 text-sky-700 ring-sky-200',
};

export default function Badge({ tone = 'gray', children, className = '' }: Props) {
  return <span className={`badge ${toneClass[tone]} ${className}`}>{children}</span>;
}
