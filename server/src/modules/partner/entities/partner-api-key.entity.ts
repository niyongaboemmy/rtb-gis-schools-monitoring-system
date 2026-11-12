import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** What a partner key may do. */
export const PARTNER_SCOPES = [
  'schools:read',
  'coordinates:read',
  'embed:create',
] as const;
export type PartnerScope = (typeof PARTNER_SCOPES)[number];

/**
 * A key another platform (TDMP) uses to call the RTB GIS partner API:
 * school list, coordinates, signed embed links. Only a SHA-256 of the key is
 * stored; the key itself is shown once, when it is created.
 *
 * Each key owns a read-only service account (`serviceUserId`) that embed
 * sessions run as. Revoking the key deactivates that account, which ends
 * every embed session made with the key at once.
 */
@Entity('partner_api_keys')
export class PartnerApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Label, e.g. "TDMP production". */
  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Partner platform, e.g. "TDMP". */
  @Column({ type: 'varchar', length: 60 })
  partner: string;

  /** First characters of the key, to recognise it in lists and logs. */
  @Column({ type: 'varchar', length: 24 })
  keyPrefix: string;

  @Index('IDX_partner_api_keys_keyHash', { unique: true })
  @Column({ type: 'varchar', length: 64, select: false })
  keyHash: string;

  @Column({ type: 'text', array: true })
  scopes: PartnerScope[];

  /**
   * Sites allowed to show RTB GIS views in an iframe with this key's embed
   * links (origins, e.g. https://tdmp.rtb.gov.rw). Shown back to the partner
   * and used for the frame-ancestors guidance.
   */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  allowedOrigins: string[];

  @Column({ type: 'uuid' })
  serviceUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  revokedBy: string | null;
}
