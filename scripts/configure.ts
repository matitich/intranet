import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateSecret } from "otplib";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const values: Record<string, string> = {
    ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    AUDIT_KEY: randomBytes(32).toString("hex"),
    S3_SECRET_KEY: randomBytes(24).toString("hex"),
    MINIO_ROOT_PASSWORD: "",
    DEMO_PASSWORD: `Demo!${randomBytes(12).toString("hex")}`,
    DEMO_TOTP_SECRET: generateSecret(),
  };
  values.MINIO_ROOT_PASSWORD = values.S3_SECRET_KEY;
  let file = readFileSync(".env.example", "utf8");
  for (const [key, value] of Object.entries(values))
    file = file.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  writeFileSync(".env", file, { mode: 0o600 });
  console.log("Configuración local creada. Los secretos no se imprimen.");
} else console.log("Se conserva .env existente.");

if (existsSync(".env") && !/^APP_ENV=/m.test(readFileSync(".env", "utf8"))) {
  const existing = readFileSync(".env", "utf8");
  writeFileSync(".env", existing + "\nAPP_ENV=development\n", { mode: 0o600 });
}
