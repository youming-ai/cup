import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { WCMatch } from '../types';
import MatchDetailPage from './MatchDetailPage';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
beforeEach(() => {
  fetchMock.mockReset();
});

const match: WCMatch = {
  id: '760420',
  homeName: 'Mexico',
  awayName: 'South Africa',
  homeFlag: '',
  awayFlag: '',
  homeId: '203',
  awayId: '492',
  homeScore: 2,
  awayScore: 0,
  group: 'A',
  kickoff: new Date('2026-06-13T19:00Z'),
  status: 'finished',
  stage: 'group',
  homeScorers: [],
  awayScorers: [],
  venue: '',
  slug: 'mexico-vs-south-africa',
};

function summaryJson() {
  return {
    header: { competitions: [{ competitors: [{ homeAway: 'home', team: { id: '203' } }] }] },
    boxscore: {
      teams: [{ team: { id: '203' }, statistics: [{ label: 'Shots', displayValue: '21' }] }],
    },
    commentary: [],
    keyEvents: [],
    rosters: [],
    gameInfo: {},
  };
}

it('renders the match header (home : away) and the back button', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const onBack = vi.fn();
  render(
    <LanguageProvider>
      <MatchDetailPage match={match} onBack={onBack} />
    </LanguageProvider>,
  );
  await waitFor(() => expect(screen.getByText('Shots')).toBeInTheDocument());
  // Header is rendered with the score and team names.
  expect(screen.getByText('Mexico')).toBeInTheDocument();
  expect(screen.getByText('South Africa')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Back/ }));
  expect(onBack).toHaveBeenCalled();
});

it('shows an i18n error with a retry button that refetches', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const onBack = vi.fn();
  render(
    <LanguageProvider>
      <MatchDetailPage match={match} onBack={onBack} />
    </LanguageProvider>,
  );
  await waitFor(() => expect(screen.getByText('Failed to load data')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Retry'));
  await waitFor(() => expect(screen.getByText('Shots')).toBeInTheDocument());
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
