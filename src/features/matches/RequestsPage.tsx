import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CircleAlert, Inbox, Mail, PartyPopper, Send, Sprout, type LucideIcon } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Loading from '@/components/common/Loading';
import Button from '@/components/common/Button';
import MatchRequestCard from '@/components/match/MatchRequestCard';
import { acceptRequest, fetchMyRequests, rejectRequest } from './matches.api';
import type { MatchRequestWithTeams } from './matches.types';
import { koMessage } from '@/utils/errors';

type Tab = 'incoming' | 'outgoing' | 'matched';

export default function RequestsPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('incoming');
  const [loading, setLoading] = useState(true);
  const [outgoing, setOutgoing] = useState<MatchRequestWithTeams[]>([]);
  const [incoming, setIncoming] = useState<MatchRequestWithTeams[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMsg(null);
    
    // 페이지 레벨 안전장치: 12초 안에 응답 없으면 강제 종료
    const safetyTimer = setTimeout(() => {
      console.warn('[requests] page-level safety timeout');
      setLoading(false);
      setErrorMsg('데이터를 불러오는데 시간이 오래 걸려요. 새로고침 해주세요.');
    }, 12000);

    try {
      const r = await fetchMyRequests();
      setIncoming(r.incoming);
      setOutgoing(r.outgoing);
    } catch (e) {
      console.warn('[requests] load error:', e);
      setErrorMsg(koMessage(e));
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onAccept = async (id: string) => {
    setBusyId(id);
    try {
      await acceptRequest(id);
      await new Promise((r) => setTimeout(r, 500));
      await load();
      alert('수락 완료! "매칭완료" 탭에서 연락처를 확인하세요.');
      setTab('matched');
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (id: string) => {
    if (!confirm('정말 거절하시겠어요?')) return;
    setBusyId(id);
    try {
      await rejectRequest(id);
      await load();
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  // 매칭완료 = 양쪽(받은+보낸) accepted 모두 합치기 (중복 제거)
  const matchedAll = [...incoming, ...outgoing].filter((r) => r.status === 'accepted');
  const matchedDedup = Array.from(
    new Map(matchedAll.map((r) => [r.id, r])).values()
  );

  // 받은신청 = pending + rejected + cancelled (accepted는 매칭완료 탭으로)
  const incomingFiltered = incoming.filter((r) => r.status !== 'accepted');
  const outgoingFiltered = outgoing.filter((r) => r.status !== 'accepted');

  const list =
    tab === 'incoming' ? incomingFiltered :
    tab === 'outgoing' ? outgoingFiltered :
    matchedDedup;

  return (
    <PageLayout subtitle="신청 현황을 확인하세요">
      {/* 3개 탭 */}
      <div className="mb-4 flex rounded-full bg-zinc-100 p-1">
        <TabButton
          active={tab === 'incoming'}
          onClick={() => setTab('incoming')}
          label="받은 신청"
          count={incomingFiltered.filter((r) => r.status === 'pending').length}
        />
        <TabButton
          active={tab === 'outgoing'}
          onClick={() => setTab('outgoing')}
          label="보낸 신청"
          count={outgoingFiltered.length}
        />
        <TabButton
          active={tab === 'matched'}
          onClick={() => setTab('matched')}
          label="매칭완료"
          count={matchedDedup.length}
          highlight
        />
      </div>

      {loading ? (
        <Loading />
      ) : errorMsg ? (
        <div className="card p-6 text-center space-y-3">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            <CircleAlert size={24} strokeWidth={1.8} />
          </span>
          <p className="font-semibold text-zinc-700">데이터를 불러오지 못했어요</p>
          <p className="text-sm text-zinc-500">{errorMsg}</p>
          <Button onClick={load} className="w-full">다시 시도</Button>
        </div>
      ) : list.length === 0 ? (
        <EmptyState tab={tab} />
      ) : tab === 'matched' ? (
        <div className="space-y-3">
          {list.map((r) => (
            <MatchedCard key={r.id} request={r} onClick={() => nav(`/matches/${r.id}`)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <MatchRequestCard
              key={r.id}
              request={r}
              side={tab === 'incoming' ? 'incoming' : 'outgoing'}
              busy={busyId === r.id}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}

// ----- 보조 컴포넌트들 -----

function TabButton({
  active, onClick, label, count, highlight,
}: {
  active: boolean; onClick: () => void; label: string; count: number; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-xs font-medium transition ${
        active
          ? highlight
            ? 'bg-gradient-to-r from-sakura-500 to-sakura-400 text-white shadow-soft'
            : 'bg-white text-sakura-600 shadow-soft'
          : 'text-zinc-500'
      }`}
    >
      {label}
      {count > 0 && <span className="ml-1 text-[10px]">({count})</span>}
    </button>
  );
}

function MatchedCard({
  request, onClick,
}: {
  request: MatchRequestWithTeams; onClick: () => void;
}) {
  return (
    <article
      onClick={onClick}
      className="card relative overflow-hidden cursor-pointer p-5 transition hover:shadow-lg active:scale-[0.99] bg-gradient-to-br from-sakura-50 via-white to-amber-50"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-sakura-500 px-3 py-1 text-xs font-bold text-white">
          <PartyPopper size={12} strokeWidth={2} />
          매칭 성공
        </span>
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-sakura-600">
          탭하여 보기
          <ChevronRight size={14} strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-3 font-display text-lg leading-snug text-zinc-900">
        "{request.from_team?.intro ?? '...'}" · "{request.to_team?.intro ?? '...'}"
      </p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500">
        <Mail size={13} strokeWidth={1.8} />
        연락처가 공개되었어요. 카드를 탭하여 확인하세요.
      </p>
    </article>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const config: { Icon: LucideIcon; title: string; desc: string } = {
    incoming: { Icon: Inbox,  title: '받은 신청이 없어요', desc: '매력적인 팀 소개로 신청을 끌어보세요!' },
    outgoing: { Icon: Send,   title: '보낸 신청이 없어요', desc: '홈 화면에서 마음에 드는 팀에 신청해보세요!' },
    matched:  { Icon: Sprout, title: '아직 매칭 성사가 없어요', desc: '신청을 주고받다 보면 좋은 인연이 찾아올 거예요!' },
  }[tab];
  const { Icon } = config;
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-sakura-50 text-sakura-500">
        <Icon size={24} strokeWidth={1.8} />
      </span>
      <p className="mt-3 font-semibold text-zinc-700">{config.title}</p>
      <p className="mt-1 text-sm text-zinc-400">{config.desc}</p>
    </div>
  );
}