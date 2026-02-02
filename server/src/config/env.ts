import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

import dotenvExpand from "dotenv-expand";

if (process.env.NODE_ENV !== 'production') {
  const myEnv = dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
  dotenvExpand.expand(myEnv);
}

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  LLM_MOCK: z.coerce.boolean().default(true),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

console.log("🔍 Environment Loaded:", {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL_masked: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 25) + "..." : "UNDEFINED"
});

export const env = parsed.data;
