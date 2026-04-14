import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email del usuario que se está verificando',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'OTP de 6 dígitos recibido en el email de confirmación',
    example: '123456',
  })
  @IsString()
  @Length(6, 10)
  token: string;
}
