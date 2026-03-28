import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLevel } from './entities/access-level.entity';

@Injectable()
export class AccessLevelsService {
  constructor(
    @InjectRepository(AccessLevel)
    private readonly repo: Repository<AccessLevel>,
  ) {}

  findAll(): Promise<AccessLevel[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<AccessLevel> {
    const level = await this.repo.findOne({ where: { id } });
    if (!level) throw new NotFoundException(`Access level ${id} not found`);
    return level;
  }

  async create(dto: { name: string }): Promise<AccessLevel> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing)
      throw new ConflictException(`Access level "${dto.name}" already exists`);
    const level = this.repo.create(dto);
    return this.repo.save(level);
  }

  async update(id: string, dto: { name: string }): Promise<AccessLevel> {
    const level = await this.findOne(id);
    Object.assign(level, dto);
    return this.repo.save(level);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const level = await this.findOne(id);
    await this.repo.remove(level);
    return { success: true };
  }
}
