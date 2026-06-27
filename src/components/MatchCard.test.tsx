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

  it('shows ET label for extra time (period 3)', () => {
    renderCard({
      homeName: 'Spain',
      awayName: 'Germany',
      homeScore: 2,
      awayScore: 2,
      status: 'live',
      kickoff: null,
      stage: 'qf',
      group: 'QF',
      // Period 3 = extra time 1st half. ESPN's displayClock would
      // typically read "91'" or "105'" — the label takes precedence.
      progress: { status: 'in', clock: 95, displayClock: '91', period: 3 },
    });
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('ET')).toBeInTheDocument();
    expect(screen.queryByText('91')).not.toBeInTheDocument();
  });

  it('shows PEN label during penalty shootout (period 5)', () => {
    renderCard({
      homeName: 'Argentina',
      awayName: 'France',
      homeScore: 2,
      awayScore: 2,
      status: 'live',
      kickoff: null,
      stage: 'final',
      group: 'Final',
      progress: { status: 'in', clock: 120, displayClock: '120', period: 5 },
    });
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('PEN')).toBeInTheDocument();
    expect(screen.queryByText('120')).not.toBeInTheDocument();
  });

  it('still shows the minute in regulation (period 1 or 2)', () => {
    renderCard({
      homeName: 'Brazil',
      awayName: 'Argentina',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      kickoff: null,
      stage: 'group',
      group: 'G',
      progress: { status: 'in', clock: 67, displayClock: "67'", period: 2 },
    });
    expect(screen.getByText("67'")).toBeInTheDocument();
    expect(screen.queryByText('ET')).not.toBeInTheDocument();
    expect(screen.queryByText('PEN')).not.toBeInTheDocument();
  });

  it('renders scorers inline under each team name on a finished match', () => {
    renderCard({
      homeName: 'Mexico',
      awayName: 'South Africa',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      kickoff: null,
      stage: 'group',
      group: 'A',
      homeScorers: ["Alvarado 45'", "Vega 67'"],
      awayScorers: [],
    });
    // The full scorer line including the minute marker is rendered under
    // the home team's name; the unicode ball emoji is appended by the UI.
    expect(screen.getByText(/⚽ Alvarado 45'/)).toBeInTheDocument();
    expect(screen.getByText(/⚽ Vega 67'/)).toBeInTheDocument();
  });

  it('truncates long scorer lists to 3 entries + "+N more"', () => {
    renderCard({
      homeName: 'Brazil',
      awayName: 'Germany',
      homeScore: 5,
      awayScore: 1,
      status: 'finished',
      kickoff: null,
      stage: 'group',
      group: 'G',
      homeScorers: ["P1 10'", "P2 20'", "P3 30'", "P4 40'", "P5 50'"],
      awayScorers: [],
    });
    // First three are shown
    expect(screen.getByText(/⚽ P1 10'/)).toBeInTheDocument();
    expect(screen.getByText(/⚽ P2 20'/)).toBeInTheDocument();
    expect(screen.getByText(/⚽ P3 30'/)).toBeInTheDocument();
    // The other two are summarised as "+2 more"
    expect(screen.getByText('+2 more')).toBeInTheDocument();
    // Earlier this showed them all in a separate block under the score;
    // the names should not leak through elsewhere
    expect(screen.queryByText(/P4 40'/)).not.toBeInTheDocument();
  });

  it('does not render a scorer list for an upcoming match', () => {
    renderCard({
      homeName: 'Scotland',
      awayName: 'Brazil',
      homeScore: null,
      awayScore: null,
      status: 'upcoming',
      kickoff: new Date(2026, 5, 24, 18, 0),
      stage: 'group',
      group: 'C',
      homeScorers: [],
      awayScorers: [],
    });
    expect(screen.queryByText(/⚽/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+[0-9]+ more/)).not.toBeInTheDocument();
  });

  it('shows the venue in the header next to the stage label when provided', () => {
    renderCard({
      homeName: 'Mexico',
      awayName: 'South Africa',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      kickoff: null,
      stage: 'group',
      group: 'A',
      venue: 'Estadio Azteca · Mexico City',
    });
    expect(screen.getByText('Group A')).toBeInTheDocument();
    // Venue renders with a · separator prefix in the header
    expect(screen.getByText(/· Estadio Azteca · Mexico City/)).toBeInTheDocument();
  });

  it('omits the venue section entirely when no venue is provided', () => {
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
    expect(screen.queryByText(/· /)).not.toBeInTheDocument();
    expect(screen.queryByText('Estadio')).not.toBeInTheDocument();
  });
});
