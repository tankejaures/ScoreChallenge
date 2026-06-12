import { IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  token: string;

  @MinLength(8)
  @MaxLength(72)
  password: string;
}
