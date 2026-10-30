import { z } from "zod";
import { db } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { audit } from "@/lib/audit";
export async function updateSettings(actor: Actor, body: unknown) {
  authorize(actor, "admin", "administrar");
  const input = z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("holiday"),
        date: z.iso.date(),
        name: z.string().min(3).max(200),
      }),
      z.object({
        kind: z.literal("setting"),
        key: z.enum([
          "requestBusinessDays",
          "sessionIdleMinutes",
          "agendaNoticeHours",
          "retentionDays",
          "executionAlertPercent",
        ]),
        value: z.coerce.number().int().min(1).max(3650),
      }),
      z.object({
        kind: z.literal("commission"),
        name: z.string().min(3).max(100),
      }),
      z.object({
        kind: z.literal("membership"),
        commissionId: z.string(),
        userId: z.string(),
      }),
    ])
    .parse(body);
  if (input.kind === "holiday")
    await db.holiday.upsert({
      where: { date: input.date },
      create: { date: input.date, name: input.name },
      update: { name: input.name },
    });
  else if (input.kind === "setting") {
    if (input.key === "requestBusinessDays" && input.value > 365)
      throw new Error("Plazo inválido");
    if (
      input.key === "sessionIdleMinutes" &&
      (input.value < 5 || input.value > 120)
    )
      throw new Error("Inactividad inválida");
    await db.systemSetting.upsert({
      where: { key: input.key },
      create: { key: input.key, value: input.value },
      update: { value: input.value },
    });
  } else if (input.kind === "commission")
    await db.commission.upsert({
      where: { name: input.name },
      create: { name: input.name },
      update: {},
    });
  else {
    await db.user.findFirstOrThrow({
      where: { id: input.userId, active: true },
    });
    await db.commissionMember.upsert({
      where: {
        userId_commissionId: {
          userId: input.userId,
          commissionId: input.commissionId,
        },
      },
      create: { userId: input.userId, commissionId: input.commissionId },
      update: {},
    });
  }
  await audit({
    actorId: actor.id,
    action: "CONFIGURE",
    resource: "admin",
    metadata: { kind: input.kind },
  });
  return { ok: true };
}
