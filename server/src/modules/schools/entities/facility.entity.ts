import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface FacilityItem {
  id: string;
  label: string;
  tags: string[];
  issueCategories?: string[]; // Predefined common issues for this item
}

export interface Facility {
  id: string;
  title: string;
  items: FacilityItem[];
}

@Entity('facilities')
export class FacilityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  facilityId: string;

  @Column()
  title: string;

  @Column({ type: 'jsonb' })
  items: FacilityItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
