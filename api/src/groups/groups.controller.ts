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
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { OwnerRoleGuard } from '../auth/owner-role.guard';
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
  @UseGuards(ThrottlerGuard)
  @Get('invite/:token')
  getInviteInfo(@Param('token') token: string) {
    return this.groupsService.getPublicInfoByInviteToken(token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('join')
  join(@Body() dto: JoinGroupDto) {
    return this.groupsService.join(dto);
  }

  @UseGuards(OwnerRoleGuard)
  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create((req.user as { sub: string }).sub, dto);
  }

  @UseGuards(OwnerRoleGuard)
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
