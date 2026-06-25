import type { Match } from '../types';

// ponytail: dev-only seed. Real fixtures are "upcoming" outside match windows, so
// there's no live card to click locally. One always-live 24/7 channel from
// api.ppv.to gives a clickable Live stream. Injected by useStreams only when
// import.meta.env.MODE === 'development'.
export const TEST_LIVE_STREAMS: Match[] = [
  {
    id: 8008,
    name: '24/7 Family Guy',
    category_name: '24/7',
    iframe: 'https://embedindia.st/embed/247-family-guy',
    viewers: '30',
    substreams: [],
    slug: '247-family-guy',
    tag: '24/7 channel',
    alwaysLive: true,
  },
];
