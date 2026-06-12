import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'localhost'),
      port: Number(this.config.get('SMTP_PORT', '1025')),
      secure: false,
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const resetUrl = `${this.config.get('WEB_BASE_URL')}/reset-password?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM'),
        to: email,
        subject: 'Réinitialisation de votre mot de passe ScoreChallenge',
        text: `Pour réinitialiser votre mot de passe, ouvrez ce lien (valable 1 heure) : ${resetUrl}`,
      });
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de l'email de réinitialisation à ${email}`,
        error,
      );
    }
  }
}
