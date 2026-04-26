import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateFeaturedDto } from './create-featured.dto';

export class UpdateFeaturedDto extends PartialType(
  OmitType(CreateFeaturedDto, ['place_id'] as const),
) {}
