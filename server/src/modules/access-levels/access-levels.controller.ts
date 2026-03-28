import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccessLevelsService } from './access-levels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('access-levels')
@Controller('access-levels')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AccessLevelsController {
  constructor(private readonly service: AccessLevelsService) {}

  @Get()
  @ApiOperation({ summary: 'List all access levels' })
  @RequirePermissions(Permission.MANAGE_USERS)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single access level' })
  @RequirePermissions(Permission.MANAGE_USERS)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create access level' })
  @RequirePermissions(Permission.MANAGE_USERS)
  create(@Body() body: { name: string }) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update access level' })
  @RequirePermissions(Permission.MANAGE_USERS)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name: string },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete access level' })
  @RequirePermissions(Permission.MANAGE_USERS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
