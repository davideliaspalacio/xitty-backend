import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ConsentType {
  LOCATION_TRACKING = 'location_tracking',
  CHAT_ANALYTICS = 'chat_analytics',
  MARKETING = 'marketing',
}

export class GrantConsentDto {
  @ApiProperty({
    description: 'Tipo de consentimiento a otorgar',
    enum: ConsentType,
    example: ConsentType.LOCATION_TRACKING,
  })
  @IsEnum(ConsentType)
  consent_type: ConsentType;
}
