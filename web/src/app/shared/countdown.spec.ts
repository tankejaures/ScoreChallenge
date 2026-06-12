import { formatCountdown } from './countdown';

describe('formatCountdown', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('formats days and hours', () => {
    expect(formatCountdown(new Date('2026-06-17T15:30:00Z'), now)).toBe('2 j 3 h');
  });

  it('formats hours and minutes under a day', () => {
    expect(formatCountdown(new Date('2026-06-15T14:45:00Z'), now)).toBe('2 h 45 min');
  });

  it('formats minutes under an hour', () => {
    expect(formatCountdown(new Date('2026-06-15T12:20:00Z'), now)).toBe('20 min');
  });

  it('returns null when expired', () => {
    expect(formatCountdown(new Date('2026-06-15T11:59:00Z'), now)).toBeNull();
  });
});
