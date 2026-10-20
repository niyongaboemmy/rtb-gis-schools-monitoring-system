import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Request,
  Get,
  Delete,
  Param,
  ParseUUIDPipe,
  Res,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response } from 'express';
import {
  AuthService,
  type LoginResult,
  type SessionResult,
} from './auth.service';
import { SessionsService } from './sessions.service';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import {
  DisableMfaDto,
  MfaEnrollConfirmDto,
  MfaTokenDto,
  MfaVerifyDto,
  TotpCodeDto,
} from './dto/mfa.dto';
import { PrivacyAcceptDto } from './dto/privacy-accept.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CsrfHeaderGuard } from './guards/csrf-header.guard';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';
import { requestMeta } from './request-meta';

type AuthedRequest = ExpressRequest & { user: any };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary:
      'Login with email and password. Returns a session, or an mfaToken when a second factor is needed',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.login(loginDto, requestMeta(req)),
    );
  }

  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Sign in with Google (ID token or access token)' })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.loginWithGoogle(dto, requestMeta(req)),
    );
  }

  // ── Second factor during sign-in ──────────────────────────────────────────

  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'Finish sign-in with an authenticator, recovery or email code',
  })
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.verifyMfa(dto, requestMeta(req)),
    );
  }

  @Post('2fa/email')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: 'Email a sign-in code instead of using the authenticator',
  })
  sendMfaEmail(@Body() dto: MfaTokenDto, @Req() req: ExpressRequest) {
    return this.authService.sendMfaEmailCode(dto.mfaToken, requestMeta(req));
  }

  @Post('2fa/enroll/start')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'Mandatory 2FA: begin authenticator set-up during sign-in',
  })
  startEnrolment(@Body() dto: MfaTokenDto) {
    return this.authService.startMfaEnrolment(dto.mfaToken);
  }

  @Post('2fa/enroll/confirm')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Mandatory 2FA: confirm set-up and finish sign-in' })
  async confirmEnrolment(
    @Body() dto: MfaEnrollConfirmDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.authService.confirmMfaEnrolment(
        dto.mfaToken,
        dto.code,
        requestMeta(req),
      ),
    );
  }

  // ── Session cookie ────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(CsrfHeaderGuard)
  // Every tab restores its session through here on load.
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @ApiOperation({
    summary: 'Rotate the refresh cookie and issue a new access token',
  })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.refresh(
        this.readCookie(req),
        body ?? {},
        requestMeta(req),
      );
      return this.respond(res, result);
    } catch (err) {
      this.clearCookie(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(CsrfHeaderGuard)
  @ApiOperation({
    summary: 'Sign out this device (revokes its session and clears the cookie)',
  })
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(
      this.readCookie(req),
      requestMeta(req),
    );
    this.clearCookie(res);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req: AuthedRequest) {
    return this.authService.publicUser(req.user);
  }

  // ── Sessions (WS9.11) ─────────────────────────────────────────────────────

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your signed-in devices' })
  listSessions(@Request() req: AuthedRequest) {
    return this.authService.listSessions(req.user.id, req.user.sessionId);
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out every other device' })
  revokeOthers(@Request() req: AuthedRequest) {
    return this.authService.revokeOtherSessions(
      req.user,
      req.user.sessionId,
      requestMeta(req),
    );
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out one device' })
  revokeSession(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.authService.revokeSession(req.user, id, requestMeta(req));
  }

  // ── 2FA management from the profile ───────────────────────────────────────

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your two-factor status' })
  mfaStatus(@Request() req: AuthedRequest) {
    return this.authService.mfaStatus(req.user);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start authenticator set-up (QR code + key)' })
  setupMfa(@Request() req: AuthedRequest) {
    return this.authService.setupMfa(req.user.id);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm set-up with a code; returns recovery codes once',
  })
  enableMfa(@Request() req: AuthedRequest, @Body() dto: TotpCodeDto) {
    return this.authService.enableMfa(req.user, dto.code, requestMeta(req));
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn 2FA off (password + code)' })
  disableMfa(@Request() req: AuthedRequest, @Body() dto: DisableMfaDto) {
    return this.authService.disableMfa(
      req.user,
      dto.password,
      dto.code,
      requestMeta(req),
    );
  }

  @Post('2fa/recovery-codes')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replace your recovery codes (needs an authenticator code)',
  })
  regenerateRecoveryCodes(
    @Request() req: AuthedRequest,
    @Body() dto: TotpCodeDto,
  ) {
    return this.authService.regenerateRecoveryCodes(
      req.user,
      dto.code,
      requestMeta(req),
    );
  }

  // ── Google link (WS10.9) ──────────────────────────────────────────────────

  @Post('google/link')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link your Google account' })
  linkGoogle(@Request() req: AuthedRequest, @Body() dto: GoogleLoginDto) {
    return this.authService.linkGoogle(req.user, dto, requestMeta(req));
  }

  @Delete('google/link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink your Google account' })
  unlinkGoogle(@Request() req: AuthedRequest) {
    return this.authService.unlinkGoogle(req.user, requestMeta(req));
  }

  // ── Privacy notice (WS8.7) ────────────────────────────────────────────────

  @Post('privacy/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record acceptance of the current privacy notice' })
  acceptPrivacy(@Request() req: AuthedRequest, @Body() dto: PrivacyAcceptDto) {
    return this.authService.acceptPrivacy(
      req.user,
      dto.version,
      requestMeta(req),
    );
  }

  // ── Forgot / reset ────────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(200)
  // Deliberately tight: this endpoint sends mail and is a spam/enumeration vector.
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Email a 6-digit password-reset code' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: ExpressRequest) {
    return this.authService.forgotPassword(dto.email, requestMeta(req));
  }

  @Post('verify-otp')
  @HttpCode(200)
  // Guessing budget is enforced per-code in the service; this only caps volume.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Check a reset code without consuming it' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyResetOtp(dto.email, dto.otp);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Set a new password using an emailed code' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: ExpressRequest) {
    return this.authService.resetPassword(
      dto.email,
      dto.otp,
      dto.password,
      requestMeta(req),
    );
  }

  // ── Cookie helpers ────────────────────────────────────────────────────────

  /** Moves a session's refresh token into the httpOnly cookie. */
  private respond<
    T extends LoginResult | (SessionResult & Record<string, unknown>),
  >(res: Response, result: T) {
    if ('refreshToken' in result && result.refreshToken) {
      const { refreshToken, sessionId: _sid, ...body } = result;
      res.cookie(REFRESH_COOKIE, refreshToken, {
        httpOnly: true,
        secure: this.secureCookies,
        sameSite: 'strict',
        path: REFRESH_COOKIE_PATH,
        maxAge: this.sessionsService.refreshTtlMs,
      });
      return body;
    }
    return result;
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });
  }

  private readCookie(req: ExpressRequest): string | undefined {
    const value = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    return typeof value === 'string' && value ? value : undefined;
  }

  /** COOKIE_SECURE overrides; otherwise Secure in production only. */
  private get secureCookies(): boolean {
    const raw = this.configService
      .get<string>('COOKIE_SECURE')
      ?.trim()
      .toLowerCase();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
