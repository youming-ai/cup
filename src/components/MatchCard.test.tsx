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
});
