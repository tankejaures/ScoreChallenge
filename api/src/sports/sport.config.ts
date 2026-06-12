import { Sport } from '@prisma/client';

export type SportApiKind = 'v3-football' | 'v1';

export interface SportConfig {
  baseUrl: string;
  api: SportApiKind;
  watchAfterKickoffMs: number;
  label: string;
}

const HOUR_MS = 60 * 60 * 1000;

export const SPORT_CONFIG: Record<Sport, SportConfig> = {
  FOOTBALL: {
    baseUrl: 'https://v3.football.api-sports.io',
    api: 'v3-football',
    watchAfterKickoffMs: 3 * HOUR_MS,
    label: 'Football',
  },
  AFL: {
    baseUrl: 'https://v1.afl.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 3.5 * HOUR_MS,
    label: 'Football australien',
  },
  BASEBALL: {
    baseUrl: 'https://v1.baseball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 4 * HOUR_MS,
    label: 'Baseball',
  },
  BASKETBALL: {
    baseUrl: 'https://v1.basketball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2.5 * HOUR_MS,
    label: 'Basketball',
  },
  HANDBALL: {
    baseUrl: 'https://v1.handball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2 * HOUR_MS,
    label: 'Handball',
  },
  HOCKEY: {
    baseUrl: 'https://v1.hockey.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 3 * HOUR_MS,
    label: 'Hockey',
  },
  NFL: {
    baseUrl: 'https://v1.american-football.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 4 * HOUR_MS,
    label: 'Football américain',
  },
  RUGBY: {
    baseUrl: 'https://v1.rugby.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2.5 * HOUR_MS,
    label: 'Rugby',
  },
  VOLLEYBALL: {
    baseUrl: 'https://v1.volleyball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2.5 * HOUR_MS,
    label: 'Volleyball',
  },
};
