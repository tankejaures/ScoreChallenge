import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiSportsEnvelope } from './sports-api.types';

@Injectable()
export class SportsHttpClient {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SPORTS_API_KEY'));
  }

  async request<T>(baseUrl: string, path: string): Promise<T[]> {
    const apiKey = this.config.get<string>('SPORTS_API_KEY');
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-apisports-key': apiKey ?? '' },
    });
    if (!response.ok) {
      throw new Error(`api-sports error ${response.status}`);
    }
    const body = (await response.json()) as ApiSportsEnvelope<T>;
    return body.response;
  }
}
