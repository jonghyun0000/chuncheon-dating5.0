import { useEffect, useState } from 'react';
import MemberPhoto from '@/features/photos/MemberPhoto';
import { deleteMemberPhoto, searchPhotoArchive, type ArchivePhoto } from '@/features/photos/photos.api';

export default function AdminPhotosPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ArchivePhoto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setRows([]);
    const timer = setTimeout(() => {
      searchPhotoArchive(query, page).then(data => { if (!cancelled) setRows(data); })
        .catch(() => { if (!cancelled) setError('사진 보관함을 불러오지 못했습니다. 관리자 인증을 확인해주세요.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, page, revision]);
  async function remove(row: ArchivePhoto) {
    if (!confirm(`${row.nickname} 사진을 삭제 처리할까요? 공개가 중단되고 24시간 이내 파일이 삭제됩니다.`)) return;
    try { await deleteMemberPhoto(row.id); setRevision(v => v + 1); }
    catch { setError('사진 삭제 요청에 실패했습니다. 다시 시도해주세요.'); }
  }
  return <div>
    <h1 className="text-2xl font-bold">팀원 사진 보관함</h1>
    <p className="mt-2 text-sm text-zinc-500">팀 삭제 후 90일 보관 · 이름이 없는 팀원은 닉네임 표시 · 관리자 전용</p>
    <label className="mt-4 block text-sm">학교 / 학과 / 학번 / 성별 / 이름 / 닉네임 검색
      <input className="input mt-2 w-full" value={query} maxLength={120} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="예: 강원대 컴퓨터 남자" />
    </label>
    {error && <p role="alert" className="mt-3 text-rose-600">{error}<button onClick={() => setRevision(v => v + 1)} className="btn-ghost">다시 시도</button></p>}
    {loading ? <p role="status" className="mt-4">사진 보관함을 불러오는 중…</p> : !rows.length && <p className="mt-4">검색 결과가 없습니다.</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {rows.map(row => <article key={row.id} className="card p-4">
        <MemberPhoto path={row.path} nickname={row.nickname} />
        <p className="break-words text-sm">{[row.school, row.department, row.student_number, row.gender === 'male' ? '남자' : '여자', row.display_name || row.nickname, row.nickname].join(' / ')}</p>
        <p className="mt-2 text-xs text-zinc-500">등록 {new Date(row.created_at).toLocaleDateString('ko-KR')} · {row.archived_at ? '삭제된 팀' : row.draft_id ? '비공개 초안' : '등록된 팀'}</p>
        {row.expires_at && <p className="text-xs">보관 종료: {new Date(row.expires_at).toLocaleDateString('ko-KR')}</p>}
        <button className="mt-3 text-xs text-rose-600" onClick={() => void remove(row)}>사진 삭제 처리</button>
      </article>)}
    </div>
    <div className="mt-4 flex justify-between">
      <button className="btn-ghost" disabled={page === 0 || loading} onClick={() => setPage(v => v - 1)}>이전</button>
      <span>{page + 1} 페이지</span>
      <button className="btn-ghost" disabled={rows.length < 30 || loading} onClick={() => setPage(v => v + 1)}>다음</button>
    </div>
  </div>;
}
