interface Props {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'pink' | 'sky' | 'green' | 'amber' | 'gray';
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  pink:  'from-sakura-50 to-white text-sakura-600',
  sky:   'from-sky-50 to-white text-sky-600',
  green: 'from-emerald-50 to-white text-emerald-600',
  amber: 'from-amber-50 to-white text-amber-600',
  gray:  'from-zinc-50 to-white text-zinc-700',
};

export default function AdminStatsCard({ label, value, hint, tone = 'gray' }: Props) {
  return (
    <div className={`card bg-gradient-to-br ${toneClass[tone]} p-5`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-display text-3xl font-bold mt-1">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}
