import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n';
import * as router from '../utils/router';
import Header from './Header';

function renderHeader(section?: Parameters<typeof Header>[0]['section']) {
  return render(
    <LanguageProvider>
      <Header section={section} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});
afterEach(() => {
  vi.restoreAllMocks();
});

it('renders the section tabs and marks the active one', () => {
  renderHeader('scorers');
  for (const name of ['Matches', 'Scorers', 'Bracket']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  // Standings is no longer a tab — it lives under the group-stage filter.
  expect(screen.queryByRole('button', { name: 'Standings' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Scorers' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Matches' })).toHaveAttribute('aria-pressed', 'false');
});

it('marks no tab active on a non-section page', () => {
  renderHeader(undefined);
  expect(screen.getByRole('button', { name: 'Matches' })).toHaveAttribute('aria-pressed', 'false');
});

it('navigates to the section route when a tab is clicked', () => {
  const navSpy = vi.spyOn(router, 'navigate').mockImplementation(() => {});
  renderHeader('matches');
  fireEvent.click(screen.getByRole('button', { name: 'Bracket' }));
  expect(navSpy).toHaveBeenCalledWith('/fifa.world/bracket');
});
