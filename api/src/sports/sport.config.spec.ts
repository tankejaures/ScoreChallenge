import { Sport } from '@prisma/client';
import { SPORT_CONFIG } from './sport.config';

describe('SPORT_CONFIG', () => {
  it('covers every Sport enum value', () => {
    for (const sport of Object.values(Sport)) {
      expect(SPORT_CONFIG[sport]).toBeDefined();
      expect(SPORT_CONFIG[sport].baseUrl).toMatch(/^https:\/\//);
      expect(SPORT_CONFIG[sport].watchAfterKickoffMs).toBeGreaterThan(0);
    }
  });

  it('uses the v3 API only for football', () => {
    expect(SPORT_CONFIG.FOOTBALL.api).toBe('v3-football');
    expect(SPORT_CONFIG.BASKETBALL.api).toBe('v1');
  });
});
