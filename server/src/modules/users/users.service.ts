import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll() {
    return this.userRepository.find({ select: ['id', 'firstName', 'lastName', 'email', 'role', 'isActive', 'createdAt', 'lastLoginAt'] });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: { firstName: string; lastName: string; email: string; password: string; roleId?: string }) {
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

  async update(id: string, dto: Partial<User> & { roleId?: string }) {
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
}
