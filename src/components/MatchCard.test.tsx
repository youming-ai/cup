import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n';
import MatchCard from './MatchCard';

function renderCard(props: Parameters<typeof MatchCard>[0]) {
  return render(
    <LanguageProvider>
      <MatchCard {...props} />
    </LanguageProvider>,
  );
}

describe('MatchCard', () => {
  it('shows the score and group for a finished match', () => {
    renderCard({
      homeName: 'Mexico',
      awayName: 'South Africa',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      kickoff: null,
      stage: 'group',
      group: 'A',
    });
    expect(screen.getByText('Mexico')).toBeInTheDocument();
    expect(screen.getByText('2 : 0')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByText('Group A')).toBeInTheDocument();
  });

  it('shows the kickoff time for an upcoming match', () => {
    renderCard({
      homeName: 'Scotland',
      awayName: 'Brazil',
      homeScore: null,
      awayScore: null,
      status: 'upcoming',
      kickoff: new Date(2026, 5, 24, 18, 0),
      stage: 'group',
      group: 'C',
    });
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.queryByText('Final')).not.toBeInTheDocument();
  });

  it('shows the LIVE status pill and stage for a knockout match', () => {
    renderCard({
      homeName: 'Argentina',
      awayName: 'France',
      homeScore: 1,
      awayScore: 1,
      status: 'live',
      kickoff: null,
      stage: 'final',
      group: 'Final',
    });
    expect(screen.getByText('1 : 1')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('shows the current minute when progress is in', () => {
    renderCard({
      homeName: 'Spain',
      awayName: 'Germany',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      kickoff: null,
      stage: 'group',
      group: 'E',
      progress: { status: 'in', clock: 67, displayClock: "67'", period: 2 },
    });
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText("67'")).toBeInTheDocument();
  });

  it('uses displayClock verbatim when ESPN provides stoppage-time notation', () => {
    renderCard({
      homeName: 'Spain',
      awayName: 'Germany',
      homeScore: 2,
      awayScore: 2,
      status: 'live',
      kickoff: null,
      stage: 'group',
      group: 'E',
      progress: { status: 'in', clock: 47, displayClock: "45'+2'", period: 1 },
    });
    expect(screen.getByText("45'+2'")).toBeInTheDocument();
  });

  it('shows the HT pill (not LIVE) when progress is halftime', () => {
    renderCard({
      homeName: 'Spain',
      awayName: 'Germany',
      homeScore: 1,
      awayScore: 1,
      status: 'live',
      kickoff: null,
      stage: 'group',
      group: 'E',
      progress: { status: 'halftime', clock: 45, displayClock: 'HT', period: 1 },
    });
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
    expect(screen.getByText('Half-time')).toBeInTheDocument();
    expect(screen.getByText('HT')).toBeInTheDocument();
    expect(screen.getByText('1 : 1')).toBeInTheDocument();
  });

  it('shows FT pill and score for finished matches', () => {
    renderCard({
      homeName: 'Argentina',
      awayName: 'France',
      homeScore: 3,
      awayScore: 0,
      status: 'finished',
      kickoff: null,
      stage: 'sf',
      group: 'SF',
      progress: { status: 'post', clock: 95, displayClock: "90'+5'", period: 2 },
    });
    expect(screen.getByText('Final')).toBeInTheDocument();
    // The "clock under the score" line is omitted for finished games.
    expect(screen.queryByText("90'+5'")).not.toBeInTheDocument();
  });
});
