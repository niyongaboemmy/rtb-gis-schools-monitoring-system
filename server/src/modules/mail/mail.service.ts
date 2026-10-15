import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Reads an env var, treating blank/whitespace as unset. ConfigService's own
   * default only applies when the key is absent, but the shipped .env declares
   * every SMTP key empty — so `get('SMTP_PORT', 587)` would return `''`.
   */
  private env(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.configService.get<string>(key)?.trim();
      if (value) return value;
    }
    return undefined;
  }

  onModuleInit() {
    const host = this.env('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST not set — emails will be logged to the console instead of sent.',
      );
      return;
    }

    const port = Number(this.env('SMTP_PORT') ?? 587);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      this.logger.error(
        `Invalid SMTP_PORT "${this.env('SMTP_PORT')}" — falling back to console logging.`,
      );
      return;
    }

    // SMTP_PASSWORD / SMTP_PASS and SMTP_FROM / EMAIL_FROM are both accepted —
    // deployments in the wild use either spelling.
    const user = this.env('SMTP_USER');
    const pass = this.env('SMTP_PASSWORD', 'SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // Implicit TLS on 465; STARTTLS is negotiated on everything else.
      secure: this.env('SMTP_SECURE') === 'true' || port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(`Mail transport ready: ${host}:${port}`);

    // Handshake + auth up front so bad credentials surface at boot rather than
    // on the first user-facing password reset.
    this.transporter
      .verify()
      .then(() => this.logger.log(`SMTP credentials verified for ${host}`))
      .catch((err: unknown) =>
        this.logger.error(
          `SMTP verification FAILED for ${host}:${port} — password reset emails will not send. ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
  }

  /** True when a real SMTP transport is configured (vs. console logging). */
  get isConfigured() {
    return this.transporter !== null;
  }

  /**
   * Sends an email, or logs it when SMTP is unconfigured.
   *
   * Throws on delivery failure: callers report "code sent" to the user, so a
   * silent failure would be a lie. The caller decides how to surface it.
   */
  async send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[DEV MAIL] To: ${options.to}\nSubject: ${options.subject}\n${options.text}`,
      );
      return;
    }

    try {
      const info = (await this.transporter.sendMail({
        from:
          this.env('SMTP_FROM', 'EMAIL_FROM') ??
          '"RTB GIS" <no-reply@rtb.gov.rw>',
        ...options,
      })) as { messageId?: string; rejected?: string[] };

      if (info.rejected?.length) {
        throw new Error(
          `Recipient rejected by server: ${info.rejected.join(', ')}`,
        );
      }
      this.logger.log(
        `Sent "${options.subject}" to ${options.to} (${info.messageId ?? 'no id'})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send "${options.subject}" to ${options.to}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  async sendPasswordResetOtp(
    to: string,
    name: string,
    otp: string,
    expiresInMinutes: number,
    options: { requestedByAdmin?: boolean; resetUrl?: string } = {},
  ) {
    await this.sendCode({
      to,
      name,
      code: otp,
      expiresInMinutes,
      subject: `${otp} is your RTB GIS verification code`,
      heading: 'Verification code',
      purpose: options.requestedByAdmin
        ? 'An administrator asked us to send you a code to set a new RTB GIS password.'
        : 'Use the code below to reset your RTB GIS password.',
      footer:
        'If you did not request a reset, you can safely ignore this email — your password will not change.',
      linkUrl: options.resetUrl,
      linkLabel: 'Open the reset page',
    });
  }

  /** Email second factor (WS10.8). */
  async sendLoginCode(
    to: string,
    name: string,
    code: string,
    expiresInMinutes: number,
  ) {
    await this.sendCode({
      to,
      name,
      code,
      expiresInMinutes,
      subject: `${code} is your RTB GIS sign-in code`,
      heading: 'Sign-in code',
      purpose: 'Use the code below to finish signing in to RTB GIS.',
      footer:
        'If you were not signing in, someone may know your password — change it now and tell an administrator.',
    });
  }

  /**
   * Short security notice ("your password was changed", "2FA turned off" …).
   * Throws like `send`; callers that must not fail wrap it (fail soft).
   */
  async sendSecurityNotice(
    to: string,
    name: string,
    subject: string,
    lines: string[],
  ) {
    const text =
      `Hello ${name},\n\n${lines.join('\n\n')}\n\n` +
      `If this was not you, reset your password immediately and contact an RTB administrator.`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
        <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">${escapeHtml(subject)}</h1>
        <p style="color:#64748b;font-size:13px;margin:0 0 24px">RTB GIS Schools Monitoring System</p>
        <p style="font-size:15px;line-height:1.6">Hello ${escapeHtml(name)},</p>
        ${lines.map((l) => `<p style="font-size:15px;line-height:1.6">${escapeHtml(l)}</p>`).join('')}
        <p style="font-size:13px;color:#b91c1c;line-height:1.6;margin-top:24px">
          If this was not you, reset your password immediately and contact an RTB administrator.
        </p>
      </div>
    `;
    await this.send({ to, subject: `RTB GIS: ${subject}`, html, text });
  }

  private async sendCode(o: {
    to: string;
    name: string;
    code: string;
    expiresInMinutes: number;
    subject: string;
    heading: string;
    purpose: string;
    footer: string;
    linkUrl?: string;
    linkLabel?: string;
  }) {
    const text =
      `Hello ${o.name},\n\n` +
      `${o.purpose}\n\n` +
      `${o.code}\n\n` +
      (o.linkUrl ? `${o.linkLabel}: ${o.linkUrl}\n\n` : '') +
      `The code expires in ${o.expiresInMinutes} minutes and can only be used once.\n\n` +
      `${o.footer} Never share this code with anyone.`;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
        <h1 style="font-size:20px;font-weight:800;margin:0 0 4px">${escapeHtml(o.heading)}</h1>
        <p style="color:#64748b;font-size:13px;margin:0 0 24px">RTB GIS Schools Monitoring System</p>
        <p style="font-size:15px;line-height:1.6">Hello ${escapeHtml(o.name)},</p>
        <p style="font-size:15px;line-height:1.6">${escapeHtml(o.purpose)}</p>
        <div style="margin:28px 0;padding:20px;background:#f1f5f9;border-radius:12px;text-align:center">
          <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#1d4ed8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">
            ${escapeHtml(o.code)}
          </div>
        </div>
        ${
          o.linkUrl
            ? `<p style="text-align:center;margin:0 0 24px"><a href="${escapeHtml(o.linkUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700;font-size:14px">${escapeHtml(o.linkLabel ?? 'Open')}</a></p>`
            : ''
        }
        <p style="font-size:13px;color:#64748b;line-height:1.6">
          This code expires in <strong>${o.expiresInMinutes} minutes</strong> and can only be used once.
          ${escapeHtml(o.footer)}
        </p>
        <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:24px">
          RTB staff will never ask you for this code. Never share it with anyone.
        </p>
      </div>
    `;

    await this.send({ to: o.to, subject: o.subject, html, text });
  }
}

/** Names come from user input; never interpolate them into HTML raw. */
function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
