import { useEffect, useState, type FormEvent } from 'react';
import { Megaphone, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { koMessage } from '@/utils/errors';
import {
  editAdBanner, fetchAdBanners, registerAdBanner, setAdEnabled,
  type AdminBanner,
} from './ads.api';
import { AdBannerContent, AdBannerPreview, adCardClass, useAdImage } from './HomeAdBanner';
import AdPerformance from './AdPerformance';
const koreaTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
});

const emptyDraft = { advertiser: '', headline: '', description: '', url: '', start: '', end: '' };

function koreanDateTimeInput(value: string | null) {
  return value ? new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 19) : '';
}

function bannerDraft(banner?: AdminBanner) {
  if (!banner) return emptyDraft;
  return {
    advertiser: banner.advertiser, headline: banner.headline, description: banner.description,
    url: banner.destination_url, start: koreanDateTimeInput(banner.starts_at),
    end: koreanDateTimeInput(banner.ends_at),
  };
}

function bannerStatus(banner: AdminBanner) {
  const now = Date.now();
  if (banner.ends_at && Date.parse(banner.ends_at) <= now) return '종료';
  if (!banner.enabled) return '일시 중지';
  return Date.parse(banner.starts_at) > now ? '예약' : '노출 중';
}

export default function AdminAdsPage() {
  const { profile } = useAuth();
  const [banners, setBanners] = useState<AdminBanner[] | null>(null);
  const [bannersError, setBannersError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [performanceBannerId, setPerformanceBannerId] = useState<string | null>(null);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [busyBanner, setBusyBanner] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let disposed = false;
    setBannersError(false);
    fetchAdBanners().then(rows => { if (!disposed) setBanners(rows); })
      .catch(() => { if (!disposed) setBannersError(true); });
    return () => { disposed = true; };
  }, [revision]);

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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-zinc-900">
          <Megaphone size={23} className="text-sakura-600" aria-hidden="true" />광고 관리
        </h1>
        <button type="button" className="btn-ghost gap-1.5" onClick={refresh}><RefreshCw size={15} aria-hidden="true" />새로고침</button>
      </header>

      <AdPerformance revision={revision} />

      {profile && <BannerForm ownerId={profile.id} onSaved={refresh} />}

      <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="ad-list-title">
        <h2 id="ad-list-title" className="font-display text-lg font-bold">등록한 배너</h2>
        {bannersError && <p role="alert" className="text-sm text-rose-700">배너 목록을 불러오지 못했습니다. 새로고침을 눌러주세요.</p>}
        {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
        {actionMessage && <p role="status" className="text-sm text-emerald-700">{actionMessage}</p>}
        {!banners && !bannersError && <p role="status" className="text-sm text-zinc-500">배너를 불러오는 중…</p>}
        {banners?.length === 0 && <p className="text-sm text-zinc-500">등록한 배너가 없습니다.</p>}
        {banners?.map(banner => {
          if (profile && editingBanner?.id === banner.id) {
            return <BannerForm key={banner.id} banner={editingBanner} ownerId={profile.id}
              onCancel={() => setEditingBanner(null)} onSaved={() => {
                setEditingBanner(null);
                setActionError('');
                setActionMessage('배너를 수정했습니다.');
                refresh();
              }} />;
          }
          const status = bannerStatus(banner);
          const performanceOpen = performanceBannerId === banner.id;
          const performanceId = `banner-performance-${banner.id}`;
          return (
            <article key={banner.id} className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{status}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost" aria-expanded={performanceOpen} aria-controls={performanceId}
                    onClick={() => setPerformanceBannerId(performanceOpen ? null : banner.id)}>
                    {performanceOpen ? '성과 닫기' : '성과 보기'}
                  </button>
                  <button type="button" className="btn-ghost" disabled={Boolean(editingBanner) || busyBanner !== null}
                    onClick={() => setEditingBanner(banner)}>수정하기</button>
                  {status !== '종료' && (
                    <button type="button" className="btn-ghost" disabled={busyBanner !== null} onClick={() => void toggle(banner)}>
                      {banner.enabled ? '일시 중지' : '노출 시작'}
                    </button>
                  )}
                </div>
              </div>
              <AdBannerPreview banner={banner} />
              <p className="text-xs text-zinc-600">
                {koreaTime.format(new Date(banner.starts_at))} ~ {banner.ends_at ? koreaTime.format(new Date(banner.ends_at)) : '종료일 없음'}
              </p>
              <p className="break-all text-xs text-zinc-500">{banner.destination_url}</p>
              <div id={performanceId} hidden={!performanceOpen}>
                {performanceOpen && <AdPerformance revision={revision} bannerId={banner.id} />}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function BannerForm({ ownerId, banner, onSaved, onCancel }: {
  ownerId: string;
  banner?: AdminBanner;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(() => bannerDraft(banner));
  const [removeImage, setRemoveImage] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const savedImage = useAdImage(!removeImage && !image ? banner?.image_path ?? null : null);
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
    if (!banner) setDraftId(null);
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    setError('');
    setSaved(false);
    const initial = bannerDraft(banner);
    const startsAt = draft.start ? new Date(draft.start + '+09:00') : null;
    const endsAt = draft.end ? new Date(draft.end + '+09:00') : null;
    if (!draft.advertiser.trim() || !draft.headline.trim()) {
      setError('광고주와 제목을 입력해주세요.');
      return;
    }
    const earliestEnd = banner ? startsAt?.getTime() ?? Date.parse(banner.starts_at) : Math.max(Date.now(), startsAt?.getTime() ?? 0);
    if (endsAt && endsAt.getTime() <= earliestEnd && (!banner || initial.start !== draft.start || initial.end !== draft.end)) {
      setError(banner ? '종료 시간은 시작 시간보다 나중이어야 합니다.' : '종료 시간은 현재와 시작 시간보다 나중으로 선택해주세요.');
      return;
    }
    const id = draftId ?? crypto.randomUUID();
    setDraftId(id);
    setSaving(true);
    try {
      const input = {
        id: banner?.id ?? id, ownerId, image, advertiser: draft.advertiser, headline: draft.headline,
        description: draft.description, url: draft.url,
        startsAt: banner && initial.start === draft.start ? banner.starts_at : startsAt?.toISOString() ?? null,
        endsAt: banner && initial.end === draft.end ? banner.ends_at : endsAt?.toISOString() ?? null,
      };
      if (banner) {
        await editAdBanner(input, id, removeImage);
        onSaved();
        return;
      }
      await registerAdBanner(input);
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
    <section className="card space-y-3 p-4 sm:p-5" aria-labelledby={banner ? 'ad-edit-title' : 'ad-register-title'}>
      <h2 id={banner ? 'ad-edit-title' : 'ad-register-title'} className="font-display text-lg font-bold">
        {banner ? '배너 수정' : '배너 등록'}
      </h2>
      {!banner && <p className="text-xs text-zinc-600">등록 후 목록에서 ‘노출 시작’을 눌러 공개합니다.</p>}
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">광고주<input required maxLength={60} className="input mt-1 w-full" value={draft.advertiser} onChange={event => update('advertiser', event.target.value)} /></label>
          <label className="text-sm">제목<input required maxLength={80} className="input mt-1 w-full" value={draft.headline} onChange={event => update('headline', event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">혜택 설명<input maxLength={160} className="input mt-1 w-full" value={draft.description} onChange={event => update('description', event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">광고 링크<input type="url" required maxLength={2048} placeholder="https://" className="input mt-1 w-full" value={draft.url} onChange={event => update('url', event.target.value)} /></label>
          <label className="min-w-0 text-sm">시작 시간 (한국 시간, 선택)
            <input type="datetime-local" step="1" className="input mt-1 w-full min-w-0" value={draft.start} onChange={event => update('start', event.target.value)} />
          </label>
          <label className="min-w-0 text-sm">종료 시간 (한국 시간, 선택)
            <input type="datetime-local" step="1" className="input mt-1 w-full min-w-0" value={draft.end} onChange={event => update('end', event.target.value)} />
          </label>
          <label className="min-w-0 text-sm sm:col-span-2">배너 이미지 (선택)
            <input type="file" accept="image/jpeg,image/png,image/webp" className="input mt-1 w-full"
              onChange={event => { setImage(event.target.files?.[0] ?? null); setRemoveImage(false); setDraftId(null); setSaved(false); }} />
          </label>
          {banner?.image_path && !image && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={removeImage} onChange={event => setRemoveImage(event.target.checked)} />
              기존 이미지 제거
            </label>
          )}
          {(draft.headline || image) && (
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-zinc-600">미리보기</p>
              <div className={adCardClass + ' max-w-sm'}>
                <AdBannerContent advertiser={draft.advertiser} headline={draft.headline} description={draft.description} imageUrl={preview ?? savedImage} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary flex-1">
              {saving ? '저장 중…' : banner ? '수정 저장' : '배너 등록하기'}
            </button>
            {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>취소</button>}
          </div>
        </fieldset>
      </form>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-700">배너를 등록했습니다. 목록에서 노출을 시작할 수 있습니다.</p>}
    </section>
  );
}
