import { z } from 'zod';

export const validateConfig =
  <T extends z.ZodType<any, any>>(schema: T) =>
  (config: Record<string, unknown>) => {
    const result = schema.safeParse(config);
    if (!result.success) {
      throw new Error(`Config validation error: ${result.error.message}`);
    }
    return result.data;
  };
