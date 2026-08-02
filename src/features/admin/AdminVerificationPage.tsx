import { useEffect, useState } from 'react';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { Check } from 'lucide-react';
import { approveVerification, getStudentSignedUrl, listVerificationQueue, rejectVerification } from './admin.api';
import type { Profile } from '@/types/database.types';
import { koMessage } from '@/utils/errors';
import { formatDate } from '@/utils/format';

export default function AdminVerificationPage() {
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  const load = async () => {
    try {
      const list = await listVerificationQueue();
      setRows(list);
      // signed URL 일괄 발급
      const u: Record<string, string | null> = {};
      await Promise.all(list.map(async (p) => {
        u[p.id] = await getStudentSignedUrl(p.student_id_image_path);
      }));
      setUrls(u);
    } catch (e) { alert(koMessage(e)); }
  };

  useEffect(() => { void load(); }, []);

  if (!rows) return <Loading />;
  const visible = rows.filter((p) => filter === 'all' ? true : p.verification_status === filter);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">인증관리</h1>

      <div className="mt-3 mb-5 flex gap-2 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs ring-1 ${
              filter === k ? 'bg-sakura-500 text-white ring-sakura-500' : 'bg-white text-zinc-600 ring-zinc-200'
            }`}
          >
            {k === 'pending' ? '대기' : k === 'approved' ? '승인' : k === 'rejected' ? '거절' : '전체'}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => (
          <div key={p.id} className="card overflow-hidden">
            <div className="aspect-[4/3] bg-zinc-100">
              {urls[p.id] ? (
                <img src={urls[p.id]!} alt="학생증" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400">학생증 없음</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.name}</p>
                <Badge tone={p.verification_status === 'approved' ? 'green' : p.verification_status === 'rejected' ? 'gray' : 'amber'}>
                  {p.verification_status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {p.school}{p.student_number ? ` · 학번 ${p.student_number}` : ''} · 가입 {formatDate(p.created_at)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={async () => { try { await rejectVerification(p.id); await load(); } catch (e) { alert(koMessage(e)); } }}
                >
                  거절
                </Button>
                <Button
                  className="gap-1.5"
                  onClick={async () => { try { await approveVerification(p.id); await load(); } catch (e) { alert(koMessage(e)); } }}
                >
                  <Check size={16} strokeWidth={2.4} />
                  승인
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-400">해당 조건의 회원이 없습니다.</p>
      )}
    </div>
  );
}
