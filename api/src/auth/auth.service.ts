import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
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
  private static readonly RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 h

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
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

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return; // pas d'énumération de comptes
    }
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + AuthService.RESET_TOKEN_TTL_MS),
      },
    });
    await this.mailService.sendPasswordReset(email, token);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Lien invalide ou expiré');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);
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
