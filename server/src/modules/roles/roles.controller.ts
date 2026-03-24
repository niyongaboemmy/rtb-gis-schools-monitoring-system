import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all roles' })
  @RequirePermissions(Permission.MANAGE_USERS)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single role' })
  @RequirePermissions(Permission.MANAGE_USERS)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new role' })
  @RequirePermissions(Permission.MANAGE_USERS)
  create(@Body() body: { name: string; description?: string; permissions: string[] }) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role capabilities' })
  @RequirePermissions(Permission.MANAGE_USERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a role' })
  @RequirePermissions(Permission.MANAGE_USERS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }
}
