import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from './users.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from './schemas/user.schema';
import {
  CreateUserDto,
  AccountType,
  AdminPermissions,
  validateWith,
  LoginSchema,
  RegisterPushTokenSchema,
  ACCOUNT_DELETION_QUEUE,
  type CurrentUserPayload,
} from '@app/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { WalletService } from '@modules/wallet/wallet.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Types, FilterQuery, UpdateQuery } from 'mongoose';
import * as nodeCrypto from 'crypto';
import { addMinutes } from 'date-fns';

export type ValidatedUserResponse =
  | {
      access_token: string;
      refresh_token: string;
      user: {
        id: string;
        email: string;
        username: string;
        role: string;
        profilePicture?: string;
        wallet?: {
          balance: number;
        };
      };
    }
  | {
      mfaRequired: true;
      tempToken: string;
      mfaMethods: string[];
    };

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @InjectQueue(ACCOUNT_DELETION_QUEUE) private deletionQueue: Queue,
  ) {}

  private toSafeUser(user: any) {
    if (!user) return null;
    const userObj =
      typeof user.toObject === 'function' ? user.toObject() : user;

    const {
      passwordHash,
      refreshTokenHash,
      mobilePushToken,
      webPushToken,
      pushToken,
      ...safeUser
    } = userObj;

    if (safeUser.mfa) {
      const { backupCodes, methods, ...mfaRest } = safeUser.mfa;
      safeUser.mfa = {
        ...mfaRest,

        methods: Array.isArray(methods)
          ? methods.map((m: any) => {
              const { secret, ...methodRest } = m;
              return methodRest;
            })
          : [],
      };
    } else {
      safeUser.mfa = {
        isEnabled: false,
        methods: [],
      };
    }

    return safeUser;
  }

  async getUserWithWallet(userId: string) {
    this.logger.log(
      `Hit Service: getUserWithWallet args=${JSON.stringify({ userId })}`,
    );
    let user: User | null;
    if (userId === 'bot_id') {
      user = await this.usersRepository.findOne({ isBot: true });
      if (!user) {
        this.logger.warn(
          '[UsersService] Bot user not found in DB. Creating real Bot user...',
        );
        try {
          user = await this.usersRepository.create({
            username: 'FateBot',
            email: 'bot@ggg.com',
            isBot: true,
            role: AccountType.BOT,
            passwordHash: '',
            initiatedDelete: false,
            emailVerified: true, // Bots are verified by default
            phoneVerified: true,
            signupMethod: 'manual',
            mfa: { isEnabled: false, methods: [] },
            notificationSettings: {
              channels: {
                email: true,
                sms: true,
                push: true,
                whatsapp: true,
                slack: true,
                'in-app': true,
              },
            },
            webauthnCredentials: [],
          });
        } catch (err) {
          this.logger.error(
            `[UsersService] Failed to create bot user: ${err.message}`,
          );
          throw err;
        }
      }
    } else {
      user = await this.usersRepository.findOne({ _id: userId });
    }

    if (!user) {
      this.logger.warn(`[UsersService] User not found: ${userId}`);
      throw new Error('User not found');
    }

    let wallet = { balance: 0, currency: 'USD' };
    try {
      const walletData = await this.walletService.getBalance(
        user._id.toString(),
      );
      if (walletData) wallet = walletData;
    } catch (e) {
      this.logger.error(
        `[UsersService] Failed to fetch wallet for ${user.email} (${user._id}): ${e.message}`,
        e.stack,
      );
    }

    return {
      ...this.toSafeUser(user),
      wallet,
    };
  }

  async findById(userId: string) {
    this.logger.log(`Hit Service: findById args=${JSON.stringify({ userId })}`);
    if (userId === 'bot_id') {
      const user = await this.getUserWithWallet(userId);
      return user;
    }
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) throw new Error('User not found');
    return user;
  }

  async findOne(filter: any) {
    this.logger.log(`Hit Service: findOne args=${JSON.stringify(filter)}`);
    return this.usersRepository.findOne(filter);
  }

  async getPublicUserProfile(
    identifier: string,
    requester?: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit Service: getPublicUserProfile args=${JSON.stringify({ identifier, requesterId: requester?._id })}`,
    );
    const filter = Types.ObjectId.isValid(identifier)
      ? { _id: identifier }
      : { username: identifier };

    const projection: any = {
      _id: 1,
      username: 1,
      email: 1,
      role: 1,
      createdAt: 1,
      emailVerified: 1,
      phoneVerified: 1,
      profilePicture: 1,
      bio: 1,
    };

    if (requester?.role === AccountType.ADMIN) {
      projection['mfa'] = 1;
    }

    const user = await this.usersRepository.findOne(filter, projection);
    if (!user) {
      throw new Error('User not found');
    }

    if (requester?.role === AccountType.ADMIN) {
      return this.toSafeUser(user);
    }

    return user;
  }

  async findByIds<T = User>(userIds: string[], projection?: any): Promise<T[]> {
    this.logger.log(`Hit Service: findByIds args=${JSON.stringify(userIds)}`);
    return this.usersRepository.findMany<T>(userIds, projection);
  }

  async getAll() {
    this.logger.log('Hit Service: getAll');
    const users = await this.usersRepository.getAll();
    return Promise.all(
      users.map(async (user: any) => {
        let wallet = { balance: 0, currency: 'USD' };
        try {
          const walletData = await this.walletService.getBalance(
            user._id.toString(),
          );
          if (walletData) wallet = walletData;
        } catch (e) {
          this.logger.error(
            `[UsersService] Failed to fetch wallet for user ${user._id} in getAll: ${e.message}`,
          );
        }
        return {
          ...this.toSafeUser(user),
          wallet,
        };
      }),
    );
  }

  private readonly ROLE_PERMISSIONS: Record<AccountType, AdminPermissions[]> = {
    [AccountType.ADMIN]: [
      AdminPermissions.FULL_ACCESS,
      AdminPermissions.VIEW_DASHBOARD,
      AdminPermissions.MANAGE_USERS,
    ],
    [AccountType.USER]: [],
    [AccountType.BOT]: [],
  };

  async verify(
    token: string,
    requiredPermission?: AdminPermissions,
    requiredRole?: AccountType,
  ) {
    this.logger.log(
      `Hit Service: verify args=${JSON.stringify({ token: token.substring(0, 10) + '...', requiredPermission, requiredRole })}`,
    );
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.usersRepository.findOne({ _id: decoded.sub });

      if (!user) {
        throw new Error('User not found');
      }

      if (requiredRole) {
        const currentRole = user.role.toString().trim();
        const required = requiredRole.toString().trim();

        const isAdmin = currentRole === AccountType.ADMIN;
        const isUserRequired = required === AccountType.USER;

        if (user.initiatedDelete) {
          this.logger.warn(
            `[UsersService] Account deletion initiated for user ${user._id}`,
          );
          throw new Error('Account deletion initiated');
        }

        if (currentRole !== required && !(isAdmin && isUserRequired)) {
          this.logger.warn(
            `[UsersService] Role mismatch. User: '${currentRole}' (len=${currentRole.length}), Required: '${required}' (len=${required.length})`,
          );
          throw new Error('Insufficient role');
        }
      }

      if (requiredPermission) {
        const userPermissions = this.ROLE_PERMISSIONS[user.role] || [];
        const required = Array.isArray(requiredPermission)
          ? requiredPermission[0]
          : requiredPermission;

        if (
          required &&
          !userPermissions.includes(required as AdminPermissions)
        ) {
          this.logger.warn(
            `[UsersService] Permission denied. User Role: ${user.role} lacks permission: ${required}`,
          );
          throw new Error('Insufficient permissions');
        }
      }

      return this.toSafeUser(user);
    } catch (e) {
      this.logger.error(
        `[UsersService] Token verification failed: ${e.message}`,
      );
      throw new Error('Invalid token or unauthorized');
    }
  }

  async create(createUserDto: CreateUserDto) {
    this.logger.log(
      `Hit Service: create args=${JSON.stringify({ email: createUserDto.email })}`,
    );
    let existing: User | null = null;
    try {
      existing = await this.usersRepository.findOne({
        email: createUserDto.email,
      });
    } catch (e) {
      this.logger.error(
        `[UsersService] Failed to find user for email ${createUserDto.email}: ${e.message}`,
      );
    }
    if (existing) {
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const user = await this.usersRepository.create({
      ...createUserDto,
      passwordHash,
      role: AccountType.USER,
      isBot: false,
      initiatedDelete: false,
      emailVerified: false,
      emailVerificationCode: nodeCrypto.randomInt(100000, 999999).toString(),
      emailVerificationExpires: addMinutes(new Date(), 15), // 15 minutes
      phoneNumber: createUserDto.phoneNumber,
      phoneVerified: false,
      signupMethod: 'manual',
      mfa: { isEnabled: false, methods: [] },
      notificationSettings: {
        channels: {
          email: true,
          sms: true,
          push: true,
          whatsapp: true,
          slack: true,
          'in-app': true,
        },
      },
      webauthnCredentials: [],
    });

    await this.notificationsService.sendVerificationEmail(
      user._id.toString(),
      user.email,
      user.emailVerificationCode!,
      user.username,
    );

    return {
      success: true,
      message:
        'User created successfully. Please check your email for verification code.',
    };
  }

  async verifyEmail(email: string, code: string) {
    this.logger.log(
      `Hit Service: verifyEmail args=${JSON.stringify({ email })}`,
    );
    const user = await this.usersRepository.findOne({ email });

    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified)
      return { success: true, message: 'Email already verified' };

    if (
      user.emailVerificationCode !== code ||
      user.emailVerificationExpires! < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.usersRepository.findOneAndUpdate(
      { _id: user._id },
      {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        $unset: { emailVerificationCode: 1, emailVerificationExpires: 1 },
      },
    );

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
        profilePicture: user.profilePicture,
        wallet: { balance: 0, currency: 'USD' },
      },
    };
  }

  async resendVerificationCode(email: string) {
    this.logger.log(
      `Hit Service: resendVerificationCode args=${JSON.stringify({ email })}`,
    );
    const user = await this.usersRepository.findOne({ email });

    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified)
      throw new BadRequestException('Email already verified');

    const newCode = nodeCrypto.randomInt(100000, 999999).toString();
    const newExpires = addMinutes(new Date(), 15);

    await this.usersRepository.findOneAndUpdate(
      { _id: user._id },
      {
        emailVerificationCode: newCode,
        emailVerificationExpires: newExpires,
      },
    );

    await this.notificationsService.sendVerificationEmail(
      user._id.toString(),
      user.email,
      newCode,
      user.username,
    );

    return { success: true, message: 'Verification code sent' };
  }

  async initiatePhoneVerification(userId: string, phoneNumber: string) {
    this.logger.log(
      `Hit Service: initiatePhoneVerification args=${JSON.stringify({ userId, phoneNumber })}`,
    );

    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) throw new NotFoundException('User not found');

    if (
      user.phoneVerificationCooldown &&
      user.phoneVerificationCooldown > new Date()
    ) {
      throw new BadRequestException(
        'Please wait before requesting another code',
      );
    }

    // Check if phone number is already taken by another user
    if (phoneNumber) {
      const existingUser = await this.usersRepository.findOne({
        phoneNumber,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        throw new BadRequestException('Phone number already in use');
      }
    }

    const code = nodeCrypto.randomInt(100000, 999999).toString();
    const expires = addMinutes(new Date(), 5); // 5 minutes expiration
    const cooldown = addMinutes(new Date(), 1); // 1 minute cooldown

    await this.usersRepository.findOneAndUpdate(
      { _id: userId },
      {
        phoneNumber,
        phoneVerificationCode: code,
        phoneVerificationExpires: expires,
        phoneVerificationCooldown: cooldown,
        phoneVerified: false, // Reset verification if new number/code
      },
    );

    try {
      await this.notificationsService.sendSms(
        userId,
        phoneNumber,
        `Your ggg verification code is: ${code}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${phoneNumber}: ${error.message}`,
      );
      // Don't throw to UI, but maybe clean up the code? Or let them retry.
      // For now, let's allow the UI to handle the lack of SMS by not receiving it.
      throw new BadRequestException(
        'Failed to send verification SMS. Please check the number and try again.',
      );
    }

    return { success: true, message: 'Verification code sent' };
  }

  async completePhoneVerification(userId: string, code: string) {
    this.logger.log(
      `Hit Service: completePhoneVerification args=${JSON.stringify({ userId })}`,
    );
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) throw new NotFoundException('User not found');

    if (user.phoneVerified) {
      return { success: true, message: 'Phone already verified' };
    }

    if (
      user.phoneVerificationCode !== code ||
      !user.phoneVerificationExpires ||
      user.phoneVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.usersRepository.findOneAndUpdate(
      { _id: user._id },
      {
        phoneVerified: true,
        $unset: {
          phoneVerificationCode: 1,
          phoneVerificationExpires: 1,
          phoneVerificationCooldown: 1,
        },
      },
    );

    return { success: true, message: 'Phone verified successfully' };
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<ValidatedUserResponse> {
    this.logger.log(
      `Hit Service: validateUser args=${JSON.stringify({ email })}`,
    );
    validateWith(LoginSchema, { email, password: pass });
    const user = await this.usersRepository.findOne({ email });
    if (!user) {
      this.logger.warn(
        `[UsersService] Validation failed: User not found for email ${email}`,
      );
      throw new Error('Invalid credentials');
    }

    if (!user.emailVerified) {
      this.logger.warn(
        `[UsersService] Validation failed: Email not verified for ${email}`,
      );
      throw new Error('Email not verified');
    }

    const passwordValid = await bcrypt.compare(pass, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(
        `[UsersService] Validation failed: Invalid password for email ${email}`,
      );
      throw new Error('Invalid credentials');
    }

    if (user.mfa && user.mfa.isEnabled) {
      const { tempToken, mfaMethods } = await this.generateMfaTempToken(user);

      return {
        mfaRequired: true,
        tempToken,
        mfaMethods,
      };
    }

    const userWithWallet = await this.getUserWithWallet(user._id.toString());

    this.logger.log(
      `[UsersService] User validated successfully: ${email} (${user._id})`,
    );

    await this.usersRepository.findOneAndUpdate(
      { _id: user._id },
      { lastLoginAt: new Date() },
    );

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
        profilePicture: user.profilePicture,
        wallet: userWithWallet.wallet,
      },
    };
  }

  async generateMfaTempToken(user: User) {
    const tempToken = await this.jwtService.signAsync(
      { sub: user._id, role: user.role, isMfaPending: true },
      { secret: this.configService.get('JWT_SECRET'), expiresIn: '5m' },
    );

    return {
      tempToken,
      mfaMethods: [
        ...new Set(
          user.mfa.methods.filter((m) => m.enabled).map((m) => m.type),
        ),
      ],
    };
  }

  async generateTokens(userId: string, email: string, role: string) {
    this.logger.log(
      `Hit Service: generateTokens args=${JSON.stringify({ userId, email, role })}`,
    );
    const payload = { sub: userId, email, role };
    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRATION'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
      }),
    ]);

    await this.updateRefreshToken(userId, refresh_token);

    return { access_token, refresh_token };
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    this.logger.log(
      `Hit Service: updateRefreshToken args=${JSON.stringify({ userId })}`,
    );
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.usersRepository.findOneAndUpdate(
      { _id: userId },
      { refreshTokenHash: hash, tokenLastRefreshedAt: new Date() },
    );
  }

  async refreshToken(userId: string, refreshToken: string) {
    this.logger.log(
      `Hit Service: refreshToken args=${JSON.stringify({ userId })}`,
    );
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user || !user.refreshTokenHash) throw new Error('Access Denied');

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isMatch) throw new Error('Access Denied');

    return this.generateTokens(user._id.toString(), user.email, user.role);
  }

  async logout(userId: string) {
    this.logger.log(`Hit Service: logout args=${JSON.stringify({ userId })}`);
    await this.usersRepository.findOneAndUpdate(
      { _id: userId },
      { $unset: { refreshTokenHash: 1 } },
    );
  }

  async verifyRefreshToken(token: string) {
    this.logger.log(`Hit Service: verifyRefreshToken`);
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });
  }
  async removePushToken(userId: string, tokenType: 'mobile' | 'web') {
    this.logger.log(
      `Hit Service: removePushToken args=${JSON.stringify({ userId, tokenType })}`,
    );

    const unsetUpdate =
      tokenType === 'mobile'
        ? { $unset: { mobilePushToken: 1 } }
        : { $unset: { webPushToken: 1 } };

    await this.usersRepository.findOneAndUpdate({ _id: userId }, unsetUpdate);
    this.logger.log(
      `[UsersService] Removed ${tokenType} push token for user ${userId}`,
    );
  }
  async registerPushToken(
    userId: string,
    token: string,
    tokenType: 'mobile' | 'web',
  ) {
    this.logger.log(
      `Hit Service: registerPushToken args=${JSON.stringify({ userId, tokenType })}`,
    );
    validateWith(RegisterPushTokenSchema, { token, type: tokenType });
    const update =
      tokenType === 'mobile'
        ? { mobilePushToken: token }
        : { webPushToken: token };

    await this.usersRepository.findOneAndUpdate({ _id: userId }, update);
    this.logger.log(
      `[UsersService] Registered ${tokenType} push token for user ${userId}`,
    );
    return { success: true };
  }

  async initiateDeletion(userId: string) {
    this.logger.log(
      `Hit Service: initiateDeletion args=${JSON.stringify({ userId })}`,
    );

    await this.usersRepository.findOneAndUpdate(
      { _id: userId },
      { initiatedDelete: true },
    );

    await this.deletionQueue.add(
      'delete_account',
      { userId },
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(
      `[UsersService] User ${userId} flagged for deletion and job queued.`,
    );
    return { success: true, message: 'Account deletion initiated.' };
  }

  async validateGoogleUser(profile: any) {
    this.logger.log(
      `Hit Service: validateGoogleUser args=${JSON.stringify({ email: profile.emails?.[0]?.value, googleId: profile.id })}`,
    );
    const { id, emails, photos, displayName } = profile;
    const email = emails?.[0]?.value;
    const photo = photos?.[0]?.value;

    if (!email) {
      throw new BadRequestException(
        'Google account must have an email address',
      );
    }

    let user = await this.usersRepository.findOne({ email });

    if (!user) {
      this.logger.log(
        `[UsersService] Creating new user from Google profile: ${email}`,
      );
      // Create new user
      user = await this.usersRepository.create({
        username: displayName || email.split('@')[0],
        email: email,
        passwordHash: '', // No password for OAuth users
        role: AccountType.USER,
        isBot: false,
        initiatedDelete: false,
        emailVerified: true, // Trusted provider
        emailVerifiedAt: new Date(),
        signupMethod: 'google',
        googleId: profile.id,
        profilePicture: profile.photos?.[0]?.value,
        phoneVerified: false,
        lastLoginAt: new Date(),
        mfa: { isEnabled: false, methods: [] },
        notificationSettings: {
          channels: {
            email: true,
            sms: true,
            push: true,
            whatsapp: true,
            slack: true,
            'in-app': true,
          },
        },
        webauthnCredentials: [],
      });
    } else {
      this.logger.log(
        `[UsersService] Existing user logged in with Google: ${email}`,
      );
      const updatePayload: any = {
        lastLoginAt: new Date(),
      };

      // Populate googleId if missing
      if (!user.googleId) {
        updatePayload.googleId = profile.id;
      }
      // Populate profilePicture if missing
      if (!user.profilePicture && profile.photos?.[0]?.value) {
        updatePayload.profilePicture = profile.photos?.[0]?.value;
      }
      // Mark verified if not
      if (!user.emailVerified) {
        updatePayload.emailVerified = true;
        updatePayload.emailVerifiedAt = new Date();
      }

      await this.usersRepository.findOneAndUpdate(
        { _id: user._id },
        updatePayload,
      );
    }

    return user;
  }

  async updateProfile(userId: string, updateData: UpdateQuery<User>) {
    this.logger.log(
      `Hit Service: updateProfile args=${JSON.stringify({ userId, keys: Object.keys(updateData) })}`,
    );
    return this.usersRepository.findOneAndUpdate({ _id: userId }, updateData);
  }
}
