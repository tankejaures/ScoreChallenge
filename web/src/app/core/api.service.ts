import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthResult,
  Competition,
  FixtureView,
  Group,
  GroupStats,
  GroupSummary,
  InviteInfo,
  JoinResult,
  MatchView,
  Participant,
  Prediction,
  RankingEntry,
  Sport,
} from './models';

const BASE = '/api';

export interface CreateGroupPayload {
  name: string;
  description?: string;
  scoringExactScore?: number;
  scoringCorrectOutcome?: number;
  scoringOneTeamScore?: number;
  competition?: { sport: Sport; leagueId: number; season: string; name: string };
}

export interface CreateMatchPayload {
  teamA: string;
  teamB: string;
  kickoffAt: string;
  predictionDeadline: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Auth
  register(email: string, password: string, name: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${BASE}/auth/register`, { email, password, name });
  }
  login(email: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${BASE}/auth/login`, { email, password });
  }
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${BASE}/auth/forgot-password`, { email });
  }
  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${BASE}/auth/reset-password`, { token, password });
  }

  // Groups
  createGroup(payload: CreateGroupPayload): Observable<Group> {
    return this.http.post<Group>(`${BASE}/groups`, payload);
  }
  myGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${BASE}/groups`);
  }
  groupDetail(groupId: string): Observable<Group> {
    return this.http.get<Group>(`${BASE}/groups/${groupId}`);
  }
  updateGroup(groupId: string, payload: Partial<CreateGroupPayload>): Observable<Group> {
    return this.http.patch<Group>(`${BASE}/groups/${groupId}`, payload);
  }
  groupSummary(groupId: string): Observable<GroupSummary> {
    return this.http.get<GroupSummary>(`${BASE}/groups/${groupId}/summary`);
  }
  inviteInfo(token: string): Observable<InviteInfo> {
    return this.http.get<InviteInfo>(`${BASE}/groups/invite/${token}`);
  }
  joinGroup(inviteToken: string, code: string): Observable<JoinResult> {
    return this.http.post<JoinResult>(`${BASE}/groups/join`, { inviteToken, code });
  }

  // Participants
  addParticipant(groupId: string, name: string): Observable<Participant> {
    return this.http.post<Participant>(`${BASE}/groups/${groupId}/participants`, { name });
  }
  removeParticipant(groupId: string, participantId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/groups/${groupId}/participants/${participantId}`);
  }

  // Matches
  createMatch(groupId: string, payload: CreateMatchPayload): Observable<MatchView> {
    return this.http.post<MatchView>(`${BASE}/groups/${groupId}/matches`, payload);
  }
  updateMatch(
    groupId: string,
    matchId: string,
    payload: Partial<CreateMatchPayload>,
  ): Observable<MatchView> {
    return this.http.patch<MatchView>(`${BASE}/groups/${groupId}/matches/${matchId}`, payload);
  }
  setResult(
    groupId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): Observable<MatchView> {
    return this.http.post<MatchView>(`${BASE}/groups/${groupId}/matches/${matchId}/result`, {
      scoreA,
      scoreB,
    });
  }
  listMatches(groupId: string): Observable<MatchView[]> {
    return this.http.get<MatchView[]>(`${BASE}/groups/${groupId}/matches`);
  }

  // Sports
  sportCompetitions(sport: Sport): Observable<Competition[]> {
    return this.http.get<Competition[]>(`${BASE}/sports/${sport}/competitions`);
  }
  competitionFixtures(sport: Sport, leagueId: number, season: string): Observable<FixtureView[]> {
    return this.http.get<FixtureView[]>(
      `${BASE}/sports/${sport}/competitions/${leagueId}/fixtures?season=${encodeURIComponent(season)}`,
    );
  }
  importMatches(groupId: string, fixtureIds: string[]): Observable<MatchView[]> {
    return this.http.post<MatchView[]>(`${BASE}/groups/${groupId}/matches/import`, {
      fixtureIds,
    });
  }

  // Predictions
  submitPrediction(matchId: string, scoreA: number, scoreB: number): Observable<Prediction> {
    return this.http.put<Prediction>(`${BASE}/matches/${matchId}/prediction`, { scoreA, scoreB });
  }

  // Stats
  ranking(groupId: string): Observable<RankingEntry[]> {
    return this.http.get<RankingEntry[]>(`${BASE}/groups/${groupId}/ranking`);
  }
  groupStats(groupId: string): Observable<GroupStats> {
    return this.http.get<GroupStats>(`${BASE}/groups/${groupId}/stats`);
  }
  participantStats(groupId: string, participantId: string): Observable<RankingEntry> {
    return this.http.get<RankingEntry>(
      `${BASE}/groups/${groupId}/participants/${participantId}/stats`,
    );
  }
}
