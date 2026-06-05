import {
  Controller,
  Get,
  Query,
  UseGuards,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** Allows only users whose role name is 'super_admin'. */
@Injectable()
class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) return false;
    const name: string = (user.role.name ?? '').toLowerCase().replace(/\s+/g, '_');
    return name === 'super_admin';
  }
}

@ApiTags('audit-logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs (super_admin only)' })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @Query('limit')  limit  = 200,
    @Query('offset') offset = 0,
  ) {
    const [data, total] = await this.auditService.findAll(
      Number(limit),
      Number(offset),
    );
    return { data, total };
  }
}
