import { NestFactory } from '@nestjs/core';
import { UsersModule } from '@modules/users/users.module';
import { UsersRepository } from '@modules/users/users.repository';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AccountType } from '@app/common';
import { User } from '../schemas/user.schema';

import { z } from 'zod';

const AdminConfigSchema = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(1),
  ADMIN_USERNAME: z.string().min(1),
});

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(UsersModule);
  // ... (rest of the setup)
  const usersRepository = app.get(UsersRepository);
  const logger = new Logger('SeedAdmin');
  const configService = app.get(ConfigService);

  const envConfig = AdminConfigSchema.safeParse(process.env);

  if (!envConfig.success) {
    logger.error('Invalid ADMIN configuration in .env file');
    console.error(envConfig.error.format());
    process.exit(1);
  }

  const {
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    ADMIN_USERNAME: adminUsername,
  } = envConfig.data;

  logger.log('Checking for existing Admin user...');

  let existingUser: User | null = null;
  try {
    try {
      existingUser = await usersRepository.findOne({ email: adminEmail });
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
    }

    if (existingUser) {
      logger.log('Admin user already exists.');
    } else {
      logger.log('Creating Admin user...');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await usersRepository.create({
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        role: AccountType.ADMIN,
        isBot: false,
        initiatedDelete: false,
        emailVerified: true,
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
      logger.log('Admin user created successfully.');
    }
  } catch (error) {
    logger.error('Error seeding admin user:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
