import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('population_data')
export class PopulationData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, (school) => school.populationData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column()
  schoolId: string;

  // Buffer zone data
  @Column({ type: 'int', nullable: true })
  population500m: number;

  @Column({ type: 'int', nullable: true })
  population1km: number;

  @Column({ type: 'int', nullable: true })
  population2km: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  schoolAgePopulation500m: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  schoolAgePopulation1km: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  schoolAgePopulation2km: number;

  // Density
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  populationDensityPerKm2: number;

  // Student-to-school ratio
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  studentToSchoolRatio: number;

  // ArcGIS source
  @Column({ nullable: true })
  arcgisObjectId: string;

  @Column({ nullable: true })
  dataSource: string;

  @Column({ nullable: true })
  dataYear: number;

  @Column({ type: 'jsonb', nullable: true })
  rawData: object;

  @Column({ nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
