import type { ReactNode } from 'react';

interface Props {
  headers: string[];
  children: ReactNode;
}

export default function AdminTable({ headers, children }: Props) {
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-zinc-50/60 text-left text-xs uppercase tracking-wider text-zinc-500">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
    </div>
  );
}
