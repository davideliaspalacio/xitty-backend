import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAudioTourProgressDto {
  @ApiProperty({
    description: 'Current stop being played',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  current_stop_id?: string | null;

  @ApiProperty({
    description: 'Completed stop ids',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  completed_stop_ids?: string[];

  @ApiProperty({
    description: 'Last position in seconds within the current stop',
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  last_position_seconds?: number;

  @ApiProperty({
    description: 'Marks the audio tour as completed',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
