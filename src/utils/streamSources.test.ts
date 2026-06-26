import { describe, expect, it } from 'vitest';
import { isTrustedStreamUrl } from './streamSources';

describe('isTrustedStreamUrl', () => {
  it('accepts HTTPS URLs from trusted stream hosts', () => {
    expect(isTrustedStreamUrl('https://embed.st/embed/admin/game/1')).toBe(true);
    expect(isTrustedStreamUrl('https://live.embed.st/embed/game')).toBe(true);
  });

  it('rejects non-HTTPS, malformed, and unknown stream URLs', () => {
    expect(isTrustedStreamUrl('http://embed.st/embed/game/1')).toBe(false);
    expect(isTrustedStreamUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedStreamUrl('https://evil.example/embed')).toBe(false);
    expect(isTrustedStreamUrl('not-a-url')).toBe(false);
  });
});
