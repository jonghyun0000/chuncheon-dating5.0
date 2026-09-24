import { useId, type SelectHTMLAttributes, type ReactNode } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export default function Select({ label, children, className = '', id, ...rest }: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div>
      {label && <label className="label" htmlFor={selectId}>{label}</label>}
      <select {...rest} id={selectId} className={`input pr-10 ${className}`}>
        {children}
      </select>
    </div>
  );
}
