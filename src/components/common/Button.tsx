import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

export default function Button({ variant = 'primary', loading, children, className = '', disabled, ...rest }: Props) {
  const cls =
    variant === 'primary' ? 'btn-primary' :
    variant === 'danger'  ? 'btn-danger'  :
    'btn-ghost';
  return (
    <button {...rest} disabled={disabled || loading} className={`${cls} ${className}`}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          처리 중...
        </span>
      ) : children}
    </button>
  );
}
