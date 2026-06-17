import { ApiProperty } from '@nestjs/swagger';
import { LocationSource } from './save-snapshots.dto';

export class LocationSnapshotDto {
  @ApiProperty({ description: 'ID del snapshot' })
  id: string;

  @ApiProperty({ description: 'User ID (FK profiles.id)' })
  user_id: string;

  @ApiProperty({ description: 'Latitud en grados' })
  latitude: number;

  @ApiProperty({ description: 'Longitud en grados' })
  longitude: number;

  @ApiProperty({
    description: 'Precision en metros',
    required: false,
    nullable: true,
  })
  accuracy_m: number | null;

  @ApiProperty({ enum: LocationSource })
  source: LocationSource;

  @ApiProperty({ description: 'Timestamp de creacion' })
  created_at: string;
}
