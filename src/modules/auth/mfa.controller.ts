import {
  Controller,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
  Res,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@guards/jwt-auth.guard';
import { MfaService } from './mfa.service';
import {
  MfaSetupInitDto,
  MfaSetupVerifyDto,
  MfaDisableDto,
  MfaType,
  MfaChallengeDto,
  MfaSendChallengeDto,
  PasskeyRegistrationVerifyDto,
  PasskeyAuthVerifyDto,
} from './dto/mfa.dto';
import { CurrentUser, type CurrentUserPayload } from '@app/common';
import { Public } from '../../decorators/public.decorator';

@ApiTags('MFA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/mfa')
export class MfaController {
  private readonly logger = new Logger(MfaController.name);
  constructor(
    private readonly mfaService: MfaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('setup/init')
  @ApiOperation({ summary: 'Initialize MFA setup (e.g. get TOTP QR code)' })
  @ApiResponse({ status: 201, description: 'Returns secret/QR key for TOTP' })
  async initSetup(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: MfaSetupInitDto,
  ) {
    this.logger.log(
      `Hit endpoint: initSetup user=${user._id} body=${JSON.stringify(body)}`,
    );
    if (body.type === MfaType.TOTP) {
      return this.mfaService.generateTotpSecret(user.email);
    }
    return this.mfaService.initiateSetup(user._id.toString(), body.type);
  }

  @Post('setup/verify')
  @ApiOperation({ summary: 'Verify code and enable MFA method' })
  @ApiResponse({ status: 201, description: 'MFA Enabled' })
  async verifySetup(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: MfaSetupVerifyDto,
  ) {
    this.logger.log(
      `Hit endpoint: verifySetup user=${user._id} body=${JSON.stringify(body)}`,
    );
    let context: any = {};

    if (body.type === MfaType.TOTP) {
      if (!body.secret)
        throw new UnauthorizedException(
          'Secret required for TOTP verification',
        );

      const isValid = await this.mfaService.verifyTotp(body.code, body.secret);
      if (!isValid) throw new UnauthorizedException('Invalid TOTP code');

      context.secret = body.secret;
    } else {
      await this.mfaService.verifySetupCode(
        user._id.toString(),
        body.type,
        body.code,
      );
    }

    const result = await this.mfaService.enableMfaMethod(
      user._id.toString(),
      body.type,
      context,
    );
    return {
      message: 'MFA Method Enabled',
      backupCodes: result.backupCodes,
    };
  }

  @Post('disable')
  @ApiOperation({ summary: 'Disable an MFA method' })
  async disableMethod(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: MfaDisableDto,
  ) {
    this.logger.log(
      `Hit endpoint: disableMethod user=${user._id} type=${body.type}`,
    );
    await this.mfaService.disableMfaMethod(user._id.toString(), body.type);
    return { message: 'MFA Method Disabled' };
  }

  @Post('challenge')
  @ApiOperation({
    summary: 'Verify MFA challenge during login and return tokens',
  })
  async challenge(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: MfaChallengeDto,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    this.logger.log(
      `Hit endpoint: challenge user=${user._id} body=${JSON.stringify(body)}`,
    );
    const isValid = await this.mfaService.verifyMfaWait(
      user._id.toString(),
      body.type,
      body.code,
    );
    // if (!isValid) throw new UnauthorizedException('Invalid MFA code'); // Handled in service

    const result = await this.mfaService.finalizeMfaLogin(user._id.toString());

    this.setRefreshTokenCookie(response, result.refresh_token);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('challenge/send')
  @ApiOperation({
    summary: 'Trigger sending of MFA code (Email/SMS) during login',
  })
  async sendChallengeCode(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: MfaSendChallengeDto,
  ) {
    this.logger.log(
      `Hit endpoint: sendChallengeCode user=${user._id} type=${body.type}`,
    );
    return this.mfaService.sendLoginChallengeCode(
      user._id.toString(),
      body.type,
    );
  }

  @Post('challenge/passkey/init')
  @ApiOperation({ summary: 'Initialize Passkey MFA Challenge (Authenticated)' })
  async initPasskeyChallenge(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: initPasskeyChallenge user=${user._id}`);
    return this.mfaService.generatePasskeyAuthenticationOptions(
      user._id.toString(),
    );
  }

  @Post('challenge/passkey/verify')
  @ApiOperation({ summary: 'Verify Passkey MFA Challenge (Authenticated)' })
  async verifyPasskeyChallenge(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: PasskeyAuthVerifyDto,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    this.logger.log(
      `Hit endpoint: verifyPasskeyChallenge user=${user._id} body=${JSON.stringify(
        body,
      )}`,
    );

    const result = await this.mfaService.verifyPasskeyAuthentication(
      user._id.toString(),
      body,
    );

    this.setRefreshTokenCookie(response, result.refresh_token);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('passkey/register/init')
  @ApiOperation({ summary: 'Initialize Passkey registration (Authenticated)' })
  async passkeyRegisterInit(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: passkeyRegisterInit user=${user._id}`);
    return this.mfaService.generatePasskeyRegistrationOptions(
      user._id.toString(),
    );
  }

  @Post('passkey/register/verify')
  @ApiOperation({ summary: 'Verify Passkey registration (Authenticated)' })
  async passkeyRegisterVerify(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: PasskeyRegistrationVerifyDto,
  ) {
    this.logger.log(
      `Hit endpoint: passkeyRegisterVerify user=${user._id} body=${JSON.stringify(body)}`,
    );
    return this.mfaService.verifyPasskeyRegistration(user._id.toString(), body);
  }

  @Public()
  @Post('passkey/login/init')
  @ApiOperation({ summary: 'Initialize Passkey Login (Public)' })
  async passkeyLoginInit(@Body() body: { email: string }) {
    this.logger.log(`Hit endpoint: passkeyLoginInit email=${body.email}`);
    if (!body.email) throw new UnauthorizedException('Email required');
    return this.mfaService.generatePasskeyAuthOptionsByEmail(body.email);
  }

  @Public()
  @Post('passkey/login/verify')
  @ApiOperation({ summary: 'Verify Passkey Login (Public)' })
  async passkeyLoginVerify(
    @Body() body: PasskeyAuthVerifyDto & { email: string },
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    this.logger.log(
      `Hit endpoint: passkeyLoginVerify email=${body.email} body=${JSON.stringify(body)}`,
    );
    if (!body.email) throw new UnauthorizedException('Email required');

    const result = await this.mfaService.verifyPasskeyAuthenticationByEmail(
      body.email,
      body,
    );

    this.setRefreshTokenCookie(response, result.refresh_token);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  private setRefreshTokenCookie(response: FastifyReply, token: string) {
    const maxAgeStr =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    const days = parseInt(maxAgeStr) || 7;
    const maxAge = days * 24 * 60 * 60 * 1000;

    const cookieName =
      this.configService.get<string>('REFRESH_TOKEN_COOKIE_NAME') ||
      'refresh_token';
    response.setCookie(cookieName, token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
  }
}
