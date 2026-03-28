import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll() {
    return this.userRepository.find({
      select: ['id', 'firstName', 'lastName', 'email', 'role', 'location', 'isActive', 'createdAt', 'lastLoginAt'],
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleId?: string;
    location?: Record<string, string>;
  }) {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`User with email ${dto.email} already exists`);
    const userData: any = { ...dto };
    if (dto.roleId) {
      userData.role = { id: dto.roleId };
      delete userData.roleId;
    }
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async update(id: string, dto: Partial<User> & { roleId?: string; location?: Record<string, string> }) {
    const user = await this.findOne(id);
    const updateData: any = { ...dto };
    if (updateData.roleId) {
       updateData.role = { id: updateData.roleId };
       delete updateData.roleId;
    }
    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }

  async changePassword(id: string, currentPass: string, newPass: string) {
    const user = await this.userRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
      
    if (!user) throw new NotFoundException('User not found');
    
    const isMatch = await bcrypt.compare(currentPass, user.password);
    if (!isMatch) throw new ConflictException('Invalid current password');
    
    user.password = newPass; 
    await this.userRepository.save(user);
    return { success: true, message: 'Password updated successfully' };
  }

  async deactivate(id: string) {
    await this.userRepository.update(id, { isActive: false });
    return { message: 'User deactivated' };
  }

  async bulkCreate(rows: any[]) {
    const results = { created: 0, skipped: 0, errors: [] as { row: number; email: string; reason: string }[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header
      const { firstName, lastName, email, password, roleName, province, district, sector, schoolId } = row;

      // Basic validation
      if (!firstName || !lastName || !email || !password) {
        results.errors.push({ row: rowNum, email: email || '(empty)', reason: 'Missing required fields: firstName, lastName, email, password' });
        continue;
      }

      // Check duplicate
      const existing = await this.userRepository.findOne({ where: { email: email.toString().trim() } });
      if (existing) {
        results.skipped++;
        results.errors.push({ row: rowNum, email, reason: 'Email already exists — skipped' });
        continue;
      }

      try {
        const userData: any = {
          firstName: firstName.toString().trim(),
          lastName: lastName.toString().trim(),
          email: email.toString().trim().toLowerCase(),
          password: password.toString(),
        };

        // Resolve role by name
        if (roleName) {
          const role = await this.roleRepository.findOne({ where: { name: roleName.toString().trim() } });
          if (role) userData.role = { id: role.id };
        }

        // Build location from columns
        const location: any = {};
        if (province) location.province = province.toString().trim();
        if (district) location.district = district.toString().trim();
        if (sector)   location.sector   = sector.toString().trim();
        if (schoolId) location.schoolId = schoolId.toString().trim();
        if (Object.keys(location).length > 0) userData.location = location;

        const user = this.userRepository.create(userData);
        await this.userRepository.save(user);
        results.created++;
      } catch (err: any) {
        results.errors.push({ row: rowNum, email, reason: err.message || 'Unknown error' });
      }
    }

    return results;
  }
}
