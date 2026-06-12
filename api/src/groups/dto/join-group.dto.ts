import { IsString, Length } from 'class-validator';

export class JoinGroupDto {
  @IsString()
  @Length(12, 12)
  inviteToken: string;

  @IsString()
  @Length(6, 6)
  code: string;
}
