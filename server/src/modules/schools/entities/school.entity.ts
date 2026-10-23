import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SchoolBuilding } from './school-building.entity';
import { SchoolBoundary } from './school-boundary.entity';
import { PopulationData } from '../../population/entities/population-data.entity';
import { DecisionAssessment } from '../../analytics/entities/decision-assessment.entity';

export enum SchoolType {
  TSS = 'TSS',
  VTC = 'VTC',
  INTEGRATED = 'INTEGRATED',
}

export enum SchoolStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNDER_RENOVATION = 'under_renovation',
}

export enum PriorityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum KmzProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** Detail measurement of a school's 3D model (see glb-tools/quality.mjs). */
/** Extra builds of the served model, picked by the viewer per device. */
export interface ModelVariants {
  /** KTX2 / UASTC textures: ≈ 4× less GPU memory, larger download. */
  ktx2?: {
    url: string;
    objectName: string;
    bytes: number;
    /** GPU texture memory once transcoded, and as WebP for comparison. */
    gpuBytes: number;
    webpGpuBytes: number;
    builtAt: string;
  } | null;
}

export interface ModelQuality {
  /** The model as served to the viewer. */
  served?: ModelQualityMeasure | null;
  /** The file as the surveyor delivered it (before our processing). */
  source?: ModelQualityMeasure | null;
  profile?: 'standard' | 'low-memory' | 'measured';
  textures?: Array<{
    action?: string;
    mime?: string;
    width?: number;
    height?: number;
  }>;
  measuredAt?: string;
}

