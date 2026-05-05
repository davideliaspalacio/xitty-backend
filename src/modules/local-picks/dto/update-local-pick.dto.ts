import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateLocalPickDto } from './create-local-pick.dto';

export class UpdateLocalPickDto extends PartialType(
  OmitType(CreateLocalPickDto, ['place_id'] as const),
) {}
