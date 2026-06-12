export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface Participant {
  id: string;
  groupId: string;
  name: string;
  code?: string;
  userId: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  inviteToken: string;
  ownerId: string;
  scoringExactScore: number;
  scoringCorrectOutcome: number;
  scoringOneTeamScore: number;
  sport: Sport;
  competitionLeagueId: number | null;
  competitionSeason: string | null;
  competitionName: string | null;
  createdAt: string;
  participants?: Participant[];
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  scoringExactScore: number;
  scoringCorrectOutcome: number;
  scoringOneTeamScore: number;
  sport: Sport;
  competitionLeagueId: number | null;
  competitionSeason: string | null;
  competitionName: string | null;
  participantCount: number;
  isOwner: boolean;
}

export type FixtureStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

export type Sport =
  | 'FOOTBALL'
  | 'AFL'
  | 'BASEBALL'
  | 'BASKETBALL'
  | 'HANDBALL'
  | 'HOCKEY'
  | 'NFL'
  | 'RUGBY'
  | 'VOLLEYBALL';

export interface Competition {
  sport: Sport;
  leagueId: number;
  name: string;
  type: string;
  logo: string | null;
  country: string;
  season: string;
}

export interface FixtureView {
  id: string;
  externalId: number;
  sport: Sport;
  leagueId: number;
  season: string;
  round: string | null;
  teamA: string;
  teamB: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  kickoffAt: string;
  status: FixtureStatus;
  minute: number | null;
  scoreA: number | null;
  scoreB: number | null;
}

export interface MatchFixtureInfo {
  status: FixtureStatus;
  minute: number | null;
  scoreA: number | null;
  scoreB: number | null;
  teamALogo: string | null;
  teamBLogo: string | null;
  round: string | null;
}

export type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';

export interface Prediction {
  id: string;
  matchId: string;
  participantId: string;
  scoreA: number;
  scoreB: number;
  editCount: number;
  lockedAt: string | null;
  points: number | null;
  participant?: { id: string; name: string };
}

export interface MatchView {
  id: string;
  groupId: string;
  teamA: string;
  teamB: string;
  kickoffAt: string;
  predictionDeadline: string;
  fixtureId: string | null;
  fixture: MatchFixtureInfo | null;
  finalScoreA: number | null;
  finalScoreB: number | null;
  status: MatchStatus;
  myPrediction: Prediction | null;
  predictions: Prediction[];
}

export interface RankingEntry {
  id: string;
  name: string;
  totalPoints: number;
  matchesPlayed: number;
  correctPredictions: number;
  exactScores: number;
  correctOutcomes: number;
  rank: number;
  successRate: number;
  averagePoints: number;
}

export interface GroupStats {
  participantCount: number;
  matchCount: number;
  averagePointsPerPlayer: number;
  bestPlayer: RankingEntry | null;
  mostExactScores: RankingEntry | null;
  ranking: RankingEntry[];
}

export interface InviteInfo {
  name: string;
  description: string | null;
}

export interface JoinResult {
  token: string;
  groupId: string;
  participant: { id: string; name: string };
}

export interface ParticipantSession extends JoinResult {
  groupName: string;
}
