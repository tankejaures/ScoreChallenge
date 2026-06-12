import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompetitionRefDto {
  @IsInt()
  leagueId: number;

  @IsInt()
  season: number;

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
