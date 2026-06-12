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
  participantCount: number;
  isOwner: boolean;
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
