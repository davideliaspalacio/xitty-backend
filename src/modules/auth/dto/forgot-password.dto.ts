import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email del usuario que olvidó la contraseña',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
