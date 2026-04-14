import { ApiProperty } from '@nestjs/swagger';
import {
  TravelerType,
  AvailableTime,
  EnergyLevel,
} from './create-preferences.dto';

export class PreferencesResponseDto {
  @ApiProperty({ description: 'User ID (FK a profiles.id)' })
  user_id: string;

  @ApiProperty({ enum: TravelerType, required: false, nullable: true })
  traveler_type: TravelerType | null;

  @ApiProperty({ required: false, nullable: true })
  budget_min: number | null;

  @ApiProperty({ required: false, nullable: true })
  budget_max: number | null;

  @ApiProperty({ enum: AvailableTime, required: false, nullable: true })
  available_time: AvailableTime | null;

  @ApiProperty({ enum: EnergyLevel, required: false, nullable: true })
  energy_level: EnergyLevel | null;

  @ApiProperty({ default: 0 })
  companions: number;

  @ApiProperty({
    description: 'true si el usuario completó el wizard, false si lo saltó',
  })
  wizard_completed: boolean;

  @ApiProperty({ required: false })
  created_at?: string;

  @ApiProperty({ required: false })
  updated_at?: string;
}
