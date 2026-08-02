import type { SelectHTMLAttributes, ReactNode } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export default function Select({ label, children, className = '', ...rest }: Props) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select {...rest} className={`input pr-10 ${className}`}>
        {children}
      </select>
    </div>
  );
}
