import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LoadingService } from './loading.service';
import { loadingInterceptor } from './loading.interceptor';

describe('LoadingService', () => {
  it('tracks nested operations with a counter', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(LoadingService);
    expect(service.isLoading()).toBe(false);
    service.start();
    service.start();
    expect(service.isLoading()).toBe(true);
    service.stop();
    expect(service.isLoading()).toBe(true);
    service.stop();
    expect(service.isLoading()).toBe(false);
  });

  it('never goes below zero', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(LoadingService);
    service.stop();
    expect(service.isLoading()).toBe(false);
    service.start();
    expect(service.isLoading()).toBe(true);
  });
});

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    service = TestBed.inject(LoadingService);
  });

  afterEach(() => controller.verify());

  it('is loading while a request is in flight, idle afterwards', () => {
    http.get('/api/ping').subscribe();
    expect(service.isLoading()).toBe(true);
    controller.expectOne('/api/ping').flush({});
    expect(service.isLoading()).toBe(false);
  });

  it('stops loading even when the request fails', () => {
    http.get('/api/boom').subscribe({ error: () => undefined });
    expect(service.isLoading()).toBe(true);
    controller.expectOne('/api/boom').flush('ko', { status: 500, statusText: 'Server Error' });
    expect(service.isLoading()).toBe(false);
  });
});
