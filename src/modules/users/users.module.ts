import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import {
  AuthModule,
  MongoDatabaseModule,
  validateConfig,
  SchemaMigrationModule,
  WALLET_CREATION_QUEUE,
  ACCOUNT_DELETION_QUEUE,
  CRON_CLEANUP_QUEUE,
  QueueModule,
} from '@app/common';
import { LoggerModule } from '@app/common/logger';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MfaService } from '../auth/mfa.service';
import { MfaController } from '../auth/mfa.controller';
import { WalletModule } from '@modules/wallet/wallet.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersRepository } from './users.repository';
import { AccountDeletionProcessor } from './account-deletion.processor';
import { CronCleanupProcessor } from './cron-cleanup.processor';
import { JwtModule } from '@nestjs/jwt';
import { z } from 'zod';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategies/google.strategy';

import { FriendsModule } from '@modules/friends/friends.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { GameModule } from '@modules/game/game.module';
import { MatchmakingModule } from '@modules/matchmaking/matchmaking.module';

@Module({
  imports: [
    forwardRef(() => WalletModule),
    forwardRef(() => FriendsModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => GameModule),
    forwardRef(() => MatchmakingModule),
    HttpModule,
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig(
        z.object({
          MONGODB_URI: z.url(),
          JWT_SECRET: z.string(),
          JWT_EXPIRATION: z.string(),
          JWT_REFRESH_SECRET: z.string(),
          JWT_REFRESH_EXPIRATION: z.string(),
          COOKIE_SECRET: z.string(),
          REFRESH_TOKEN_COOKIE_NAME: z.string(),
          NODE_ENV: z.string().optional(),
        }),
      ),
      envFilePath: './.env',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION'),
        },
      }),
    }),
    AuthModule,
    PassportModule,
    MongoDatabaseModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    SchemaMigrationModule,
    QueueModule.register({ name: WALLET_CREATION_QUEUE }),
    QueueModule.register({ name: ACCOUNT_DELETION_QUEUE }),
    QueueModule.register({ name: CRON_CLEANUP_QUEUE }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: require('cache-manager-ioredis'),
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        ttl: 600, // 10 minutes default
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController, MfaController],
  providers: [
    UsersService,
    MfaService,
    UsersRepository,
    AccountDeletionProcessor,
    CronCleanupProcessor,
    GoogleStrategy,
  ],
  exports: [UsersService, UsersRepository, JwtModule],
})
export class UsersModule {}
