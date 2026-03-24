import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';


@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @RequirePermissions(Permission.VIEW_USERS)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @RequirePermissions(Permission.VIEW_USERS)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @RequirePermissions(Permission.MANAGE_USERS)
  create(@Body() body: { firstName: string; lastName: string; email: string; password: string; roleId?: string }) {
    return this.usersService.create(body);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update your own profile' })
  updateProfile(@Request() req, @Body() body: any) {
    // Only allow updating safe fields
    const safeUpdate = {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      department: body.department,
    };
    return this.usersService.update(req.user.id, safeUpdate);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change your own password' })
  changePassword(@Request() req, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.usersService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (role, name, etc.)' })
  @RequirePermissions(Permission.MANAGE_USERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate user' })
  @RequirePermissions(Permission.MANAGE_USERS)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }
}
