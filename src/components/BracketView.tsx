import { type ResolvedBracketMatch, useBracket } from '../hooks/useBracket';
import { useT } from '../i18n';
import type { WCGroup, WCMatch } from '../types';
import { navigate } from '../utils/router';

export default function BracketView({
  groups,
  matches,
}: {
  groups: WCGroup[];
  matches: WCMatch[];
}) {
  const t = useT();
  const { rounds } = useBracket(groups, matches);

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] tracking-wider text-chalkdim">{t('bracket.subtitle')}</p>
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
        <div className="grid grid-cols-6 gap-3 min-w-[900px]">
          {rounds.map(({ round, matches: roundMatches }) => (
            <div key={round} className="space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalkdim text-center sticky top-0 bg-night py-1">
                {t(`bracket.${round}`)}
              </h3>
              {roundMatches.map((m) => (
                <BracketCell key={m.index} match={m} t={t} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BracketCell({ match, t }: { match: ResolvedBracketMatch; t: (k: string) => string }) {
  const onClick = () => {
    if (match.match) {
      navigate(`/match/wc:${encodeURIComponent(match.match.slug)}`);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!match.match}
      className="w-full border border-line bg-panel p-2 text-left transition-colors hover:border-pitch focus:outline-none focus:border-pitch disabled:cursor-default disabled:hover:border-line"
    >
      <div className="flex items-center justify-between font-mono text-[10px] text-chalkdim/60">
        <span>{match.label}</span>
        {match.match && match.match.status === 'finished' && <span className="text-pitch">FT</span>}
        {match.match && match.match.status === 'live' && <span className="text-live">LIVE</span>}
      </div>
      <div
        className={`font-display text-xs my-0.5 truncate ${
          match.winner === 'home' ? 'text-chalk font-bold' : 'text-chalk'
        }`}
      >
        {match.home?.label ?? <TBD t={t} />}
      </div>
      <div
        className={`font-display text-xs truncate ${
          match.winner === 'away' ? 'text-chalk font-bold' : 'text-chalk'
        }`}
      >
        {match.away?.label ?? <TBD t={t} />}
      </div>
      {match.match && match.match.homeScore != null && match.match.awayScore != null && (
        <div className="font-mono text-[10px] tabular-nums text-chalkdim mt-1">
          {match.match.homeScore} : {match.match.awayScore}
        </div>
      )}
    </button>
  );
}

function TBD({ t }: { t: (k: string) => string }) {
  return <span className="text-chalkdim/40 font-mono text-[10px]">{t('bracket.tbd')}</span>;
}
