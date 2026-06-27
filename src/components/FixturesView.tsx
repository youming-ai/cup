import { useCallback, useMemo, useState } from 'react';
import { useT } from '../i18n';
import type { Stage, TopScorer, WCGroup, WCMatch } from '../types';
import { navigate } from '../utils/router';
import BracketView from './BracketView';
import MatchCard from './MatchCard';
import StandingsView from './StandingsView';
import TopScorersView from './TopScorersView';

const KNOWN_STAGES: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

// Quick filter: which match statuses to show. Tournament-stage chips below
// further narrow by stage; this is a coarser "is the match still to play or
// already played?" toggle. Defaults to Upcoming so users land on what's next.
type StatusFilter = 'upcoming' | 'finished';
type Tab = 'schedule' | 'standings' | 'scorers' | 'bracket';

export default function FixturesView({
  matches,
  groups,
  scorers,
}: {
  matches: WCMatch[];
  groups: WCGroup[];
  scorers: TopScorer[];
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('schedule');
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('upcoming');
  const openMatch = useCallback((m: WCMatch) => {
    // `wc:` namespaces ESPN schedule matches so App routes them to
    // MatchDetailPage (plain /match/<slug> is a streamed.pk live stream).
    navigate(`/match/wc:${encodeURIComponent(m.slug)}`);
  }, []);

  const stages: (Stage | 'all')[] = useMemo(() => {
    const present = new Set<Stage>(matches.map((m) => m.stage));
    return ['all', ...KNOWN_STAGES.filter((s) => present.has(s))] as (Stage | 'all')[];
  }, [matches]);

  // Counts for the status-filter chips: shown regardless of the stage filter
  // so users see at a glance how many matches are finished vs still to play
  // (e.g. "Finished (48)"). The current `stage` selection does NOT affect
  // these totals — clicking a status chip first then a stage chip will
  // intersect, which is the expected behaviour.
  const counts = useMemo(() => {
    let upcoming = 0;
    let finished = 0;
    for (const m of matches) {
      if (m.status === 'finished') finished++;
      else upcoming++;
    }
    return { upcoming, finished };
  }, [matches]);

  // 按开球当天分组；组内按开球时间正序。未完赛(upcoming/live)在前(日期正序)，
  // 已完赛在后(日期倒序，最近的在上)，两段分开。
  const { upcoming, finished } = useMemo(() => {
    const filtered = stage === 'all' ? matches : matches.filter((m) => m.stage === stage);
    const group = (list: WCMatch[]) => {
      const map = new Map<string, WCMatch[]>();
      for (const m of list) {
        const k = m.kickoff;
        const key = k
          ? `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, '0')}-${String(k.getDate()).padStart(2, '0')}`
          : 'zzzz-tbd';
        (map.get(key) ?? map.set(key, []).get(key)!).push(m);
      }
      for (const arr of map.values()) {
        arr.sort((a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0));
      }
      return [...map.entries()];
    };
    return {
      upcoming: group(filtered.filter((m) => m.status !== 'finished')).sort((a, _b) =>
        a[0].localeCompare(_b[0]),
      ),
      finished: group(filtered.filter((m) => m.status === 'finished')).sort((a, _b) =>
        _b[0].localeCompare(a[0]),
      ),
    };
  }, [matches, stage]);

  const renderDay = ([key, list]: [string, WCMatch[]]) => (
    <section key={key} className="space-y-3">
      <h3 className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase">
        {list[0].kickoff
          ? list[0].kickoff.toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : t('common.tbd')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {list.map((m) => (
          <MatchCard
            key={m.id}
            homeName={m.homeName}
            awayName={m.awayName}
            homeFlag={m.homeFlag}
            awayFlag={m.awayFlag}
            homeScore={m.homeScore}
            awayScore={m.awayScore}
            status={m.status}
            kickoff={m.kickoff}
            stage={m.stage}
            group={m.group}
            progress={m.progress}
            homeScorers={m.homeScorers}
            awayScorers={m.awayScorers}
            venue={m.venue}
            onOpen={m.status === 'upcoming' ? undefined : () => openMatch(m)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* 赛程 | 积分 子切换 */}
      <div className="flex items-center gap-1 p-1 border border-line bg-panel w-fit">
        {(['schedule', 'standings', 'scorers', 'bracket'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`px-4 py-2 font-display font-semibold text-sm transition-colors ${
              tab === k ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
            }`}
          >
            {t(`fixtures.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'standings' ? (
        <StandingsView groups={groups} />
      ) : tab === 'scorers' ? (
        <TopScorersView scorers={scorers} />
      ) : tab === 'bracket' ? (
        <BracketView groups={groups} matches={matches} />
      ) : (
        <>
          {/* Quick filter: Upcoming / Finished. Counts are taken from the
              unfiltered match list so users always see how many matches exist
              in each bucket regardless of the stage selection below. */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {(
              [
                {
                  key: 'upcoming',
                  label: t('fixtures.filterUpcoming'),
                  count: counts.upcoming,
                },
                {
                  key: 'finished',
                  label: t('fixtures.filterFinished'),
                  count: counts.finished,
                },
              ] as { key: StatusFilter; label: string; count: number }[]
            ).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                aria-pressed={statusFilter === key}
                className={`shrink-0 px-3 py-2 font-mono text-xs uppercase tracking-wider border-b-2 transition-colors ${
                  statusFilter === key
                    ? 'border-pitch text-chalk'
                    : 'border-transparent text-chalkdim hover:text-chalk'
                }`}
              >
                {label}
                <span className="ml-1.5 tabular-nums text-chalkdim/70">{count}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {stages.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                aria-pressed={stage === s}
                className={`shrink-0 px-3 py-2 font-mono text-xs uppercase tracking-wider border-b-2 transition-colors ${
                  stage === s
                    ? 'border-pitch text-chalk'
                    : 'border-transparent text-chalkdim hover:text-chalk'
                }`}
              >
                {s === 'all' ? t('filter.all') : t(`stage.${s}`)}
              </button>
            ))}
          </div>

          {(() => {
            const days = statusFilter === 'finished' ? finished : upcoming;
            if (days.length === 0) {
              // The status-filter counts above are unfiltered by stage, so a
              // status-specific message ("No finished matches yet") would
              // contradict a non-zero chip count when an empty stage is also
              // selected. Only assert that global truth when no stage narrows
              // the view; otherwise fall back to the neutral "no results".
              const emptyKey =
                stage !== 'all'
                  ? 'common.empty'
                  : statusFilter === 'finished'
                    ? 'fixtures.finishedEmpty'
                    : 'fixtures.upcomingEmpty';
              return (
                <p className="font-mono text-xs tracking-wider text-chalkdim">{t(emptyKey)}</p>
              );
            }
            return <>{days.map(renderDay)}</>;
          })()}
        </>
      )}
    </div>
  );
}
