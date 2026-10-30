import { cookies, headers } from "next/headers";
import { hash, verify as verifyHash, argon2id } from "argon2";
import { verify as verifyOtp, generateSecret, generateURI } from "otplib";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { token, sha256, encrypt, decrypt, anonymize } from "@/lib/crypto";
import { rateLimit } from "@/lib/redis";
import { audit } from "@/lib/audit";
import { strongPassword } from "@/lib/password-policy";
import { sendMail } from "@/lib/mail";
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine(strongPassword, "Contraseña común o predecible")
  .refine(
    (v) =>
      /[A-Z]/.test(v) &&
      /[a-z]/.test(v) &&
      /\d/.test(v) &&
      /[^a-zA-Z0-9]/.test(v),
    "Use mayúscula, minúscula, número y símbolo",
  )
  .refine(
    (v) =>
      !["password", "contraseña", "qwerty", "123456", "municipalidad"].some(
        (word) => v.toLowerCase().includes(word),
      ),
    "Contraseña demasiado común",
  );
export const passwordHash = (value: string) =>
  hash(value, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
export const cookieName = () =>
  env().APP_ENV === "production" ? "__Host-intranet" : "intranet";
const cookieOptions = () => ({
  httpOnly: true,
  secure: env().APP_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});
export async function context() {
  const h = await headers();
  return {
    ipHash: anonymize(h.get("x-real-ip") ?? "unknown"),
    device: (h.get("user-agent") ?? "Desconocido").slice(0, 200),
  };
}
export async function sessionIdleMinutes() {
  const setting = await db.systemSetting.findUnique({
    where: { key: "sessionIdleMinutes" },
  });
  return typeof setting?.value === "number" &&
    setting.value >= 5 &&
    setting.value <= 120
    ? setting.value
    : env().SESSION_IDLE_MINUTES;
}
export async function currentUser() {
  const value = (await cookies()).get(cookieName())?.value;
  if (!value) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(value) },
    include: { user: true },
  });
  const now = new Date();
  if (
    !session ||
    !session.user.active ||
    session.user.deletedAt ||
    session.expiresAt < now ||
    now.getTime() - session.lastSeenAt.getTime() >
      (await sessionIdleMinutes()) * 60000
  )
    return null;
  if (now.getTime() - session.lastSeenAt.getTime() > 60000)
    await db.session.updateMany({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  return session.user;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
export async function login(email: string, password: string) {
  const ctx = await context();
  const accountHash = anonymize(email.toLowerCase());
  await rateLimit(`login-ip:${ctx.ipHash}`, 30, 900);
  await rateLimit(`login-account:${accountHash}`, 8, 900);
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  // Always perform an expensive hash operation for unknown accounts.
  const valid = user?.passwordHash
    ? await verifyHash(user.passwordHash, password)
    : Boolean(await passwordHash(password)) && false;
  await db.loginAttempt.create({
    data: {
      accountHash,
      ipHash: ctx.ipHash,
      success: Boolean(valid && user?.active),
    },
  });
  if (!valid || !user?.active || user.deletedAt)
    throw new Error("Credenciales inválidas");
  const challenge = token();
  await db.mfaChallenge.create({
    data: {
      id: sha256(challenge),
      userId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60000),
    },
  });
  (await cookies()).set("mfa-challenge", challenge, {
    ...cookieOptions(),
    maxAge: 300,
  });
  await audit({
    actorId: user.id,
    action: "PASSWORD_VERIFIED",
    resource: "auth",
    ...ctx,
  });
  return { mfaRequired: true };
}
export async function mfaSetup() {
  const challenge = await getChallenge();
  const user = await db.user.findUniqueOrThrow({
    where: { id: challenge.userId },
    include: { mfa: true },
  });
  if (user.mfa?.enabled) throw new Error("MFA ya configurado");
  const secret = user.mfa
    ? decrypt(user.mfa.encryptedSecret)
    : generateSecret();
  if (!user.mfa)
    await db.mfaSecret.create({
      data: { userId: user.id, encryptedSecret: encrypt(secret) },
    });
  return {
    secret,
    uri: generateURI({
      issuer: "Intranet municipal",
      label: user.email,
      secret,
    }),
  };
}
async function getChallenge() {
  const value = (await cookies()).get("mfa-challenge")?.value;
  const challenge = value
    ? await db.mfaChallenge.findUnique({ where: { id: sha256(value) } })
    : null;
  if (!challenge || challenge.expiresAt < new Date())
    throw new Error("Desafío expirado");
  return challenge;
}
export async function completeMfa(code: string) {
  const challenge = await getChallenge();
  await rateLimit(`mfa:${challenge.userId}`, 8, 300);
  const mfa = await db.mfaSecret.findUnique({
    where: { userId: challenge.userId },
  });
  if (!mfa) throw new Error("Configure MFA");
  const isRecovery = code.length > 6;
  const result = isRecovery
    ? null
    : await verifyOtp({
        secret: decrypt(mfa.encryptedSecret),
        token: code,
        epochTolerance: 30,
        afterTimeStep: Number(mfa.lastStep),
      });
  const step =
    result?.valid && "timeStep" in result && typeof result.timeStep === "number"
      ? BigInt(result.timeStep)
      : null;
  const recoveryCodes = !mfa.enabled
    ? Array.from({ length: 10 }, () => token().slice(0, 16))
    : [];
  await db.$transaction(async (tx) => {
    const used = await tx.mfaChallenge.deleteMany({
      where: { id: challenge.id, expiresAt: { gt: new Date() } },
    });
    if (!used.count) throw new Error("Desafío usado");
    const user = await tx.user.findUniqueOrThrow({
      where: { id: challenge.userId },
    });
    if (!user.active || user.deletedAt) throw new Error("Cuenta inactiva");
    if (isRecovery) {
      const consumed = await tx.recoveryCode.updateMany({
        where: { userId: user.id, hash: sha256(code), usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!consumed.count) throw new Error("Código inválido");
    } else {
      if (step === null) throw new Error("Código inválido");
      const updated = await tx.mfaSecret.updateMany({
        where: { userId: user.id, lastStep: { lt: step } },
        data: { lastStep: step, enabled: true },
      });
      if (!updated.count) throw new Error("Código ya utilizado");
    }
    if (recoveryCodes.length)
      await tx.recoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ userId: user.id, hash: sha256(c) })),
      });
  });
  const raw = token(),
    ctx = await context();
  const user = await db.user.findUniqueOrThrow({
    where: { id: challenge.userId },
  });
  const known = await db.session.findFirst({
    where: { userId: user.id, device: ctx.device, ipHash: ctx.ipHash },
  });
  const existing = (await cookies()).get(cookieName())?.value;
  if (existing)
    await db.session.deleteMany({ where: { tokenHash: sha256(existing) } });
  await db.session.create({
    data: {
      tokenHash: sha256(raw),
      userId: user.id,
      ...ctx,
      expiresAt: new Date(Date.now() + 12 * 3600000),
    },
  });
  (await cookies()).set(cookieName(), raw, {
    ...cookieOptions(),
    maxAge: 43200,
  });
  (await cookies()).delete("mfa-challenge");
  await audit({ actorId: user.id, action: "LOGIN", resource: "auth", ...ctx });
  if (!known)
    await sendMail(
      user.email,
      "Nuevo inicio de sesión",
      "Se inició una sesión en un dispositivo nuevo. Si no fue usted, cierre todas sus sesiones desde Mi cuenta.",
    );
  return { ok: true, recoveryCodes };
}
export async function logout(all = false) {
  const user = await requireUser(),
    jar = await cookies(),
    raw = jar.get(cookieName())?.value;
  await db.session.deleteMany({
    where: all ? { userId: user.id } : { tokenHash: sha256(raw ?? "") },
  });
  jar.delete(cookieName());
  await audit({
    actorId: user.id,
    action: all ? "LOGOUT_ALL" : "LOGOUT",
    resource: "auth",
  });
}
export async function changePassword(
  userId: string,
  newPassword: string,
  currentPassword: string,
) {
  await rateLimit(`password-change:${userId}`, 5, 900);
  const account = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (
    !account.passwordHash ||
    !(await verifyHash(account.passwordHash, currentPassword))
  )
    throw new Error("Contraseña actual inválida");
  passwordSchema.parse(newPassword);
  const history = await db.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const old of history)
    if (await verifyHash(old.hash, newPassword))
      throw new Error("Contraseña reutilizada");
  const value = await passwordHash(newPassword);
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash: value, mustChangePassword: false },
    }),
    db.passwordHistory.create({ data: { userId, hash: value } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}
export async function recover(email: string) {
  const ctx = await context();
  await rateLimit(`recover:${ctx.ipHash}`, 5, 900);
  await rateLimit(`recover-account:${anonymize(email)}`, 3, 900);
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.active) return;
  const raw = token();
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 20 * 60000),
    },
  });
  await sendMail(
    email,
    "Recuperar acceso",
    `Recupere su acceso en ${env().APP_URL}/activar?token=${raw}&tipo=recuperacion`,
  );
}
export async function activate(raw: string, password: string, kind: string) {
  passwordSchema.parse(password);
  const record =
    kind === "invitacion"
      ? await db.invitation.findUnique({ where: { tokenHash: sha256(raw) } })
      : await db.passwordResetToken.findUnique({
          where: { tokenHash: sha256(raw) },
        });
  if (!record || record.usedAt || record.expiresAt < new Date())
    throw new Error("Enlace inválido");
  const value = await passwordHash(password);
  await db.$transaction(async (tx) => {
    const where = {
      id: record.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    };
    const consumed =
      kind === "invitacion"
        ? await tx.invitation.updateMany({
            where,
            data: { usedAt: new Date() },
          })
        : await tx.passwordResetToken.updateMany({
            where,
            data: { usedAt: new Date() },
          });
    if (!consumed.count) throw new Error("Enlace utilizado");
    const history = await tx.passwordHistory.findMany({
      where: { userId: record.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    for (const old of history)
      if (await verifyHash(old.hash, password))
        throw new Error("Contraseña reutilizada");
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: value, active: true, mustChangePassword: false },
    });
    await tx.passwordHistory.create({
      data: { userId: record.userId, hash: value },
    });
    await tx.session.deleteMany({ where: { userId: record.userId } });
  });
  await audit({
    actorId: record.userId,
    action: "PASSWORD_SET",
    resource: "auth",
  });
}