export interface ModelQualityMeasure {
  triangles?: number;
  surfaceM2?: number;
  cmPerPixel?: {
    horizontal?: { median: number | null; p90: number | null };
    vertical?: { median: number | null; p90: number | null };
    overall?: { median: number | null; p90: number | null };
  };
  textures?: Array<{
    mime?: string;
    width?: number;
    height?: number;
    used?: number | null;
  }>;
  score?: 'sharp' | 'fair' | 'low' | 'unknown';
  precompressed?: boolean;
  warnings?: string[];
}

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: SchoolType, default: SchoolType.TSS })
  type: SchoolType;

  @Column({ type: 'enum', enum: SchoolStatus, default: SchoolStatus.ACTIVE })
  status: SchoolStatus;

  @Column()
  province: string;

  @Column()
  district: string;

  @Column()
  sector: string;

  @Column({ nullable: true })
  cell: string;

  @Column({ nullable: true })
  village: string;

  @Column({ type: 'int', nullable: true })
  establishedYear: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  /** Where latitude / longitude came from (see school-location.rules.ts). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  locationSource: 'manual' | 'kmz' | 'glb' | 'seed' | null;

  @Column({ type: 'timestamptz', nullable: true })
  locationUpdatedAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  elevation: number;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  headTeacher: string;

  // Computed from educationPrograms
  @Column({ type: 'int', nullable: true })
  totalStudents: number;

  @Column({ type: 'int', nullable: true })
  maleStudents: number;

  @Column({ type: 'int', nullable: true })
  femaleStudents: number;

  // Admin Staff with gender breakdown
  @Column({ type: 'int', nullable: true })
  maleAdminStaff: number;

  @Column({ type: 'int', nullable: true })
  femaleAdminStaff: number;

  // Support Staff with gender breakdown
  @Column({ type: 'int', nullable: true })
  maleSupportStaff: number;

  @Column({ type: 'int', nullable: true })
  femaleSupportStaff: number;

  @Column({ type: 'int', nullable: true })
  totalTeachers: number;

  // Staff
  @Column({ type: 'int', nullable: true })
  maleTeachers: number;

  @Column({ type: 'int', nullable: true })
  femaleTeachers: number;

  @Column({ type: 'int', nullable: true })
  adminStaff: number;

  @Column({ type: 'int', nullable: true })
  supportStaff: number;

  // Roads
  @Column({ type: 'int', nullable: true })
  numberOfAccessRoads: number;

  @Column({ nullable: true })
  roadState: string;

  @Column({ type: 'int', nullable: true })
  roadStatusPercentage: number;

  // Land
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  usedLandArea: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unusedLandArea: number;

  // trades (TVET Trades)
  @Column({ type: 'jsonb', nullable: true })
  educationPrograms: {
    code: string;
    name: string;
    totalStudents: number;
    capacity: number;
  }[];

  @Column({ type: 'enum', enum: PriorityLevel, nullable: true })
  priorityLevel: PriorityLevel;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  overallScore: number;

  @Column({
    type: 'enum',
    enum: KmzProcessingStatus,
    default: KmzProcessingStatus.PENDING,
  })
  kmzStatus: KmzProcessingStatus;

  @Column({ nullable: true })
  kmzFilePath: string;

  @Column({ nullable: true })
  kmzMasterKmlPath: string;

  // 2D-specific KMZ/KML for OpenLayers viewer
  @Column({ nullable: true })
  kmz2dFilePath: string;

  // GeoTIFF raster overlay for the 2D viewer (School2DViewer reads this back)
  @Column({ nullable: true })
  tifFilePath: string;

  // Pre-processed manifest for the 2D viewer (extracted at upload time)
  @Column({ type: 'jsonb', nullable: true })
  kmz2dManifest: {
    kmlUrls: string[];
    groundOverlays: {
      imageUrl: string;
      north: number;
      south: number;
      east: number;
      west: number;
      drawOrder: number;
      name?: string;
    }[];
    initialView?: {
      latitude: number;
      longitude: number;
      altitude?: number;
      heading?: number;
      range?: number;
    } | null;
  } | null;

  @Column({ nullable: true })
  kmzProcessedAt: Date;

  // --- 3D model (GLB) optimization telemetry -------------------------------
  // Whether the served GLB has been through the server-side optimizer
  // (mesh-simplify + Meshopt + WebP). null = not yet attempted.
  @Column({ type: 'boolean', nullable: true })
  modelOptimized: boolean | null;

  // Size in bytes of the currently-served GLB (optimized build when
  // modelOptimized is true, otherwise the raw upload).
  @Column({ type: 'bigint', nullable: true })
  modelBytes: number | null;

  // Last optimizer failure reason (OOM, timeout, glb-tools unavailable, …).
  // Cleared to null on a successful optimize.
  @Column({ type: 'text', nullable: true })
  modelOptimizeError: string | null;

  // Explicit type: a `Date | null` union erases to `Object` under
  // reflect-metadata, which TypeORM cannot map to a Postgres column.
  @Column({ type: 'timestamp', nullable: true })
  modelOptimizedAt: Date | null;

  // --- 3D model scale check + georeference (WS6.4 / WS5.3) ------------------
  // Multiply 3D measurements by this (1 = verified against the KMZ footprint;
  // null = not checked or could not be judged). Written by processGlbJob.
  @Column({ type: 'double precision', nullable: true })
  modelScaleFactor: number | null;

  // Shown by the 3D viewer as a non-blocking banner when set.
  @Column({ type: 'text', nullable: true })
  modelScaleWarning: string | null;

  /**
   * Detail measurement of the 3D model (glb-tools/quality.mjs): centimetres
   * of real surface per texture pixel for the served model and for the file
   * as delivered, the processing profile used, and plain-word warnings.
   */
  @Column({ type: 'jsonb', nullable: true })
  modelQuality: ModelQuality | null;

  /** GPU-compressed build(s) of the served model (Phase 3, glb-ktx2.ts). */
  @Column({ type: 'jsonb', nullable: true })
  modelVariants: ModelVariants | null;

  // Origin of the model's local ENU frame (+X East, +Y Up, −Z North). Set when
  // the optimizer reprojected geographic vertices; null for plain models.
  @Column({ type: 'double precision', nullable: true })
  modelOriginLat: number | null;

  @Column({ type: 'double precision', nullable: true })
  modelOriginLng: number | null;

  @Column({ type: 'double precision', nullable: true })
  modelOriginAlt: number | null;

  // Site-wide annotations for 2D map (measurements, labels)
  @Column({ type: 'jsonb', nullable: true })
  siteAnnotations: {
    id: string;
    type: 'point' | 'line' | 'polygon';
    label?: string;
    description?: string;
    coordinates: number[];
    style?: any;
    createdAt: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  geojsonContent: object;

  @Column({ nullable: true })
  thumbnailUrl: string;

  // Places overlay for displaying additional POIs on the map
  @Column({ nullable: true })
  placesOverlayFilePath: string;

  @Column({ type: 'jsonb', nullable: true })
  placesOverlayData: object;

  // School facilities with tags
  @Column({ type: 'jsonb', nullable: true })
  facilities: {
    id: string;
    title: string;
    items: {
      id: string;
      label: string;
      tags: string[];
    }[];
  }[];

  @Column({ type: 'text', nullable: true })
  description: string;

  // 3D GLB viewer — saved camera home position
  @Column({ type: 'jsonb', nullable: true })
  glb3dHomePosition: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };

  // 3D GLB viewer — user-created annotations
  @Column({ type: 'jsonb', nullable: true })
  glb3dAnnotations: {
    id: string;
    label: string;
    color: string;
    position: { x: number; y: number; z: number };
    createdAt: string;
  }[];

  @OneToMany(() => SchoolBuilding, (building) => building.school, {
    cascade: true,
  })
  buildings: SchoolBuilding[];

  @OneToMany(() => SchoolBoundary, (boundary) => boundary.school, {
    cascade: true,
  })
  boundaries: SchoolBoundary[];

  @OneToMany(() => PopulationData, (pop) => pop.school)
  populationData: PopulationData[];

  @OneToMany(() => DecisionAssessment, (da) => da.school)
  assessments: DecisionAssessment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
