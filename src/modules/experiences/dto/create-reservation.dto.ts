import { IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ description: 'Slot id chosen by the user' })
  @IsUUID()
  slot_id: string;

  @ApiProperty({ example: 2, description: 'Number of participants' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  participants: number;
}
