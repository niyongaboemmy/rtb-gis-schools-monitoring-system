import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.password')
      .addSelect('user.location')
      .where('user.email = :email', { email })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    const { password: _, ...userWithoutPassword } = user as any;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.refreshToken')
      .addSelect('user.location')
      .where('user.id = :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Access denied');

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: '' });
    return { message: 'Logged out successfully' };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: ['role', 'role.accessLevel'],
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return user;
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    await this.userRepository.update(userId, { refreshToken });
  }
}
