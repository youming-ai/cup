import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n';
import * as router from '../utils/router';
import CompetitionSwitcher from './CompetitionSwitcher';

describe('CompetitionSwitcher', () => {
  it('opens and lists competition labels', () => {
    render(
      <LanguageProvider>
        <CompetitionSwitcher />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    // The trigger button also renders the current competition's label ("World
    // Cup" is the default), so scope to the listbox to avoid ambiguous matches.
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('World Cup')).toBeInTheDocument();
    expect(within(listbox).getByText('Premier League')).toBeInTheDocument();
  });

  it('navigates to the selected competition root', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockImplementation(() => {});
    render(
      <LanguageProvider>
        <CompetitionSwitcher />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Premier League'));
    expect(navSpy).toHaveBeenCalledWith('/eng.1');
    navSpy.mockRestore();
  });
});
