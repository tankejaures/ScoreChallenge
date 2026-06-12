import { Module } from '@nestjs/common';
import { GroupOwnerGuard } from '../groups/guards/group-owner.guard';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

@Module({
  controllers: [ParticipantsController],
  providers: [ParticipantsService, GroupOwnerGuard],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
