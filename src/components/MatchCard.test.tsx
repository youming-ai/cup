import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('shows the score for a finished match', () => {
    renderCard({
      homeName: 'Mexico', awayName: 'South Africa',
      homeScore: 2, awayScore: 0, status: 'finished', kickoff: null,
    });
    expect(screen.getByText('Mexico')).toBeInTheDocument();
    expect(screen.getByText('2 : 0')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('shows the kickoff time for an upcoming match', () => {
    renderCard({
      homeName: 'Scotland', awayName: 'Brazil',
      homeScore: null, awayScore: null, status: 'upcoming',
      kickoff: new Date(2026, 5, 24, 18, 0),
    });
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.queryByText('Final')).not.toBeInTheDocument();
  });

  it('shows the LIVE status pill for a live match', () => {
    renderCard({
      homeName: 'Argentina', awayName: 'France',
      homeScore: 1, awayScore: 1, status: 'live', kickoff: null,
    });
    expect(screen.getByText('1 : 1')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });
});
