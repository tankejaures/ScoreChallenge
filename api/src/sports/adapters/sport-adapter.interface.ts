import { CompetitionDto, NormalizedGame } from '../sports-api.types';

export interface WatchedFixtureRef {
  externalId: number;
  leagueId: number;
  season: string;
  kickoffAt: Date;
}

export interface SportApiAdapter {
  getCompetitions(): Promise<CompetitionDto[]>;
  getGames(leagueId: number, season: string): Promise<NormalizedGame[]>;
  getLiveGames(refs: WatchedFixtureRef[]): Promise<NormalizedGame[]>;
}
