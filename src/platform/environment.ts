import { z } from "zod";

const localhostNames = new Set(["127.0.0.1", "::1", "localhost"]);

function usesLocalhost(value: string) {
  return localhostNames.has(new URL(value).hostname);
}

export const applicationEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "uat", "production"]),
    APP_URL: z.string().url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    DATA_ENCRYPTION_KEY: z.string().optional(),
    OWNER_BOOTSTRAP_TOKEN: z.string().min(32).optional(),
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(8),
    DB_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(500)
      .max(30_000)
      .default(5_000),
    DB_IDLE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(10_000),
    REDIS_URL: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined))
      .refine((value) => {
        if (!value) return true;
        const protocol = new URL(value).protocol;
        return protocol === "redis:" || protocol === "rediss:";
      }, "REDIS_URL must use redis:// or rediss://"),
    PRIVATE_STORAGE_ROOT: z
      .string()
      .min(1)
      .refine(
        (value) => !/(^|[\\/])public([\\/]|$)/u.test(value),
        "Private storage must be outside every public directory",
      ),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_FROM: z.string().min(3),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    MAILPIT_URL: z.string().url().optional(),
  })
  .superRefine((environment, context) => {
    if (environment.APP_ENV === "uat" || environment.APP_ENV === "production") {
      for (const field of ["APP_URL", "DATABASE_URL"] as const) {
        if (usesLocalhost(environment[field])) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} cannot use localhost in ${environment.APP_ENV}`,
          });
        }
      }

      if (environment.REDIS_URL && usesLocalhost(environment.REDIS_URL)) {
        context.addIssue({
          code: "custom",
          path: ["REDIS_URL"],
          message: `REDIS_URL cannot use localhost in ${environment.APP_ENV}`,
        });
      }

      if (environment.MAILPIT_URL) {
        context.addIssue({
          code: "custom",
          path: ["MAILPIT_URL"],
          message: "Mailpit is allowed only in development or test",
        });
      }

      if (!environment.DATA_ENCRYPTION_KEY) {
        context.addIssue({
          code: "custom",
          path: ["DATA_ENCRYPTION_KEY"],
          message: `DATA_ENCRYPTION_KEY is required in ${environment.APP_ENV}`,
        });
      }
    }

    if (environment.DATA_ENCRYPTION_KEY) {
      const decoded = Buffer.from(environment.DATA_ENCRYPTION_KEY, "base64");
      if (decoded.length !== 32) {
        context.addIssue({
          code: "custom",
          path: ["DATA_ENCRYPTION_KEY"],
          message: "DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
        });
      }
    }
  });

export type ApplicationEnvironment = z.infer<
  typeof applicationEnvironmentSchema
>;

export function parseApplicationEnvironment(
  source: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ApplicationEnvironment {
  return applicationEnvironmentSchema.parse(source);
}
