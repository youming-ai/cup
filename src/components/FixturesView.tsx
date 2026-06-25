import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import MatchCard from './MatchCard';
import MatchDetailModal from './MatchDetailModal';
import StandingsView from './StandingsView';
import type { WCGroup, WCMatch, Stage } from '../types';

const KNOWN_STAGES: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

export default function FixturesView({ matches, groups }: { matches: WCMatch[]; groups: WCGroup[] }) {
  const t = useT();
  const [tab, setTab] = useState<'schedule' | 'standings'>('schedule');
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const [openMatch, setOpenMatch] = useState<WCMatch | null>(null);

  const stages: (Stage | 'all')[] = useMemo(() => {
    const present = new Set<Stage>(matches.map((m) => m.stage));
    return ['all', ...KNOWN_STAGES.filter((s) => present.has(s))] as (Stage | 'all')[];
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
      upcoming: group(filtered.filter((m) => m.status !== 'finished')).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
      finished: group(filtered.filter((m) => m.status === 'finished')).sort((a, b) =>
        b[0].localeCompare(a[0]),
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
            homeScorers={m.homeScorers}
            awayScorers={m.awayScorers}
            venue={m.venue}
            onOpen={m.status === 'upcoming' ? undefined : () => setOpenMatch(m)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 赛程 | 积分 子切换 */}
      <div className="flex items-center gap-1 p-1 border border-line bg-panel w-fit">
        {(['schedule', 'standings'] as const).map((k) => (
          <button
            key={k}
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
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                aria-pressed={stage === s}
                className={`shrink-0 px-3 py-2 font-mono text-xs uppercase tracking-wider border-b-2 transition-colors ${
                  stage === s ? 'border-pitch text-chalk' : 'border-transparent text-chalkdim hover:text-chalk'
                }`}
              >
                {s === 'all' ? t('filter.all') : t(`stage.${s}`)}
              </button>
            ))}
          </div>

          {upcoming.length === 0 && finished.length === 0 ? (
            <p className="font-mono text-xs tracking-wider text-chalkdim">{t('common.empty')}</p>
          ) : (
            <>
              {upcoming.map(renderDay)}
              {finished.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase shrink-0">
                    {t('fixtures.results')}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              {finished.map(renderDay)}
            </>
          )}
        </>
      )}
      {openMatch && <MatchDetailModal match={openMatch} onClose={() => setOpenMatch(null)} />}
    </div>
  );
}
