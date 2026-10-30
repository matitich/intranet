import "dotenv/config";
import { it, expect, afterAll } from "vitest";
import { db } from "../../src/lib/db";
import { audit } from "../../src/lib/audit";
import { scan } from "../../src/modules/documentos/storage";
import { importBudget } from "../../src/modules/presupuesto/import";
afterAll(() => db.$disconnect());
it("la base conserva las ocho funciones y todos los concejales ficticios", async () => {
  expect(await db.role.count()).toBe(8);
  expect(await db.user.count({ where: { roleId: "CONCEJAL" } })).toBe(8);
  expect(await db.councilSession.count()).toBeGreaterThanOrEqual(12);
});
it("PostgreSQL ejecuta búsqueda española con el índice vectorial", async () => {
  const rows = await db.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Document" WHERE "searchVector" @@ websearch_to_tsquery('spanish','convivencia')`;
  expect(rows.length).toBeGreaterThan(0);
});
it("la auditoría impide alterar registros desde SQL", async () => {
  await expect(
    db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "AuditLog" SET action='ALTERED' WHERE sequence=(SELECT min(sequence) FROM "AuditLog")`;
      throw new Error("El trigger no protegió el registro");
    }),
  ).rejects.toThrow(/append-only/);
});
it("las inserciones concurrentes conservan el encadenamiento de auditoría", async () => {
  const before = await db.auditLog.findFirst({ orderBy: { sequence: "desc" } });
  await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      audit({ action: `INTEGRATION_${i}`, resource: "tests" }),
    ),
  );
  const rows = await db.auditLog.findMany({
    where: { sequence: { gt: before?.sequence ?? 0n } },
    orderBy: { sequence: "asc" },
  });
  expect(rows.length).toBe(4);
  let previous = before?.hash ?? "GENESIS";
  for (const row of rows) {
    expect(row.previousHash).toBe(previous);
    previous = row.hash;
  }
});
it("ClamAV rechaza el archivo de prueba estándar EICAR", async () => {
  const eicar = Buffer.from(
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
  );
  await expect(scan(eicar)).rejects.toThrow("rechazado");
});
it("la vista previa presupuestaria mantiene exactitud y no cambia partidas", async () => {
  const count = await db.budgetLine.count();
  const preview = await importBudget(
    { id: "finanzas", roleId: "FUNCIONARIO_FINANZAS" },
    {
      year: 2026,
      lines: [
        {
          kind: "GASTO",
          subtitle: "22",
          item: "01",
          assignment: "099",
          area: "Prueba",
          description: "Monto exacto de verificación",
          initial: "9007199254740993",
          current: "9007199254740993",
        },
      ],
    },
  );
  expect(preview.total).toBe("9007199254740993");
  expect(await db.budgetLine.count()).toBe(count);
});
