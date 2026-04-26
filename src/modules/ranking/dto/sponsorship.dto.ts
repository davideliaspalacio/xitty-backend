import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSponsorshipDto {
  @ApiProperty({
    description: 'How many days the sponsorship stays active starting now',
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  duration_days: number;
}

export class SponsorshipResponseDto {
  @ApiProperty() place_id: string;
  @ApiProperty() is_sponsored: boolean;
  @ApiProperty({ nullable: true }) sponsored_at: string | null;
  @ApiProperty({ nullable: true }) sponsored_until: string | null;
}
