import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe, Request,
  UploadedFile, UseInterceptors, Res, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import * as XLSX from 'xlsx';


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
  create(@Body() body: { firstName: string; lastName: string; email: string; password: string; roleId?: string; location?: any }) {
    return this.usersService.create(body);
  }

  @Get('upload/template')
  @ApiOperation({ summary: 'Download xlsx user upload template' })
  @RequirePermissions(Permission.MANAGE_USERS)
  downloadTemplate(@Res() res: Response) {
    const headers = ['firstName', 'lastName', 'email', 'password', 'roleName', 'province', 'district', 'sector', 'schoolId'];
    const example = ['John', 'Doe', 'john.doe@rtb.gov.rw', 'SecurePass123!', 'viewer', 'Kigali City', 'Gasabo', '', ''];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="users_upload_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Bulk upload users from xlsx file' })
  @RequirePermissions(Permission.MANAGE_USERS)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  async uploadUsers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return this.usersService.bulkCreate(rows);
  }

  @Post('bulk-json')
  @ApiOperation({ summary: 'Bulk create users from parsed JSON rows' })
  @RequirePermissions(Permission.MANAGE_USERS)
  @HttpCode(200)
  async createBulkJson(@Body() body: { rows: any[] }) {
    if (!body || !Array.isArray(body.rows)) {
      throw new Error('Invalid payload: expected an array of rows');
    }
    return this.usersService.bulkCreate(body.rows);
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
