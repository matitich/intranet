import { beforeAll, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt, sha256 } from "../src/lib/crypto";
beforeAll(() => {
  Object.assign(process.env, {
    APP_ENV: "test",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    REDIS_URL: "redis://localhost:6379",
    ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    AUDIT_KEY: randomBytes(32).toString("hex"),
    S3_ENDPOINT: "http://localhost:9000",
    S3_PUBLIC_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_BUCKET: "test",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: randomBytes(24).toString("hex"),
    CLAMAV_HOST: "localhost",
    SMTP_HOST: "localhost",
    SMTP_FROM: "test@example.invalid",
  });
});
it("cifra con IV aleatorio y descifra íntegramente", () => {
  const a = encrypt("Nota privada"),
    b = encrypt("Nota privada");
  expect(a).not.toBe(b);
  expect(a).not.toContain("Nota");
  expect(decrypt(a)).toBe("Nota privada");
});
it("detecta manipulación del texto cifrado", () => {
  const parts = encrypt("Privado").split(".");
  parts[2] = Buffer.from("alterado").toString("base64url");
  expect(() => decrypt(parts.join("."))).toThrow();
});
it("hash SHA-256 tiene longitud y resultado reproducible", () => {
  expect(sha256("abc")).toHaveLength(64);
  expect(sha256("abc")).toBe(sha256("abc"));
});
