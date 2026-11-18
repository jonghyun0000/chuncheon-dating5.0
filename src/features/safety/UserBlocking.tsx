import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import { blockingAvailable, blockTeamOwner, blockReviewAuthor, blockedUsers, unblockUser, type BlockedUser } from './blocking.api';

// Schema-first rollout: old databases must not expose non-working safety controls.
const availability = new Map<string, { until: number; value: Promise<boolean> }>();
function useBlockingAvailable() {
  const { profile } = useAuth();
  const [status, setStatus] = useState({ userId: '', enabled: false });
  useEffect(() => {
    let active = true;
    setStatus({ userId: '', enabled: false });
    if (!profile?.id || profile.role === 'admin') return;
    let cached = availability.get(profile.id);
    if (!cached || cached.until < Date.now()) {
      cached = { until: Date.now() + 60000, value: blockingAvailable().catch(() => false) };
      availability.set(profile.id, cached);
    }
    const userId = profile.id;
    void cached.value.then(value => { if (active) setStatus({ userId, enabled: value }); });
    return () => { active = false; };
  }, [profile?.id, profile?.role]);
  return status.enabled && status.userId === profile?.id && profile?.role !== 'admin';
}

export function BlockTeamButton({ teamId, onBlocked }: { teamId: string; onBlocked: () => void }) {
  return <BlockAccountButton label="이 팀 계정 차단" title="이 팀의 계정을 차단할까요?"
    scope="팀원 각각의 계정이 아니라 팀을 만든 계정을 차단해요."
    block={() => blockTeamOwner(teamId)} onBlocked={onBlocked} />;
}

export function BlockReviewButton({ reviewId, onBlocked }: { reviewId: string; onBlocked: () => void }) {
  return <BlockAccountButton label="후기 작성자 차단" title="이 후기 작성자를 차단할까요?"
    scope="이 후기를 작성한 계정이 올린 다른 후기와 팀에도 적용돼요."
    block={() => blockReviewAuthor(reviewId)} onBlocked={onBlocked} />;
}

function BlockAccountButton({ label, title, scope, block, onBlocked }: {
  label: string; title: string; scope: string; block: () => Promise<void>; onBlocked: () => void;
}) {
  const enabled = useBlockingAvailable();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!enabled) return null;
  const close = () => { if (!saving) { setOpen(false); setFailed(false); } };
  return <>
    <button type="button" className="mt-3 text-sm text-zinc-500 underline underline-offset-2"
      onClick={() => setOpen(true)}>{label}</button>
    <Modal open={open} onClose={close} title={title}>
      <p className="text-sm leading-relaxed text-zinc-600">상대 계정과 서로 팀·사진·신청 내역·후기를 볼 수 없고 새로 신청할 수 없어요. 상대가 새 팀을 만들어도 적용돼요.</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{scope} 기존 약속이나 외부 단체방은 자동 취소되지 않으며, 이미 확인한 정보는 회수할 수 없어요. 차단 해제는 마이페이지에서 할 수 있어요.</p>
      {failed && <p role="alert" className="mt-3 text-sm text-rose-700">차단하지 못했어요. 네트워크를 확인하고 다시 시도해주세요.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" disabled={saving} onClick={close}>취소</Button>
        <Button variant="danger" loading={saving} onClick={async () => {
          setSaving(true); setFailed(false);
          try { await block(); setOpen(false); onBlocked(); }
          catch { setFailed(true); }
          finally { setSaving(false); }
        }}>차단하기</Button>
      </div>
    </Modal>
  </>;
}

export function BlockedUsers() {
  const enabled = useBlockingAvailable();
  const [rows, setRows] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true); setError(false);
    void blockedUsers().then(data => { if (active) setRows(data); }, () => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, retry]);
  if (!enabled) return null;
  return <section className="card mb-4 p-5">
    <h2 className="font-semibold">차단한 계정 관리</h2>
    <p className="mt-2 text-xs text-zinc-500">차단 당시 팀 소개 또는 후기 닉네임으로 표시해요. 내가 해제해도 상대의 차단이나 지인 피하기 설정은 유지돼요.</p>
    {loading ? <p role="status" className="mt-3 text-sm">불러오는 중…</p> : <ul className="mt-3 divide-y divide-zinc-100">
      {rows.map(row => <li key={row.user_id} className="flex items-center gap-3 py-3 text-sm">
        <span className="min-w-0 flex-1 break-words">{row.label}</span>
        <Button variant="ghost" disabled={busy !== null} loading={busy === row.user_id} onClick={async () => {
          setBusy(row.user_id); setError(false);
          try { await unblockUser(row.user_id); setRows(items => items.filter(item => item.user_id !== row.user_id)); }
          catch { setError(true); }
          finally { setBusy(null); }
        }}>차단 해제</Button>
      </li>)}
    </ul>}
    {!loading && !error && !rows.length && <p className="mt-3 text-sm text-zinc-500">차단한 계정이 없어요.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">차단 설정을 확인하지 못했어요. <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></p>}
  </section>;
}
