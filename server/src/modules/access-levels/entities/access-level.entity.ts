import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';

@Entity('access_levels')
export class AccessLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  /**
   * Stable machine key — one of national|province|district|sector|school.
   * `name` stays free to edit; `slug` is what code branches on.
   */
  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

  /**
   * Hierarchy rank: 10 national … 50 school. Lower = broader geographic reach.
   * Custom levels default to 100 (treated as unscoped until configured).
   */
  @Column({ type: 'smallint', default: 100 })
  rank: number;

  @OneToMany(() => Role, (role) => role.accessLevel)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
