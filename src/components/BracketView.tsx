import { Fragment } from 'react';
import { type ResolvedBracketMatch, type ResolvedTeam, useBracket } from '../hooks/useBracket';
import { useT } from '../i18n';
import type { WCGroup, WCMatch } from '../types';
import { navigate, pathFor, useRouter } from '../utils/router';

const VISUAL_ORDERS: Record<string, number[]> = {
  R32: [1, 6, 0, 2, 10, 11, 8, 9, 3, 5, 4, 7, 13, 15, 12, 14],
  R16: [16, 17, 20, 21, 18, 19, 22, 23],
  QF: [24, 25, 26, 27],
  SF: [28, 29],
  Final: [31],
};

function Connector({ parentCount }: { parentCount: number }) {
  const childCount = parentCount / 2;
  const paths = [];
  for (let i = 0; i < childCount; i++) {
    const yParent1 = ((2 * i + 0.5) / parentCount) * 100;
    const yParent2 = ((2 * i + 1.5) / parentCount) * 100;
    const yChild = ((i + 0.5) / childCount) * 100;
    paths.push(
      <path
        key={i}
        d={`M 0 ${yParent1} H 50 V ${yParent2} H 0 M 50 ${yChild} H 100`}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return (
    <svg
      className="w-8 h-full stroke-line/30 py-2"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export default function BracketView({
  groups,
  matches,
}: {
  groups: WCGroup[];
  matches: WCMatch[];
}) {
  const t = useT();
  const { route } = useRouter();
  const comp = route.comp;
  const { resolved } = useBracket(groups, matches);
  const thirdPlaceMatch = resolved.find((m) => m.round === '3rd');

  const treeRounds = [
    { round: 'R32', count: 16 },
    { round: 'R16', count: 8 },
    { round: 'QF', count: 4 },
    { round: 'SF', count: 2 },
    { round: 'Final', count: 1 },
  ];

  return (
    <div className="space-y-card">
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
        <div className="min-w-[1000px] flex flex-col py-2">
          {/* Headings Row */}
          <div className="flex gap-0 items-center border-b border-line/20 pb-2 mb-2">
            {treeRounds.map(({ round }, idx) => (
              <Fragment key={round}>
                {idx > 0 && <div className="w-8 shrink-0" />}
                <h3 className="w-48 text-center ds-caption uppercase tracking-[0.18em] text-chalkdim shrink-0">
                  {t(`bracket.${round}`)}
                </h3>
              </Fragment>
            ))}
          </div>

          {/* Main Tree Row */}
          <div className="flex gap-0 items-stretch h-[1200px] relative">
            {treeRounds.map(({ round, count }, idx) => {
              const roundMatches = resolved.filter((m) => m.round === round);
              const order = VISUAL_ORDERS[round] || [];
              const orderedMatches = order
                .map((idx) => roundMatches.find((m) => m.index === idx))
                .filter(Boolean) as ResolvedBracketMatch[];

              return (
                <Fragment key={round}>
                  {idx > 0 && <Connector parentCount={count * 2} />}
                  <div className="flex flex-col justify-around h-full w-48 shrink-0 py-2">
                    {orderedMatches.map((m) => (
                      <BracketCell key={m.index} match={m} t={t} comp={comp} />
                    ))}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {thirdPlaceMatch && (
        <div className="mt-6 w-48">
          <h3 className="ds-caption uppercase tracking-[0.18em] text-chalkdim mb-2">
            {t('bracket.3rd')}
          </h3>
          <BracketCell match={thirdPlaceMatch} t={t} comp={comp} />
        </div>
      )}
    </div>
  );
}

function BracketCell({
  match,
  t,
  comp,
}: {
  match: ResolvedBracketMatch;
  t: (k: string) => string;
  comp: string;
}) {
  const onClick = () => {
    if (match.match) {
      navigate(pathFor({ kind: 'match', comp, slug: match.match.slug }));
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!match.match}
      className="w-full rounded-card border border-line bg-panel px-2.5 py-1.5 text-left transition-all duration-200 hover:border-pitch focus:outline-none disabled:cursor-default disabled:hover:border-line shadow-panel"
    >
      <div className="flex items-center justify-between ds-caption text-chalkdim/60 mb-1">
        <span>{match.label}</span>
        {match.match && match.match.status === 'finished' && <span className="text-pitch">FT</span>}
        {match.match && match.match.status === 'live' && <span className="text-live">LIVE</span>}
      </div>
      <div className="flex items-center justify-between my-0.5 w-full min-w-0">
        <div
          className={`flex items-center gap-1.5 font-display text-xs min-w-0 truncate ${
            match.winner === 'home' ? 'text-chalk font-bold' : 'text-chalk'
          }`}
        >
          {match.home ? <TeamLabel team={match.home} /> : <TBD t={t} />}
        </div>
        {match.match && match.match.homeScore != null && (
          <span
            className={`text-xs tabular-nums shrink-0 ml-2 ${match.winner === 'home' ? 'text-chalk font-bold' : 'text-chalkdim'}`}
          >
            {match.match.homeScore}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between w-full min-w-0">
        <div
          className={`flex items-center gap-1.5 font-display text-xs min-w-0 truncate ${
            match.winner === 'away' ? 'text-chalk font-bold' : 'text-chalk'
          }`}
        >
          {match.away ? <TeamLabel team={match.away} /> : <TBD t={t} />}
        </div>
        {match.match && match.match.awayScore != null && (
          <span
            className={`text-xs tabular-nums shrink-0 ml-2 ${match.winner === 'away' ? 'text-chalk font-bold' : 'text-chalkdim'}`}
          >
            {match.match.awayScore}
          </span>
        )}
      </div>
    </button>
  );
}

function TeamLabel({ team }: { team: ResolvedTeam }) {
  return (
    <>
      {team.flag && (
        <img src={team.flag} alt="" className="w-4 h-3 object-cover rounded-micro shrink-0" />
      )}
      <span className="truncate">{team.label}</span>
    </>
  );
}

function TBD({ t }: { t: (k: string) => string }) {
  return <span className="text-chalkdim/40 ds-caption">{t('bracket.tbd')}</span>;
}
