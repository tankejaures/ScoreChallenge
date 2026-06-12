// Réponses brutes API-Football v3 (champs utilisés uniquement)
export interface ApiFootballEnvelope<T> {
  response: T[];
}

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

// DTO domaine exposés par notre API
export interface CompetitionDto {
  leagueId: number;
  name: string;
  type: string;
  logo: string;
  country: string;
  season: number;
}
