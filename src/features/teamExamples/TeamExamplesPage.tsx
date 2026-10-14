import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, ShieldCheck } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Loading from '@/components/common/Loading';
import LoadError from '@/components/common/LoadError';
import MemberTags from '@/components/team/MemberTags';
import { useI18n } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { schoolLabel, labelSmoking } from '@/lib/constants';
import { EXAMPLES_PAGE_SIZE, fetchTeamExamples, type TeamExample } from './teamExamples.api';
import { teamExamplesCopy } from './teamExamplesCopy';

export default function TeamExamplesPage() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const copy = teamExamplesCopy(lang);
  const [rows, setRows] = useState<TeamExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offset = useRef(0);
  const generation = useRef(0);
  const busy = useRef(false);
  const load = useCallback(async (reset = false) => {
    if (busy.current && !reset) return;
    const request = ++generation.current;
    busy.current = true;
    if (reset) { offset.current = 0; setRows([]); setHasMore(false); }
    setLoading(true); setFailed(false);
    try {
      const result = await fetchTeamExamples(offset.current);
      if (request !== generation.current) return;
      offset.current += result.length;
      setRows(previous => [...previous, ...result.filter(row => !previous.some(old => old.id === row.id))]);
      setHasMore(result.length === EXAMPLES_PAGE_SIZE);
    } catch { if (request === generation.current) setFailed(true); }
    finally { if (request === generation.current) { busy.current = false; setLoading(false); } }
  }, []);
  useEffect(() => {
    void load(true);
    return () => { generation.current++; busy.current = false; };
  }, [load, profile?.id]);

  return <PageLayout>
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-zinc-500"><ArrowLeft size={16} />{copy.back}</Link>
    <header className="my-5">
      <BookOpen className="mb-3 text-sakura-500" size={28} />
      <h1 className="font-display text-2xl font-bold">{copy.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{copy.note}</p>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-sakura-50 p-3 text-xs text-sakura-700"><ShieldCheck size={16} className="shrink-0" />{copy.privacy}</p>
    </header>
    <div className="space-y-4">
      {rows.map(team => <article key={team.id} className="card p-5" data-testid="team-example">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{team.team_size}{copy.people}</span>
          <span>{team.owner_verified ? t.teamCard.verified : t.teamCard.unverified}</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words font-display text-lg text-zinc-900">{team.intro}</p>
        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl bg-zinc-50 px-3">
          {team.members.map(member => <li key={member.member_order} className="py-3">
            <p className="text-sm font-semibold">{copy.member} {member.member_order}</p>
            <p className="mt-1 break-words text-xs text-zinc-500">{schoolLabel(member.school)} · {member.department} · {labelSmoking(member.smoking)}</p>
            <MemberTags taste={member.taste_tags} want={member.want_tags} compact />
          </li>)}
        </ul>
      </article>)}
    </div>
    {loading && <Loading />}
    {failed && <LoadError retry={() => void load()} />}
    {!loading && !failed && rows.length === 0 && <p className="card p-8 text-center text-sm text-zinc-500">{copy.empty}</p>}
    {!loading && !failed && hasMore && <button type="button" className="btn-ghost mt-4 w-full" onClick={() => void load()}>{copy.more}</button>}
    <Link to="/team" className="btn-primary mt-6 w-full">{copy.create}</Link>
  </PageLayout>;
}
