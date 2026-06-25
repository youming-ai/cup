import { describe, it, expect } from 'vitest';
import { googleCalUrl, icsDataUri } from './calendar';

const event = { title: 'Brazil vs France', start: new Date(Date.UTC(2026, 5, 24, 18, 0, 0)) };

describe('calendar', () => {
  it('builds a Google Calendar URL with UTC start/end and default 2h duration', () => {
    const url = googleCalUrl(event);
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('dates=20260624T180000Z%2F20260624T200000Z');
    expect(url).toContain('text=Brazil+vs+France');
  });

  it('builds an .ics data URI with the event start time', () => {
    const uri = icsDataUri(event);
    const ics = decodeURIComponent(uri.split(',')[1]);
    expect(ics).toContain('DTSTART:20260624T180000Z');
    expect(ics).toContain('DTEND:20260624T200000Z');
    expect(ics).toContain('SUMMARY:Brazil vs France');
  });
});
