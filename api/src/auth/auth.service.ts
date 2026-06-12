import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OwnerJwtPayload } from './jwt-payload.interface';

const BCRYPT_ROUNDS = 10;
const OWNER_TOKEN_TTL = '7d';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });
    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return this.buildAuthResult(user);
  }

  private buildAuthResult(user: {
    id: string;
    email: string;
    name: string;
  }): AuthResult {
    const payload: OwnerJwtPayload = { sub: user.id, role: 'owner' };
    return {
      token: this.jwtService.sign(payload, { expiresIn: OWNER_TOKEN_TTL }),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
