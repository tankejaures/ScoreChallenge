import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupOwnerGuard } from './guards/group-owner.guard';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Public()
  @Get('invite/:token')
  getInviteInfo(@Param('token') token: string) {
    return this.groupsService.getPublicInfoByInviteToken(token);
  }

  @Public()
  @Post('join')
  join(@Body() dto: JoinGroupDto) {
    return this.groupsService.join(dto);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateGroupDto) {
    if (req.user?.role !== 'owner') {
      throw new ForbiddenException('Action réservée au créateur du groupe');
    }
    return this.groupsService.create(req.user.sub, dto);
  }

  @Get()
  findMine(@Req() req: RequestWithUser) {
    return this.groupsService.findMine((req.user as { sub: string }).sub);
  }

  @UseGuards(GroupOwnerGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  @UseGuards(GroupOwnerGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }
}
