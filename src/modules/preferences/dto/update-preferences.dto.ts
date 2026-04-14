import { PartialType } from '@nestjs/swagger';
import { CreatePreferencesDto } from './create-preferences.dto';

export class UpdatePreferencesDto extends PartialType(CreatePreferencesDto) {}
