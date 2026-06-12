import { HttpInterceptorFn } from '@angular/common/http';

// Stub (Task 2) — remplacé par l'intercepteur JWT réel en Task 3.
export const authInterceptor: HttpInterceptorFn = (req, next) => next(req);
