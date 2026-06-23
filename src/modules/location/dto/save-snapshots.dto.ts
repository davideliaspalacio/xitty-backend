import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum LocationSource {
  BROWSER_GPS = 'browser_gps',
  IP_GEO = 'ip_geo',
  MANUAL = 'manual',
}

export class SnapshotItemDto {
  @ApiProperty({ description: 'Latitud en grados', example: 10.9878 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ description: 'Longitud en grados', example: -74.7889 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({
    description: 'Precision en metros (opcional)',
    required: false,
    example: 15,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiProperty({
    description: 'Origen de la coordenada',
    enum: LocationSource,
    required: false,
    default: LocationSource.BROWSER_GPS,
  })
  @IsOptional()
  @IsEnum(LocationSource)
  source?: LocationSource;
}

export class SaveSnapshotsDto {
  @ApiProperty({
    description: 'Lote de snapshots (max 10)',
    type: [SnapshotItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SnapshotItemDto)
  snapshots: SnapshotItemDto[];
}
