import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { AuditService, AuditActor } from '../audit/audit.service';

/** TDMP role names: trimmed, non-empty, unique (case-insensitive), ≤ 50. */
export function cleanTdmpRoleNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const name = v.trim().slice(0, 100);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.slice(0, 50);
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.roleRepository.find({
      relations: ['accessLevel'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['accessLevel'],
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async create(dto: {
    name: string;
    description?: string;
    permissions: string[];
    accessLevelId?: string;
    tdmpRoleNames?: unknown;
  }) {
    const existing = await this.roleRepository.findOne({
      where: { name: dto.name },
    });
    if (existing)
      throw new ConflictException(`Role with name ${dto.name} already exists`);

    const { accessLevelId, ...rest } = dto;
    const role = this.roleRepository.create({
      ...rest,
      tdmpRoleNames: cleanTdmpRoleNames(rest.tdmpRoleNames),
      ...(accessLevelId ? { accessLevel: { id: accessLevelId } as any } : {}),
    });
    await this.roleRepository.save(role);
    return this.findOne(role.id);
  }

  async update(id: string, dto: any, actor?: AuditActor) {
    const role = await this.findOne(id);

    const { accessLevelId, ...rest } = dto;
    if (rest.tdmpRoleNames !== undefined)
      rest.tdmpRoleNames = cleanTdmpRoleNames(rest.tdmpRoleNames);

    // Set relation via entity reference (TypeORM resolves the FK)
    if (accessLevelId !== undefined) {
      (role as any).accessLevel = accessLevelId ? { id: accessLevelId } : null;
    }

    Object.assign(role, rest);
    await this.roleRepository.save(role);

    this.auditService.log(actor ?? null, 'role.update', 'role', id, {
      name: role.name,
      changes: rest,
    });

    // Re-fetch to get fully hydrated accessLevel object
    return this.findOne(id);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (
      role.name === 'super_admin' ||
      role.name === 'admin' ||
      role.name === 'viewer'
    ) {
      throw new ConflictException(
        `Cannot delete system default role: ${role.name}`,
      );
    }
    await this.roleRepository.remove(role);
    return { success: true };
  }
}
