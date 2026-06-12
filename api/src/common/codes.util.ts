import { randomInt } from 'crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomFromAlphabet(length: number): string {
  return Array.from(
    { length },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('');
}

export function generateParticipantCode(): string {
  return randomFromAlphabet(6);
}

export function generateInviteToken(): string {
  return randomFromAlphabet(12).toLowerCase();
}
