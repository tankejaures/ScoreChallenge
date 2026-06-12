import { mapFixtureStatus } from './fixture-status.util';

describe('mapFixtureStatus', () => {
  it.each(['TBD', 'NS'])('maps %s to SCHEDULED', (short) => {
    expect(mapFixtureStatus(short)).toBe('SCHEDULED');
  });

  it.each(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])(
    'maps %s to LIVE',
    (short) => {
      expect(mapFixtureStatus(short)).toBe('LIVE');
    },
  );

  it.each(['FT', 'AET', 'PEN'])('maps %s to FINISHED', (short) => {
    expect(mapFixtureStatus(short)).toBe('FINISHED');
  });

  it('maps PST to POSTPONED', () => {
    expect(mapFixtureStatus('PST')).toBe('POSTPONED');
  });

  it.each(['CANC', 'ABD', 'AWD', 'WO'])('maps %s to CANCELLED', (short) => {
    expect(mapFixtureStatus(short)).toBe('CANCELLED');
  });

  it('falls back to SCHEDULED for unknown codes', () => {
    expect(mapFixtureStatus('???')).toBe('SCHEDULED');
  });
});
