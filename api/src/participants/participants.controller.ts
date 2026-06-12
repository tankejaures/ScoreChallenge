import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GroupOwnerGuard } from '../groups/guards/group-owner.guard';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { ParticipantsService } from './participants.service';

@UseGuards(GroupOwnerGuard)
@Controller('groups/:groupId/participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  add(@Param('groupId') groupId: string, @Body() dto: CreateParticipantDto) {
    return this.participantsService.addToGroup(groupId, dto);
  }

  @Delete(':pid')
  @HttpCode(204)
  remove(
    @Param('groupId') groupId: string,
    @Param('pid') pid: string,
  ): Promise<void> {
    return this.participantsService.remove(groupId, pid);
  }
}
