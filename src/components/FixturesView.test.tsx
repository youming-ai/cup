import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { WCGroup, WCMatch } from '../types';
import FixturesView from './FixturesView';

function renderView(matches: WCMatch[], groups: WCGroup[] = []) {
  return render(
    <LanguageProvider>
      <FixturesView matches={matches} groups={groups} />
    </LanguageProvider>,
  );
}

function match(overrides: Partial<WCMatch> & { id: string }): WCMatch {
  return {
    homeName: 'Mexico',
    awayName: 'Canada',
    homeFlag: '',
    awayFlag: '',
    homeScore: 0,
    awayScore: 0,
    status: 'upcoming',
    kickoff: new Date('2026-06-15T20:00:00Z'),
    stage: 'group',
    group: 'A',
    homeScorers: [],
    awayScorers: [],
    venue: '',
    slug: 'mexico-vs-canada',
    ...overrides,
  };
}

describe('FixturesView status filter', () => {
  it('renders the All / Upcoming / Finished chips with counts', () => {
    renderView([
      match({ id: '1', status: 'finished', homeScore: 2, awayScore: 1 }),
      match({ id: '2', status: 'finished', homeScore: 0, awayScore: 0 }),
      match({ id: '3', status: 'upcoming' }),
    ]);
    expect(screen.getByRole('button', { name: /^All\s+3$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Upcoming\s+1$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Finished\s+2$/ })).toBeInTheDocument();
  });

  it('hides upcoming matches when Finished is selected', () => {
    renderView([
      match({ id: '1', status: 'finished', homeName: 'A', awayName: 'B' }),
      match({ id: '2', status: 'upcoming', homeName: 'C', awayName: 'D' }),
    ]);
    // Both match cards visible initially
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Finished\s+1$/ }));

    // The finished match remains, the upcoming one is gone
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  it('hides finished matches when Upcoming is selected', () => {
    renderView([
      match({ id: '1', status: 'finished', homeName: 'A', awayName: 'B' }),
      match({ id: '2', status: 'upcoming', homeName: 'C', awayName: 'D' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /^Upcoming\s+1$/ }));

    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    // The "Results" section header should also be absent in the upcoming-only view
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
  });

  it('shows a friendly empty state when filter has no matches', () => {
    renderView([match({ id: '1', status: 'upcoming' })]);

    fireEvent.click(screen.getByRole('button', { name: /^Finished\s+0$/ }));

    expect(screen.getByText('No finished matches yet')).toBeInTheDocument();
  });

  it('shows the "Results" divider only in All view', () => {
    renderView([
      match({ id: '1', status: 'finished', homeName: 'A', awayName: 'B' }),
      match({ id: '2', status: 'upcoming', homeName: 'C', awayName: 'D' }),
    ]);

    // In All view, the divider is present
    expect(screen.getByText('Results')).toBeInTheDocument();

    // In Finished-only view, the divider is suppressed (no need to label a single section)
    fireEvent.click(screen.getByRole('button', { name: /^Finished\s+1$/ }));
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
  });

  it('All chip restores both sections', () => {
    renderView([
      match({ id: '1', status: 'finished', homeName: 'A', awayName: 'B' }),
      match({ id: '2', status: 'upcoming', homeName: 'C', awayName: 'D' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /^Finished\s+1$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^All\s+2$/ }));

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  it('keeps stage filter chips functional alongside the status filter', () => {
    renderView([
      match({ id: '1', status: 'finished', stage: 'group' }),
      match({ id: '2', status: 'finished', stage: 'qf' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /^Finished\s+2$/ }));

    // Click the Group stage chip within the stage filter row (not the status filter row)
    const stageChip = screen.getByRole('button', { name: 'Group stage' });
    const stageBar = stageChip.parentElement!;
    fireEvent.click(within(stageBar).getByRole('button', { name: 'Group stage' }));

    // Both finished matches were in different stages; filtering by Group
    // should leave only the group match visible. The status-filter counts
    // remain unfiltered (still 2).
    expect(screen.getAllByText('Mexico').length).toBe(1);
    expect(screen.getByRole('button', { name: /^Finished\s+2$/ })).toBeInTheDocument();
  });
});
