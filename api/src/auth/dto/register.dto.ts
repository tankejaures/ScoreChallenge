import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
