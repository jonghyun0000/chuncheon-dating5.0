import { useEffect, useId, useState } from 'react';
import { fetchAdMetrics, type AdMetrics } from './ads.api';

const koreaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });

function count(value: number) {
  return Number(value).toLocaleString('ko-KR');
}

function clickRate(row: Pick<AdMetrics, 'viewers' | 'clickers'>) {
  return row.viewers > 0 ? (100 * row.clickers / row.viewers).toFixed(1) + '%' : '—';
}

export default function AdPerformance({ revision, bannerId }: { revision: number; bannerId?: string }) {
  const headingId = useId();
  const today = koreaDate.format(new Date());
  const [from, setFrom] = useState(() => koreaDate.format(new Date(Date.now() - 6 * 86400000)));
  const [through, setThrough] = useState(today);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ request: string; rows: AdMetrics[] | null } | null>(null);
  const span = (Date.parse(through) - Date.parse(from)) / 86400000;
  const validRange = Boolean(from && through && span >= 0 && span < 90 && through <= today);
  const request = JSON.stringify([bannerId, from, through, revision, retry]);

  useEffect(() => {
    if (!validRange) return;
    let disposed = false;
    fetchAdMetrics(from, through, bannerId ?? '').then(rows => {
      if (!disposed) setResult({ request, rows });
    }).catch(() => {
      if (!disposed) setResult({ request, rows: null });
    });
    return () => { disposed = true; };
  }, [bannerId, from, through, validRange, request]);

  const current = validRange && result?.request === request ? result : null;
  const metrics = current?.rows;
  const metricsError = current !== null && !metrics;
  const latest = metrics?.[0];
  const trackedDays = bannerId ? metrics?.filter(row => row.tracked) ?? [] : [];
  const totals = trackedDays.reduce((sum, row) => ({
    viewers: sum.viewers + Number(row.viewers),
    clickers: sum.clickers + Number(row.clickers),
  }), { viewers: 0, clickers: 0 });
  const summary = bannerId ? [
    ['총 노출', count(totals.viewers) + '건'],
    ['총 클릭', count(totals.clickers) + '건'],
    ['기간 클릭률', clickRate(totals)],
  ] : latest ? [
    ['홈 방문', count(latest.visitors) + '명'],
    ['배너 노출', count(latest.viewers) + '명'],
    ['배너 클릭', count(latest.clickers) + '명'],
    ['클릭률', clickRate(latest)],
  ] : [];
  const summaryTracked = bannerId ? trackedDays.length > 0 : latest?.tracked;
  const Heading = bannerId ? 'h3' : 'h2';

  return (
    <section
      aria-labelledby={headingId}
      className={bannerId ? 'mt-3 space-y-4 rounded-xl bg-zinc-50 p-3' : 'card space-y-4 p-4 sm:p-5'}
    >
      <div>
        <Heading id={headingId} className="font-display text-lg font-bold">{bannerId ? '배너 성과' : '전체 성과'}</Heading>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">한국 시간 기준으로 같은 회원은 하루에 한 번씩 집계합니다.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm">시작 날짜
          <input className="input mt-1 w-full min-w-0" type="date" value={from} max={today} onChange={event => setFrom(event.target.value)} />
        </label>
        <label className="min-w-0 text-sm">종료 날짜
          <input className="input mt-1 w-full min-w-0" type="date" value={through} min={from} max={today} onChange={event => setThrough(event.target.value)} />
        </label>
      </div>
      {!validRange && <p role="alert" className="text-sm text-rose-700">오늘까지의 날짜를 최대 90일로 선택해주세요.</p>}
      {metricsError && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-rose-700">성과를 불러오지 못했습니다.</p>
          <button type="button" className="btn-ghost" onClick={() => setRetry(value => value + 1)}>다시 시도</button>
        </div>
      )}
      {validRange && !metricsError && !metrics && <p role="status" className="text-sm text-zinc-500">성과를 불러오는 중…</p>}
      {latest && (
        <div>
          <p className="mb-2 text-xs font-semibold text-zinc-600">
            {bannerId ? `조회 기간 합계 · ${from} ~ ${through}` : `${latest.day === today ? '오늘 · ' : ''}${latest.day}`}
          </p>
          <div className={`grid grid-cols-2 gap-2 ${bannerId ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
            {summary.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-sakura-50 px-3 py-2.5">
                <p className="text-xs text-zinc-600">{label}</p>
                <p className="mt-1 text-lg font-bold text-zinc-900">{summaryTracked ? value : '—'}</p>
              </div>
            ))}
          </div>
          {bannerId && (
            <p className="mt-2 text-xs text-zinc-600">일별 집계의 합계입니다. 같은 회원이 다른 날짜에 노출되거나 클릭하면 날짜마다 집계됩니다.</p>
          )}
        </div>
      )}
      {metrics && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={bannerId ? '배너 일별 성과' : '광고 일별 성과'}>
            <thead className="border-b border-zinc-200 text-xs text-zinc-600">
              <tr>
                <th className="px-1 py-2 text-left">날짜</th>
                {!bannerId && <th className="px-1 text-right">방문</th>}
                <th className="px-1 text-right">노출</th>
                <th className="px-1 text-right">클릭</th>
                <th className="px-1 text-right">클릭률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {metrics.map(row => (
                <tr key={row.day}>
                  <th scope="row" className="whitespace-nowrap px-1 py-2 text-left font-medium">{row.day}</th>
                  {!bannerId && <td className="px-1 text-right">{row.tracked ? count(row.visitors) : '—'}</td>}
                  <td className="px-1 text-right">{row.tracked ? count(row.viewers) : '—'}</td>
                  <td className="px-1 text-right">{row.tracked ? count(row.clickers) : '—'}</td>
                  <td className="px-1 text-right">{row.tracked ? clickRate(row) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs leading-relaxed text-zinc-500">노출은 배너의 절반 이상이 1초간 보였거나 클릭한 경우입니다. —는 집계 전이거나 클릭률을 계산할 노출이 없는 경우입니다.</p>
    </section>
  );
}
