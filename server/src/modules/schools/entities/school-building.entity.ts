import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from './school.entity';

export enum BuildingCondition {
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

export enum RoofCondition {
  GOOD = 'good',
  NEEDS_REPAIR = 'needs_repair',
  DAMAGED = 'damaged',
}

@Entity('school_buildings')
export class SchoolBuilding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, (school) => school.buildings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  buildingCode: string;

  @Column({ nullable: true })
  function: string;

  @Column({ type: 'int', nullable: true })
  floors: number;

  @Column({ type: 'int', nullable: true })
  rooms: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  areaSquareMeters: number;

  @Column({ type: 'int', nullable: true })
  yearBuilt: number;

  @Column({
    type: 'enum',
    enum: BuildingCondition,
    default: BuildingCondition.FAIR,
  })
  condition: BuildingCondition;

  @Column({ type: 'enum', enum: RoofCondition, default: RoofCondition.GOOD })
  roofCondition: RoofCondition;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  structuralScore: number;

  @Column({ type: 'jsonb', nullable: true })
  footprintGeojson: object;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  centroidLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  centroidLng: number;

  @Column({ nullable: true })
  lastInspectionDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  modelPath: string;

  @Column({ nullable: true })
  modelName: string;

  @Column({ type: 'jsonb', nullable: true })
  modelMetadata: {
    location?: { lat: number; lng: number; alt: number };
    orientation?: { heading: number; tilt: number; roll: number };
    scale?: { x: number; y: number; z: number };
    altitudeMode?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
