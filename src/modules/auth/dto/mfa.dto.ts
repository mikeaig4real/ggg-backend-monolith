import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export enum MfaType {
  EMAIL = 'email',
  SMS = 'sms',
  TOTP = 'totp',
  BACKUP_CODE = 'backup_code',
  PASSKEY = 'passkey',
}

export class MfaSetupInitDto {
  @ApiProperty({ enum: MfaType, description: 'Type of MFA method to set up' })
  @IsEnum(MfaType)
  type: MfaType;

  @ApiProperty({
    required: false,
    description: 'User label for this method (e.g. "My iPhone")',
  })
  @IsString()
  @IsOptional()
  label?: string;
}

export class MfaSetupVerifyDto {
  @ApiProperty({ enum: MfaType })
  @IsEnum(MfaType)
  type: MfaType;

  @ApiProperty({ description: 'The verification code provided by the user' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    required: false,
    description: 'Secret used during setup (for TOTP verification context)',
  })
  @IsString()
  @IsOptional()
  secret?: string;
}

export class MfaChallengeDto {
  @ApiProperty({ enum: MfaType })
  @IsEnum(MfaType)
  type: MfaType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class MfaSendChallengeDto {
  @ApiProperty({ enum: MfaType })
  @IsEnum(MfaType)
  type: MfaType;
}

export class MfaDisableDto {
  @ApiProperty({ enum: MfaType })
  @IsEnum(MfaType)
  type: MfaType;
}

export class PasskeyRegistrationVerifyDto {
  @ApiProperty()
  @IsNotEmpty()
  registrationResponse: any; // Type is RegistrationResponseJSON from simplewebauthn
}

export class PasskeyAuthVerifyDto {
  @ApiProperty()
  @IsNotEmpty()
  authResponse: any; // Type is AuthenticationResponseJSON
}
