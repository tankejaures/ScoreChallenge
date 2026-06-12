import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GroupOwnerGuard } from '../groups/guards/group-owner.guard';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesService } from './matches.service';

@Controller('groups/:groupId/matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @UseGuards(GroupOwnerGuard)
  @Post()
  create(@Param('groupId') groupId: string, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(groupId, dto);
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
}
