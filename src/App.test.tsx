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
});
