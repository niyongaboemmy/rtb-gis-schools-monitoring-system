import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { School } from './school.entity';

export enum BoundaryType {
  CAMPUS = 'campus',
  BUILDING_FOOTPRINT = 'building_footprint',
  SPORTS_FIELD = 'sports_field',
  PARKING = 'parking',
  GREEN_AREA = 'green_area',
  OTHER = 'other',
}

@Entity('school_boundaries')
export class SchoolBoundary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, (school) => school.boundaries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column()
  schoolId: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'enum', enum: BoundaryType, default: BoundaryType.CAMPUS })
  boundaryType: BoundaryType;

  @Column({ type: 'jsonb' })
  geojson: object;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  areaSquareMeters: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  centroidLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  centroidLng: number;

  @Column({ nullable: true })
  sourceFile: string;

  @Column({ nullable: true })
  kmlPlacemarkId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  properties: object;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
