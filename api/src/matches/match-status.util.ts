export type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';

export function getMatchStatus(
  match: { kickoffAt: Date; finalScoreA: number | null },
  now: Date = new Date(),
): MatchStatus {
  if (match.finalScoreA !== null) {
    return 'FINISHED';
  }
  return now < match.kickoffAt ? 'UPCOMING' : 'LIVE';
}
