import { ApiProperty } from '@nestjs/swagger';
import { ConsentType } from './grant-consent.dto';

export class ConsentResponseDto {
  @ApiProperty({ description: 'User ID (FK a profiles.id)' })
  user_id: string;

  @ApiProperty({ enum: ConsentType, description: 'Tipo de consentimiento' })
  consent_type: ConsentType;

  @ApiProperty({
    description: 'true si el consentimiento está activo, false si fue revocado',
  })
  granted: boolean;

  @ApiProperty({ description: 'Fecha en que se otorgó el consentimiento' })
  granted_at: string;

  @ApiProperty({
    description: 'Fecha en que se revocó el consentimiento (null si activo)',
    required: false,
    nullable: true,
  })
  revoked_at: string | null;
}
