import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { StatsService } from './stats.service';

@UseGuards(GroupMemberGuard)
@Controller('groups/:groupId')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('ranking')
  getRanking(@Param('groupId') groupId: string) {
    return this.statsService.getRanking(groupId);
  }

  @Get('stats')
  getGroupStats(@Param('groupId') groupId: string) {
    return this.statsService.getGroupStats(groupId);
  }

  @Get('participants/:pid/stats')
  getParticipantStats(
    @Param('groupId') groupId: string,
    @Param('pid') pid: string,
  ) {
    return this.statsService.getParticipantStats(groupId, pid);
  }
}
