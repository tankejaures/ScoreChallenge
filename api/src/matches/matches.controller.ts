import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { GroupOwnerGuard } from '../groups/guards/group-owner.guard';
import { CreateMatchDto } from './dto/create-match.dto';
import { ImportFixturesDto } from './dto/import-fixtures.dto';
import { SetResultDto } from './dto/set-result.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesService } from './matches.service';

@Controller('groups/:groupId/matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @UseGuards(GroupMemberGuard)
  @Get()
  list(@Param('groupId') groupId: string, @Req() req: RequestWithUser) {
    return this.matchesService.listForGroup(groupId, req.user!);
  }

  @UseGuards(GroupOwnerGuard)
  @Post()
  create(@Param('groupId') groupId: string, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(groupId, dto);
  }

  @UseGuards(GroupOwnerGuard)
  @Post('import')
  importFixtures(
    @Param('groupId') groupId: string,
    @Body() dto: ImportFixturesDto,
  ) {
    return this.matchesService.importFixtures(groupId, dto);
  }

  @UseGuards(GroupOwnerGuard)
  @Patch(':mid')
  update(
    @Param('groupId') groupId: string,
    @Param('mid') matchId: string,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.matchesService.update(groupId, matchId, dto);
  }

  @UseGuards(GroupOwnerGuard)
  @Post(':mid/result')
  setResult(
    @Param('groupId') groupId: string,
    @Param('mid') matchId: string,
    @Body() dto: SetResultDto,
  ) {
    return this.matchesService.setResult(groupId, matchId, dto);
  }
}
