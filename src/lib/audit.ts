import { Prisma } from "@prisma/client";
import { db } from "./db";
import { sha256 } from "./crypto";
type Entry = {
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipHash?: string;
  device?: string;
  metadata?: Prisma.InputJsonValue;
};
export async function audit(entry: Entry) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(812901)`;
    const last = await tx.auditLog.findFirst({ orderBy: { sequence: "desc" } });
    const previousHash = last?.hash ?? "GENESIS";
    const createdAt = new Date();
    const data = {
      ...entry,
      metadata: entry.metadata ?? {},
      previousHash,
      createdAt,
    };
    const hash = sha256(
      JSON.stringify({ ...data, createdAt: createdAt.toISOString() }),
    );
    return tx.auditLog.create({ data: { ...data, hash } });
  });
}
