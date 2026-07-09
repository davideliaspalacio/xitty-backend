import {
  Controller,
  Get,
  Patch,
  Body,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationSettingsDto } from './dto/notification-settings.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

type NotificationSettingsRole = 'business' | 'admin';

interface AuthenticatedNotificationSettingsRequest {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('notification-settings')
@ApiBearerAuth()
@Controller('me/notification-settings')
@UseGuards(AuthGuard)
export class NotificationSettingsController {
  constructor(private readonly service: NotificationSettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get notification settings (defaults if not set) — US-025',
  })
  @ApiResponse({ status: 200, type: NotificationSettingsDto })
  @ApiResponse({ status: 403, description: 'Only business owners or admins' })
  async getMe(
    @Request() req: AuthenticatedNotificationSettingsRequest,
  ): Promise<NotificationSettingsDto> {
    this.assertBusinessOrAdmin(req.user.role);
    return this.service.getOrDefaults(req.user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update notification settings (upserts) — US-025' })
  @ApiBody({ type: UpdateNotificationSettingsDto })
  @ApiResponse({ status: 200, type: NotificationSettingsDto })
  @ApiResponse({ status: 403, description: 'Only business owners or admins' })
  async updateMe(
    @Request() req: AuthenticatedNotificationSettingsRequest,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    this.assertBusinessOrAdmin(req.user.role);
    return this.service.upsert(req.user.id, dto);
  }

  private assertBusinessOrAdmin(
    role: string,
  ): asserts role is NotificationSettingsRole {
    if (role !== 'business' && role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners or admins can manage notification settings',
      );
    }
  }
}
