import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AccessLevel } from '../../access-levels/entities/access-level.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'text', array: true, default: [] })
  permissions: string[];

  /**
   * Snapshot of the permissions the code granted this role at the last seed
   * run (WS7.3). The seed only ADDS permissions that are new in code since
   * this snapshot, so admin grants and admin removals both survive re-seeding.
   * NULL = never synced under the tracking scheme (legacy row or custom role).
   */
  @Column({ type: 'text', array: true, nullable: true })
  seededPermissions: string[] | null;

  @ManyToOne(() => AccessLevel, (al) => al.roles, {
    nullable: true,
    eager: true,
  })
  @JoinColumn()
  accessLevel: AccessLevel;

  @OneToMany(() => User, (user) => user.role)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
