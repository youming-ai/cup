import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { LanguageProvider } from './i18n';

beforeEach(() => {
  // App 挂载即发起 fetch；用永不 resolve 的 mock 让其停在加载态
  globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof globalThis.fetch;
  localStorage.setItem('lang', 'en');
  window.history.pushState(null, '', '/');
});

describe('App', () => {
  it('renders the loading state on initial mount', () => {
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('marks the top-nav active from the route (/live → Live tab selected)', () => {
    window.history.pushState(null, '', '/live');
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    // The active top-nav tab is derived from the route, not from stored state.
    expect(screen.getByRole('tab', { name: /Live/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Schedule/ })).toHaveAttribute('aria-selected', 'false');
  });
});
