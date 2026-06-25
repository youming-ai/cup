import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../i18n';
import MatchDetailModal from './MatchDetailModal';
import type { WCMatch } from '../types';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
beforeEach(() => { vi.clearAllMocks(); });

const match: WCMatch = {
  id: '760420',
  homeName: 'Mexico',
  awayName: 'South Africa',
  homeFlag: '',
  awayFlag: '',
  homeScore: 2,
  awayScore: 0,
  group: 'A',
  kickoff: new Date('2026-06-13T19:00Z'),
  status: 'finished',
  stage: 'group',
  homeScorers: [],
  awayScorers: [],
  venue: '',
};

function summaryJson() {
  return {
    header: { competitions: [{ competitors: [{ homeAway: 'home', team: { id: '203' } }] }] },
    boxscore: { teams: [{ team: { id: '203' }, statistics: [{ label: 'Shots', displayValue: '21' }] }] },
    commentary: [],
    keyEvents: [],
    rosters: [],
    gameInfo: {},
  };
}

it('loads the summary and shows the stats tab, closes on the close button', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <MatchDetailModal match={match} onClose={onClose} />
    </LanguageProvider>,
  );
  await waitFor(() => expect(screen.getByText('Shots')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Close'));
  expect(onClose).toHaveBeenCalled();
});

it('closes on Escape', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <MatchDetailModal match={match} onClose={onClose} />
    </LanguageProvider>,
  );
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

it('restores focus to the opener element after closing', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const opener = document.createElement('button');
  opener.textContent = 'open';
  document.body.appendChild(opener);
  opener.focus();
  expect(document.activeElement).toBe(opener);

  const onClose = vi.fn();
  const { unmount } = render(
    <LanguageProvider>
      <MatchDetailModal match={match} onClose={onClose} />
    </LanguageProvider>,
  );
  await waitFor(() => expect(screen.getByText('Shots')).toBeInTheDocument());
  // Closing the modal (caller would unmount it on onClose) restores opener focus.
  unmount();
  expect(document.activeElement).toBe(opener);
  opener.remove();
});

it('shows an i18n error with a retry button that refetches', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <MatchDetailModal match={match} onClose={onClose} />
    </LanguageProvider>,
  );
  await waitFor(() => expect(screen.getByText('Failed to load data')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Retry'));
  await waitFor(() => expect(screen.getByText('Shots')).toBeInTheDocument());
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
