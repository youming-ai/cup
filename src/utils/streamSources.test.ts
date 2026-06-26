import { describe, expect, it } from 'vitest';
import { isTrustedStreamUrl } from './streamSources';

describe('isTrustedStreamUrl', () => {
  it('accepts HTTPS URLs from trusted stream hosts', () => {
    expect(isTrustedStreamUrl('https://embedindia.st/embed/wc/game')).toBe(true);
    expect(isTrustedStreamUrl('https://live.embedindia.st/embed/wc/game')).toBe(true);
    expect(isTrustedStreamUrl('https://ppv.to/embed/game')).toBe(true);
  });

  it('rejects non-HTTPS, malformed, and unknown stream URLs', () => {
    expect(isTrustedStreamUrl('http://embedindia.st/embed/wc/game')).toBe(false);
    expect(isTrustedStreamUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedStreamUrl('https://evil.example/embed')).toBe(false);
    expect(isTrustedStreamUrl('not-a-url')).toBe(false);
  });
});
