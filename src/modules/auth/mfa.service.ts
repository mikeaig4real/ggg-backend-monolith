import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationChannelType,
  NotificationType,
} from '../notifications/interfaces/notification-payload.interface';
import {
  MfaType,
  PasskeyRegistrationVerifyDto,
  PasskeyAuthVerifyDto,
} from './dto/mfa.dto';
import {
  MfaMethod,
  UserMfa,
  WebAuthnCredential,
} from '../users/schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { enrichMfaCodeTemplate } from '../notifications/channels/email/templates/general/mfa-code';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private rpName = 'ggg';
  private rpID: string;
  private origin: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly notificationsService: NotificationsService,
  ) {
    authenticator.options = { window: 1 };

    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
    try {
      const url = new URL(frontendUrl);
      this.rpID = url.hostname;
      this.origin = url.origin;
    } catch (e) {
      this.rpID = 'localhost';
      this.origin = 'http://localhost:5173';
    }
  }
  private encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(
      this.configService.get('JWT_SECRET') || 'fallback_secret',
      'salt',
      32,
    );
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptSecret(encrypted: string): string {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts.shift() as string, 'hex');
    const encryptedText = parts.join(':');
    const key = crypto.scryptSync(
      this.configService.get('JWT_SECRET') || 'fallback_secret',
      'salt',
      32,
    );
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async generateTotpSecret(userEmail: string) {
    this.logger.log(
      `Hit Service: generateTotpSecret args=${JSON.stringify({ userEmail })}`,
    );
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userEmail, 'ggg', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret,
      qrCodeUrl,
    };
  }

  async generateAndSendCode(userId: string, type: MfaType, target: string) {
    this.logger.log(
      `Hit Service: generateAndSendCode args=${JSON.stringify({ userId, type, target })}`,
    );
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `mfa_setup:${userId}:${type}`;
    this.logger.log(`Generating setup code. Key: ${key}, Code: ${code}`);
    await (this.cacheManager as any).set(key, code, 600 * 1000); // 10 mins (in ms)

    if (type === MfaType.EMAIL) {
      const html = enrichMfaCodeTemplate({ code });
      await this.notificationsService.dispatch({
        userIds: [userId],
        title: 'ggg MFA Verification Code',
        message: `Your verification code is: ${code}`,
        type: NotificationType.SYSTEM,
        channels: [NotificationChannelType.EMAIL],
        html,
      });
    } else if (type === MfaType.SMS) {
      // await this.notificationsService.sendSms(target, `Your code is ${code}`);
    }

    return { success: true, message: `Code sent to ${target}` };
  }

  async verifyTotp(token: string, secret: string): Promise<boolean> {
    this.logger.log(
      `Hit Service: verifyTotp args=${JSON.stringify({ token })}`,
    );
    try {
      return authenticator.verify({ token, secret });
    } catch (err) {
      return false;
    }
  }

  async generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
    this.logger.log(`Hit Service: generateBackupCodes`);
    const codes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );

    const hashedCodes = await Promise.all(
      codes.map((code) => bcrypt.hash(code, 10)),
    );

    return { plain: codes, hashed: hashedCodes };
  }

  async initiateSetup(userId: string, type: MfaType) {
    this.logger.log(
      `Hit Service: initiateSetup args=${JSON.stringify({ userId, type })}`,
    );
    const user = await this.usersService.findById(userId);

    if (type === MfaType.TOTP) {
      return this.generateTotpSecret(user.email);
    } else if (type === MfaType.EMAIL) {
      if (!user.emailVerified)
        throw new BadRequestException('Email not verified');
      return this.generateAndSendCode(userId, type, user.email);
    } else if (type === MfaType.SMS) {
      if (!user.phoneVerified)
        throw new BadRequestException('Phone not verified');
      return this.generateAndSendCode(userId, type, user.phoneNumber);
    }
    throw new BadRequestException('Invalid method');
  }

  async generatePasskeyRegistrationOptions(userId: string) {
    this.logger.log(
      `Hit Service: generatePasskeyRegistrationOptions args=${JSON.stringify({ userId })}`,
    );
    const user = await this.usersService.findById(userId);
    const userCredentials = user.webauthnCredentials || [];

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: isoUint8Array.fromUTF8String(userId),
      userName: user.email,
      userDisplayName: user.username,
      attestationType: 'none',
      excludeCredentials: userCredentials
        .map((cred: WebAuthnCredential) => {
          let idString: string;
          if (typeof cred.credentialID === 'string') {
            idString = cred.credentialID;
          } else if (Buffer.isBuffer(cred.credentialID)) {
            idString = isoBase64URL.fromBuffer(cred.credentialID);
          } else {
            try {
              idString = isoBase64URL.fromBuffer(cred.credentialID as any);
            } catch (e) {
              idString = String(cred.credentialID);
            }
          }
          return {
            id: idString,
            type: 'public-key',
            transports: cred.transports as any,
          };
        })
        .filter((c: { id: string }) => c.id && c.id.length > 0),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'cross-platform',
      },
    });

    // Save challenge to session/cache
    await (this.cacheManager as any).set(
      `passkey_challenge:${userId}`,
      options.challenge,
      300 * 1000, // 5 mins (in ms)
    );

    return options;
  }

  async verifyPasskeyRegistration(
    userId: string,
    body: PasskeyRegistrationVerifyDto,
  ) {
    this.logger.log(
      `Hit Service: verifyPasskeyRegistration args=${JSON.stringify({ userId, body })}`,
    );
    const user = await this.usersService.findById(userId);
    const expectedChallenge = await (this.cacheManager as any).get(
      `passkey_challenge:${userId}`,
    );

    if (!expectedChallenge) {
      throw new BadRequestException('Passkey registration session expired');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.registrationResponse,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      });
    } catch (error) {
      this.logger.error(`Passkey verification failed: ${error.message}`);
      throw new BadRequestException('Verification failed');
    }

    this.logger.log(
      `Verification Result: ${JSON.stringify(verification, (key, value) =>
        (key === 'credentialID' || key === 'credentialPublicKey') &&
        value?.type === 'Buffer'
          ? `Buffer(len=${value.data.length})`
          : value,
      )}`,
    );

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const {
        id: credentialID,
        publicKey: credentialPublicKey,
        counter,
      } = credential;

      if (!credentialID || !credentialPublicKey) {
        this.logger.error(
          'Received empty credential ID or Public Key from registration verification',
        );
        throw new BadRequestException('Invalid credential data received');
      }

      const newCredential: WebAuthnCredential = {
        credentialID,
        credentialPublicKey: isoBase64URL.fromBuffer(credentialPublicKey),
        counter,
        transports: body.registrationResponse.response.transports || [],
      };

      // Save credential
      const credentials = user.webauthnCredentials || [];
      credentials.push(newCredential);
      await this.usersService.updateProfile(userId, {
        webauthnCredentials: credentials,
      });

      // Also enable 'passkey' MFA method
      await this.enableMfaMethod(userId, MfaType.PASSKEY, {
        label: 'My Passkey',
      });

      // Cleanup
      await (this.cacheManager as any).del(`passkey_challenge:${userId}`);

      return { verified: true };
    }

    throw new BadRequestException('Verification failed');
  }

  async generatePasskeyAuthenticationOptions(userId: string) {
    this.logger.log(
      `Hit Service: generatePasskeyAuthenticationOptions args=${JSON.stringify({ userId })}`,
    );
    const user = await this.usersService.findById(userId);
    const userCredentials = user.webauthnCredentials || [];
    this.logger.debug(
      `[MfaService] Generating auth options for user ${userId}. Credentials: ${JSON.stringify(userCredentials)}`,
    );
    userCredentials.forEach((c: WebAuthnCredential, i: number) => {
      this.logger.debug(
        `Credential ${i} ID type: ${typeof c.credentialID}, Value: ${c.credentialID}`,
      );
    });

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: userCredentials
        .map((cred: WebAuthnCredential) => {
          let idString: string;
          if (typeof cred.credentialID === 'string') {
            idString = cred.credentialID;
          } else if (Buffer.isBuffer(cred.credentialID)) {
            idString = isoBase64URL.fromBuffer(cred.credentialID);
          } else {
            try {
              idString = isoBase64URL.fromBuffer(cred.credentialID as any);
            } catch (e) {
              idString = String(cred.credentialID);
            }
          }
          return {
            id: idString,
            type: 'public-key',
            transports: cred.transports as any,
          };
        })
        .filter((c: { id: string }) => c.id && c.id.length > 0),
      userVerification: 'preferred',
    });

    await (this.cacheManager as any).set(
      `passkey_challenge:${userId}`,
      options.challenge,
      300 * 1000,
    );

    return options;
  }

  async verifyPasskeyAuthentication(
    userId: string,
    body: PasskeyAuthVerifyDto,
  ) {
    this.logger.log(
      `Hit Service: verifyPasskeyAuthentication args=${JSON.stringify({ userId, body })}`,
    );
    const user = await this.usersService.findById(userId);
    const expectedChallenge = await (this.cacheManager as any).get(
      `passkey_challenge:${userId}`,
    );

    if (!expectedChallenge) {
      throw new BadRequestException('Passkey auth session expired');
    }

    const credentialId = body.authResponse.id;
    const credential = user.webauthnCredentials?.find(
      (cred: WebAuthnCredential) => {
        const storedId = Buffer.isBuffer(cred.credentialID)
          ? isoBase64URL.fromBuffer(cred.credentialID as any)
          : typeof cred.credentialID === 'object' // Handle if specific object type
            ? isoBase64URL.fromBuffer(cred.credentialID)
            : cred.credentialID;
        return storedId === credentialId;
      },
    );

    if (!credential) {
      throw new BadRequestException('Credential not found');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.authResponse,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: credentialId,
          publicKey:
            typeof credential.credentialPublicKey === 'string'
              ? isoBase64URL.toBuffer(credential.credentialPublicKey)
              : credential.credentialPublicKey,
          counter: credential.counter,
          transports: credential.transports as any,
        },
      });
    } catch (error) {
      this.logger.error(`Passkey auth failed: ${error.message}`);
      throw new BadRequestException('Verification failed');
    }

    if (verification.verified) {
      // Update counter
      credential.counter = verification.authenticationInfo.newCounter;
      // Update user credentials
      const credIndex = user.webauthnCredentials.findIndex(
        (c: WebAuthnCredential) => c.credentialID === credentialId,
      );
      if (credIndex > -1) {
        user.webauthnCredentials[credIndex] = credential;
        await this.usersService.updateProfile(userId, {
          webauthnCredentials: user.webauthnCredentials,
        });
      }

      await (this.cacheManager as any).del(`passkey_challenge:${userId}`);

      // Log user in
      return this.mfaServiceLogin(userId);
    }
    throw new BadRequestException('Verification failed');
  }

  async mfaServiceLogin(userId: string) {
    this.logger.log(
      `Hit Service: mfaServiceLogin args=${JSON.stringify({ userId })}`,
    );
    const user = await this.usersService.findById(userId);
    await this.usersService.updateProfile(user._id.toString(), {
      lastLoginAt: new Date(),
    });

    const tokens = await this.usersService.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    const userWithWallet = await this.usersService.getUserWithWallet(
      user._id.toString(),
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

  async enableMfaMethod(
    userId: string,
    type: MfaType,
    verificationContext: any,
  ) {
    this.logger.log(
      `Hit Service: enableMfaMethod args=${JSON.stringify({ userId, type, verificationContext })}`,
    );
    const user = await this.usersService.findById(userId);
    const mfa = user.mfa || { isEnabled: false, methods: [] };

    const existing = mfa.methods.find((m: MfaMethod) => m.type === type);
    if (existing && existing.enabled) {
      if (type !== MfaType.PASSKEY) {
        throw new BadRequestException('MFA method already enabled');
      }
    }

    let method: MfaMethod = existing || {
      type,
      enabled: true,
      isPrimary: mfa.methods.length === 0,
      lastUsedAt: new Date(),
    };
    method.enabled = true; // Ensure true

    if (type === MfaType.TOTP) {
      const { secret } = verificationContext;
      if (!secret)
        throw new BadRequestException('Secret required for TOTP setup');
      method.secret = this.encryptSecret(secret);
      method.label = verificationContext.label || 'Authenticator App';
    } else if (type === MfaType.EMAIL || type === MfaType.SMS) {
      method.label = type === MfaType.EMAIL ? user.email : user.phoneNumber;
    } else if (type === MfaType.PASSKEY) {
      method.label = verificationContext.label || 'Passkey';
    }

    // Add or update method
    const existingIndex = mfa.methods.findIndex(
      (m: MfaMethod) => m.type === type,
    );
    if (existingIndex > -1) {
      mfa.methods[existingIndex] = method;
    } else {
      mfa.methods.push(method);
    }

    mfa.isEnabled = true;

    // Generate backup codes if needed
    let backupCodesRaw: string[] | undefined;
    if (!mfa.backupCodes || mfa.backupCodes.length === 0) {
      const { plain, hashed } = await this.generateBackupCodes();
      mfa.backupCodes = hashed;
      backupCodesRaw = plain;
      const backupMethod: MfaMethod = {
        type: MfaType.BACKUP_CODE,
        enabled: true,
        isPrimary: false,
        lastUsedAt: new Date(),
        label: 'Recovery Codes',
      };
      const bkIndex = mfa.methods.findIndex(
        (m: MfaMethod) => m.type === MfaType.BACKUP_CODE,
      );
      if (bkIndex > -1) mfa.methods[bkIndex] = backupMethod;
      else mfa.methods.push(backupMethod);
    }

    await this.usersService.updateProfile(userId, { mfa });

    return { success: true, backupCodes: backupCodesRaw };
  }

  async verifySetupCode(
    userId: string,
    type: MfaType,
    code: string,
    secret?: string,
  ) {
    this.logger.log(
      `Hit Service: verifySetupCode args=${JSON.stringify({ userId, type, code })}`,
    );
    if (type === MfaType.TOTP) {
      if (!secret) throw new BadRequestException('Secret required');
      return this.verifyTotp(code, secret);
    }

    const key = `mfa_setup:${userId}:${type}`;
    const stored = await (this.cacheManager as any).get(key);
    this.logger.log(
      `Verifying setup code. Key: ${key}, Stored: ${stored}, Input: ${code}`,
    );

    if (!stored) throw new BadRequestException('Code expired or invalid');
    if (stored !== code) throw new BadRequestException('Invalid code');

    await (this.cacheManager as any).del(key);
    return true;
  }

  async disableMfaMethod(userId: string, type: MfaType) {
    this.logger.log(
      `Hit Service: disableMfaMethod args=${JSON.stringify({ userId, type })}`,
    );
    const user = await this.usersService.findById(userId);
    const mfa = user.mfa;

    if (!mfa || !mfa.isEnabled)
      throw new BadRequestException('MFA not enabled');

    const methodIndex = mfa.methods.findIndex(
      (m: MfaMethod) => m.type === type,
    );
    if (methodIndex === -1) throw new BadRequestException('Method not found');

    // Remove the method
    mfa.methods.splice(methodIndex, 1);

    // If no methods left (excluding backup codes), disable MFA entirely
    const activeMethods = mfa.methods.filter(
      (m: MfaMethod) => m.type !== MfaType.BACKUP_CODE && m.enabled,
    );
    if (activeMethods.length === 0) {
      mfa.isEnabled = false;
      mfa.methods = [];
      mfa.backupCodes = []; // Clear codes
      if (type === MfaType.PASSKEY) {
        await this.usersService.updateProfile(userId, {
          webauthnCredentials: [],
        });
      }
    } else {
      if (!mfa.methods.find((m: MfaMethod) => m.isPrimary)) {
        const first = mfa.methods.find(
          (m: MfaMethod) => m.type !== MfaType.BACKUP_CODE,
        );
        if (first) first.isPrimary = true;
      }
    }

    await this.usersService.updateProfile(userId, { mfa });
    return { success: true };
  }

  async verifyMfaWait(
    userId: string,
    type: MfaType,
    code: string,
  ): Promise<boolean> {
    this.logger.log(
      `Hit Service: verifyMfaWait args=${JSON.stringify({ userId, type, code })}`,
    );
    const user = await this.usersService.findById(userId);
    const method = user.mfa?.methods.find((m: MfaMethod) => m.type === type);

    if (!method || !method.enabled) return false;

    if (type === MfaType.TOTP) {
      if (!method.secret) return false;
      const decryptedSecret = this.decryptSecret(method.secret);
      return this.verifyTotp(code, decryptedSecret);
    }

    if (type === MfaType.BACKUP_CODE) {
      if (!user.mfa || !user.mfa.backupCodes) return false;
      for (const hash of user.mfa.backupCodes) {
        if (await bcrypt.compare(code, hash)) {
          user.mfa.backupCodes = user.mfa.backupCodes.filter(
            (h: string) => h !== hash,
          );
          await this.usersService.updateProfile(userId, { mfa: user.mfa });
          return true;
        }
      }
      return false;
    }

    if (type === MfaType.EMAIL || type === MfaType.SMS) {
      const cacheKey = `mfa_login:${userId}`;
      const stored = await (this.cacheManager as any).get(cacheKey);

      this.logger.log(
        `verifyMfaWait: userId=${userId} type=${type} inputCode=${code} storedCode=${stored}`,
      );

      if (!stored) {
        this.logger.warn(
          `verifyMfaWait: Code expired or not found for ${userId}`,
        );
        throw new UnauthorizedException(
          'MFA code verification failed: Code has expired.',
        );
      }

      if (stored === code) {
        await (this.cacheManager as any).del(cacheKey);
        this.logger.log(
          `verifyMfaWait: Code verified successfully for ${userId}`,
        );
        return true;
      } else {
        this.logger.warn(
          `verifyMfaWait: Code mismatch for ${userId}. Expected ${stored}, got ${code}`,
        );
        throw new UnauthorizedException(
          'MFA code verification failed: Invalid Code',
        );
      }
    }

    return false;
  }

  async sendLoginChallengeCode(userId: string, type: MfaType) {
    this.logger.log(
      `Hit Service: sendLoginChallengeCode args=${JSON.stringify({ userId, type })}`,
    );
    const user = await this.usersService.findById(userId);
    const method = user.mfa?.methods.find(
      (m: MfaMethod) => m.type === type && m.enabled,
    );
    if (!method) throw new BadRequestException('Method not enabled');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // TTL is in milliseconds for cache-manager v5+
    await (this.cacheManager as any).set(
      `mfa_login:${userId}`,
      code,
      5 * 60 * 1000,
    );

    if (type === MfaType.EMAIL) {
      const html = enrichMfaCodeTemplate({ code });
      await this.notificationsService.dispatch({
        userIds: [userId],
        title: 'ggg Login Verification Code',
        message: `Your login code is: ${code}`,
        type: NotificationType.SYSTEM,
        channels: [NotificationChannelType.EMAIL],
        html,
      });
    } else {
    }
    return { success: true, message: 'Code sent' };
  }

  async finalizeMfaLogin(userId: string) {
    this.logger.log(
      `Hit Service: finalizeMfaLogin args=${JSON.stringify({ userId })}`,
    );
    return this.mfaServiceLogin(userId);
  }

  async generatePasskeyAuthOptionsByEmail(email: string) {
    this.logger.log(
      `Hit Service: generatePasskeyAuthOptionsByEmail args=${JSON.stringify({ email })}`,
    );
    const user = await this.usersService.findOne({ email });
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }
    return this.generatePasskeyAuthenticationOptions(user._id.toString());
  }

  async verifyPasskeyAuthenticationByEmail(
    email: string,
    body: PasskeyAuthVerifyDto,
  ) {
    this.logger.log(
      `Hit Service: verifyPasskeyAuthenticationByEmail args=${JSON.stringify({ email, body })}`,
    );
    const user = await this.usersService.findOne({ email });
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }
    return this.verifyPasskeyAuthentication(user._id.toString(), body);
  }
}
