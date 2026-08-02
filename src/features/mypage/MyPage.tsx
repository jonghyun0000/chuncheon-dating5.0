import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  KeyRound,
  Mail,
  ShieldCheck,
  TriangleAlert,
  UserPen,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import TermsModal from '@/components/common/TermsModal';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL, labelContact, labelGender } from '@/lib/constants';
import { TERMS_DOCS, type TermsDoc } from '@/lib/terms';
import { deleteMyAccount, getMyStudentIdSignedUrl } from './mypage.api';
import { fetchMyTeam } from '@/features/teams/teams.api';
import type { Team } from '@/types/database.types';
import { koMessage } from '@/utils/errors';
import { admissionLabel } from '@/utils/format';
import { MatchedTeamBanner, ReportLink, VerificationBanner } from '@/components/common/StatusBanner';

export default function MyPage() {
  const { profile, signOut, refreshProfile, loading } = useAuth();
  const nav = useNavigate();
  const [studentUrl, setStudentUrl] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [openedTerms, setOpenedTerms] = useState<TermsDoc | null>(null);

  useEffect(() => {
    void (async () => {
      if (profile?.student_id_image_path) {
        const url = await getMyStudentIdSignedUrl(profile.student_id_image_path);
        setStudentUrl(url);
      }
      const { team } = await fetchMyTeam();
      setMyTeam(team);
    })();
  }, [profile?.student_id_image_path, profile?.id]);

  if (!profile) {
    return (
      <PageLayout subtitle="내 정보">
        <div className="card space-y-3 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            <CircleAlert size={24} strokeWidth={1.8} />
          </div>
          <h2 className="font-display text-lg text-zinc-900">프로필을 불러오지 못했어요</h2>
          <p className="text-sm text-zinc-500">
            네트워크가 잠시 불안정하거나 로그인 정보가 만료되었을 수 있어요.<br />
            아래 버튼으로 새로고침하거나 다시 로그인해주세요.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="ghost" onClick={() => refreshProfile()}>새로고침</Button>
            <Button variant="danger" onClick={async () => { await signOut(); nav('/login'); }}>
              다시 로그인
            </Button>
          </div>
          {loading && <p className="text-xs text-zinc-400">불러오는 중...</p>}
        </div>
      </PageLayout>
    );
  }

  const verifyTone =
    profile.verification_status === 'approved' ? 'green' :
    profile.verification_status === 'rejected' ? 'gray' :
    'amber';
  const verifyLabel =
    profile.verification_status === 'approved' ? '인증 완료' :
    profile.verification_status === 'rejected' ? '인증 거절' :
    '인증 대기 중';

  const onDelete = async () => {
    if (deleteConfirm !== '탈퇴합니다') {
      alert('확인 문구를 정확히 입력해주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteMyAccount();
      alert('탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.');
      nav('/login', { replace: true });
    } catch (e) {
      alert(koMessage(e));
      setDeleting(false);
    }
  };

  return (
    <PageLayout subtitle="내 정보 및 설정">
      <MatchedTeamBanner show={myTeam?.status === 'matched'} />
      <VerificationBanner />

      <section className="card p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-sakura-100 text-sakura-600">
            <CircleUserRound size={30} strokeWidth={1.6} />
          </div>
          <div>
            <p className="font-display text-xl text-zinc-900">{profile.name}</p>
            <p className="text-xs text-zinc-500">@{profile.username}</p>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-zinc-50/60 text-sm ring-1 ring-zinc-100">
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">성별</span>
            <span className="font-medium text-zinc-800">{labelGender(profile.gender)}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">학교</span>
            <span className="font-medium text-zinc-800">
              {profile.school}
              {profile.student_number ? ` · ${admissionLabel(profile.student_number)}` : ''}
            </span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">연락수단</span>
            <span className="font-medium text-zinc-800">{labelContact(profile.contact_type)} · {profile.contact_id}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">학교 인증</span>
            <Badge tone={verifyTone} className="gap-1">
              {profile.verification_status === 'approved' && <ShieldCheck size={12} strokeWidth={2.2} />}
              {verifyLabel}
            </Badge>
          </li>
        </ul>

        {studentUrl && (
          <details className="mt-3 text-sm text-zinc-600">
            <summary className="cursor-pointer">내 학생증 사진 보기</summary>
            <img src={studentUrl} alt="학생증" className="mt-2 w-full rounded-xl" />
            <p className="mt-1 text-[11px] text-zinc-400">* 본인만 볼 수 있는 이미지입니다.</p>
          </details>
        )}
      </section>

      {/* 계정 관리 */}
      <section className="card mt-4 overflow-hidden">
        <h3 className="px-5 pb-2 pt-5 text-sm font-semibold text-zinc-800">계정 관리</h3>
        <ul className="divide-y divide-zinc-100">
          <li>
            <Link to="/me/edit" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-zinc-50">
              <UserPen size={18} strokeWidth={1.8} className="text-zinc-400" />
              <span className="flex-1 text-sm text-zinc-700">개인정보 수정</span>
              <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
            </Link>
          </li>
          <li>
            <Link to="/me/change-password" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-zinc-50">
              <KeyRound size={18} strokeWidth={1.8} className="text-zinc-400" />
              <span className="flex-1 text-sm text-zinc-700">비밀번호 변경</span>
              <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
            </Link>
          </li>
          <li><ReportLink /></li>
        </ul>
      </section>

      <section className="card mt-4 p-5">
        <h3 className="font-semibold text-zinc-800">내 팀</h3>
        {myTeam ? (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-zinc-700">"{myTeam.intro}"</p>
            <Link to="/team" className="text-sm font-semibold text-sakura-600">자세히</Link>
          </div>
        ) : (
          <Link to="/team" className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-sakura-600">
            팀을 등록해보세요
            <ChevronRight size={15} strokeWidth={2.2} />
          </Link>
        )}
      </section>

      {/* 약관 다시 보기 */}
      <section className="card mt-4 overflow-hidden">
        <h3 className="px-5 pb-2 pt-5 text-sm font-semibold text-zinc-800">약관 및 정책</h3>
        <ul className="divide-y divide-zinc-100">
          {TERMS_DOCS.map((doc) => (
            <li key={doc.key}>
              <button
                type="button"
                onClick={() => setOpenedTerms(doc)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-zinc-50"
              >
                <span className="flex-1 text-sm text-zinc-700">{doc.label}</span>
                <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
              </button>
            </li>
          ))}
        </ul>
        {profile.terms_version && (
          <p className="px-5 pb-4 text-[11px] text-zinc-400">
            동의한 약관 버전: {profile.terms_version}
          </p>
        )}
      </section>

      <section className="card mt-4 p-5">
        <h3 className="font-semibold text-zinc-800">문의</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          매칭 상대에 대한 신고는 위 [신고하기]에서 접수해주세요.
          그 밖의 문의는 관리자 이메일로 보내주시면 됩니다.
        </p>
        <a
          href={`mailto:${ADMIN_EMAIL}?subject=[춘천과팅] 신고/문의`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 font-mono text-sm text-zinc-700"
        >
          <Mail size={14} strokeWidth={1.8} />
          {ADMIN_EMAIL}
        </a>
      </section>

      {profile.role === 'admin' && (
        <section className="card mt-4 p-5">
          <h3 className="flex items-center gap-1.5 font-semibold text-sakura-700">
            <ShieldCheck size={16} strokeWidth={2} />
            관리자 메뉴
          </h3>
          <Link to="/admin" className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-sakura-600">
            관리자 페이지로 이동
            <ChevronRight size={15} strokeWidth={2.2} />
          </Link>
        </section>
      )}

      <div className="mt-6 space-y-2">
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => { await signOut(); nav('/login'); }}
        >
          로그아웃
        </Button>
        <button
          onClick={() => setShowDelete(true)}
          className="w-full py-3 text-center text-sm text-zinc-400 transition hover:text-rose-500"
        >
          회원 탈퇴
        </button>
      </div>

      <TermsModal doc={openedTerms} onClose={() => setOpenedTerms(null)} />

      {/* 회원 탈퇴 모달 */}
      <Modal open={showDelete} onClose={() => { setShowDelete(false); setDeleteConfirm(''); }} title="정말 탈퇴하시겠어요?">
        <div className="space-y-4">
          <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
              <TriangleAlert size={15} strokeWidth={2} />
              탈퇴 시 다음 데이터가 모두 삭제됩니다
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-xs text-rose-600">
              <li>내가 등록한 팀 및 팀원 정보</li>
              <li>주고받은 매칭 신청 내역</li>
              <li>작성한 후기</li>
              <li>학생증 사진</li>
            </ul>
            <p className="mt-2 text-xs text-rose-600">탈퇴 후 동일 정보로 재가입은 어렵습니다.</p>
          </div>
          <div>
            <label className="label">아래에 "탈퇴합니다"를 정확히 입력해주세요</label>
            <input
              className="input"
              placeholder="탈퇴합니다"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}>
              취소
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleteConfirm !== '탈퇴합니다'}
              onClick={onDelete}
            >
              탈퇴하기
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
