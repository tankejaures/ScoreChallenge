import { IsInt, Max, Min } from 'class-validator';

export class UpsertPredictionDto {
  @IsInt()
  @Min(0)
  @Max(99)
  scoreA: number;

  @IsInt()
  @Min(0)
  @Max(99)
  scoreB: number;
}
