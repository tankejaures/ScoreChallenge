import { Sport } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompetitionRefDto {
  @IsEnum(Sport)
  sport: Sport;

  @IsInt()
  leagueId: number;

  @IsNotEmpty()
  @MaxLength(12)
  season: string;

  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}

export class CreateGroupDto {
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoringExactScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoringCorrectOutcome?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoringOneTeamScore?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompetitionRefDto)
  competition?: CompetitionRefDto;
}
