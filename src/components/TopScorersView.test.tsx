import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { TopScorer } from '../types';
import TopScorersView from './TopScorersView';

function renderView(scorers: TopScorer[]) {
  return render(
    <LanguageProvider>
      <TopScorersView scorers={scorers} />
    </LanguageProvider>,
  );
}

describe('TopScorersView', () => {
  it('shows an empty message when there are no scorers', () => {
    renderView([]);
    expect(screen.getByText('No goals scored yet')).toBeInTheDocument();
  });

  it('renders each scorer with rank, name, team, and goals', () => {
    renderView([
      { athleteId: '1', name: 'Erling Haaland', teamId: '464', teamName: 'Norway', goals: 4 },
      { athleteId: '2', name: 'Kylian Mbappé', teamId: '475', teamName: 'France', goals: 3 },
      { athleteId: '3', name: 'Mohamed Salah', teamId: '498', teamName: 'Egypt', goals: 2 },
    ]);
    // Player names: unique per row.
    expect(screen.getByText('Erling Haaland')).toBeInTheDocument();
    expect(screen.getByText('Kylian Mbappé')).toBeInTheDocument();
    expect(screen.getByText('Mohamed Salah')).toBeInTheDocument();
    // Team names: each appears in both a desktop <td> and a mobile <span>;
    // use getAllByText to assert presence without matching a single instance.
    expect(screen.getAllByText('Norway').length).toBeGreaterThan(0);
    expect(screen.getAllByText('France').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Egypt').length).toBeGreaterThan(0);
    // Goals column shows the numeric goal count in a large tabular cell.
    // The goal cells share digits with the rank column ("2", "3", etc.) so we
    // select them by the table-data cell role, then filter to those whose
    // className includes the bold goal-cell style.
    const goalsCells = screen.getAllByRole('cell').filter((c) => c.className.includes('font-bold'));
    expect(goalsCells.map((c) => c.textContent)).toEqual(['4', '3', '2']);
  });

  it('numbers rows starting from 1', () => {
    renderView([
      { athleteId: '1', name: 'A', teamId: '1', teamName: 'TA', goals: 5 },
      { athleteId: '2', name: 'B', teamId: '2', teamName: 'TB', goals: 3 },
    ]);
    // First cell of each row should be 1, then 2. jsdom's HTMLElement doesn't
    // expose the table-specific `cells` collection, so read text via
    // firstElementChild.
    const rows = screen.getAllByRole('row');
    // rows[0] = thead, rows[1] = first scorer, rows[2] = second
    expect(rows[1]?.textContent).toMatch(/^1/);
    expect(rows[2]?.textContent).toMatch(/^2/);
  });

  it('renders a header row with the expected column labels', () => {
    renderView([{ athleteId: '1', name: 'A', teamId: '1', teamName: 'TA', goals: 1 }]);
    expect(screen.getByRole('columnheader', { name: '#' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Player' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'G' })).toBeInTheDocument();
  });
});
