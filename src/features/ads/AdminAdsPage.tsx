import { useEffect, useState, type FormEvent } from 'react';
import { Megaphone, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { koMessage } from '@/utils/errors';
import {
  fetchAdBanners, fetchAdMetrics, registerAdBanner, setAdEnabled,
  type AdminBanner, type AdMetrics,
} from './ads.api';
import { AdBannerContent, AdBannerPreview, adCardClass } from './HomeAdBanner';

const koreaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });
const koreaTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
});

const emptyDraft = { advertiser: '', headline: '', description: '', url: '', start: '', end: '' };

function bannerStatus(banner: AdminBanner) {
  const now = Date.now();
  if (banner.ends_at && Date.parse(banner.ends_at) <= now) return '종료';
  if (!banner.enabled) return '일시 중지';
  return Date.parse(banner.starts_at) > now ? '예약' : '노출 중';
}

function count(value: number) {
  return Number(value).toLocaleString('ko-KR');
}

function clickRate(row: AdMetrics) {
  return row.viewers > 0 ? (100 * row.clickers / row.viewers).toFixed(1) + '%' : '—';
}

export default function AdminAdsPage() {
  const { profile } = useAuth();
  const [banners, setBanners] = useState<AdminBanner[] | null>(null);
  const [metrics, setMetrics] = useState<AdMetrics[] | null>(null);
  const [bannersError, setBannersError] = useState(false);
  const [metricsError, setMetricsError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [bannerFilter, setBannerFilter] = useState('');
  const today = koreaDate.format(new Date());
  const [from, setFrom] = useState(() => koreaDate.format(new Date(Date.now() - 6 * 86400000)));
  const [through, setThrough] = useState(today);
  const [busyBanner, setBusyBanner] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const span = (Date.parse(through) - Date.parse(from)) / 86400000;
  const validRange = Boolean(from && through && span >= 0 && span < 90 && through <= today);

  useEffect(() => {
    let disposed = false;
    setBannersError(false);
    fetchAdBanners().then(rows => { if (!disposed) setBanners(rows); })
      .catch(() => { if (!disposed) setBannersError(true); });
    return () => { disposed = true; };
  }, [revision]);

  useEffect(() => {
    let disposed = false;
    setMetrics(null);
    setMetricsError(false);
    if (validRange) {
      fetchAdMetrics(from, through, bannerFilter).then(rows => { if (!disposed) setMetrics(rows); })
        .catch(() => { if (!disposed) setMetricsError(true); });
    }
    return () => { disposed = true; };
  }, [from, through, bannerFilter, validRange, revision]);

  function refresh() { setRevision(value => value + 1); }

  async function toggle(banner: AdminBanner) {
    if (busyBanner) return;
    setBusyBanner(banner.id);
    setActionError('');
    setActionMessage('');
    try {
      await setAdEnabled(banner.id, !banner.enabled);
      setBanners(rows => rows?.map(row => row.id === banner.id ? { ...row, enabled: !banner.enabled } : row) ?? null);
      setActionMessage(banner.enabled ? '배너를 일시 중지했습니다.' : '배너 노출을 설정했습니다.');
      refresh();
    } catch (error) {
      setActionError(koMessage(error));
    } finally {
      setBusyBanner(null);
    }
  }

  const latest = metrics?.[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-zinc-900">
          <Megaphone size={23} className="text-sakura-600" aria-hidden="true" />광고 관리
        </h1>
        <button type="button" className="btn-ghost gap-1.5" onClick={refresh}><RefreshCw size={15} aria-hidden="true" />새로고침</button>
      </header>

      <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="ad-stats-title">
        <div>
          <h2 id="ad-stats-title" className="font-display text-lg font-bold">날짜별 성과</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">한국 시간 기준. 같은 회원은 하루에 한 번씩 셉니다. 배너를 선택해도 홈 방문은 전체 회원 기준입니다.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="min-w-0 text-sm">시작 날짜
            <input className="input mt-1 w-full min-w-0" type="date" value={from} max={today} onChange={event => setFrom(event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">종료 날짜
            <input className="input mt-1 w-full min-w-0" type="date" value={through} min={from} max={today} onChange={event => setThrough(event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">배너
            <select aria-label="배너" className="input mt-1 w-full min-w-0" value={bannerFilter} onChange={event => setBannerFilter(event.target.value)}>
              <option value="">전체 배너</option>
              {banners?.map(banner => <option key={banner.id} value={banner.id}>{banner.advertiser} · {banner.headline}</option>)}
            </select>
          </label>
        </div>
        {!validRange && <p role="alert" className="text-sm text-rose-700">오늘까지의 날짜를 최대 90일로 선택해주세요.</p>}
        {metricsError && <p role="alert" className="text-sm text-rose-700">성과를 불러오지 못했습니다. 새로고침을 눌러주세요.</p>}
        {validRange && !metricsError && !metrics && <p role="status" className="text-sm text-zinc-500">성과를 불러오는 중…</p>}
        {latest && (
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-600">{latest.day === today ? '오늘 · ' : ''}{latest.day}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['홈 방문', count(latest.visitors) + '명'], ['배너 노출', count(latest.viewers) + '명'],
                ['배너 클릭', count(latest.clickers) + '명'], ['클릭률', clickRate(latest)],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-sakura-50 px-3 py-2.5">
                  <p className="text-xs text-zinc-600">{label}</p>
                  <p className="mt-1 text-lg font-bold text-zinc-900">{latest.tracked ? value : '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {metrics && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="광고 일별 성과">
              <thead className="border-b border-zinc-200 text-xs text-zinc-600">
                <tr><th className="px-1 py-2 text-left">날짜</th><th className="px-1 text-right">방문</th><th className="px-1 text-right">노출</th><th className="px-1 text-right">클릭</th><th className="px-1 text-right">클릭률</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {metrics.map(row => (
                  <tr key={row.day}>
                    <th scope="row" className="whitespace-nowrap px-1 py-2 text-left font-medium">{row.day}</th>
                    <td className="px-1 text-right">{row.tracked ? count(row.visitors) : '—'}</td>
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

      {profile && <RegisterBanner ownerId={profile.id} onSaved={refresh} />}

      <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="ad-list-title">
        <h2 id="ad-list-title" className="font-display text-lg font-bold">등록한 배너</h2>
        {bannersError && <p role="alert" className="text-sm text-rose-700">배너 목록을 불러오지 못했습니다. 새로고침을 눌러주세요.</p>}
        {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
        {actionMessage && <p role="status" className="text-sm text-emerald-700">{actionMessage}</p>}
        {!banners && !bannersError && <p role="status" className="text-sm text-zinc-500">배너를 불러오는 중…</p>}
        {banners?.length === 0 && <p className="text-sm text-zinc-500">등록한 배너가 없습니다.</p>}
        {banners?.map(banner => {
          const status = bannerStatus(banner);
          return (
            <article key={banner.id} className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{status}</p>
                {status !== '종료' && (
                  <button type="button" className="btn-ghost" disabled={busyBanner !== null} onClick={() => void toggle(banner)}>
                    {banner.enabled ? '일시 중지' : '노출 시작'}
                  </button>
                )}
              </div>
              <AdBannerPreview banner={banner} />
              <p className="text-xs text-zinc-600">
                {koreaTime.format(new Date(banner.starts_at))} ~ {banner.ends_at ? koreaTime.format(new Date(banner.ends_at)) : '종료일 없음'}
              </p>
              <p className="break-all text-xs text-zinc-500">{banner.destination_url}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function RegisterBanner({ ownerId, onSaved }: { ownerId: string; onSaved: () => void }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!image) { setPreview(undefined); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function update(key: keyof typeof emptyDraft, value: string) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setDraftId(null);
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    setError('');
    setSaved(false);
    const startsAt = draft.start ? new Date(draft.start + '+09:00') : null;
    const endsAt = draft.end ? new Date(draft.end + '+09:00') : null;
    if (!draft.advertiser.trim() || !draft.headline.trim()) {
      setError('광고주와 제목을 입력해주세요.');
      return;
    }
    if (endsAt && endsAt.getTime() <= Math.max(Date.now(), startsAt?.getTime() ?? 0)) {
      setError('종료 시간은 현재와 시작 시간보다 나중으로 선택해주세요.');
      return;
    }
    const id = draftId ?? crypto.randomUUID();
    setDraftId(id);
    setSaving(true);
    try {
      await registerAdBanner({
        id, ownerId, image, advertiser: draft.advertiser, headline: draft.headline,
        description: draft.description, url: draft.url,
        startsAt: startsAt?.toISOString() ?? null, endsAt: endsAt?.toISOString() ?? null,
      });
      setDraft(emptyDraft);
      setImage(null);
      setDraftId(null);
      form.reset();
      setSaved(true);
      onSaved();
    } catch (failure) {
      setError(koMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="ad-register-title">
      <h2 id="ad-register-title" className="font-display text-lg font-bold">배너 등록</h2>
      <p className="text-xs text-zinc-600">등록 후 목록에서 ‘노출 시작’을 눌러 공개합니다.</p>
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">광고주<input required maxLength={60} className="input mt-1 w-full" value={draft.advertiser} onChange={event => update('advertiser', event.target.value)} /></label>
          <label className="text-sm">제목<input required maxLength={80} className="input mt-1 w-full" value={draft.headline} onChange={event => update('headline', event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">혜택 설명<input maxLength={160} className="input mt-1 w-full" value={draft.description} onChange={event => update('description', event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">광고 링크<input type="url" required maxLength={2048} placeholder="https://" className="input mt-1 w-full" value={draft.url} onChange={event => update('url', event.target.value)} /></label>
          <label className="min-w-0 text-sm">시작 시간 (한국 시간, 선택)
            <input type="datetime-local" className="input mt-1 w-full min-w-0" value={draft.start} onChange={event => update('start', event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">종료 시간 (한국 시간, 선택)
            <input type="datetime-local" className="input mt-1 w-full min-w-0" value={draft.end} onChange={event => update('end', event.target.value)} />
          </label>
          <label className="min-w-0 text-sm sm:col-span-2">배너 이미지 (선택)
            <input type="file" accept="image/jpeg,image/png,image/webp" className="input mt-1 w-full"
              onChange={event => { setImage(event.target.files?.[0] ?? null); setDraftId(null); setSaved(false); }} />
          </label>
          {(draft.headline || image) && (
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-zinc-600">미리보기</p>
              <div className={adCardClass + ' max-w-sm'}>
                <AdBannerContent advertiser={draft.advertiser} headline={draft.headline} description={draft.description} imageUrl={preview} />
              </div>
            </div>
          )}
          <button type="submit" className="btn-primary sm:col-span-2">{saving ? '등록 중…' : '배너 등록하기'}</button>
        </fieldset>
      </form>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-700">배너를 등록했습니다. 목록에서 노출을 시작할 수 있습니다.</p>}
    </section>
  );
}
