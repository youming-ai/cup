import { describe, it, expect } from 'vitest';
import { messages, LANGS } from './messages';
import { translate } from './index';

describe('i18n messages', () => {
  it('every language has the same keys as en', () => {
    const enKeys = Object.keys(messages.en).sort();
    for (const lang of LANGS) {
      expect(Object.keys(messages[lang]).sort()).toEqual(enKeys);
    }
  });
});

describe('translate', () => {
  it('returns the translation for the active language', () => {
    expect(translate('zh', 'nav.live')).toBe('直播');
    expect(translate('ja', 'nav.live')).toBe('ライブ');
  });

  it('falls back to the key itself when missing in every language', () => {
    expect(translate('zh', '__missing__')).toBe('__missing__');
  });

  it('interpolates {var} placeholders', () => {
    expect(translate('en', 'common.watching', { n: 42 })).toBe('42 watching');
    expect(translate('zh', 'common.matchday', { n: 3 })).toBe('比赛日 3');
  });
});
