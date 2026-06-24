import { useEffect, useState, type ReactNode } from 'react';

interface HeaderProps {
  mode: 'events' | 'channels';
  setMode: (m: 'events' | 'channels') => void;
  category: string;
  setCategory: (c: string) => void;
  categories: string[];
}

const MODES = [
  { key: 'events', label: '赛事直播', icon: '⚽' },
  { key: 'channels', label: '电视频道', icon: '📺' },
] as const;

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm text-chalkdim tabular-nums">
      {now.toLocaleTimeString('en-GB', { hour12: false })}
    </span>
  );
}

function ModeSwitch({
  mode,
  setMode,
  setCategory,
  className = '',
}: Pick<HeaderProps, 'mode' | 'setMode' | 'setCategory'> & { className?: string }) {
  return (
    <div className={`items-center gap-1 p-1 rounded-full border border-line bg-night ${className}`}>
      {MODES.map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => {
              setMode(m.key);
              setCategory('all');
            }}
            aria-pressed={active}
            className={`px-4 py-1.5 rounded-full font-display font-semibold tracking-wide text-sm whitespace-nowrap transition-colors ${
              active ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
            }`}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 px-3 py-1 font-mono text-xs uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
        active ? 'border-pitch text-chalk' : 'border-transparent text-chalkdim hover:text-chalk'
      }`}
    >
      {children}
    </button>
  );
}

export default function Header({ mode, setMode, category, setCategory, categories }: HeaderProps) {
  return (
    <header className="bg-panel border-b border-line">
      {/* 控制条主行 */}
      <div className="flex items-center justify-between gap-4 px-5 h-16">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-pitch shadow-[0_0_12px_rgba(43,217,107,0.8)]" />
          <div className="leading-none">
            <div className="font-display font-bold text-xl tracking-[0.18em] text-chalk">
              STREAMCUP
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-chalkdim mt-1">
              MATCHDAY · LIVE
            </div>
          </div>
        </div>

        <ModeSwitch
          mode={mode}
          setMode={setMode}
          setCategory={setCategory}
          className="hidden sm:flex"
        />

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-xs tracking-widest text-live">
            <span className="live-dot" />
            ON AIR
          </span>
          <span className="hidden md:inline">
            <Clock />
          </span>
        </div>
      </div>

      {/* 类目导轨（移动端含模式切换） */}
      <div className="flex items-center gap-3 px-5 h-11 border-t border-line overflow-x-auto no-scrollbar">
        <ModeSwitch
          mode={mode}
          setMode={setMode}
          setCategory={setCategory}
          className="flex sm:hidden"
        />
        <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>
          全部
        </CategoryChip>
        {categories.map((cat) => (
          <CategoryChip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
            {cat}
          </CategoryChip>
        ))}
      </div>
    </header>
  );
}
