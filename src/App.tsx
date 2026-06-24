import { useState, useEffect } from 'react';
import Header, { type View } from './components/Header';
import LiveView from './components/LiveView';
import FixturesView from './components/FixturesView';
import StadiumsView from './components/StadiumsView';
import FormatGuide from './components/FormatGuide';
import { useStreams } from './hooks/useStreams';
import { useWorldCup } from './hooks/useWorldCup';
import { translate, useLang, useT } from './i18n';

const KNOWN_VIEWS: View[] = ['live', 'fixtures', 'stadiums', 'format'];

function initialView(): View {
  const v = new URLSearchParams(window.location.search).get('view');
  return v && (KNOWN_VIEWS as string[]).includes(v) ? (v as View) : 'live';
}

function Loading() {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-full bg-night gap-4">
      <span className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse motion-reduce:animate-none">
        {t('common.loading')}
      </span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-full bg-night p-6 text-center gap-3">
      <div className="font-mono text-xs tracking-[0.3em] text-live">{t('common.signalLost')}</div>
      <h2 className="font-display font-bold text-2xl text-chalk tracking-wide">{t('common.error')}</h2>
      <p className="font-body text-sm text-chalkdim max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 px-4 py-2 bg-pitch text-night font-display font-semibold tracking-wide rounded hover:brightness-110 transition"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}

export default function App() {
  const [view, setViewState] = useState<View>(initialView);
  const { lang } = useLang();
  const streams = useStreams();
  const wc = useWorldCup();

  useEffect(() => {
    document.title = `StreamCup — ${translate(lang, 'brand.subtitle')}`;
  }, [lang]);

  const setView = (v: View) => {
    setViewState(v);
    // 保留既有查询参数（尤其是 ?match），仅更新 view，避免切 tab 丢失直播深链
    const params = new URLSearchParams(window.location.search);
    params.set('view', v);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-night">
      <Header view={view} setView={setView} />

      {view === 'live' && (
        streams.loading ? <Loading /> :
        streams.error ? <ErrorState message={streams.error} onRetry={streams.refetch} /> :
        <LiveView matches={streams.matches} />
      )}

      {view !== 'live' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-night">
          {wc.loading ? <Loading /> :
            wc.error ? <ErrorState message={wc.error} onRetry={wc.refetch} /> :
            view === 'fixtures' ? <FixturesView matches={wc.matches} groups={wc.groups} /> :
            view === 'stadiums' ? <StadiumsView stadiums={wc.stadiums} /> :
            <FormatGuide />}
        </div>
      )}
    </div>
  );
}
