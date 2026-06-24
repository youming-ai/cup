import { useT } from '../i18n';
import type { WCStadium } from '../types';

// 主办城市 → viewBox(0..100 x, 0..60 y) 近似坐标（风格化示意，非地理精确）
const CITY_XY: Record<string, [number, number]> = {
  Vancouver: [12, 14],
  Seattle: [14, 16],
  'San Francisco': [10, 30],
  'Santa Clara': [10, 30],
  'Los Angeles': [16, 36],
  Inglewood: [16, 36],
  Guadalajara: [30, 52],
  'Mexico City': [40, 55],
  Monterrey: [38, 46],
  Houston: [46, 44],
  Dallas: [46, 38],
  Arlington: [46, 38],
  'Kansas City': [52, 31],
  Atlanta: [66, 38],
  Miami: [74, 48],
  Toronto: [70, 23],
  Boston: [86, 22],
  Foxborough: [86, 22],
  'New York': [82, 26],
  'East Rutherford': [82, 26],
  Philadelphia: [80, 28],
};

function locate(city: string, index: number): [number, number] {
  for (const [key, xy] of Object.entries(CITY_XY)) {
    if (city.includes(key) || key.includes(city)) return xy;
  }
  // 兜底：沿对角线散布
  return [10 + (index * 13) % 80, 12 + (index * 7) % 40];
}

export default function StadiumsView({ stadiums }: { stadiums: WCStadium[] }) {
  const t = useT();
  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (stadiums.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim">{t('common.empty')}</p>;
  }

  return (
    <div className="space-y-6">
      <p className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase">
        {t('stadiums.venuesCount', { n: stadiums.length })}
      </p>

      {/* 风格化地图 */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <svg viewBox="0 0 100 60" className="w-full h-auto" role="img" aria-label={t('stadiums.mapLabel')}>
          <defs>
            <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A211D" />
              <stop offset="100%" stopColor="#0A0F0D" />
            </linearGradient>
          </defs>
          {/* 抽象陆块 */}
          <path
            d="M8,10 C20,4 40,6 60,8 C78,9 92,14 94,22 C96,32 80,40 66,46 C52,52 40,58 30,54 C18,49 12,40 10,30 C8,22 4,16 8,10 Z"
            fill="url(#land)"
            stroke="#2A332E"
            strokeWidth="0.5"
          />
          {stadiums.map((s, i) => {
            const [x, y] = locate(s.city, i);
            return (
              <g key={s.id}>
                <circle cx={x} cy={y} r="1.4" fill="#2BD96B" />
                {!reduceMotion && (
                  <circle cx={x} cy={y} r="1.4" fill="none" stroke="#2BD96B" strokeOpacity="0.4" strokeWidth="0.6">
                    <animate attributeName="r" values="1.4;3;1.4" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 球场卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stadiums.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
          >
            <h3 className="font-display font-bold text-lg text-chalk">{s.name}</h3>
            <p className="font-body text-sm text-chalkdim">
              {s.city}, {s.country}
            </p>
            <p className="font-mono text-[10px] tracking-wider text-chalkdim/70 mt-1">{s.fifaName}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
              <span className="font-mono text-xs text-chalkdim">
                {t('stadiums.capacity')}
                <span className="text-pitch ml-2 tabular-nums">{s.capacity.toLocaleString()}</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-chalkdim">{s.region}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
