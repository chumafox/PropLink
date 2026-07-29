import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  APP_ID: z.string().min(1, "APP_ID is required"),
  APP_SECRET: z.string().min(1, "APP_SECRET is required"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  KIMI_AUTH_URL: z.string().url("KIMI_AUTH_URL must be a valid URL").default("https://auth.kimi.com"),
  KIMI_OPEN_URL: z.string().url("KIMI_OPEN_URL must be a valid URL").default("https://open.kimi.com"),
  OWNER_UNION_ID: z.string().default(""),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3000"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = {
  appId: parsedEnv.data.APP_ID,
  appSecret: parsedEnv.data.APP_SECRET,
  isProduction: parsedEnv.data.NODE_ENV === "production",
  databaseUrl: parsedEnv.data.DATABASE_URL,
  kimiAuthUrl: parsedEnv.data.KIMI_AUTH_URL,
  kimiOpenUrl: parsedEnv.data.KIMI_OPEN_URL,
  ownerUnionId: parsedEnv.data.OWNER_UNION_ID,
  port: parsedEnv.data.PORT,
  r2: {
    accountId: parsedEnv.data.R2_ACCOUNT_ID,
    accessKeyId: parsedEnv.data.R2_ACCESS_KEY_ID,
    secretAccessKey: parsedEnv.data.R2_SECRET_ACCESS_KEY,
    bucket: parsedEnv.data.R2_BUCKET,
    publicUrl: parsedEnv.data.R2_PUBLIC_URL,
  }
};
