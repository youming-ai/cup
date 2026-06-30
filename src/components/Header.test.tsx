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

it('renders the four section tabs and marks the active one', () => {
  renderHeader('standings');
  for (const name of ['Matches', 'Standings', 'Scorers', 'Bracket']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  expect(screen.getByRole('button', { name: 'Standings' })).toHaveAttribute('aria-pressed', 'true');
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
  expect(navSpy).toHaveBeenCalledWith('/bracket');
});
