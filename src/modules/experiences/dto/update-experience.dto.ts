import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateExperienceDto } from './create-experience.dto';

export class UpdateExperienceDto extends PartialType(
  OmitType(CreateExperienceDto, ['operator_place_id'] as const),
) {}
