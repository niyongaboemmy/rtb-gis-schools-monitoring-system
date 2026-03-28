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

  @Column({ nullable: true })
  kmzProcessedAt: Date;

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
