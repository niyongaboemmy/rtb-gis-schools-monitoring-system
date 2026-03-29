import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as JSZip from 'jszip';
import * as xml2js from 'xml2js';
import * as fs from 'fs';
import { School, KmzProcessingStatus } from '../schools/entities/school.entity';
import {
  SchoolBoundary,
  BoundaryType,
} from '../schools/entities/school-boundary.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { StorageService } from '../storage/storage.service';
import { Readable } from 'stream';
import unzipper from 'unzipper';
import * as path from 'path';
import archiver from 'archiver';
import type { Response } from 'express';
import sharp from 'sharp';
import * as os from 'os';

@Injectable()
export class KmzService {
  private readonly logger = new Logger(KmzService.name);
  constructor(
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolBoundary)
    private readonly boundaryRepository: Repository<SchoolBoundary>,
    @InjectRepository(SchoolBuilding)
    private readonly buildingRepository: Repository<SchoolBuilding>,
    private readonly storageService: StorageService,
  ) {}

  async uploadKmz(schoolId: string, file: Express.Multer.File) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.glb')) {
      throw new BadRequestException('File must be a .glb file');
    }

    const fileBuffer = fs.readFileSync(file.path);

    const filePath = `schools/${schoolId}/3d/${file.originalname}`;
    const publicPath = await this.storageService.uploadFile(
      filePath,
      fileBuffer,
      file.mimetype,
    );

    // Clean up temp file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      this.logger.warn(`Failed to clean up temp file: ${file.path}`);
    }

    // Store as a building record so the 3D viewer can find it
    await this.buildingRepository.delete({ schoolId });
    const building = this.buildingRepository.create({
      schoolId,
      name: file.originalname,
      modelPath: publicPath || filePath,
      modelName: file.originalname,
    });
    await this.buildingRepository.save(building);

    await this.schoolRepository.update(schoolId, {
      kmzStatus: KmzProcessingStatus.COMPLETED,
      kmzFilePath: publicPath || filePath,
      kmzProcessedAt: new Date(),
    });

    return {
      message: '3D GLB model uploaded successfully',
      schoolId,
      modelPath: publicPath || filePath,
    };
  }

  async processGeospatialBuffer(
    schoolId: string,
    fileBuffer: Buffer,
    fileName: string,
    publicKmzPath?: string,
  ): Promise<any> {
    try {
      const geojsonFeatures: any[] = [];
      const buildings: SchoolBuilding[] = [];
      let modelMap: Record<string, string> = {};

      if (fileName.toLowerCase().endsWith('.kmz')) {
        let zipFile: JSZip;
        let kmlFiles: string[];

        try {
          // 1. Load JSZip
          const jszipInstance: any = await JSZip.loadAsync(fileBuffer);
          zipFile = jszipInstance as unknown as JSZip;
          kmlFiles = Object.keys(jszipInstance.files).filter((name: string) =>
            name.toLowerCase().endsWith('.kml'),
          );

          if (kmlFiles.length === 0) {
            throw new Error('No KML file found inside KMZ');
          }

          // 2. Extract EVERYTHING from zip to preserve structure
          const extraction = await this.extractKmzArchive(
            schoolId,
            zipFile as any,
          );
          modelMap = extraction.modelMap;
          const rootKmlPath = extraction.rootKmlPath;
          const thumbnailUrl = extraction.thumbnailUrl;

          // 3. Process KML Files
          const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
          });

          const allOverlays: any[] = [];
          const allViews: any[] = [];

          const rootKmlFile =
            kmlFiles.find((p) => p.toLowerCase().endsWith('doc.kml')) ||
            kmlFiles[0];
          let rootInitialView = null;

          for (const kmlPath of kmlFiles) {
            const content = await zipFile.files[kmlPath].async('string');
            const parsed = await parser
              .parseStringPromise(content)
              .catch(() => null);
            if (!parsed) continue;

            const { placemarks, overlays, views } =
              this.extractKmlFeatures(parsed);

            const parsedOverlays = overlays
              .map((o) => this.parseGroundOverlay(o, modelMap))
              .filter((o) => !!o);
            const parsedViews = views
              .map((v) => this.parseKmlView(v))
              .filter((v) => !!v);

            allOverlays.push(...parsedOverlays);
            allViews.push(...parsedViews);

            if (
              kmlPath === rootInitialView ||
              (kmlPath.toLowerCase().includes('doc.kml') && !rootInitialView)
            ) {
              if (parsedViews.length > 0) rootInitialView = parsedViews[0];
            }

            for (const pm of placemarks) {
              const feature = this.placemarkToGeoJson(pm);
              if (feature) geojsonFeatures.push(feature);

              const modelData = this.parseModel(pm, modelMap);
              if (modelData) {
                const b = this.buildingRepository.create({
                  schoolId,
                  name: modelData.name,
                  modelPath: modelData.modelPath,
                  modelName: modelData.modelName,
                  modelMetadata: modelData.modelMetadata,
                  centroidLat: modelData.modelMetadata.location.lat,
                  centroidLng: modelData.modelMetadata.location.lng,
                });
                buildings.push(b);

                // Priority coordinate sync: use the first model's location as school location if missing/far
                if (buildings.length === 1) {
                  await this.schoolRepository.update(schoolId, {
                    latitude: b.centroidLat,
                    longitude: b.centroidLng,
                  });
                }
              }
            }
          }

          if (rootKmlPath) publicKmzPath = rootKmlPath;
          if (thumbnailUrl) {
            await this.schoolRepository.update(schoolId, { thumbnailUrl });
          }

          const initialView = rootInitialView || allViews[0] || null;
          const overlaysMetadata = allOverlays;

          const fileServerBase = process.env.FILE_SERVER_BASE_URL || '/files';
          const assetsBaseUrl = `${fileServerBase}/schools/${schoolId}/kmz_content`;

          const updatedGeoJson = {
            type: 'FeatureCollection',
            features: geojsonFeatures.map((f) => ({
              ...f,
              properties: {
                ...f.properties,
                description: this.rewriteKmlDescription(
                  f.properties?.description,
                  assetsBaseUrl,
                ),
              },
            })),
            properties: {
              initialView,
              overlays: overlaysMetadata,
            },
          };

          await this.schoolRepository.update(schoolId, {
            geojsonContent: updatedGeoJson as any,
            kmzStatus: KmzProcessingStatus.COMPLETED,
            kmzFilePath: publicKmzPath || fileName,
            kmzMasterKmlPath: rootKmlPath || undefined,
            kmzProcessedAt: new Date(),
          });

          // Final safety coordinate sync from initialView if still offset
          if (initialView && initialView.latitude && initialView.longitude) {
            await this.schoolRepository.update(schoolId, {
              latitude: Number(initialView.latitude),
              longitude: Number(initialView.longitude),
            });
          }
        } catch (zipError: any) {
          this.logger.warn(
            `JSZip failed: ${zipError.message}, trying unzipper`,
          );
          // Fallback to unzipper for problematic ZIP files
          const result = await this.extractKmzWithUnzipper(
            schoolId,
            fileBuffer,
          );
          modelMap = result.modelMap;

          // Process KML files
          const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
          });
          for (const kmlData of result.kmlFiles) {
            const parsed = await parser
              .parseStringPromise(kmlData.content)
              .catch(() => null);
            if (!parsed) continue;
            const { placemarks } = this.extractKmlFeatures(parsed);
            for (const pm of placemarks) {
              const feature = this.placemarkToGeoJson(pm);
              if (feature) geojsonFeatures.push(feature);
              const modelData = this.parseModel(pm, modelMap);
              if (modelData) {
                buildings.push(
                  this.buildingRepository.create({
                    schoolId,
                    name: modelData.name,
                    modelPath: modelData.modelPath,
                    modelName: modelData.modelName,
                    modelMetadata: modelData.modelMetadata,
                    centroidLat: modelData.modelMetadata.location.lat,
                    centroidLng: modelData.modelMetadata.location.lng,
                  }),
                );
              }
            }
          }

          await this.schoolRepository.update(schoolId, {
            geojsonContent: {
              type: 'FeatureCollection',
              features: geojsonFeatures,
            } as any,
            kmzStatus: KmzProcessingStatus.COMPLETED,
            kmzFilePath: fileName,
            kmzMasterKmlPath: result.rootKmlPath || undefined,
            kmzProcessedAt: new Date(),
            thumbnailUrl: result.thumbnailUrl || undefined,
          });

          // Save boundaries and buildings
          await this.boundaryRepository.delete({ schoolId });
          const boundaries = geojsonFeatures
            .filter(
              (f) =>
                f.geometry?.type === 'Polygon' ||
                f.geometry?.type === 'MultiPolygon',
            )
            .map((f) =>
              this.boundaryRepository.create({
                schoolId,
                name: f.properties?.name || 'Boundary',
                boundaryType: BoundaryType.CAMPUS,
                geojson: f.geometry,
                sourceFile: fileName,
                kmlPlacemarkId: f.id,
                properties: f.properties,
              }),
            );
          if (boundaries.length > 0)
            await this.boundaryRepository.save(boundaries);
          if (buildings.length > 0) {
            await this.buildingRepository.delete({ schoolId });
            await this.buildingRepository.save(buildings);
          }

          return {
            placemarkCount: geojsonFeatures.length,
            modelCount: buildings.length,
            status: 'completed',
            data: { type: 'FeatureCollection', features: geojsonFeatures },
          };
        }
      } else {
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true,
        });
        const parsed = await parser.parseStringPromise(
          fileBuffer.toString('utf-8'),
        );
        const { placemarks, views } = this.extractKmlFeatures(parsed);

        for (const pm of placemarks) {
          const feature = this.placemarkToGeoJson(pm);
          if (feature) geojsonFeatures.push(feature);
        }

        const initialView =
          views.length > 0 ? this.parseKmlView(views[0]) : null;

        await this.schoolRepository.update(schoolId, {
          geojsonContent: {
            type: 'FeatureCollection',
            features: geojsonFeatures,
            properties: { initialView },
          } as any,
          kmzStatus: KmzProcessingStatus.COMPLETED,
          kmzFilePath: publicKmzPath || fileName,
          kmzProcessedAt: new Date(),
        });
      }

      // Restore boundary and building updates
      await this.boundaryRepository.delete({ schoolId });
      const boundaries = geojsonFeatures
        .filter(
          (f) =>
            f.geometry?.type === 'Polygon' ||
            f.geometry?.type === 'MultiPolygon',
        )
        .map((f) =>
          this.boundaryRepository.create({
            schoolId,
            name: f.properties?.name || 'Boundary',
            boundaryType: BoundaryType.CAMPUS,
            geojson: f.geometry,
            sourceFile: fileName,
            kmlPlacemarkId: f.id,
            properties: f.properties,
          }),
        );
      if (boundaries.length > 0) await this.boundaryRepository.save(boundaries);

      if (buildings.length > 0) {
        await this.buildingRepository.delete({ schoolId });
        await this.buildingRepository.save(buildings);
      }

      const updatedSchool = await this.schoolRepository.findOne({
        where: { id: schoolId },
      });

      return {
        placemarkCount: geojsonFeatures.length,
        modelCount: buildings.length,
        status: 'completed',
        data: updatedSchool?.geojsonContent || {
          type: 'FeatureCollection',
          features: geojsonFeatures,
        },
      };
    } catch (error) {
      await this.schoolRepository.update(schoolId, {
        kmzStatus: KmzProcessingStatus.FAILED,
      });
      // Clean up any partially-extracted kmz_content so the DB and disk stay in sync
      await this.storageService.deleteDirectory(`schools/${schoolId}/kmz_content`);
      throw error;
    }
  }

  private async extractKmzArchive(
    schoolId: string,
    zip: JSZip,
  ): Promise<{
    rootKmlPath: string | null;
    thumbnailUrl: string | null;
    modelMap: Record<string, string>;
  }> {
    const modelMap: Record<string, string> = {};
    let rootKmlPath: string | null = null;
    let thumbnailUrl: string | null = null;

    const files = Object.keys(zip.files).filter((f) => !f.endsWith('/'));

    // Batch processing to avoid overhead but some concurrency
    const BATCH_SIZE = 50;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (fileName) => {
          const file = zip.files[fileName];
          const buffer = await file.async('nodebuffer');
          const contentType = this.getContentType(fileName);

          const publicPath = await this.storageService.uploadFile(
            `schools/${schoolId}/kmz_content/${fileName}`,
            buffer as any,
            contentType,
          );

          if (!publicPath) {
            // Throw so the whole extraction fails atomically — prevents DB being
            // updated with a kmzMasterKmlPath whose referenced assets are missing
            throw new Error(`Failed to extract KMZ asset: ${fileName}`);
          }

          this.logger.log(`Extracted KMZ member: ${fileName} -> ${publicPath}`);

          // Identify root KML (prefer doc.kml in the root)
          if (fileName.toLowerCase().endsWith('.kml')) {
            if (
              !rootKmlPath ||
              fileName.toLowerCase() === 'doc.kml' ||
              fileName.toLowerCase() === 'index.kml'
            ) {
              rootKmlPath = publicPath;
              this.logger.log(`Identified root KML: ${fileName}`);
            }
          }

          // Identify thumbnail or first image
          if (/\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
            const isExplicitThumb =
              fileName.toLowerCase().includes('thumb') ||
              fileName.toLowerCase().includes('preview') ||
              fileName.toLowerCase().includes('logo');
            if (!thumbnailUrl || isExplicitThumb) {
              thumbnailUrl = publicPath;
            }
          }

          // Map models
          if (
            fileName.toLowerCase().endsWith('.dae') ||
            fileName.toLowerCase().endsWith('.glb')
          ) {
            modelMap[fileName] = publicPath;
          }
        }),
      );
    }

    return { rootKmlPath, thumbnailUrl, modelMap };
  }

  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      kml: 'application/vnd.google-earth.kml+xml',
      kmz: 'application/vnd.google-earth.kmz',
      dae: 'model/vnd.collada+xml',
      glb: 'model/gltf-binary',
      gltf: 'model/gltf+json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      tga: 'image/x-targa',
      bmp: 'image/bmp',
      dds: 'image/vnd-ms.dds',
    };
    return map[ext || ''] || 'application/octet-stream';
  }

  private parseModel(placemark: any, modelMap: Record<string, string>): any {
    const model = placemark.Model;
    if (!model) return null;

    const href = model.Link?.href || model.Link;
    // Try to find exact match or relative match in modelMap
    const modelPath =
      modelMap[href] ||
      Object.values(modelMap).find((p) => p.endsWith(href)) ||
      null;

    // KML orientation often needs normalization or defaults
    const loc = model.Location || {};
    const ori = model.Orientation || {};
    const sca = model.Scale || {};

    return {
      name: placemark.name || 'Structural Model',
      modelPath,
      modelName: href,
      modelMetadata: {
        location: {
          lat: Number(loc.latitude || 0),
          lng: Number(loc.longitude || 0),
          alt: Number(loc.altitude || 0),
        },
        orientation: {
          heading: Number(ori.heading || 0),
          tilt: Number(ori.tilt || 0),
          roll: Number(ori.roll || 0),
        },
        scale: {
          x: Number(sca.x || 1),
          y: Number(sca.y || 1),
          z: Number(sca.z || 1),
        },
        altitudeMode: model.altitudeMode || 'absolute',
      },
    };
  }

  async getKmzContent(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    return {
      schoolId,
      kmzStatus: school.kmzStatus,
      processedAt: school.kmzProcessedAt,
      geojsonContent: school.geojsonContent,
    };
  }

  async getPlacesOverlayContent(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    return {
      schoolId,
      placesOverlayFilePath: school.placesOverlayFilePath,
      placesOverlayData: school.placesOverlayData,
    };
  }

  private extractKmlFeatures(parsed: any): {
    placemarks: any[];
    overlays: any[];
    views: any[];
  } {
    const placemarks: any[] = [];
    const overlays: any[] = [];
    const views: any[] = [];

    const traverse = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const lookup = (o: any, keys: string[]) => {
        for (const key of keys) {
          if (o[key]) return o[key];
        }
        return null;
      };

      // Placemark
      const pm = lookup(obj, ['Placemark', 'gx:Placemark']);
      if (pm) {
        const pms = Array.isArray(pm) ? pm : [pm];
        placemarks.push(...pms);
      }

      // GroundOverlay
      const ov = lookup(obj, ['GroundOverlay', 'gx:GroundOverlay']);
      if (ov) {
        const ovs = Array.isArray(ov) ? ov : [ov];
        overlays.push(...ovs);
      }

      // LookAt / Camera
      const la = lookup(obj, ['LookAt', 'gx:LookAt']);
      if (la) {
        const ls = Array.isArray(la) ? la : [la];
        views.push(...ls.map((l) => ({ type: 'LookAt', ...l })));
      }

      const ca = lookup(obj, ['Camera', 'gx:Camera']);
      if (ca) {
        const cs = Array.isArray(ca) ? ca : [ca];
        views.push(...cs.map((c) => ({ type: 'Camera', ...c })));
      }

      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') traverse(obj[key]);
      }
    };

    traverse(parsed);
    return { placemarks, overlays, views };
  }

  private getKmlValue(val: any): string {
    if (val === undefined || val === null) return '';
    if (Array.isArray(val)) return this.getKmlValue(val[0]);
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return (
        val._text ||
        val._ ||
        (val.$ ? val._ : '') ||
        (val.toString && val.toString() !== '[object Object]'
          ? val.toString()
          : '') ||
        ''
      );
    }
    return String(val);
  }

  private parseKmlView(view: any): any {
    if (!view) return null;
    return {
      type: view.type,
      longitude: Number(this.getKmlValue(view.longitude) || 0),
      latitude: Number(this.getKmlValue(view.latitude) || 0),
      altitude: Number(this.getKmlValue(view.altitude) || 0),
      heading: Number(this.getKmlValue(view.heading) || 0),
      tilt: Number(this.getKmlValue(view.tilt) || 0),
      roll: Number(this.getKmlValue(view.roll) || 0),
      range: Number(this.getKmlValue(view.range) || 1200),
      altitudeMode: this.getKmlValue(view.altitudeMode) || 'relativeToGround',
    };
  }

  private parseGroundOverlay(
    overlay: any,
    modelMap: Record<string, string>,
  ): any {
    const icon = overlay.Icon;
    if (!icon) return null;

    const href = this.getKmlValue(icon.href);
    const imagePath =
      modelMap[href] ||
      Object.values(modelMap).find((p) => p.endsWith(href)) ||
      null;

    const box = overlay.LatLonBox || {};
    return {
      name: this.getKmlValue(overlay.name) || 'Ground Overlay',
      imagePath,
      bounds: {
        north: Number(this.getKmlValue(box.north) || 0),
        south: Number(this.getKmlValue(box.south) || 0),
        east: Number(this.getKmlValue(box.east) || 0),
        west: Number(this.getKmlValue(box.west) || 0),
      },
      color: this.getKmlValue(overlay.color) || 'ffffffff',
      visibility: this.getKmlValue(overlay.visibility) !== '0',
    };
  }

  private placemarkToGeoJson(placemark: any): any {
    // ... (rest of the file as before)
    try {
      const name = placemark.name?._text || placemark.name || 'Unknown';
      const description =
        placemark.description?._text || placemark.description || '';

      // 1. Polygon
      if (placemark.Polygon) {
        const coords = this.parseKmlCoordinates(
          placemark.Polygon?.outerBoundaryIs?.LinearRing?.coordinates,
        );
        if (coords) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { name, description },
          };
        }
      }

      // 2. LineString
      if (placemark.LineString) {
        const coords = this.parseKmlCoordinates(
          placemark.LineString?.coordinates,
        );
        if (coords) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'LineString', coordinates: coords },
            properties: { name, description },
          };
        }
      }

      // 3. Point
      if (placemark.Point) {
        const coords = this.parseKmlCoordinates(placemark.Point?.coordinates);
        if (coords && coords.length > 0) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'Point', coordinates: coords[0] },
            properties: { name, description },
          };
        }
      }

      // 4. MultiGeometry
      if (placemark.MultiGeometry) {
        const geometries: any[] = [];
        const mg = placemark.MultiGeometry;

        // Recursively handle sub-geometries if needed, but for now simple extract
        if (mg.Polygon) {
          const pms = Array.isArray(mg.Polygon) ? mg.Polygon : [mg.Polygon];
          for (const p of pms) {
            const coords = this.parseKmlCoordinates(
              p.outerBoundaryIs?.LinearRing?.coordinates,
            );
            if (coords)
              geometries.push({ type: 'Polygon', coordinates: [coords] });
          }
        }
        if (mg.LineString) {
          const lss = Array.isArray(mg.LineString)
            ? mg.LineString
            : [mg.LineString];
          for (const l of lss) {
            const coords = this.parseKmlCoordinates(l.coordinates);
            if (coords)
              geometries.push({ type: 'LineString', coordinates: coords });
          }
        }
        if (mg.Point) {
          const pts = Array.isArray(mg.Point) ? mg.Point : [mg.Point];
          for (const p of pts) {
            const coords = this.parseKmlCoordinates(p.coordinates);
            if (coords && coords.length > 0)
              geometries.push({ type: 'Point', coordinates: coords[0] });
          }
        }

        if (geometries.length > 0) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'GeometryCollection', geometries },
            properties: { name, description },
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private rewriteKmlDescription(description: string, baseUrl: string): string {
    if (!description || typeof description !== 'string')
      return description || '';

    // Replace relative src="path" or src='path' with baseUrl/path
    // Exclude absolute URLs and data URIs
    return description.replace(
      /(src=["'])(?!https?:\/\/|\/|data:)([^"'>]+)(["'])/gi,
      (match, p1, p2, p3) => {
        // Clean up p2 if it starts with ./
        const cleanPath = p2.startsWith('./') ? p2.substring(2) : p2;
        return `${p1}${baseUrl}/${cleanPath}${p3}`;
      },
    );
  }

  private parseKmlCoordinates(coordStr: any): number[][] | null {
    if (!coordStr) return null;

    // Handle xml2js different variations of string content
    const str =
      typeof coordStr === 'string'
        ? coordStr
        : coordStr._ ||
          (typeof coordStr === 'object' ? JSON.stringify(coordStr) : '');

    try {
      return str
        .trim()
        .split(/\s+/)
        .map((point: string) => {
          const parts = point.split(',').map(Number);
          return parts.slice(0, 3); // [lng, lat, alt]
        })
        .filter((p: number[]) => p.length >= 2 && !p.some(isNaN));
    } catch {
      return null;
    }
  }

  // Alternative KMZ extraction using unzipper for problematic ZIP files
  private async extractKmzWithUnzipper(
    schoolId: string,
    fileBuffer: Buffer,
  ): Promise<{
    rootKmlPath: string | null;
    thumbnailUrl: string | null;
    modelMap: Record<string, string>;
    kmlFiles: { name: string; content: string }[];
  }> {
    const modelMap: Record<string, string> = {};
    let rootKmlPath: string | null = null;
    let thumbnailUrl: string | null = null;
    const kmlFiles: { name: string; content: string }[] = [];

    // Create a Readable stream from the buffer
    const readable = Readable.from(fileBuffer);
    const directory = readable.pipe(unzipper.Parse({ forceStream: true }));

    for await (const entry of directory) {
      const fileName = entry.path;
      const type = entry.type; // 'Directory' or 'File'

      if (type === 'Directory') {
        entry.autodrain();
        continue;
      }

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of entry) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const contentType = this.getContentType(fileName);

        const publicPath = await this.storageService.uploadFile(
          `schools/${schoolId}/kmz_content/${fileName}`,
          buffer as any,
          contentType,
        );

        if (!publicPath) {
          throw new Error(`Failed to extract KMZ asset (unzipper): ${fileName}`);
        }

        this.logger.log(`Extracted (unzipper): ${fileName} -> ${publicPath}`);

        // Identify KML files
        if (fileName.toLowerCase().endsWith('.kml')) {
          kmlFiles.push({
            name: fileName,
            content: buffer.toString('utf-8'),
          });
          if (!rootKmlPath || fileName.toLowerCase() === 'doc.kml') {
            rootKmlPath = publicPath;
          }
        }

        // Identify thumbnail
        if (/\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
          if (!thumbnailUrl || fileName.toLowerCase().includes('thumb')) {
            thumbnailUrl = publicPath;
          }
        }

        // Map models
        if (
          fileName.toLowerCase().endsWith('.dae') ||
          fileName.toLowerCase().endsWith('.glb')
        ) {
          modelMap[fileName] = publicPath;
        }
      } catch (err) {
        this.logger.error(`Error processing ${fileName}: ${err}`);
        entry.autodrain();
      }
    }

    return { rootKmlPath, thumbnailUrl, modelMap, kmlFiles };
  }

  async generateModelKmz(schoolId: string, res: Response) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    let daePath = '';
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'schools',
      schoolId,
      'kmz_content',
    );

    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const daeFile = files.find(
        (f) =>
          f.toLowerCase().endsWith('.dae') || f.toLowerCase().endsWith('.glb'),
      );
      if (daeFile) {
        daePath = path.join(uploadDir, daeFile);
      }
    }

    if (!daePath || !fs.existsSync(daePath)) {
      throw new NotFoundException(
        `No 3D .dae or .glb model found for school ${schoolId}`,
      );
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${school.name.replace(/[^a-zA-Z0-9]/g, '_')}_3D_Model.kmz"`,
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      this.logger.error(`Error generating KMZ archive for ${schoolId}`, err);
      if (!res.headersSent) {
        res.status(500).send({ message: 'Failed to generate KMZ' });
      }
    });

    archive.pipe(res);

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${school.name} 3D Model</name>
    <Model>
      <altitudeMode>relativeToGround</altitudeMode>
      <Location>
        <longitude>${school.longitude || 0}</longitude>
        <latitude>${school.latitude || 0}</latitude>
        <altitude>${school.elevation || 0}</altitude>
      </Location>
      <Orientation>
        <heading>0</heading>
        <tilt>0</tilt>
        <roll>0</roll>
      </Orientation>
      <Scale>
        <x>1</x><y>1</y><z>1</z>
      </Scale>
      <Link>
        <href>models/${path.basename(daePath)}</href>
      </Link>
    </Model>
  </Placemark>
