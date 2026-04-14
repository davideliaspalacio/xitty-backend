import { IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TravelerType {
  NOMADA = 'nomada',
  PAREJA = 'pareja',
  FAMILIA = 'familia',
  NEGOCIOS = 'negocios',
  EXCURSION = 'excursion',
}

export enum AvailableTime {
  SHORT = '1-3 dias',
  MEDIUM = '4-7 dias',
  LONG = '+1 semana',
}

export enum EnergyLevel {
  BAJA = 'baja',
  MEDIA = 'media',
  ALTA = 'alta',
}

export class CreatePreferencesDto {
  @ApiProperty({
    description: 'Tipo de viajero',
    enum: TravelerType,
    example: TravelerType.NOMADA,
  })
  @IsEnum(TravelerType)
  traveler_type: TravelerType;

  @ApiProperty({
    description: 'Presupuesto mínimo en COP',
    example: 50000,
  })
  @IsInt()
  @Min(0)
  budget_min: number;

  @ApiProperty({
    description: 'Presupuesto máximo en COP',
    example: 200000,
  })
  @IsInt()
  @Min(0)
  budget_max: number;

  @ApiProperty({
    description: 'Tiempo disponible para el viaje',
    enum: AvailableTime,
    example: AvailableTime.MEDIUM,
  })
  @IsEnum(AvailableTime)
  available_time: AvailableTime;

  @ApiProperty({
    description: 'Nivel de energía deseado',
    enum: EnergyLevel,
    example: EnergyLevel.ALTA,
  })
  @IsEnum(EnergyLevel)
  energy_level: EnergyLevel;

  @ApiProperty({
    description: 'Cantidad de acompañantes',
    example: 0,
  })
  @IsInt()
  @Min(0)
  companions: number;
}
