import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { GlbReoptimizeService } from './glb-reoptimize.service';

@ApiTags('kmz')
@Controller('kmz')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class GlbAdminController {
  constructor(private readonly glbReoptimize: GlbReoptimizeService) {}

  @Post('reoptimize-all')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Enqueue server-side optimization for every school GLB not yet optimized (background)',
  })
  reoptimizeAll(@Body() body: { force?: boolean } = {}) {
    return this.glbReoptimize.enqueueUnoptimized({
      force: body?.force === true,
    });
  }
}
