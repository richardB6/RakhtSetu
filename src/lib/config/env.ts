import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  SEED_ON_STARTUP: z.enum(['true', 'false']).default('false'),
  SEED_SECRET: z.string().min(32, 'SEED_SECRET must be at least 32 characters').optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_MAP_TILE_URL: z.string().url().optional(),
  NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().optional(),
}).refine((data) => data.DEMO_MODE !== 'true' || !!data.SEED_SECRET, {
  message: 'SEED_SECRET is required when DEMO_MODE=true',
  path: ['SEED_SECRET'],
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
