import "dotenv/config";
import { PrismaClient, RoleName, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash, argon2id } from "argon2";
import { randomBytes } from "node:crypto";
import { encrypt, sha256 } from "../src/lib/crypto";
import { matrix } from "../src/lib/permissions";
import { businessDeadline } from "../src/lib/chile";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  if (process.env.APP_ENV === "production") {
    console.log("Seed de demostración omitido en producción.");
    return;
  }
  if (!process.env.DEMO_PASSWORD || !process.env.DEMO_TOTP_SECRET)
    throw new Error("Configure DEMO_PASSWORD y DEMO_TOTP_SECRET localmente.");
  if (await db.systemSetting.findUnique({ where: { key: "seed-v1" } })) {
    console.log("Seed ya aplicado; se conservan cambios.");
    return;
  }
  const passwordHash = await hash(process.env.DEMO_PASSWORD, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
  await db.$transaction(
    async (tx) => {
      await tx.municipality.create({
        data: {
          id: "municipalidad-demo",
          name: "Municipalidad de Villa del Roble (ficticia)",
        },
      });
      for (const roleId of Object.values(RoleName)) {
        await tx.role.upsert({
          where: { id: roleId },
          update: {},
          create: { id: roleId },
        });
        for (const [resource, actions] of Object.entries(matrix[roleId]))
          for (const action of actions)
            await tx.permission.upsert({
              where: { roleId_resource_action: { roleId, resource, action } },
              update: {},
              create: { roleId, resource, action },
            });
      }
      const specs: [string, string, RoleName][] = [
        ...Array.from(
          { length: 8 },
          (_, i) =>
            [
              `concejal${i + 1}`,
              `Concejal de ejemplo ${i + 1}`,
              RoleName.CONCEJAL,
            ] as [string, string, RoleName],
        ),
        ["alcalde", "Alcaldesa de ejemplo", RoleName.ALCALDE],
        ["secretario", "Secretaría Municipal", RoleName.SECRETARIO_MUNICIPAL],
        ["finanzas", "Finanzas de ejemplo", RoleName.FUNCIONARIO_FINANZAS],
        ["juridico", "Jurídico de ejemplo", RoleName.FUNCIONARIO_JURIDICO],
        [
          "respuestas",
          "Respuestas de ejemplo",
          RoleName.FUNCIONARIO_RESPUESTAS,
        ],
        ["admin", "Administración TI", RoleName.SUPERADMIN_TI],
        ["auditor", "Auditoría de ejemplo", RoleName.AUDITOR],
      ];
      for (const [id, name, roleId] of specs) {
        await tx.user.create({
          data: {
            id,
            email: `${id}@villa-roble.example.invalid`,
            name,
            roleId,
            active: true,
            passwordHash,
            mfa: {
              create: {
                encryptedSecret: encrypt(process.env.DEMO_TOTP_SECRET!),
                enabled: true,
              },
            },
            history: { create: { hash: passwordHash } },
          },
        });
      }
      const period = await tx.councilPeriod.create({
        data: {
          id: "periodo-2024",
          name: "Concejo 2024–2028",
          start: new Date("2024-12-06T12:00:00Z"),
          end: new Date("2028-12-06T12:00:00Z"),
        },
      });
      for (const name of [
        "Finanzas",
        "Desarrollo territorial",
        "Educación y cultura",
        "Salud y bienestar",
      ]) {
        const c = await tx.commission.create({ data: { name } });
        for (let i = 1; i <= 8; i++)
          if (i % 2 === 0)
            await tx.commissionMember.create({
              data: { commissionId: c.id, userId: `concejal${i}` },
            });
      }
      const year = new Date().getUTCFullYear();
      for (const [day, name] of [
        ["01-01", "Año Nuevo"],
        ["05-01", "Día del Trabajo"],
        ["05-21", "Glorias Navales"],
        ["09-18", "Independencia Nacional"],
        ["09-19", "Glorias del Ejército"],
        ["12-25", "Navidad"],
      ])
        await tx.holiday.create({ data: { date: `${year}-${day}`, name } });
      await tx.systemSetting.createMany({
        data: [
          { key: "requestBusinessDays", value: 15 },
          {
            key: "municipalityName",
            value: "Municipalidad de Villa del Roble (ficticia)",
          },
          { key: "agendaNoticeHours", value: 48 },
          { key: "executionAlertPercent", value: 95 },
          { key: "sessionIdleMinutes", value: 30 },
          { key: "retentionDays", value: 365 },
        ],
      });
      for (let month = 0; month < 12; month++) {
        const start = new Date(Date.UTC(year, month, 15, 14));
        const event = await tx.calendarEvent.create({
          data: {
            id: `evento-${month + 1}`,
            title: `Sesión ordinaria ${month + 1}`,
            type: "SESION_ORDINARIA",
            start,
            end: new Date(start.getTime() + 7200000),
            location: "Salón del Concejo",
            status: start < new Date() ? "REALIZADA" : "CONFIRMADA",
          },
        });
        const session = await tx.councilSession.create({
          data: {
            id: `sesion-${month + 1}`,
            number: month + 1,
            type: "ORDINARIA",
            eventId: event.id,
            periodId: period.id,
            agendaStatus: "PUBLICADA",
            publishedAt: new Date(start.getTime() - 72 * 3600000),
          },
        });
        for (let item = 1; item <= 3; item++)
          await tx.agendaItem.create({
            data: {
              id: `punto-${month + 1}-${item}`,
              councilSessionId: session.id,
              order: item,
              title: [
                "Aprobación del acta anterior",
                "Programa de mejoramiento de espacios públicos",
                "Cuenta de la gestión municipal",
              ][item - 1],
              description:
                "Antecedentes ficticios preparados para la demostración del Concejo.",
              type: item === 2 ? "VOTACION" : "INFORMACION",
              presenter: item === 2 ? "SECPLAN" : "Secretaría Municipal",
              minutes: 20,
              requiresVote: item === 2,
            },
          });
        await tx.minutes.create({
          data: {
            councilSessionId: session.id,
            version: 1,
            status: "APROBADA",
            text: `Acta ficticia de la sesión ${month + 1}. Se presentaron los antecedentes y se aprobaron las iniciativas de mejoramiento comunal.`,
          },
        });
        for (let i = 1; i <= 8; i++)
          await tx.eventAttendance.create({
            data: {
              eventId: event.id,
              userId: `concejal${i}`,
              status: "ASISTIRE",
            },
          });
        const vote = await tx.vote.create({
          data: {
            agendaItemId: `punto-${month + 1}-2`,
            result: "APROBADO",
            records: {
              create: Array.from({ length: 8 }, (_, i) => ({
                userId: `concejal${i + 1}`,
                choice: i === 7 ? "ABSTENCION" : "A_FAVOR",
              })),
            },
          },
        });
        await tx.agreement.create({
          data: {
            id: `acuerdo-${month + 1}`,
            number: month + 1,
            year,
            date: start,
            councilSessionId: session.id,
            voteId: vote.id,
            text: `Aprobar programa de mejoramiento de espacios públicos, etapa ${month + 1}.`,
            subject: "Desarrollo comunal",
            responsible: "SECPLAN",
            deadline: new Date(start.getTime() + 45 * 86400000),
            priority: month % 3 === 0 ? "ALTA" : "NORMAL",
            status: month < 6 ? "CUMPLIDO" : "EN_EJECUCION",
            progress: {
              create: {
                authorId: "secretario",
                comment:
                  "Avance de ejemplo respaldado por la unidad responsable.",
                percent: month < 6 ? 100 : 40,
              },
            },
          },
        });
        await tx.document.create({
          data: {
            id: `documento-${month + 1}`,
            title: `Ordenanza de convivencia comunal · ${month + 1}`,
            type: "ORDENANZA",
            number: String(month + 1),
            year,
            publicationDate: start,
            subject: "Convivencia y espacio público",
            unit: "Asesoría Jurídica",
            classification: month === 11 ? "RESERVADO" : "INTERNO",
            tags: { create: { name: "Comunidad" } },
            access:
              month === 11
                ? {
                    create: [{ userId: "secretario" }, { userId: "concejal1" }],
                  }
                : undefined,
          },
        });
        await tx.informationRequest.create({
          data: {
            id: `solicitud-${month + 1}`,
            authorId: `concejal${(month % 8) + 1}`,
            assigneeId: "respuestas",
            recipient: "Alcaldía",
            subject: `Avance del programa comunal ${month + 1}`,
            description:
              "Solicito informar el estado de avance y la ejecución de los recursos asignados al programa de ejemplo.",
            basis:
              "Antecedentes para el ejercicio de la función fiscalizadora.",
            deadline: businessDeadline(start, 15, new Set()),
            status: month < 6 ? "RESPONDIDA" : "EN_PROCESO",
            createdAt: start,
            messages: {
              create: {
                authorId:
                  month < 6 ? "respuestas" : `concejal${(month % 8) + 1}`,
                body:
                  month < 6
                    ? "Se remite el informe oficial de ejemplo con el detalle solicitado."
                    : "Solicitud recibida para su gestión.",
                official: month < 6,
              },
            },
            statusLogs: {
              create: {
                actorId: "respuestas",
                previous: "ENVIADA",
                next: month < 6 ? "RESPONDIDA" : "EN_PROCESO",
              },
            },
          },
        });
      }
      for (const budgetYear of [year - 1, year]) {
        const b = await tx.budget.create({ data: { year: budgetYear } });
        for (const [i, area] of [
          "Municipal",
          "Salud",
          "Educación",
          "Cultura",
        ].entries()) {
          const initial = new Prisma.Decimal("2500000000").mul(i + 1);
          await tx.budgetLine.create({
            data: {
              budgetId: b.id,
              kind: "GASTO",
              subtitle: "21",
              item: String(i + 1).padStart(2, "0"),
              assignment: "001",
              area,
              description: `Servicios y programas de ${area.toLowerCase()}`,
              initial,
              current: initial.mul("1.08"),
              executions: {
                create: Array.from({ length: 12 }, (_, m) => ({
                  month: m + 1,
                  accrued: initial.mul("0.06"),
                  received: initial.mul("0.05"),
                })),
              },
            },
          });
        }
      }
      await tx.announcement.create({
        data: {
          title: "Bienvenidos al espacio del Concejo",
          body: "Consulte antecedentes, prepare sus sesiones y haga seguimiento a la gestión municipal. Todos los datos de este entorno son ficticios.",
          priority: "NORMAL",
          expiresAt: new Date(Date.now() + 365 * 86400000),
        },
      });
      for (const [id] of specs)
        await tx.notification.create({
          data: {
            userId: id,
            type: "SISTEMA",
            title: "Su intranet está disponible",
            body: "Revise el calendario y los documentos del Concejo.",
            href: "/inicio",
          },
        });
      const createdAt = new Date();
      const data = {
        action: "SEED",
        resource: "sistema",
        metadata: { fictitious: true },
        previousHash: "GENESIS",
        createdAt,
      };
      await tx.auditLog.create({
        data: {
          ...data,
          hash: sha256(
            JSON.stringify({ ...data, createdAt: createdAt.toISOString() }),
          ),
        },
      });
      await tx.systemSetting.create({
        data: {
          key: "seed-v1",
          value: { applied: true, nonce: randomBytes(8).toString("hex") },
        },
      });
    },
    { timeout: 120000 },
  );
  console.log(
    "Datos ficticios creados. Credenciales solo en .env local; correos documentados en README.",
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Error de seed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
