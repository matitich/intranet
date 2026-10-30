import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorize, type Actor } from "@/lib/permissions";
const money = z
  .string()
  .regex(/^\d{1,20}$/)
  .refine((v) => new Prisma.Decimal(v).gte(0));
export const budgetImport = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  confirm: z.boolean().default(false),
  lines: z
    .array(
      z.object({
        kind: z.enum(["INGRESO", "GASTO"]),
        subtitle: z.string().regex(/^\d{2}$/),
        item: z.string().regex(/^\d{2}$/),
        assignment: z.string().regex(/^\d{3}$/),
        area: z.string().min(3).max(100),
        description: z.string().min(3).max(300),
        initial: money,
        current: money,
      }),
    )
    .min(1)
    .max(2000),
});
export async function importBudget(actor: Actor, input: unknown) {
  authorize(actor, "presupuesto", "editar");
  const data = budgetImport.parse(input);
  const keys = data.lines.map((l) =>
    [l.kind, l.subtitle, l.item, l.assignment, l.area].join("|"),
  );
  if (new Set(keys).size !== keys.length)
    throw new Error("Partidas duplicadas");
  const total = data.lines
    .reduce((sum, l) => sum.add(l.current), new Prisma.Decimal(0))
    .toFixed(0);
  if (!data.confirm)
    return {
      preview: true,
      count: data.lines.length,
      total,
      lines: data.lines,
    };
  await db.$transaction(async (tx) => {
    const budget = await tx.budget.upsert({
      where: { year: data.year },
      create: { year: data.year },
      update: {},
    });
    for (const line of data.lines) {
      const { initial, current, ...key } = line;
      const { description: label, ...identity } = key;
      await tx.budgetLine.upsert({
        where: {
          budgetId_kind_subtitle_item_assignment_area: {
            budgetId: budget.id,
            ...identity,
          },
        },
        create: { budgetId: budget.id, ...line },
        update: { description: label, initial, current },
      });
    }
  });
  await audit({
    actorId: actor.id,
    action: "IMPORT",
    resource: "presupuesto",
    metadata: { year: data.year, count: data.lines.length },
  });
  return { ok: true, count: data.lines.length, total };
}
