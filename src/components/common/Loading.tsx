import { useI18n } from '@/i18n';

export default function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-sakura-500">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sakura-100 border-t-sakura-500" />
      <p className="mt-3 text-sm text-zinc-500">{label ?? t.common.loading}</p>
    </div>
  );
}
