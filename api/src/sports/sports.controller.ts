import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Sport } from '@prisma/client';
import { OwnerRoleGuard } from '../auth/owner-role.guard';
import { SportsService } from './sports.service';

@UseGuards(OwnerRoleGuard)
@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get(':sport/competitions')
  competitions(@Param('sport', new ParseEnumPipe(Sport)) sport: Sport) {
    return this.sportsService.getCompetitions(sport);
  }

  @Get(':sport/competitions/:leagueId/fixtures')
  fixtures(
    @Param('sport', new ParseEnumPipe(Sport)) sport: Sport,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('season') season: string,
  ) {
    return this.sportsService.listFixtures(sport, leagueId, season ?? '');
  }
}