</kml>`;

    archive.append(kml, { name: 'doc.kml' });
    archive.file(daePath, { name: `models/${path.basename(daePath)}` });

    // Include other files (textures, etc.) from the kmz_content folder
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const f of files) {
        if (
          !f.toLowerCase().endsWith('.dae') &&
          !f.toLowerCase().endsWith('.glb') &&
          !f.toLowerCase().endsWith('.kml')
        ) {
          archive.file(path.join(uploadDir, f), { name: `models/${f}` });
        }
      }
    }

    archive.finalize();
  }

  async uploadPlacesOverlay(schoolId: string, file: Express.Multer.File) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.kmz') && !filename.endsWith('.kml')) {
      throw new BadRequestException('File must be a .kmz or .kml file');
    }

    // Read file from disk
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(file.path);

    // Save the places overlay file
    const filePath = `schools/${schoolId}/places-overlay/${file.originalname}`;
    const publicPath = await this.storageService.uploadFile(
      filePath,
      fileBuffer,
      file.mimetype,
    );

    // Process the file to extract features for overlay
    const result = await this.processPlacesOverlayBuffer(
      schoolId,
      fileBuffer,
      file.originalname,
      publicPath || undefined,
    );

    // Clean up temp file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      this.logger.warn(`Failed to clean up temp file: ${file.path}`);
    }

    return {
      message: 'Places overlay file uploaded and processed successfully',
      schoolId,
      ...result,
    };
  }

  private async processPlacesOverlayBuffer(
    schoolId: string,
    fileBuffer: Buffer,
    fileName: string,
    publicPath?: string,
  ): Promise<any> {
    try {
      const geojsonFeatures: any[] = [];

      if (fileName.toLowerCase().endsWith('.kmz')) {
        const jszipInstance = await JSZip.loadAsync(fileBuffer);
        const kmlFiles = Object.keys(jszipInstance.files).filter(
          (name: string) => name.toLowerCase().endsWith('.kml'),
        );

        if (kmlFiles.length === 0) {
          throw new Error('No KML file found inside KMZ');
        }

        // Extract all files from the KMZ
        const extraction = await this.extractPlacesOverlayArchive(
          schoolId,
          jszipInstance as any,
        );

        // Process KML Files
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true,
        });

        for (const kmlPath of kmlFiles) {
          const content = await jszipInstance.files[kmlPath].async('string');
          const parsed = await parser
            .parseStringPromise(content)
            .catch(() => null);
          if (!parsed) continue;

          const { placemarks } = this.extractKmlFeatures(parsed);

          for (const pm of placemarks) {
            const feature = this.placemarkToGeoJson(pm);
            if (feature) geojsonFeatures.push(feature);
          }
        }
      } else {
        // Process KML file directly
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true,
        });
        const parsed = await parser.parseStringPromise(
          fileBuffer.toString('utf-8'),
        );
        const { placemarks } = this.extractKmlFeatures(parsed);

        for (const pm of placemarks) {
          const feature = this.placemarkToGeoJson(pm);
          if (feature) geojsonFeatures.push(feature);
        }
      }

      const placesOverlayData = {
        type: 'FeatureCollection',
        features: geojsonFeatures,
        properties: {
          sourceFile: fileName,
          uploadedAt: new Date().toISOString(),
        },
      };

      console.log(
        '[PlacesOverlay] Generated GeoJSON:',
        JSON.stringify(placesOverlayData, null, 2).substring(0, 500),
      );

      await this.schoolRepository.update(schoolId, {
        placesOverlayFilePath: publicPath || fileName,
        placesOverlayData: placesOverlayData as any,
      });

      return {
        placemarkCount: geojsonFeatures.length,
        status: 'completed',
        data: placesOverlayData,
      };
    } catch (error) {
      this.logger.error(`Failed to process places overlay: ${error.message}`);
      throw error;
    }
  }

  private async extractPlacesOverlayArchive(
    schoolId: string,
    zip: JSZip,
  ): Promise<{
    modelMap: Record<string, string>;
  }> {
    const modelMap: Record<string, string> = {};

    const files = Object.keys(zip.files).filter((f) => !f.endsWith('/'));

    const BATCH_SIZE = 50;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (fileName) => {
          const file = zip.files[fileName];
          const buffer = await file.async('nodebuffer');
          const contentType = this.getContentType(fileName);

          const publicPath = await this.storageService.uploadFile(
            `schools/${schoolId}/places-overlay_content/${fileName}`,
            buffer as any,
            contentType,
          );

          if (!publicPath) {
            this.logger.error(
              `FAILED to extract file from places overlay KMZ: ${fileName}`,
            );
            return;
          }

          this.logger.log(
            `Extracted places overlay KMZ member: ${fileName} -> ${publicPath}`,
          );

          // Map model files for reference
          if (
            fileName.toLowerCase().endsWith('.dae') ||
            fileName.toLowerCase().endsWith('.glb')
          ) {
            modelMap[fileName] = publicPath;
          }
        }),
      );
    }

    return { modelMap };
  }

  /**
   * Upload a 2D-specific KMZ/KML file for the OpenLayers viewer.
   * Extracts all assets server-side and stores a pre-computed manifest
   * so the client does NOT need to download and unzip the raw KMZ.
   */
  async uploadKmz2d(schoolId: string, file: Express.Multer.File) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.kmz') && !filename.endsWith('.kml')) {
      throw new BadRequestException('File must be a .kmz or .kml file');
    }

    const fileBuffer = fs.readFileSync(file.path);

    // Store raw file (kept for 3D compatibility / fallback)
    const filePath = `schools/${schoolId}/kmz_2d/${file.originalname}`;
    const publicPath = await this.storageService.uploadFile(
      filePath,
      fileBuffer,
      file.mimetype,
    );

    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      this.logger.warn(`Failed to clean up temp file: ${file.path}`);
    }

    if (!publicPath) {
      throw new BadRequestException('Failed to store 2D KMZ file');
    }

    // ── Server-side extraction (the heavy work) ────────────────────────────
    let manifest: any = null;
    try {
      manifest = await this.extractKmz2dAssets(
        schoolId, 
        fileBuffer, 
        file.originalname
      );
      this.logger.log(
        `[2D] Manifest built for school ${schoolId}: ${manifest?.kmlUrls?.length || 0} KML(s), ${manifest?.groundOverlays?.length || 0} overlay(s)`,
      );
    } catch (err: any) {
      // Non-fatal: fallback to browser-side processing if extraction fails
      this.logger.warn(
        `[2D] Manifest extraction failed (will fall back to browser): ${err.message}`,
      );
    }

    await this.schoolRepository.update(schoolId, {
      kmz2dFilePath: publicPath,
      kmz2dManifest: manifest,
    });

    return {
      message: '2D KMZ file uploaded and processed successfully',
      schoolId,
      kmz2dFilePath: publicPath,
      manifestReady: manifest !== null,
      overlayCount: manifest?.groundOverlays?.length ?? 0,
    };
  }

  /**
   * Return pre-computed 2D manifest for the viewer.
   * Includes resolved absolute URLs for KML files and ground overlay images.
   */
  async getKmz2dManifest(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    return {
      schoolId,
      manifest: school.kmz2dManifest ?? null,
      kmz2dFilePath: school.kmz2dFilePath ?? null,
    };
  }

  /**
   * Server-side KMZ extraction for the 2D viewer.
   * Unpacks the archive, uploads every asset to the file server, then builds
   * a lightweight manifest the client can use instead of the raw KMZ.
   */
  private async extractKmz2dAssets(
    schoolId: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<{
    kmlUrls: string[];
    groundOverlays: any[];
    initialView: any | null;
  }> {
    const kmlUrls: string[] = [];
    const groundOverlays: any[] = [];
    let initialView: any = null;

    if (fileName.toLowerCase().endsWith('.kml')) {
      // Bare KML file — just store it, no extraction needed
      const publicPath = await this.storageService.uploadFile(
        `schools/${schoolId}/kmz_2d_content/doc.kml`,
        fileBuffer,
        'application/vnd.google-earth.kml+xml',
      );
      if (publicPath) kmlUrls.push(publicPath);

      // Parse for initial view
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
      });
      const parsed = await parser
        .parseStringPromise(fileBuffer.toString('utf-8'))
        .catch(() => null);
      if (parsed) {
        const { views } = this.extractKmlFeatures(parsed);
        if (views.length > 0) initialView = this.parseKmlView(views[0]);
      }
      return { kmlUrls, groundOverlays, initialView };
    }

    // ── KMZ (zip) extraction ───────────────────────────────────────────────
    const fileServerBase = process.env.FILE_SERVER_BASE_URL || '/files';
    const assetBaseUrl = `${fileServerBase}/schools/${schoolId}/kmz_2d_content`;

    let jszipInstance: any;
    try {
      jszipInstance = await (JSZip as any).loadAsync(fileBuffer);
    } catch (err: any) {
      throw new Error(`Failed to open KMZ archive: ${err.message}`);
    }

    // Map of in-zip path → { url, isTiled, maxZoom }
    const assetUrlMap: Record<string, { url: string; isTiled?: boolean; maxZoom?: number }> = {};
    const allKmlPaths: string[] = [];
    const files = Object.keys(jszipInstance.files).filter(
      (f: string) => !jszipInstance.files[f].dir,
    );

    const uploadDirectoryToStorage = async (
      localDir: string,
      storagePrefix: string,
    ): Promise<void> => {
      const dirFiles = await fs.promises.readdir(localDir, { withFileTypes: true });
      for (const file of dirFiles) {
        const p = path.join(localDir, file.name);
        if (file.isDirectory()) {
           await uploadDirectoryToStorage(p, `${storagePrefix}/${file.name}`);
        } else {
           const buf = await fs.promises.readFile(p);
           const ext = path.extname(file.name).toLowerCase();
           let mime = 'application/octet-stream';
           if (ext === '.png') mime = 'image/png';
           else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
           await this.storageService.uploadFile(`${storagePrefix}/${file.name}`, buf as any, mime);
        }
      }
    };

    // Upload all assets in batches
    const BATCH_SIZE = 30;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (zipPath: string) => {
          const fileBuf = await jszipInstance.files[zipPath].async(
            'nodebuffer',
          );
          const contentType = this.getContentType(zipPath);
          
          let isTiled = false;
          let tileUrlTemplate = '';
          let maxZoom = 0;

          const isOptimizeable = (contentType === 'image/jpeg' || contentType === 'image/png') && !zipPath.toLowerCase().includes('.tif');

          if (isOptimizeable) {
             try {
               const meta = await sharp(fileBuf).metadata();
               if ((meta.width && meta.width > 2048) || (meta.height && meta.height > 2048)) {
                  this.logger.log(`Image ${zipPath} is massive (${meta.width}x${meta.height}). Tiling on backend to save client GPU!`);
                  const tmpDir = path.join(os.tmpdir(), `kmz_chunk_${Date.now()}_${Math.random()}`);
                  await fs.promises.mkdir(tmpDir, { recursive: true });
                  
                  await sharp(fileBuf)
                     .tile({ layout: 'google', size: 256 })
                     .toFile(tmpDir); 
                  
                  const storagePrefix = `schools/${schoolId}/kmz_2d_content/${zipPath}_tiled`;
                  await uploadDirectoryToStorage(tmpDir, storagePrefix);
                  await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(()=>null);
                  
                  let tileExt = 'jpg';
                  const files00 = await fs.promises.readdir(path.join(tmpDir, '0', '0')).catch(()=>[]);
                  if (files00.length > 0) tileExt = files00[0].split('.').pop() || 'jpg';
                  
                  tileUrlTemplate = `${fileServerBase}/${storagePrefix}/{z}/{x}/{y}.${tileExt}`;
                  isTiled = true;
                  maxZoom = Math.ceil(Math.log2(Math.max(meta.width, meta.height) / 256));
               }
             } catch (e) {
                this.logger.warn(`Sharp failed to tile ${zipPath}: ` + e);
             }
          }

          if (!isTiled) {
            const publicPath = await this.storageService.uploadFile(
              `schools/${schoolId}/kmz_2d_content/${zipPath}`,
              fileBuf as any,
              contentType,
            );
            if (publicPath) {
              assetUrlMap[zipPath] = { url: publicPath };
              const baseName = zipPath.split('/').pop()!;
              if (!assetUrlMap[baseName]) assetUrlMap[baseName] = { url: publicPath };
            }
          } else {
            assetUrlMap[zipPath] = { url: tileUrlTemplate, isTiled: true, maxZoom };
            const baseName = zipPath.split('/').pop()!;
            if (!assetUrlMap[baseName]) assetUrlMap[baseName] = { url: tileUrlTemplate, isTiled: true, maxZoom };
          }

          if (zipPath.toLowerCase().endsWith('.kml')) {
            allKmlPaths.push(zipPath);
          }
        }),
      );
    }

    // Prefer doc.kml / index.kml as the root KML
    const rootKmlPath =
      allKmlPaths.find((p) => p.toLowerCase() === 'doc.kml') ||
      allKmlPaths.find((p) => p.toLowerCase() === 'index.kml') ||
      allKmlPaths[0];

    if (rootKmlPath && assetUrlMap[rootKmlPath]) {
      kmlUrls.push(assetUrlMap[rootKmlPath].url);
    }

    // Parse every KML for overlays and initial view
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
    });
    for (const kmlPath of allKmlPaths) {
      const content = await jszipInstance.files[kmlPath].async('string');
      const parsed = await parser.parseStringPromise(content).catch(() => null);
      if (!parsed) continue;

      const { overlays, views } = this.extractKmlFeatures(parsed);

      for (const ov of overlays) {
        const icon = ov.Icon;
        if (!icon) continue;
        const href = this.getKmlValue(icon.href);
        const kmlDir = kmlPath.includes('/') ? kmlPath.substring(0, kmlPath.lastIndexOf('/') + 1) : '';
        let resolvedHref = href;
        if (!href.startsWith('http') && !href.startsWith('/')) {
           resolvedHref = kmlDir + href;
           resolvedHref = resolvedHref.replace(/\.\//g, '');
        }

        const mapEntry =
          assetUrlMap[resolvedHref] ||
          assetUrlMap[href] ||
          Object.entries(assetUrlMap).find(([k]) => k.endsWith('/' + href) || k === href)?.[1];
          
        const imageUrl = mapEntry ? mapEntry.url : `${assetBaseUrl}/${href}`;
        const isTiled = mapEntry ? (mapEntry.isTiled || false) : false;
        const maxZoom = mapEntry ? mapEntry.maxZoom : undefined;

        const box = ov.LatLonBox || {};
        const drawOrder = parseInt(this.getKmlValue(ov.drawOrder) || '0', 10);
        groundOverlays.push({
          name: this.getKmlValue(ov.name) || 'Overlay',
          imageUrl,
          isTiled,
          maxZoom,
          north: parseFloat(this.getKmlValue(box.north) || '0'),
          south: parseFloat(this.getKmlValue(box.south) || '0'),
          east: parseFloat(this.getKmlValue(box.east) || '0'),
          west: parseFloat(this.getKmlValue(box.west) || '0'),
          drawOrder: isNaN(drawOrder) ? 0 : drawOrder,
        });
      }

      if (!initialView && views.length > 0) {
        initialView = this.parseKmlView(views[0]);
      }
    }

    // Deduplicate overlays (in case multiple KMLs define the same hierarchy)
    const uniqueOverlays: any[] = [];
    const seen = new Set<string>();
    for (const ov of groundOverlays) {
      const key = `${ov.imageUrl}_${ov.north}_${ov.south}_${ov.west}_${ov.east}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueOverlays.push(ov);
      }
    }

    // Sort overlays so higher draw-order layers go on top
    uniqueOverlays.sort((a, b) => a.drawOrder - b.drawOrder);

    return { kmlUrls, groundOverlays: uniqueOverlays, initialView };
  }
}
