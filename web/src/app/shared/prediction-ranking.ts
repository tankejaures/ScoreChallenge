import { Prediction } from '../core/models';

// Classement d'un match : points décroissants, pronostics non calculés (points null)
// en dernier, égalités départagées par le nom du participant.
export function sortPredictionsForRanking(predictions: Prediction[]): Prediction[] {
  return [...predictions].sort((a, b) => {
    const pointsA = a.points ?? -1;
    const pointsB = b.points ?? -1;
    if (pointsA !== pointsB) {
      return pointsB - pointsA;
    }
    return (a.participant?.name ?? '').localeCompare(b.participant?.name ?? '', 'fr');
  });
}
