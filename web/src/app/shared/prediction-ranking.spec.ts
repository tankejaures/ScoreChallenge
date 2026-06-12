import { Prediction } from '../core/models';
import { sortPredictionsForRanking } from './prediction-ranking';

const prediction = (name: string, points: number | null): Prediction => ({
  id: name,
  matchId: 'm1',
  participantId: name,
  scoreA: 1,
  scoreB: 0,
  editCount: 0,
  lockedAt: null,
  points,
  participant: { id: name, name },
});

describe('sortPredictionsForRanking', () => {
  it('orders by points descending', () => {
    const sorted = sortPredictionsForRanking([
      prediction('Léa', 1),
      prediction('Marc', 5),
      prediction('Ana', 3),
    ]);
    expect(sorted.map((p) => p.participant?.name)).toEqual(['Marc', 'Ana', 'Léa']);
  });

  it('puts pending predictions (points null) last, sorted by name', () => {
    const sorted = sortPredictionsForRanking([
      prediction('Zoé', null),
      prediction('Marc', 0),
      prediction('Ana', null),
    ]);
    expect(sorted.map((p) => p.participant?.name)).toEqual(['Marc', 'Ana', 'Zoé']);
  });

  it('breaks point ties by name', () => {
    const sorted = sortPredictionsForRanking([
      prediction('Zoé', 3),
      prediction('Ana', 3),
    ]);
    expect(sorted.map((p) => p.participant?.name)).toEqual(['Ana', 'Zoé']);
  });

  it('does not mutate the input array', () => {
    const input = [prediction('Zoé', 1), prediction('Ana', 5)];
    sortPredictionsForRanking(input);
    expect(input[0].participant?.name).toBe('Zoé');
  });
});
