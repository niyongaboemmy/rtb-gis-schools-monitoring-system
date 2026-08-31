import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  Res,
  Delete,
  Body,
  Patch,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { KmzService } from './kmz.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { ScopeGuard } from '../../common/scope/scope.guard';
import { ScopedResource } from '../../common/scope/scope.decorator';

@ApiTags('kmz')
@Controller('schools/:schoolId/kmz')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@ScopedResource('schoolId', 'params')
@ApiBearerAuth()
@RequireAnyPermission(
  Permission.VIEW_SCHOOLS,
  Permission.SCHOOL_VIEW_2D3D_MAP,
  Permission.VIEW_MAP,
)
export class KmzController {
  constructor(private readonly kmzService: KmzService) {}

  @Post()
  @RequirePermissions(Permission.UPLOAD_KMZ)
  @HttpCode(202)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload 3D GLB model for school (accepted for async processing)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadGlbModel(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kmzService.uploadGlbModel(schoolId, file);
  }

  // Used by production (Vercel): frontend uploads file to file-server first,
  // then sends the URL here to avoid Vercel's 4.5 MB body limit.
  @Post('2d/from-url')
  @RequirePermissions(Permission.UPLOAD_KMZ)
  @HttpCode(202)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process 2D KMZ/KML from a pre-uploaded file URL' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { fileUrl: { type: 'string' }, fileName: { type: 'string' } },
    },
  })
  uploadKmz2dFromUrl(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() body: { fileUrl: string; fileName: string },
  ) {
    return this.kmzService.uploadKmz2dFromUrl(
      schoolId,
      body.fileUrl,
      body.fileName,
    );
  }

  @Post('from-url')
  @RequirePermissions(Permission.UPLOAD_KMZ)
  @HttpCode(202)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Process GLB 3D model from a pre-uploaded file URL',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { fileUrl: { type: 'string' }, fileName: { type: 'string' } },
    },
  })
  uploadGlbFromUrl(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() body: { fileUrl: string; fileName: string },
  ) {
    return this.kmzService.uploadGlbFromUrl(
      schoolId,
      body.fileUrl,
      body.fileName,
    );
  }

  @Post('2d')
  @RequirePermissions(Permission.UPLOAD_KMZ)
  @HttpCode(202)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload 2D KMZ/KML file (accepted for async processing)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadKmz2d(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kmzService.uploadKmz2d(schoolId, file);
  }

  @Post('places-overlay')
  @RequirePermissions(Permission.EDIT_SITE_ANNOTATIONS)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload places overlay file (KML/KMZ) to display additional POIs',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadPlacesOverlay(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kmzService.uploadPlacesOverlay(schoolId, file);
  }

  @Get('2d/manifest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pre-computed 2D KMZ manifest for a school' })
  getKmz2dManifest(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.kmzService.getKmz2dManifest(schoolId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Poll KMZ/GLB processing status for a school' })
  getKmzStatus(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.kmzService.getKmzStatus(schoolId);
  }

  @Get('content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get processed KMZ GeoJSON content for a school' })
  getKmzContent(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.kmzService.getKmzContent(schoolId);
  }

  @Get('places-overlay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get places overlay GeoJSON content for a school' })
  getPlacesOverlayContent(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.kmzService.getPlacesOverlayContent(schoolId);
  }

  @Get('model.kmz')
  @ApiOperation({ summary: 'Generate and download 3D KMZ model for a school' })
  async downloadModelKmz(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Res() res: Response,
  ) {
    return this.kmzService.generateModelKmz(schoolId, res);
  }

  @Delete('2d/overlays/:index')
  @RequirePermissions(Permission.EDIT_SITE_ANNOTATIONS)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove a specific ground overlay from the 2D manifest',
  })
  removeOverlay(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('index') index: number,
  ) {
    return this.kmzService.removeOverlay(schoolId, index);
  }

  @Post('2d/overlays')
  @RequirePermissions(Permission.EDIT_SITE_ANNOTATIONS)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Append a new overlay layer (KMZ/KML) to the 2D manifest',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  addOverlay(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kmzService.addOverlay(schoolId, file);
  }

  @Post('2d/site-annotations')
  @RequirePermissions(Permission.EDIT_SITE_ANNOTATIONS)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a site-wide annotation (measurement/label)' })
  addSiteAnnotation(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() annotation: any,
  ) {
    return this.kmzService.addSiteAnnotation(schoolId, annotation);
  }

  @Delete('2d/site-annotations/:id')
  @RequirePermissions(Permission.EDIT_SITE_ANNOTATIONS)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a site-wide annotation' })
  removeSiteAnnotation(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id') id: string,
  ) {
    return this.kmzService.removeSiteAnnotation(schoolId, id);
  }
}
