import { NestFactory } from '@nestjs/core';
import { UsersModule } from '@modules/users/users.module';
import { UsersRepository } from '@modules/users/users.repository';
import { Logger } from '@nestjs/common';
import { AccountType } from '@app/common';
import bcrypt from 'bcryptjs';
import { User } from '../schemas/user.schema';

import { z } from 'zod';

const BotConfigSchema = z.object({
  BOT_EMAIL: z.email(),
  BOT_PASSWORD: z.string().min(1),
  BOT_USERNAME: z.string().min(1),
});

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(UsersModule);
  // ... (rest of the setup)
  const usersRepository = app.get(UsersRepository);
  const logger = new Logger('SeedBot');

  const envConfig = BotConfigSchema.safeParse(process.env);

  if (!envConfig.success) {
    logger.error('Invalid BOT configuration in .env file');
    console.error(envConfig.error.format());
    process.exit(1);
  }

  const {
    BOT_EMAIL: botEmail,
    BOT_PASSWORD: botPassword,
    BOT_USERNAME: botUsername,
  } = envConfig.data;

  try {
    let existingBot: User | null = null;
    try {
      existingBot = await usersRepository.findOne({ email: botEmail });
    } catch (e) {
      if (e.status !== 404) {
        throw e;
      }
    }

    if (existingBot) {
      logger.log('Bot user already exists.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(botPassword, salt);

    await usersRepository.create({
      email: botEmail,
      username: botUsername,
      passwordHash,
      role: AccountType.BOT,
      isBot: true,
    } as any);

    logger.log(`Bot user created successfully: ${botEmail}`);
  } catch (error) {
    logger.error('Failed to seed bot user', error);
  } finally {
    await app.close();
  }
}

bootstrap();
