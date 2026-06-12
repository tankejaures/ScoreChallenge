import { FixtureStatus } from '@prisma/client';

const STATUS_MAP: Record<string, FixtureStatus> = {
  TBD: 'SCHEDULED',
  NS: 'SCHEDULED',
  '1H': 'LIVE',
  HT: 'LIVE',
  '2H': 'LIVE',
  ET: 'LIVE',
  BT: 'LIVE',
  P: 'LIVE',
  SUSP: 'LIVE',
  INT: 'LIVE',
  LIVE: 'LIVE',
  FT: 'FINISHED',
  AET: 'FINISHED',
  PEN: 'FINISHED',
  PST: 'POSTPONED',
  CANC: 'CANCELLED',
  ABD: 'CANCELLED',
  AWD: 'CANCELLED',
  WO: 'CANCELLED',
};

export function mapFixtureStatus(short: string): FixtureStatus {
  return STATUS_MAP[short] ?? 'SCHEDULED';
}

const V1_SCHEDULED = new Set(['NS', 'TBD']);
const V1_FINISHED = new Set(['FT', 'AET', 'AOT', 'AWD']);
const V1_POSTPONED = new Set(['PST', 'POST']);
const V1_CANCELLED = new Set(['CANC', 'ABD', 'WO']);

// Les codes de période varient par sport (Q1, P2, S3, IN5…) :
// tout code ni programmé, ni terminé, ni annulé = match en cours.
export function mapV1Status(short: string): FixtureStatus {
  if (V1_SCHEDULED.has(short)) {
    return 'SCHEDULED';
  }
  if (V1_FINISHED.has(short)) {
    return 'FINISHED';
  }
  if (V1_POSTPONED.has(short)) {
    return 'POSTPONED';
  }
  if (V1_CANCELLED.has(short)) {
    return 'CANCELLED';
  }
  return 'LIVE';
}
