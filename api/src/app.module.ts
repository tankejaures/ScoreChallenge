import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { MailModule } from './mail/mail.module';
import { MatchesModule } from './matches/matches.module';
import { PredictionsModule } from './predictions/predictions.module';
import { PrismaModule } from './prisma/prisma.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 10, ttl: 60000 }],
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    GroupsModule,
    MatchesModule,
    PredictionsModule,
    StatsModule,
  ],
})
export class AppModule {}
