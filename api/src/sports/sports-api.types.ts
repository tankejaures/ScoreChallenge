import { FixtureStatus, Sport } from '@prisma/client';

// ---- Enveloppe commune api-sports ----
export interface ApiSportsEnvelope<T> {
  response: T[];
}

// ---- Réponses brutes v3 football (champs utilisés) ----
export interface ApiLeagueEntry {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string };
  seasons: { year: number; current: boolean; start: string; end: string }[];
}

export interface ApiFixtureEntry {
  fixture: {
    id: number;
    date: string; // ISO
    status: { short: string; elapsed: number | null };
  };
  league: { id: number; season: number; round: string };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
}

// ---- Réponses brutes v1 (champs utilisés ; structures tolérantes) ----
// Certains sports renvoient la ligue à plat, d'autres sous { league: {...} }.
export interface ApiV1LeagueEntry {
  id?: number;
  name?: string;
  type?: string;
  logo?: string | null;
  league?: { id: number; name: string; type?: string; logo?: string | null };
  country?: { name?: string };
  seasons?: { season: number | string; current?: boolean }[];
}

// Certains sports (NFL) enveloppent le match sous { game: {...} }.
export type ApiV1Score = number | { total?: number | null } | null;

export interface ApiV1GameCore {
  id: number;
  date: string | { date?: string };
  status: { short: string; long?: string };
}

export interface ApiV1GameEntry {
  id?: number;
  date?: string | { date?: string };
  status?: { short: string; long?: string };
  game?: ApiV1GameCore;
  league: { id: number; season: number | string; round?: string | null };
  teams: {
    home: { name: string; logo?: string | null };
    away: { name: string; logo?: string | null };
  };
  scores: { home: ApiV1Score; away: ApiV1Score };
}

// ---- Format pivot (seul format vu par le reste du code) ----
export interface NormalizedGame {
  externalId: number;
  leagueId: number;
  season: string;
  round: string | null;
  teamA: string;
  teamB: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  kickoffAt: Date;
  status: FixtureStatus;
  minute: number | null;
  scoreA: number | null;
  scoreB: number | null;
}

// ---- DTO domaine ----
export interface CompetitionDto {
  sport: Sport;
  leagueId: number;
  name: string;
  type: string;
  logo: string | null;
  country: string;
  season: string;
}
