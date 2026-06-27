import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { Match } from '../types';
import LiveView from './LiveView';

function renderLiveView(matches: Match[], initialSlug?: string) {
  return render(
    <LanguageProvider>
      <LiveView matches={matches} initialSlug={initialSlug} />
    </LanguageProvider>,
  );
}

// Helper to build a Match with minimal fields for testing
function mk(m: Partial<Match> & { id: number; name: string; iframe: string }): Match {
  return {
    category_name: 'Football',
    viewers: '0',
    substreams: [],
    slug: m.name.toLowerCase().replace(/\s+/g, '-'),
    ...m,
  };
}

describe('LiveView', () => {
  // ---- classify logic (via rendering) ----

  it('shows live matches in the Live section when they are currently live', () => {
    const matches: Match[] = [
      mk({ id: 1, name: 'Mexico vs Brazil', iframe: 'https://a', alwaysLive: true }),
    ];
    renderLiveView(matches);
    expect(screen.getByText('Mexico vs Brazil')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument(); // section heading
  });

  it('shows matches with startsAt in the past and no endsAt as live', () => {
    const past = Math.floor((Date.now() - 3600000) / 1000); // 1 hour ago
    const matches: Match[] = [
      mk({ id: 1, name: 'Ongoing Game', iframe: 'https://a', startsAt: past }),
    ];
    renderLiveView(matches);
    expect(screen.getByText('Ongoing Game')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows upcoming matches in the Upcoming section sorted by startsAt', () => {
    const t1 = Math.floor((Date.now() + 7200000) / 1000); // 2h from now
    const t2 = Math.floor((Date.now() + 3600000) / 1000); // 1h from now
    const matches: Match[] = [
      mk({ id: 1, name: 'Later Game', iframe: 'https://a', startsAt: t1 }),
      mk({ id: 2, name: 'Sooner Game', iframe: 'https://b', startsAt: t2 }),
    ];
    renderLiveView(matches);
    expect(screen.getByText('Upcoming matches')).toBeInTheDocument();

    // Upcoming cards are non-clickable divs (opacity-80), not buttons
    const cards = screen.getAllByText(/Game/);
    expect(cards).toHaveLength(2);
    // Sooner Game should appear first (sorted ascending by startsAt)
    expect(cards[0].textContent).toBe('Sooner Game');
    expect(cards[1].textContent).toBe('Later Game');
  });

  it('excludes ended matches from both sections', () => {
    const past = Math.floor((Date.now() - 7200000) / 1000); // 2h ago
    const ended = Math.floor((Date.now() - 3600000) / 1000); // 1h ago
    const matches: Match[] = [
      mk({ id: 1, name: 'Ended Game', iframe: 'https://a', startsAt: past, endsAt: ended }),
    ];
    renderLiveView(matches);
    expect(screen.queryByText('Ended Game')).not.toBeInTheDocument();
  });

  it('shows empty message when no matches are live or upcoming', () => {
    renderLiveView([]);
    expect(screen.getByText('No live matches right now')).toBeInTheDocument();
  });

  // ---- formatKickoff logic (via rendering) ----

  it('displays the formatted kickoff time on upcoming cards', () => {
    const future = Math.floor((Date.now() + 7200000) / 1000);
    const matches: Match[] = [
      mk({ id: 1, name: 'Future Match', iframe: 'https://a', startsAt: future }),
    ];
    renderLiveView(matches);
    expect(screen.getByText('Future Match')).toBeInTheDocument();
    // Upcoming cards with a startsAt show the formatted kickoff, not "Upcoming"
    expect(screen.getByText('Upcoming matches')).toBeInTheDocument(); // section heading
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  // ---- player mode / deep-link ----

  it('shows the list view by default (no deep link)', () => {
    const matches: Match[] = [
      mk({ id: 1, name: 'Live Game', iframe: 'https://a', alwaysLive: true }),
    ];
    renderLiveView(matches);
    // Should show the list, not the player
    expect(screen.getByText('Live Game')).toBeInTheDocument();
    // Back button should not be present
    expect(screen.queryByText('Back to matches')).not.toBeInTheDocument();
  });

  it('enters player mode when initialSlug points at a live match', () => {
    const matches: Match[] = [
      mk({ id: 1, name: 'Live Game', iframe: 'https://a', alwaysLive: true }),
    ];
    renderLiveView(matches, 'live-game');
    // Should show the player with a back button
    expect(screen.getByText('Back to matches')).toBeInTheDocument();
    expect(screen.getByText('Live Game')).toBeInTheDocument(); // title in player
  });

  it('ignores initialSlug for an upcoming match and shows list', () => {
    const future = Math.floor((Date.now() + 7200000) / 1000);
    const matches: Match[] = [
      mk({ id: 1, name: 'Future Match', iframe: 'https://a', startsAt: future }),
    ];
    renderLiveView(matches, 'future-match');
    // Should stay on list view since future matches are not playable
    expect(screen.queryByText('Back to matches')).not.toBeInTheDocument();
  });

  it('ignores initialSlug when the match does not exist', () => {
    const matches: Match[] = [
      mk({ id: 1, name: 'Live Game', iframe: 'https://a', alwaysLive: true }),
    ];
    renderLiveView(matches, 'nonexistent');
    expect(screen.queryByText('Back to matches')).not.toBeInTheDocument();
  });
});
