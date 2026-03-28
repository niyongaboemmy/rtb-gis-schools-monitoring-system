import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
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

  async create(dto: { name: string; description?: string; permissions: string[]; accessLevelId?: string }) {
    const existing = await this.roleRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role with name ${dto.name} already exists`);

    const { accessLevelId, ...rest } = dto;
    const role = this.roleRepository.create({
      ...rest,
      ...(accessLevelId ? { accessLevel: { id: accessLevelId } as any } : {}),
    });
    await this.roleRepository.save(role);
    return this.findOne(role.id);
  }

  async update(id: string, dto: any) {
    const role = await this.findOne(id);

    const { accessLevelId, ...rest } = dto;

    // Set relation via entity reference (TypeORM resolves the FK)
    if (accessLevelId !== undefined) {
      (role as any).accessLevel = accessLevelId ? { id: accessLevelId } : null;
    }

    Object.assign(role, rest);
    await this.roleRepository.save(role);

    // Re-fetch to get fully hydrated accessLevel object
    return this.findOne(id);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.name === 'super_admin' || role.name === 'admin' || role.name === 'viewer') {
      throw new ConflictException(`Cannot delete system default role: ${role.name}`);
    }
    await this.roleRepository.remove(role);
    return { success: true };
  }
}

