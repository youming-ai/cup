import type { Match } from '../types';

// ponytail: dev-only seed. Real Football fixtures are all "upcoming" outside
// match windows, so there are no live cards to click. These 3 always-live 24/7
// channels from api.ppv.to give a clickable Live stream to exercise the full
// grab → m3u8 → Vidstack path. Injected by useStreams only when import.meta.env.DEV.
export const TEST_LIVE_STREAMS: Match[] = [
  {
    id: 5112,
    name: '24/7 South Park',
    category_name: '24/7',
    iframe: 'https://embedindia.st/embed/247-south-park',
    viewers: '22',
    substreams: [],
    slug: '247-south-park',
    tag: '24/7 channel',
    alwaysLive: true,
  },
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
  {
    id: 3663,
    name: '24/7 COWS',
    category_name: '24/7',
    iframe: 'https://embedindia.st/embed/247-cows',
    viewers: '0',
    substreams: [],
    slug: '247-cows',
    tag: '24/7 channel',
    alwaysLive: true,
  },
];
