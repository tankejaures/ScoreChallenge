export interface OwnerJwtPayload {
  sub: string; // userId
  role: 'owner';
}

export interface ParticipantJwtPayload {
  sub: string; // participantId
  groupId: string;
  role: 'participant';
}

export type JwtPayload = OwnerJwtPayload | ParticipantJwtPayload;
