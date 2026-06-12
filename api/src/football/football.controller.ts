import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OwnerRoleGuard } from '../auth/owner-role.guard';
import { FootballService } from './football.service';

@UseGuards(OwnerRoleGuard)
@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('competitions')
  competitions() {
    return this.footballService.getCompetitions();
  }

  @Get('competitions/:leagueId/fixtures')
  fixtures(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('season', ParseIntPipe) season: number,
  ) {
    return this.footballService.listFixtures(leagueId, season);
  }
}
