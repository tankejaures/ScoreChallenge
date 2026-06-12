import { Sport } from '../core/models';

export const SPORT_META: Record<Sport, { icon: string; label: string }> = {
  FOOTBALL: { icon: '⚽', label: 'Football' },
  AFL: { icon: '🦘', label: 'Football australien' },
  BASEBALL: { icon: '⚾', label: 'Baseball' },
  BASKETBALL: { icon: '🏀', label: 'Basketball' },
  HANDBALL: { icon: '🤾', label: 'Handball' },
  HOCKEY: { icon: '🏒', label: 'Hockey' },
  NFL: { icon: '🏈', label: 'Football américain' },
  RUGBY: { icon: '🏉', label: 'Rugby' },
  VOLLEYBALL: { icon: '🏐', label: 'Volleyball' },
};

export const SPORTS: Sport[] = Object.keys(SPORT_META) as Sport[];
