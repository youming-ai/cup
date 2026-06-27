import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { LanguageProvider } from './i18n';

beforeEach(() => {
  // App 挂载即发起 fetch；用永不 resolve 的 mock 让其停在加载态
  globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof globalThis.fetch;
  localStorage.setItem('lang', 'en');
  localStorage.removeItem('cup:view');
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

  it('persists view=live for a live-stream deep link so Back returns to live', () => {
    window.history.pushState(null, '', '/match/some-live-slug');
    render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    );
    // The live-route effect must store the tab as 'live', so the eventual
    // Back (→ '/') lands on the live list rather than the schedule.
    expect(localStorage.getItem('cup:view')).toBe('live');
  });
});
