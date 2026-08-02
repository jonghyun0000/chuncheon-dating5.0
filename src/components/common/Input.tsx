import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export default function Input({ label, hint, error, className = '', ...rest }: Props) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input {...rest} className={`input ${error ? 'border-rose-300 focus:ring-rose-100' : ''} ${className}`} />
      {error ? (
        <p className="mt-1 text-xs text-rose-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}
