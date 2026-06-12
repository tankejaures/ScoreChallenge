import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
}
