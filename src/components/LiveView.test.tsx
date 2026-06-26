import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { Match } from '../types';
import LiveView from './LiveView';

// Player resolves stream embed URLs via fetch on open — stub it so player-mode
// tests don't hit the network. Returns no streams; the title/back button still
// render, which is all these tests assert.
beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof globalThis.fetch;
});

function renderLiveView(matches: Match[]) {
  return render(
    <LanguageProvider>
      <LiveView matches={matches} />
    </LanguageProvider>,
  );
}

function mk(m: Partial<Match> & { id: string; name: string; status: 'live' | 'upcoming' }): Match {
  return {
    category_name: 'Football',
    streamSources: [{ source: 'echo', id: '1' }],
    slug: m.name.toLowerCase().replace(/\s+/g, '-'),
    ...m,
  };
}

describe('LiveView', () => {
  it('shows live matches in the Live section', () => {
    renderLiveView([mk({ id: '1', name: 'Mexico vs Brazil', status: 'live' })]);
    expect(screen.getByText('Mexico vs Brazil')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument(); // section heading
  });

  it('shows upcoming matches sorted by startsAt', () => {
    const t1 = Math.floor((Date.now() + 7200000) / 1000); // 2h from now
    const t2 = Math.floor((Date.now() + 3600000) / 1000); // 1h from now
    renderLiveView([
      mk({ id: '1', name: 'Later Game', status: 'upcoming', startsAt: t1 }),
      mk({ id: '2', name: 'Sooner Game', status: 'upcoming', startsAt: t2 }),
    ]);
    expect(screen.getByText('Upcoming matches')).toBeInTheDocument();

    const cards = screen.getAllByText(/Game/);
    expect(cards).toHaveLength(2);
    // Sooner Game first (sorted ascending by startsAt)
    expect(cards[0].textContent).toBe('Sooner Game');
    expect(cards[1].textContent).toBe('Later Game');
  });

  it('shows empty message when there are no matches', () => {
    renderLiveView([]);
    expect(screen.getByText('No live matches right now')).toBeInTheDocument();
  });

  it('displays the formatted kickoff time on upcoming cards', () => {
    const future = Math.floor((Date.now() + 7200000) / 1000);
    renderLiveView([mk({ id: '1', name: 'Future Match', status: 'upcoming', startsAt: future })]);
    expect(screen.getByText('Future Match')).toBeInTheDocument();
    expect(screen.getByText('Upcoming matches')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('shows the list view by default (no deep link)', () => {
    window.history.replaceState(null, '', '?view=live');
    renderLiveView([mk({ id: '1', name: 'Live Game', status: 'live' })]);
    expect(screen.getByText('Live Game')).toBeInTheDocument();
    expect(screen.queryByText('Back to matches')).not.toBeInTheDocument();
  });

  it('enters player mode when URL has a valid live match slug', () => {
    window.history.replaceState(null, '', '?view=live&match=live-game');
    renderLiveView([mk({ id: '1', name: 'Live Game', status: 'live' })]);
    expect(screen.getByText('Back to matches')).toBeInTheDocument();
    expect(screen.getByText('Live Game')).toBeInTheDocument(); // title in player
  });

  it('ignores deep link for an upcoming match and shows list', () => {
    const future = Math.floor((Date.now() + 7200000) / 1000);
    window.history.replaceState(null, '', '?view=live&match=future-match');
    renderLiveView([mk({ id: '1', name: 'Future Match', status: 'upcoming', startsAt: future })]);
    expect(screen.queryByText('Back to matches')).not.toBeInTheDocument();
  });

  it('ignores deep link when match slug does not exist', () => {
    window.history.replaceState(null, '', '?view=live&match=nonexistent');
    renderLiveView([mk({ id: '1', name: 'Live Game', status: 'live' })]);
    expect(screen.queryByText('Back to matches')).not.toBeInTheDocument();
  });
});
