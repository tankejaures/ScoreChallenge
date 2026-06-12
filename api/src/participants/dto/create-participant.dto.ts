import { IsNotEmpty, MaxLength } from 'class-validator';

export class CreateParticipantDto {
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
