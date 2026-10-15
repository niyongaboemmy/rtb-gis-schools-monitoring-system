import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Request,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import * as XLSX from 'xlsx';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { BulkUsersDto, MAX_BULK_USER_ROWS } from './dto/bulk-users.dto';
import { requestMeta } from '../auth/request-meta';
import {
  UPLOAD_EXTENSIONS,
  assertUploadedFile,
  extensionFileFilter,
} from '../../common/security/upload-validation';

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
  create(@Request() req: any, @Body() body: CreateUserDto) {
    return this.usersService.create(body, req.user, requestMeta(req));
  }

  @Get('upload/template')
  @ApiOperation({ summary: 'Download xlsx user upload template' })
  @RequirePermissions(Permission.MANAGE_USERS)
  downloadTemplate(@Res() res: Response) {
    const headers = [
      'firstName',
      'lastName',
      'email',
      'password',
      'roleName',
      'province',
      'district',
      'sector',
      'schoolId',
    ];
    const example = [
      'John',
      'Doe',
      'john.doe@rtb.gov.rw',
      'Secure-Pass2026!',
      'viewer',
      'Kigali City',
      'Gasabo',
      '',
      '',
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="users_upload_template.xlsx"',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buf);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Bulk upload users from xlsx file' })
  @RequirePermissions(Permission.MANAGE_USERS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: extensionFileFilter(UPLOAD_EXTENSIONS.spreadsheet),
    }),
  )
  @HttpCode(200)
  async uploadUsers(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    assertUploadedFile(file, UPLOAD_EXTENSIONS.spreadsheet);
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
      defval: '',
    });
    if (rows.length > MAX_BULK_USER_ROWS)
      throw new BadRequestException(
        `At most ${MAX_BULK_USER_ROWS} rows can be imported at once.`,
      );
    return this.usersService.bulkCreate(rows, req.user, requestMeta(req));
  }

  @Post('bulk-json')
  @ApiOperation({ summary: 'Bulk create users from parsed JSON rows' })
  @RequirePermissions(Permission.MANAGE_USERS)
  @HttpCode(200)
  async createBulkJson(@Body() body: BulkUsersDto, @Request() req: any) {
    return this.usersService.bulkCreate(body.rows, req.user, requestMeta(req));
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update your own profile' })
  updateProfile(@Request() req, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Patch('me/password')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Change your own password (signs out your other devices)',
  })
  changePassword(@Request() req, @Body() body: ChangePasswordDto) {
    return this.usersService.changePassword(
      req.user,
      body.currentPassword,
      body.newPassword,
      req.user.sessionId,
      requestMeta(req),
    );
  }

  @Post(':id/send-reset')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Email the user a code to set a new password' })
  @RequirePermissions(Permission.MANAGE_USERS)
  sendReset(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.usersService.sendReset(id, req.user, requestMeta(req));
  }

  @Post(':id/2fa/reset')
  @HttpCode(200)
  @ApiOperation({
    summary: "Reset a user's two-factor authentication (they re-enrol)",
  })
  @RequirePermissions(Permission.MANAGE_USERS)
  resetMfa(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.usersService.resetMfa(id, req.user, requestMeta(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (role, name, etc.)' })
  @RequirePermissions(Permission.MANAGE_USERS)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.update(id, body, req.user, requestMeta(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate user' })
  @RequirePermissions(Permission.MANAGE_USERS)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.usersService.deactivate(id, req.user, requestMeta(req));
  }
}
