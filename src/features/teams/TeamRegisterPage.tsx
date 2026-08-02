import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';
import MemberForm from '@/components/team/MemberForm';
import {
  createTeam,
  deleteMyTeam,
  fetchMyActiveTeam,
  fetchMyMatchedTeam,
  finishMyTeam,
  updateTeam,
} from './teams.api';
import type { MemberInput, TeamRegisterInput } from './teams.types';
import type { Team, TeamMember, TeamSize } from '@/types/database.types';
import { koMessage } from '@/utils/errors';
import { admissionLabel } from '@/utils/format';
import { isValidStudentNumber, normalizeStudentNumber, studentNumberError } from '@/utils/validators';
import Badge from '@/components/common/Badge';
import { VerificationBanner } from '@/components/common/StatusBanner';

const empty: MemberInput = {
  school: '강원대',
  department: '',
  student_number: '',
  nickname: '',
  smoking: false,
  contact_type: 'kakao',
  contact_id: '',
};

type Mode = 'view' | 'create' | 'edit';

export default function TeamRegisterPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [activeMembers, setActiveMembers] = useState<TeamMember[]>([]);
  const [matchedTeam, setMatchedTeam] = useState<Team | null>(null);
  const [matchedMembers, setMatchedMembers] = useState<TeamMember[]>([]);

  const [mode, setMode] = useState<Mode>('create');
  const [intro, setIntro] = useState('');
  const [teamSize, setTeamSize] = useState<TeamSize>(3);
  const [members, setMembers] = useState<MemberInput[]>([
    { ...empty }, { ...empty }, { ...empty },
  ]);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const reload = useCallback(async () => {
    const [active, matched] = await Promise.all([
      fetchMyActiveTeam(),
      fetchMyMatchedTeam(),
    ]);
    setActiveTeam(active.team);
    setActiveMembers(active.members);
    setMatchedTeam(matched.team);
    setMatchedMembers(matched.members);

    if (active.team) {
      setMode('view');
    } else {
      setMode('create');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  useEffect(() => {
    setMembers((prev) => {
      if (prev.length === teamSize) return prev;
      if (prev.length < teamSize) {
        return [...prev, ...Array.from({ length: teamSize - prev.length }, () => ({ ...empty }))];
      }
      return prev.slice(0, teamSize);
    });
  }, [teamSize]);

  const enterEdit = () => {
    if (!activeTeam) return;
    setIntro(activeTeam.intro);
    setTeamSize(activeTeam.team_size);
    setMembers(
      activeMembers.map((m) => ({
        school: m.school,
        department: m.department,
        student_number: m.student_number,
        nickname: m.nickname,
        smoking: m.smoking,
        contact_type: m.contact_type,
        contact_id: m.contact_id,
      }))
    );
    setMode('edit');
    setConsent(activeTeam?.members_consent_confirmed ?? false);
    setErr(null);
  };

  /** 새 과팅 시작하기: 매칭 종료 → 등록 폼으로 전환 */
  const startNewGating = async () => {
    const ok = confirm(
      '새로운 과팅을 시작하시겠어요?\n\n' +
      '- 이전 매칭은 종료 처리됩니다.\n' +
      '- 신청내역의 매칭완료 기록은 그대로 유지됩니다.\n' +
      '- 종료 후 새 팀을 등록하고 다시 신청할 수 있습니다.'
    );
    if (!ok) return;

    setFinishing(true);
    try {
      await finishMyTeam();

      // 데이터 새로고침
      await reload();

      // 등록 폼 초기화 + 강제로 create 모드 진입
      setIntro('');
      setMembers([{ ...empty }, { ...empty }, { ...empty }]);
      setTeamSize(3);
      setConsent(false);
      setMode('create');
      setErr(null);

      alert(
        '과팅이 종료되었습니다.\n\n' +
        '아래에서 새 팀을 등록하고\n' +
        '홈에서 마음에 드는 팀에 다시 신청해보세요!'
      );
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setFinishing(false);
    }
  };

  const submit = async () => {
    setErr(null);
    if (intro.trim().length < 4) return setErr('팀 한줄소개를 4자 이상 입력해주세요.');
    for (const [i, m] of members.entries()) {
      if (!m.department.trim() || !m.student_number.trim() || !m.nickname.trim() || !m.contact_id.trim()) {
        return setErr(`팀원 ${i + 1}의 정보를 모두 입력해주세요.`);
      }
      if (!isValidStudentNumber(m.student_number)) {
        return setErr(`팀원 ${i + 1}의 ${studentNumberError}`);
      }
    }
    if (!consent) {
      return setErr('팀원 전원에게 정보 등록 동의를 받으셨는지 확인해주세요.');
    }
    const input: TeamRegisterInput = {
      intro: intro.trim(),
      team_size: teamSize,
      members: members.map((m) => ({ ...m, student_number: normalizeStudentNumber(m.student_number) })),
      members_consent_confirmed: consent,
    };
    setSubmitting(true);
    try {
      if (mode === 'edit' && activeTeam) {
        await updateTeam(activeTeam.id, input);
        alert('팀 정보가 수정되었습니다.');
        await reload();
      } else {
        await createTeam(input);
        alert('팀 등록이 완료되었습니다. 좋은 매칭이 되길 바랍니다.');
        nav('/');
      }
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageLayout><Loading /></PageLayout>;
  }

  // ===== 케이스 A: matched 팀이 있고 active 팀은 없는 상태 =====
  // (매칭 성사 직후의 일반적 상황)
  if (matchedTeam && !activeTeam) {
    return (
      <PageLayout subtitle="매칭 성공한 팀">
        <section className="card relative overflow-hidden bg-gradient-to-br from-sakura-50 via-white to-amber-50 p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge tone="pink">매칭완료</Badge>
            <Badge tone={matchedTeam.gender === 'male' ? 'sky' : 'pink'}>
              {matchedTeam.gender === 'male' ? '남자팀' : '여자팀'}
            </Badge>
            <Badge tone="amber">
              {matchedTeam.team_size} : {matchedTeam.team_size}
            </Badge>
          </div>
          <p className="font-display text-lg text-zinc-900">"{matchedTeam.intro}"</p>

          <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-white/70 ring-1 ring-zinc-100">
            {matchedMembers.map((m) => (
              <li key={m.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{m.nickname}</p>
                  <Badge tone={m.smoking ? 'amber' : 'green'}>{m.smoking ? '흡연' : '비흡연'}</Badge>
                </div>
                <p className="text-xs text-zinc-500">{m.school} · {m.department} · {admissionLabel(m.student_number)}</p>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-zinc-600 leading-relaxed">
            좋은 매칭이 성사되었어요.<br />
            과팅이 끝나고 다시 새 인연을 만나고 싶다면<br />
            <strong className="text-sakura-600">새 과팅 시작하기</strong>를 눌러주세요.
          </p>

          <p className="mt-2 text-xs text-zinc-400">
            * 신청내역의 매칭완료 탭에서 상대 팀 연락처를 다시 확인할 수 있어요.
          </p>
        </section>

        <div className="mt-4 space-y-2">
          <Button variant="ghost" className="w-full" onClick={() => nav('/')}>
            홈으로
          </Button>
          <Button
            onClick={startNewGating}
            loading={finishing}
            className="w-full"
          >
            새 과팅 시작하기
          </Button>
        </div>
      </PageLayout>
    );
  }

  // ===== 케이스 B: active 팀이 있는 상태 (수정/삭제 가능) =====
  if (mode === 'view' && activeTeam) {
    return (
      <PageLayout subtitle="내 팀 정보">
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">활성</Badge>
            <Badge tone={activeTeam.gender === 'male' ? 'sky' : 'pink'}>
              {activeTeam.gender === 'male' ? '남자팀' : '여자팀'}
            </Badge>
            <Badge tone="amber">
              {activeTeam.team_size} : {activeTeam.team_size}
            </Badge>
          </div>
          <p className="font-display text-lg text-zinc-900">"{activeTeam.intro}"</p>
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-zinc-50/60 ring-1 ring-zinc-100">
            {activeMembers.map((m) => (
              <li key={m.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{m.nickname}</p>
                  <Badge tone={m.smoking ? 'amber' : 'green'}>{m.smoking ? '흡연' : '비흡연'}</Badge>
                </div>
                <p className="text-xs text-zinc-500">{m.school} · {m.department} · {admissionLabel(m.student_number)}</p>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="gap-1.5" onClick={enterEdit}>
              <Pencil size={16} strokeWidth={2} />
              팀 수정
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm('내 팀을 삭제할까요? 받은/보낸 신청도 함께 정리됩니다.')) return;
                try {
                  await deleteMyTeam(activeTeam.id);
                  alert('삭제되었습니다.');
                  await reload();
                } catch (e) {
                  alert(koMessage(e));
                }
              }}
              className="gap-1.5"
            >
              <Trash2 size={16} strokeWidth={2} />
              팀 삭제
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => nav('/')}>홈으로</Button>
        </div>
      </PageLayout>
    );
  }

  // ===== 케이스 C: 등록/수정 폼 =====
  const isEdit = mode === 'edit';

  return (
    <PageLayout subtitle={isEdit ? '팀 정보 수정' : '팀을 등록해보세요'}>
      <VerificationBanner />
      <div className="space-y-4">
        <div className="card p-4">
          <p className="label">팀 사이즈</p>
          <div className="grid grid-cols-4 gap-2">
            {([1,2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTeamSize(n)}
                className={`rounded-2xl py-3 font-bold transition active:scale-[0.98] ${
                  teamSize === n
                    ? 'bg-sakura-500 text-white shadow-soft'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {n} : {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            * 인원 차이가 1명 이내인 팀끼리 매칭됩니다. (3:3 팀은 2:2 · 3:3 · 4:4 팀에 신청 가능)
          </p>
        </div>

        <div className="card p-4">
          <Input
            label="팀 한줄소개"
            placeholder="ex. 강대후문에서 만날까요??"
            maxLength={50}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </div>

        {members.map((m, i) => (
          <MemberForm
            key={i}
            index={i + 1}
            value={m}
            onChange={(v) => {
              setMembers((arr) => {
                const next = [...arr];
                next[i] = v;
                return next;
              });
            }}
          />
        ))}

        <div className="card p-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-sakura-500"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="text-sm leading-relaxed text-zinc-700">
              <span className="font-semibold text-sakura-600">(필수)</span> 팀원 전원에게
              이름·학과·학번·연락처가 등록되고 <strong>매칭된 상대 팀에게 공개된다는 사실</strong>을
              알렸으며, 모두의 동의를 받았습니다.
            </span>
          </label>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            동의 없이 타인의 정보를 등록하면 이용이 제한될 수 있고, 등록하신 분에게 법적 책임이
            발생할 수 있습니다.
          </p>
        </div>

        {err && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {isEdit && (
            <Button variant="ghost" onClick={() => setMode('view')}>
              취소
            </Button>
          )}
          <Button onClick={submit} loading={submitting} className={isEdit ? '' : 'col-span-2 w-full'}>
            {isEdit ? '수정 완료' : `${teamSize}:${teamSize} 팀 등록하기`}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}