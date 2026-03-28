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

@ApiTags('kmz')
@Controller('schools/:schoolId/kmz')
export class KmzController {
  constructor(private readonly kmzService: KmzService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload KMZ file and trigger background processing',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadKmz(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kmzService.uploadKmz(schoolId, file);
  }

  @Post('2d')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload 2D KMZ/KML file for the OpenLayers viewer (no 3D model extraction)',
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
}
