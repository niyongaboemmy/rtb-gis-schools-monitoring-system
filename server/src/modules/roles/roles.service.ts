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
    return this.roleRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async create(dto: { name: string; description?: string; permissions: string[] }) {
    const existing = await this.roleRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role with name ${dto.name} already exists`);
    const role = this.roleRepository.create(dto);
    return this.roleRepository.save(role);
  }

  async update(id: string, dto: Partial<Role>) {
    const role = await this.findOne(id);
    Object.assign(role, dto);
    return this.roleRepository.save(role);
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
