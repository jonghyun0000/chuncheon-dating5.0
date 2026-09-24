import { useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export default function Input({ label, hint, error, className = '', id, ...rest }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  return (
    <div>
      {label && <label className="label" htmlFor={inputId}>{label}</label>}
      <input {...rest} id={inputId} aria-invalid={error ? true : rest['aria-invalid']} aria-describedby={[rest['aria-describedby'], error || hint ? descriptionId : null].filter(Boolean).join(' ') || undefined} className={`input ${error ? 'border-rose-300 focus:ring-rose-100' : ''} ${className}`} />
      {error ? (
        <p id={descriptionId} className="mt-1 text-xs text-rose-500">{error}</p>
      ) : hint ? (
        <p id={descriptionId} className="mt-1 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
