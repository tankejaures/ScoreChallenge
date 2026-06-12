import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts credentials to /api/auth/login', () => {
    let result: unknown;
    service.login('a@b.c', 'secret123').subscribe((r) => (result = r));
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 't', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
    expect(result).toEqual(expect.objectContaining({ token: 't' }));
  });

  it('puts a prediction to /api/matches/:id/prediction', () => {
    service.submitPrediction('m1', 2, 1).subscribe();
    const req = http.expectOne('/api/matches/m1/prediction');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ scoreA: 2, scoreB: 1 });
    req.flush({});
  });
});
