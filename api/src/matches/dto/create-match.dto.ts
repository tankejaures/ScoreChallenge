import { IsDateString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMatchDto {
  @IsNotEmpty()
  @MaxLength(50)
  teamA: string;

  @IsNotEmpty()
  @MaxLength(50)
  teamB: string;

  @IsDateString()
  kickoffAt: string;

  @IsDateString()
  predictionDeadline: string;
}
