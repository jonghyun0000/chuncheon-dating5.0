import { Link } from 'react-router-dom';
import { GraduationCap, MessagesSquare, School, UsersRound } from 'lucide-react';
import { SCHOOLS, SCHOOL_FULL_NAME } from '@/lib/constants';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sakura-100 via-sakura-50 to-amber-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="petal animate-fall"
            style={{
              left: `${(i * 7.3) % 100}%`,
              animationDuration: `${9 + (i % 5)}s`,
              animationDelay: `${(i * 0.7) % 7}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        <div className="mt-6 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-sakura-600 shadow-soft backdrop-blur">
            춘천 대학생 전용
          </span>
        </div>

        <div className="mt-10 text-center">
          <h2 className="bg-gradient-to-br from-sakura-500 to-violet-400 bg-clip-text font-display text-7xl font-bold leading-[0.95] text-transparent">
            춘천<br />과팅
          </h2>
          <p className="mt-6 text-base leading-relaxed text-zinc-500">
            강원대 · 한림대 · 성심대 · 춘교대<br />
            <span className="font-semibold text-zinc-700">과팅 매칭 서비스</span>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SCHOOLS.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-sm text-zinc-700 shadow-soft ring-1 ring-white backdrop-blur"
            >
              <School size={14} strokeWidth={1.8} className="text-sakura-500" />
              {SCHOOL_FULL_NAME[s]}
            </span>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 shadow-soft ring-1 ring-white backdrop-blur">
            <GraduationCap size={22} strokeWidth={1.8} className="shrink-0 text-sakura-500" />
            <p className="text-sm font-medium text-zinc-700">재학생 인증 — 믿을 수 있는 만남</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 shadow-soft ring-1 ring-white backdrop-blur">
            <UsersRound size={22} strokeWidth={1.8} className="shrink-0 text-sakura-500" />
            <p className="text-sm font-medium text-zinc-700">1:1, 2:2, 3:3, 4:4 팀 과팅 — 어색함은 NO</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 shadow-soft ring-1 ring-white backdrop-blur">
            <MessagesSquare size={22} strokeWidth={1.8} className="shrink-0 text-sakura-500" />
            <p className="text-sm font-medium text-zinc-700">매칭 시 카카오톡 · 인스타 아이디 공개</p>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm font-medium text-zinc-400">어떻게 진행되나요?</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-soft ring-1 ring-white backdrop-blur">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sakura-500 text-sm font-bold text-white">1</span>
              <div>
                <p className="text-sm font-bold text-zinc-900">가입 + 학생증 인증</p>
                <p className="text-xs text-zinc-500">재학 여부 확인 후 인증 완료</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-soft ring-1 ring-white backdrop-blur">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sakura-500 text-sm font-bold text-white">2</span>
              <div>
                <p className="text-sm font-bold text-zinc-900">팀 등록 / 신청</p>
                <p className="text-xs text-zinc-500">1:1, 2:2, 3:3, 4:4 팀 단위로 과팅 진행</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-soft ring-1 ring-white backdrop-blur">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sakura-500 text-sm font-bold text-white">3</span>
              <div>
                <p className="text-sm font-bold text-zinc-900">매칭 성사</p>
                <p className="text-xs text-zinc-500">연락수단 공개</p>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-sakura-50 to-amber-50 p-4 ring-1 ring-sakura-200">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sakura-200 text-sakura-700">
                  <MessagesSquare size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-bold text-sakura-600">채팅방 만들기</p>
                  <p className="text-xs text-zinc-500">약속 시간 정하고 만나기</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3 pb-6">
          <Link
            to="/register"
            className="block w-full rounded-full bg-gradient-to-r from-sakura-500 to-sakura-400 py-4 text-center font-bold text-white shadow-soft transition active:scale-[0.98]"
          >
            지금 시작하기
          </Link>
          <Link
            to="/login"
            className="block w-full rounded-full bg-white py-4 text-center font-semibold text-zinc-700 ring-1 ring-zinc-200"
          >
            이미 계정이 있어요
          </Link>
        </div>
      </div>
    </div>
  );
}
