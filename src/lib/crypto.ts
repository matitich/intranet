import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { env } from "./env";
export const token = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export const anonymize = (value: string) =>
  createHmac("sha256", env().AUDIT_KEY).update(value).digest("hex");
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(env().ENCRYPTION_KEY, "hex"),
      iv,
    );
  return [
    "v1",
    iv.toString("base64url"),
    Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString(
      "base64url",
    ),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
export function decrypt(value: string) {
  const [version, iv, data, tag] = value.split(".");
  if (version !== "v1" || !iv || !data || !tag)
    throw new Error("Formato cifrado inválido");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(env().ENCRYPTION_KEY, "hex"),
    Buffer.from(iv, "base64url"),
  );
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "base64url")),
    cipher.final(),
  ]).toString("utf8");
}
