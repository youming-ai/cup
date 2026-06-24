import { useT } from '../i18n';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-center">
      <div className="font-display font-bold text-4xl text-pitch tabular-nums">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-chalkdim mt-1">{label}</div>
    </div>
  );
}

const ROUNDS: { key: string; n: string }[] = [
  { key: 'stage.r32', n: '32' },
  { key: 'stage.r16', n: '16' },
  { key: 'stage.qf', n: '8' },
  { key: 'stage.sf', n: '4' },
  { key: 'stage.final', n: '2' },
];

export default function FormatGuide() {
  const t = useT();
  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="font-display font-bold text-3xl text-chalk tracking-wide">{t('format.title')}</h1>
        <p className="font-body text-chalkdim mt-1">{t('format.subtitle')}</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat value="48" label={t('format.teams')} />
        <Stat value="12" label={t('format.groups')} />
        <Stat value="16" label={t('format.venues')} />
        <Stat value="104" label={t('format.matches')} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <h2 className="font-display font-bold text-xl text-chalk">{t('format.groupStageTitle')}</h2>
        <p className="font-body text-sm text-chalkdim mt-2 leading-relaxed">{t('format.groupStageBody')}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <h2 className="font-display font-bold text-xl text-chalk">{t('format.knockoutTitle')}</h2>
        <p className="font-body text-sm text-chalkdim mt-2 leading-relaxed">{t('format.knockoutBody')}</p>
        <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar">
          {ROUNDS.map((r, i) => (
            <div key={r.key} className="flex items-center gap-2 shrink-0">
              <div className="rounded-xl border border-white/10 bg-night px-3 py-2 text-center">
                <div className="font-display font-bold text-pitch tabular-nums">{r.n}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-chalkdim whitespace-nowrap">
                  {t(r.key)}
                </div>
              </div>
              {i < ROUNDS.length - 1 && <span className="text-chalkdim">→</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
