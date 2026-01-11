import {
  Controller,
  Logger,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Res,
  Req,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  CreateUserDto,
  LoginUserDto,
  AdminPermissions,
  AccountType,
  Roles,
  Permissions,
  CurrentUser,
  type CurrentUserPayload,
  UserDto,
} from '@app/common';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import {
  InitiatePhoneVerificationDto,
  CompletePhoneVerificationDto,
} from './dto/phone-verification.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { VerifyAuthDto } from './dto/verify-auth.dto';
import { JwtAuthGuard } from '@guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Patch } from '@nestjs/common';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req: any) {
    this.logger.log(`Hit endpoint: googleAuth ip=${req.ip}`);
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(
    @Req() req: any,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const user = req.user;
    this.logger.log(`Hit endpoint: googleAuthRedirect user=${user.email}`);

    const { access_token, refresh_token } =
      await this.usersService.generateTokens(
        user._id.toString(),
        user.email,
        user.role,
      );

    this.setRefreshTokenCookie(response, refresh_token);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    response
      .status(302)
      .redirect(`${frontendUrl}/auth/callback?token=${access_token}`);
  }

  @Post()
  async createUser(@Body() data: CreateUserDto) {
    this.logger.log(`Hit endpoint: createUser email=${data.email}`);

    if (
      this.configService.get('NODE_ENV') === 'production' ||
      data.captchaToken
    ) {
      if (!data.captchaToken) {
        throw new Error('Captcha token is required');
      }
      await this.verifyCaptcha(data.captchaToken);
    }

    return this.usersService.create(data);
  }

  private async verifyCaptcha(token: string): Promise<void> {
    const secret = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    if (!secret) {
      this.logger.warn('RECAPTCHA_SECRET_KEY not set, skipping verification');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
        ),
      );

      if (!response.data.success) {
        this.logger.error(
          `Captcha verification failed: ${JSON.stringify(response.data)}`,
        );
        throw new Error('Captcha verification failed');
      }
    } catch (error) {
      this.logger.error(`Captcha error`, error);
      throw new Error('Captcha verification failed');
    }
  }

  @Post('login')
  async login(
    @Body() data: LoginUserDto,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    this.logger.log(`Hit endpoint: login email=${data.email}`);
    const result = await this.usersService.validateUser(
      data.email,
      data.password,
    );

    if ('access_token' in result) {
      this.setRefreshTokenCookie(response, result.refresh_token);
      const { refresh_token, ...rest } = result;
      return rest;
    }

    return result;
  }

  @Post('refresh')
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    this.logger.log(`Hit endpoint: refresh`);
    const cookieName =
      this.configService.get<string>('REFRESH_TOKEN_COOKIE_NAME') ||
      'refresh_token';
    const refreshToken = request.cookies[cookieName];
    if (!refreshToken) throw new Error('No refresh token');

    // decoding token to get user ID without verifying yet
    const decoded = await this.usersService.verifyRefreshToken(refreshToken);
    const result = await this.usersService.refreshToken(
      decoded.sub,
      refreshToken,
    );

    this.setRefreshTokenCookie(response, result.refresh_token);
    return { access_token: result.access_token };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    this.logger.log(`Hit endpoint: logout user=${user._id}`);
    await this.usersService.logout(user._id.toString());
    const cookieName =
      this.configService.get<string>('REFRESH_TOKEN_COOKIE_NAME') ||
      'refresh_token';
    response.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
    });
    return { success: true };
  }

  private setRefreshTokenCookie(response: FastifyReply, token: string) {
    const maxAgeStr =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d'; // e.g. "7d"

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

  @Post('verify')
  async verify(@Body() data: VerifyAuthDto) {
    this.logger.log(`Hit endpoint: verify jwt=${data.jwt.substring(0, 10)}...`);
    return this.usersService.verify(
      data.jwt,
      data.permission as unknown as AdminPermissions,
      data.role as unknown as AccountType,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: getProfile user=${user._id}`);
    return this.usersService.getUserWithWallet(user._id.toString());
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: UpdateProfileDto,
  ) {
    this.logger.log(
      `Hit endpoint: updateProfile user=${user._id} args=${JSON.stringify(data)}`,
    );
    await this.usersService.updateProfile(user._id.toString(), data);
    return this.usersService.getUserWithWallet(user._id.toString());
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async getUser(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(`Hit endpoint: getUser admin=${user._id} target=${id}`);
    return this.usersService.getUserWithWallet(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async getAllUsers(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: getAllUsers admin=${user._id}`);
    return this.usersService.getAll();
  }

  @Get('profile/:username')
  @UseGuards(JwtAuthGuard)
  async getPublicUserProfile(
    @Param('username') username: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: getPublicUserProfile user=${user._id} target=${username}`,
    );
    return this.usersService.getPublicUserProfile(username, user);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteMyAccount(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: deleteMyAccount user=${user._id}`);
    return this.usersService.initiateDeletion(user._id.toString());
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Permissions(AdminPermissions.MANAGE_USERS)
  @Roles(AccountType.ADMIN)
  async deleteUser(@Param('id') id: string) {
    this.logger.log(`Hit endpoint: deleteUser target=${id}`);
    return this.usersService.initiateDeletion(id);
  }

  @Get('health')
  async healthCheck() {
    this.logger.log(`Hit endpoint: healthCheck`);
    return { status: 'ok', service: 'users-module' };
  }
  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  async registerPushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: RegisterPushTokenDto,
  ) {
    this.logger.log(
      `Hit endpoint: registerPushToken user=${user._id} type=${data.type}`,
    );
    return this.usersService.registerPushToken(
      user._id.toString(),
      data.token,
      data.type,
    );
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() data: VerifyEmailDto,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    this.logger.log(`Hit endpoint: verifyEmail email=${data.email}`);
    const result = await this.usersService.verifyEmail(data.email, data.code);

    if ('refresh_token' in result) {
      this.setRefreshTokenCookie(response, result.refresh_token as string);
      const { refresh_token, ...rest } = result;
      return rest;
    }
    return result;
  }

  @Post('resend-verification')
  async resendVerification(@Body() data: ResendVerificationDto) {
    this.logger.log(`Hit endpoint: resendVerification email=${data.email}`);
    return this.usersService.resendVerificationCode(data.email);
  }
  @Post('phone/verify/initiate')
  @UseGuards(JwtAuthGuard)
  async initiatePhoneVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: InitiatePhoneVerificationDto,
  ) {
    this.logger.log(
      `Hit endpoint: initiatePhoneVerification user=${user._id} phone=${data.phoneNumber}`,
    );
    return this.usersService.initiatePhoneVerification(
      user._id.toString(),
      data.phoneNumber,
    );
  }

  @Post('phone/verify/confirm')
  @UseGuards(JwtAuthGuard)
  async completePhoneVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CompletePhoneVerificationDto,
  ) {
    this.logger.log(`Hit endpoint: completePhoneVerification user=${user._id}`);
    return this.usersService.completePhoneVerification(
      user._id.toString(),
      data.code,
    );
  }
}
