import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SITE_FEATURE_KINDS,
  SITE_FEATURE_SOURCES,
  type ModelCoord,
  type SiteFeatureKind,
  type SiteFeatureSource,
} from '../entities/site-feature.entity';

/** Max vertices per feature — keeps a single row and the payload bounded. */
export const MAX_FEATURE_POINTS = 2000;
/** Max serialised size of `properties`. */
export const MAX_PROPERTIES_BYTES = 4096;

const isFiniteNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** [lng, lat] or [lng, lat, alt], finite and in range. */
export function isPosition(p: unknown): boolean {
  return (
    Array.isArray(p) &&
    (p.length === 2 || p.length === 3) &&
    p.every(isFiniteNum) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90
  );
}

/** Validates GeoJSON coordinates against the geometry type on the same object. */
export function isValidGeometry(g: unknown): boolean {
  if (!g || typeof g !== 'object') return false;
  const { type, coordinates: c } = g as {
    type?: unknown;
    coordinates?: unknown;
  };
  if (!Array.isArray(c)) return false;
  switch (type) {
    case 'Point':
      return isPosition(c);
    case 'LineString':
      return (
        c.length >= 2 && c.length <= MAX_FEATURE_POINTS && c.every(isPosition)
      );
    case 'Polygon': {
      if (c.length < 1 || c.length > 10) return false;
      let total = 0;
      for (const ring of c) {
        if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isPosition))
          return false;
        total += ring.length;
      }
      return total <= MAX_FEATURE_POINTS;
    }
    default:
      return false;
  }
}

function IsGeoJsonGeometry(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isGeoJsonGeometry',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'geometry must be a GeoJSON Point, LineString or Polygon in WGS84 ' +
          `([lng, lat, alt?], finite, ≤ ${MAX_FEATURE_POINTS} points; polygon rings closed with ≥ 4 positions)`,
        ...options,
      },
      validator: { validate: (v: unknown) => isValidGeometry(v) },
    });
}

function IsModelCoords(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isModelCoords',
      target: object.constructor,
      propertyName,
      options: {
        message: `modelCoords must be ≤ ${MAX_FEATURE_POINTS} {x, y, z} points with finite numbers`,
        ...options,
      },
      validator: {
        validate: (v: unknown) =>
          Array.isArray(v) &&
          v.length <= MAX_FEATURE_POINTS &&
          v.every(
            (p) =>
              p &&
              typeof p === 'object' &&
              Object.keys(p).every(
                (k) => k === 'x' || k === 'y' || k === 'z',
              ) &&
              isFiniteNum((p as ModelCoord).x) &&
              isFiniteNum((p as ModelCoord).y) &&
              isFiniteNum((p as ModelCoord).z),
          ),
      },
    });
}

function IsSmallObject(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isSmallObject',
      target: object.constructor,
      propertyName,
      options: {
        message: `properties must be an object of at most ${MAX_PROPERTIES_BYTES} bytes`,
        ...options,
      },
      validator: {
        validate: (v: unknown) => {
          if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
          try {
            return Buffer.byteLength(JSON.stringify(v)) <= MAX_PROPERTIES_BYTES;
          } catch {
            return false;
          }
        },
      },
    });
}

export class GeometryDto {
  @ApiProperty({ enum: ['Point', 'LineString', 'Polygon'] })
  @IsIn(['Point', 'LineString', 'Polygon'])
  type: 'Point' | 'LineString' | 'Polygon';

  @ApiProperty({ description: 'GeoJSON coordinates, WGS84 [lng, lat, alt?]' })
  @IsArray()
  coordinates: number[] | number[][] | number[][][];
}

const COLOR = /^#[0-9a-f]{3,8}$/i;

export class CreateSiteFeatureDto {
  @ApiProperty({ enum: SITE_FEATURE_KINDS })
  @IsIn(SITE_FEATURE_KINDS as unknown as string[])
  kind: SiteFeatureKind;

  @ApiProperty({ type: GeometryDto })
  @ValidateNested()
  @Type(() => GeometryDto)
  @IsGeoJsonGeometry()
  geometry: GeometryDto;

  @ApiPropertyOptional({
    description: '3D model-frame points (x East, y Up, z −North)',
  })
  @IsOptional()
  @IsModelCoords()
  modelCoords?: ModelCoord[] | null;

  @ApiPropertyOptional({ description: 'Metres, or m² (plan area) for areas' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value?: number | null;

  @ApiPropertyOptional({ enum: ['m', 'm2'] })
  @IsOptional()
  @IsIn(['m', 'm2'])
  unit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @Matches(COLOR)
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSmallObject()
  properties?: Record<string, unknown> | null;

  @ApiProperty({ enum: SITE_FEATURE_SOURCES })
  @IsIn(SITE_FEATURE_SOURCES as unknown as string[])
  source: SiteFeatureSource;
}

/** kind and source are fixed once created. */
export class UpdateSiteFeatureDto {
  @ApiPropertyOptional({ type: GeometryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeometryDto)
  @IsGeoJsonGeometry()
  geometry?: GeometryDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsModelCoords()
  modelCoords?: ModelCoord[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value?: number | null;

  @ApiPropertyOptional({ enum: ['m', 'm2'] })
  @IsOptional()
  @IsIn(['m', 'm2'])
  unit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(COLOR)
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSmallObject()
  properties?: Record<string, unknown> | null;
}

/**
 * Body of the legacy `POST /schools/:id/kmz/2d/site-annotations` (WS9.4) —
 * replaces the old `@Body() annotation: any`. Coordinates are the flat
 * [lng, lat, lng, lat, …] array the 2D viewer always sent.
 */
export class LegacySiteAnnotationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @IsIn(['point', 'line', 'polygon'])
  type: 'point' | 'line' | 'polygon';

  @IsArray()
  @ArrayMaxSize(MAX_FEATURE_POINTS * 2)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  coordinates: number[];

  @IsOptional() @IsString() @MaxLength(200) label?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) content?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsString() @MaxLength(40) iconType?: string;
  @IsOptional() @IsSmallObject() style?: Record<string, unknown>;
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  areaSquareMeters?: number;
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  lengthMeters?: number;
  @IsOptional() @IsString() @MaxLength(40) createdAt?: string;

  // Sent by older 2D clients alongside the annotation; accepted and ignored.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FEATURE_POINTS * 2)
  footprintCoords?: number[];
  @IsOptional() @IsObject() activeBlock?: Record<string, unknown> | null;
}
