import { type ResolvedBracketMatch, type ResolvedTeam, useBracket } from '../hooks/useBracket';
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
      navigate(`/match/${encodeURIComponent(match.match.slug)}`);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!match.match}
      className="w-full rounded-xl border border-line/50 bg-panel p-3 text-left transition-all duration-200 hover:border-pitch focus:outline-none disabled:cursor-default disabled:hover:border-line/50 shadow-sm"
    >
      <div className="flex items-center justify-between font-mono text-[10px] text-chalkdim/60">
        <span>{match.label}</span>
        {match.match && match.match.status === 'finished' && <span className="text-pitch">FT</span>}
        {match.match && match.match.status === 'live' && <span className="text-live">LIVE</span>}
      </div>
      <div
        className={`flex items-center gap-1.5 font-display text-xs my-0.5 ${
          match.winner === 'home' ? 'text-chalk font-bold' : 'text-chalk'
        }`}
      >
        {match.home ? <TeamLabel team={match.home} /> : <TBD t={t} />}
      </div>
      <div
        className={`flex items-center gap-1.5 font-display text-xs ${
          match.winner === 'away' ? 'text-chalk font-bold' : 'text-chalk'
        }`}
      >
        {match.away ? <TeamLabel team={match.away} /> : <TBD t={t} />}
      </div>
      {match.match && match.match.homeScore != null && match.match.awayScore != null && (
        <div className="font-mono text-[10px] tabular-nums text-chalkdim mt-1">
          {match.match.homeScore} : {match.match.awayScore}
        </div>
      )}
    </button>
  );
}

function TeamLabel({ team }: { team: ResolvedTeam }) {
  return (
    <>
      {team.flag && (
        <img
          src={team.flag}
          alt=""
          className="w-4 h-3 object-cover rounded-[3px] border border-white/10 shrink-0"
        />
      )}
      <span className="truncate">{team.label}</span>
    </>
  );
}

function TBD({ t }: { t: (k: string) => string }) {
  return <span className="text-chalkdim/40 font-mono text-[10px]">{t('bracket.tbd')}</span>;
}
