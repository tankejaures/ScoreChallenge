import { INestApplication, ValidationPipe } from '@nestjs/common';

export function setupApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: process.env.WEB_BASE_URL ?? 'http://localhost:4200',
  });
  return app;
}
