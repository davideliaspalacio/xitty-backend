import { ApiProperty } from '@nestjs/swagger';

export class ReviewUserDto {
  @ApiProperty() full_name: string | null;
}

export class ReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() place_id: string;
  @ApiProperty() user_id: string;
  @ApiProperty({ type: ReviewUserDto, nullable: true })
  profiles: ReviewUserDto | null;
  @ApiProperty() rating: number;
  @ApiProperty({ nullable: true }) comment: string | null;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class ReviewListResponseDto {
  @ApiProperty({ type: [ReviewResponseDto] }) data: ReviewResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
