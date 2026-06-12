import {
  CODE_ALPHABET,
  generateInviteToken,
  generateParticipantCode,
} from './codes.util';

describe('codes.util', () => {
  it('generates 6-char participant codes from unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateParticipantCode();
      expect(code).toHaveLength(6);
      for (const char of code) {
        expect(CODE_ALPHABET).toContain(char);
      }
    }
  });

  it('alphabet excludes ambiguous characters O, 0, I, 1', () => {
    expect(CODE_ALPHABET).not.toMatch(/[O0I1]/);
  });

  it('generates unique codes (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 200 }, generateParticipantCode));
    expect(codes.size).toBeGreaterThan(190);
  });

  it('generates 12-char lowercase invite tokens', () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(12);
    expect(token).toBe(token.toLowerCase());
  });
});
