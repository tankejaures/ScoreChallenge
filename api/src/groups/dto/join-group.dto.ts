import { IsNotEmpty } from 'class-validator';

export class JoinGroupDto {
  @IsNotEmpty()
  inviteToken: string;

  @IsNotEmpty()
  code: string;
}
