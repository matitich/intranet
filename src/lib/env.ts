import { z } from "zod";
const schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  REDIS_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/),
  AUDIT_KEY: z.string().regex(/^[a-f0-9]{64}$/),
  S3_ENDPOINT: z.string().url(),
  S3_PUBLIC_ENDPOINT: z.string().url(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY: z.string().min(3),
  S3_SECRET_KEY: z.string().min(16),
  CLAMAV_HOST: z.string(),
  CLAMAV_PORT: z.coerce.number().default(3310),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().email(),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(20),
});
let cached: z.infer<typeof schema> | undefined;
export function env() {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success)
      throw new Error(
        `Variables inválidas o ausentes: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      );
    cached = result.data;
    if (
      cached.APP_ENV === "production" &&
      !cached.APP_URL.startsWith("https://")
    )
      throw new Error("Producción requiere APP_URL HTTPS");
  }
  return cached;
}
