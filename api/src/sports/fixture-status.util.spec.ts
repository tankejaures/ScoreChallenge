import { mapFixtureStatus, mapV1Status } from './fixture-status.util';

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

describe('mapV1Status', () => {
  it.each(['NS', 'TBD'])('maps %s to SCHEDULED', (short) => {
    expect(mapV1Status(short)).toBe('SCHEDULED');
  });

  it.each(['FT', 'AET', 'AOT', 'AWD'])('maps %s to FINISHED', (short) => {
    expect(mapV1Status(short)).toBe('FINISHED');
  });

  it.each(['PST', 'POST'])('maps %s to POSTPONED', (short) => {
    expect(mapV1Status(short)).toBe('POSTPONED');
  });

  it.each(['CANC', 'ABD', 'WO'])('maps %s to CANCELLED', (short) => {
    expect(mapV1Status(short)).toBe('CANCELLED');
  });

  it.each(['Q1', 'P2', 'S3', 'IN5', 'HT', 'OT', 'LIVE'])(
    'maps unknown period code %s to LIVE',
    (short) => {
      expect(mapV1Status(short)).toBe('LIVE');
    },
  );
});
