import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

import { ConsentsService } from './consents.service';
import { GrantConsentDto, ConsentType } from './dto/grant-consent.dto';
import { ConsentResponseDto } from './dto/consent-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('consents')
@ApiBearerAuth()
@Controller('consents')
@UseGuards(AuthGuard)
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Get('me')
  @ApiOperation({
    summary:
      'Lista los consentimientos del usuario actual (Ley 1581 Colombia)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de consents (granted y revoked)',
    type: [ConsentResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Request() req: any): Promise<ConsentResponseDto[]> {
    return this.consentsService.getByUser(req.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Otorga un consentimiento (granted=true, revoked_at=null)',
  })
  @ApiBody({ type: GrantConsentDto })
  @ApiResponse({
    status: 201,
    description: 'Consentimiento otorgado',
    type: ConsentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'consent_type inválido' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async grant(
    @Request() req: any,
    @Body() dto: GrantConsentDto,
  ): Promise<ConsentResponseDto> {
    return this.consentsService.grant(req.user.id, dto);
  }

  @Delete(':type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Revoca un consentimiento (setea revoked_at y granted=false). Ley 1581.',
  })
  @ApiParam({
    name: 'type',
    enum: ConsentType,
    description: 'Tipo de consent a revocar',
  })
  @ApiResponse({
    status: 200,
    description: 'Consentimiento revocado',
    type: ConsentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'consent_type inválido' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revoke(
    @Request() req: any,
    @Param('type') type: ConsentType,
  ): Promise<ConsentResponseDto> {
    return this.consentsService.revoke(req.user.id, type);
  }
}
