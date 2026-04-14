import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'OTP de 6 dígitos recibido por email',
    example: '123456',
  })
  @IsString()
  @Length(6, 10)
  token: string;

  @ApiProperty({
    description: 'Nueva contraseña (mínimo 8 caracteres)',
    example: 'NuevaPass456!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  new_password: string;
}
