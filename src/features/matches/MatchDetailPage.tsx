import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Check, CircleAlert, Copy, Mail, ShieldAlert, UsersRound } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { fetchMatchDetail } from './matches.api';
import type { MatchRequestWithTeams } from './matches.types';
import { SCHOOL_BADGE_COLOR, labelContact } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { admissionLabel } from '@/utils/format';

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [match, setMatch] = useState<MatchRequestWithTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!id) { setLoading(false); return; }
      try {
        const m = await fetchMatchDetail(id);
        setMatch(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <PageLayout><Loading /></PageLayout>;
  
  if (!match || match.status !== 'accepted') {
    return (
      <PageLayout subtitle="매칭 정보">
        <div className="card p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            <CircleAlert size={24} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-semibold">매칭 정보를 찾을 수 없어요</p>
          <p className="mt-1 text-sm text-zinc-400">아직 수락되지 않았거나 권한이 없습니다.</p>
          <Button variant="ghost" className="mt-4" onClick={() => nav('/requests')}>신청내역으로</Button>
        </div>
      </PageLayout>
    );
  }

  // 내 팀이 from인지 to인지 판단해서 상대팀 결정
  const myTeamIsFrom = match.from_team.owner_id === profile?.id;
  const myTeam = myTeamIsFrom ? match.from_team : match.to_team;
  const otherTeam = myTeamIsFrom ? match.to_team : match.from_team;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      alert(`복사 실패. 직접 입력해주세요: ${text}`);
    }
  };

  return (
    <PageLayout subtitle="매칭 성공">
      {/* 축하 헤더 */}
      <section className="card relative overflow-hidden bg-gradient-to-br from-sakura-100 via-white to-amber-50 p-6">
        <p className="text-sm font-semibold text-sakura-600">매칭 성사</p>
        <h1 className="font-display text-2xl font-bold text-zinc-900 mt-1">
          {otherTeam.intro && `“${otherTeam.intro}”`}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          서로 좋은 인연으로 이어지길 바랄게요.
        </p>
      </section>

      {/* 안내 메세지 */}
      <section className="mt-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          <Camera size={15} strokeWidth={2} />
          이 페이지를 이미지로 저장하세요
        </p>
        <p className="mt-1 text-xs text-amber-700 leading-relaxed">
          상대 연락처가 사라지지 않도록 화면을 캡처해 보관하세요.<br />
          <strong>먼저 연락을 시작해보세요.</strong> 첫 메시지가 매칭의 시작이에요.
        </p>
      </section>

      {/* 상대 팀 연락처 */}
      <section className="mt-4">
        <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
          <Mail size={15} strokeWidth={1.8} />
          상대 팀 ({otherTeam.gender === 'male' ? '남자팀' : '여자팀'})
        </h2>
        {otherTeam.members && otherTeam.members.length > 0 ? (
          <ul className="space-y-2">
            {otherTeam.members.map((m) => (
              <li key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`badge ring-1 ${SCHOOL_BADGE_COLOR[m.school]}`}>{m.school}</span>
                      <p className="font-bold text-zinc-900">{m.nickname}</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{m.department} · {admissionLabel(m.student_number)}</p>
                    <Badge tone={m.smoking ? 'amber' : 'green'} className="mt-2">
                      {m.smoking ? '흡연' : '비흡연'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-sakura-50 px-3 py-2.5 ring-1 ring-sakura-100">
                  <div>
                    <p className="text-[11px] text-sakura-600 font-medium">{labelContact(m.contact_type)}</p>
                    <p className="font-mono text-sm text-zinc-900 select-all">{m.contact_id}</p>
                  </div>
                  <button
                    onClick={() => copy(m.contact_id)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sakura-600 ring-1 ring-sakura-200"
                  >
                    {copied === m.contact_id
                      ? <><Check size={13} strokeWidth={2.4} />복사됨</>
                      : <><Copy size={13} strokeWidth={2} />복사</>}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card p-5 text-center text-sm text-zinc-400">
            연락처를 불러오는 중...
          </div>
        )}
      </section>

      {/* 우리 팀 정보 (참고용) */}
      <section className="mt-6">
        <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
          <UsersRound size={15} strokeWidth={1.8} />
          우리 팀 ({myTeam.gender === 'male' ? '남자팀' : '여자팀'})
        </h2>
        <div className="card p-4">
          {myTeam.intro && <p className="font-display text-base text-zinc-700 mb-3">“{myTeam.intro}”</p>}
          <ul className="divide-y divide-zinc-100 rounded-xl bg-zinc-50/60 ring-1 ring-zinc-100">
            {(myTeam.members ?? []).map((m) => (
              <li key={m.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{m.nickname}</span>
                  <span className="text-xs text-zinc-500">{m.school}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-6 space-y-2">
        <Button variant="ghost" className="w-full" onClick={() => nav('/requests')}>
          신청내역으로 돌아가기
        </Button>
        <button
          type="button"
          onClick={() => nav(`/report?user=${otherTeam.owner_id}&team=${otherTeam.id}`)}
          className="inline-flex w-full items-center justify-center gap-1.5 py-3 text-sm text-zinc-400 transition hover:text-rose-500"
        >
          <ShieldAlert size={15} strokeWidth={1.8} />
          이 팀 신고하기
        </button>
      </div>
    </PageLayout>
  );
}