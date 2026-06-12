import { getMatchStatus } from './match-status.util';

describe('getMatchStatus', () => {
  const now = new Date('2026-06-15T15:00:00Z');

  it('returns UPCOMING before kickoff', () => {
    expect(
      getMatchStatus(
        { kickoffAt: new Date('2026-06-15T16:00:00Z'), finalScoreA: null },
        now,
      ),
    ).toBe('UPCOMING');
  });

  it('returns LIVE after kickoff without final score', () => {
    expect(
      getMatchStatus(
        { kickoffAt: new Date('2026-06-15T14:00:00Z'), finalScoreA: null },
        now,
      ),
    ).toBe('LIVE');
  });

  it('returns FINISHED when final score is set', () => {
    expect(
      getMatchStatus(
        { kickoffAt: new Date('2026-06-15T14:00:00Z'), finalScoreA: 2 },
        now,
      ),
    ).toBe('FINISHED');
  });
});
