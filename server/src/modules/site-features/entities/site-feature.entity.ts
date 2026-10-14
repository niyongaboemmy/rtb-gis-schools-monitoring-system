import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

export const SITE_FEATURE_KINDS = [
  'measure_distance',
  'measure_area',
  'measure_perimeter',
  'measure_height',
  'note',
  'pin',
] as const;
export type SiteFeatureKind = (typeof SITE_FEATURE_KINDS)[number];

export const SITE_FEATURE_SOURCES = ['2d', '3d'] as const;
export type SiteFeatureSource = (typeof SITE_FEATURE_SOURCES)[number];

/** GeoJSON geometry in WGS84 ([lng, lat, alt?]). */
export interface SiteFeatureGeometry {
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface ModelCoord {
  x: number;
  y: number;
  z: number;
}

/**
 * A measurement, note or pin drawn on a school site in either viewer (WS5.2).
 * Both viewers read and write this one table, so whatever is drawn in 2D shows
 * in 3D and vice versa. `geometry` is always WGS84; 3D features also keep the
 * exact model-frame points they were picked at in `modelCoords`.
 */
@Entity('site_features')
@Index('IDX_site_features_school_created', ['schoolId', 'createdAt'])
export class SiteFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 32 })
  kind: SiteFeatureKind;

  @Column({ type: 'jsonb' })
  geometry: SiteFeatureGeometry;

  @Column({ type: 'jsonb', name: 'model_coords', nullable: true })
  modelCoords: ModelCoord[] | null;

  /** Metres (lengths, height) or m² (area). For area: the PLAN area. */
  @Column({ type: 'double precision', nullable: true })
  value: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  label: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  /** Small viewer-specific extras: icon, surfaceArea, perimeter, … */
  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 2 })
  source: SiteFeatureSource;

  /** Id the feature had before it moved here (legacy 2D annotation / 3D state). */
  @Index('IDX_site_features_legacy_id')
  @Column({ type: 'varchar', length: 100, name: 'legacy_id', nullable: true })
  legacyId: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'created_by_name',
    nullable: true,
  })
  createdByName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
