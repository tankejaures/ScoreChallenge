import { ScoringService } from './scoring.service';

describe('ScoringService', () => {
  const service = new ScoringService();
  const config = { exactScore: 5, correctOutcome: 3, oneTeamScore: 1 };

  it.each([
    // [predA, predB, resA, resB, expected, label]
    [3, 2, 3, 2, 5, 'score exact'],
    [0, 0, 0, 0, 5, 'score exact 0-0'],
    [2, 1, 4, 0, 3, 'bon vainqueur (équipe A)'],
    [0, 2, 1, 3, 3, 'bon vainqueur (équipe B)'],
    [1, 1, 2, 2, 3, 'bon match nul'],
    [3, 1, 3, 0, 3, 'bon vainqueur prime sur bon score d’une équipe'],
    [0, 2, 3, 2, 1, 'bon score équipe B seulement'],
    [1, 0, 0, 2, 0, 'tout faux'],
  ])(
    'pred %i-%i vs result %i-%i → %i points (%s)',
    (pa, pb, ra, rb, expected) => {
      expect(
        service.computePoints({ a: pa, b: pb }, { a: ra, b: rb }, config),
      ).toBe(expected);
    },
  );

  it('uses configurable point values', () => {
    const custom = { exactScore: 10, correctOutcome: 5, oneTeamScore: 2 };
    expect(service.computePoints({ a: 1, b: 0 }, { a: 1, b: 0 }, custom)).toBe(
      10,
    );
    expect(service.computePoints({ a: 2, b: 0 }, { a: 1, b: 0 }, custom)).toBe(
      5,
    );
    expect(service.computePoints({ a: 1, b: 2 }, { a: 1, b: 0 }, custom)).toBe(
      2,
    );
  });
});
