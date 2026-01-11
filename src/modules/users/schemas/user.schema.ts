import { AbstractDocument } from '@app/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AccountType } from '@app/common';

export class WebAuthnCredential {
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  transports?: string[];
}

export class MfaMethod {
  type: 'email' | 'sms' | 'totp' | 'backup_code' | 'passkey';
  enabled: boolean;
  isPrimary: boolean;
  secret?: string;
  lastUsedAt?: Date;
  label?: string;
}

export class UserMfa {
  isEnabled: boolean;
  methods: MfaMethod[];
  backupCodes?: string[];
}

@Schema({ versionKey: false, timestamps: true })
export class User extends AbstractDocument {
  // ... existing props ...
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({
    type: String,
    enum: AccountType,
    default: AccountType.USER,
  })
  role: AccountType;

  @Prop({ default: false })
  isBot: boolean;

  @Prop()
  refreshTokenHash?: string;

  @Prop()
  phoneNumber?: string;

  @Prop()
  mobilePushToken?: string;

  @Prop()
  webPushToken?: string;

  @Prop({ default: false })
  initiatedDelete: boolean;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop()
  profilePicture?: string;

  @Prop({ type: String, enum: ['manual', 'google'], default: 'manual' })
  signupMethod: string;

  @Prop()
  bio?: string;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop()
  emailVerifiedAt?: Date;

  @Prop()
  emailVerificationCode?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop()
  phoneVerificationCode?: string;

  @Prop()
  phoneVerificationExpires?: Date;

  @Prop()
  phoneVerificationCooldown?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  tokenLastRefreshedAt?: Date;

  @Prop({ type: Object, default: { isEnabled: false, methods: [] } })
  mfa: UserMfa;

  @Prop({
    type: Object,
    default: {
      channels: {
        email: true,
        sms: true,
        push: true,
        whatsapp: true,
        slack: true,
        'in-app': true,
      },
    },
  })
  notificationSettings: {
    channels: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
      slack: boolean;
      'in-app': boolean;
    };
  };

  @Prop({ type: Array, default: [] })
  webauthnCredentials: WebAuthnCredential[];
}

export const UserSchema = SchemaFactory.createForClass(User);
