import { ArrayMaxSize, ArrayNotEmpty, IsString } from 'class-validator';

export class ImportFixturesDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  fixtureIds: string[];
}
