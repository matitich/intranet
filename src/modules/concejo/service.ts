import { Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  authorize,
  can,
  documentWhere,
  requestWhere,
  Forbidden,
  type Resource,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { businessDeadline, requestTransitions } from "@/lib/chile";
import { decrypt, encrypt, token, sha256 } from "@/lib/crypto";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
export const resourceSchema = z.enum([
  "documentos",
  "calendario",
  "sesiones",
  "presupuesto",
  "acuerdos",
  "solicitudes",
  "archivo",
  "notificaciones",
  "admin",
  "auditoria",
]);
const text = z.string().trim().min(3).max(300);
const description = z.string().trim().min(5).max(20000);
const pageSchema = z.object({
  q: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  status: z.string().max(40).default(""),
});
export async function list(resource: Resource, user: User, input: unknown) {
  const { q, page, status } = pageSchema.parse(input);
  const paging = { skip: (page - 1) * 20, take: 20 };
  if (resource !== "documentos") authorize(user, resource, "ver");
  switch (resource) {
    case "documentos": {
      let ids: string[] | undefined;
      if (q) {
        ids = (
          await db.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "Document" WHERE "searchVector" @@ websearch_to_tsquery('spanish', ${q}) OR title ILIKE ${"%" + q + "%"} ORDER BY "publicationDate" DESC LIMIT 200`
        ).map((x) => x.id);
      }
      const where: Prisma.DocumentWhereInput = {
        AND: [
          documentWhere(user),
          ...(ids ? [{ id: { in: ids } }] : []),
          ...(status ? [{ status }] : []),
        ],
      };
      const [items, total] = await Promise.all([
        db.document.findMany({
          where,
          ...paging,
          orderBy: { publicationDate: "desc" },
          include: {
            tags: true,
            versions: { orderBy: { version: "desc" }, take: 1 },
            favorites: { where: { userId: user.id } },
          },
        }),
        db.document.count({ where }),
      ]);
      return { items, total, page };
    }
    case "calendario": {
      const where = {
        title: { contains: q, mode: "insensitive" as const },
        ...(status ? { status } : {}),
      };
      const [items, total] = await Promise.all([
        db.calendarEvent.findMany({
          where,
          ...paging,
          orderBy: { start: "desc" },
          include: {
            attendance: { where: { userId: user.id } },
            councilSession: { select: { id: true } },
          },
        }),
        db.calendarEvent.count({ where }),
      ]);
      return { items, total, page };
    }
    case "sesiones":
    case "archivo": {
      const where: Prisma.CouncilSessionWhereInput = {
        event: { title: { contains: q, mode: "insensitive" } },
        ...(user.roleId !== "SECRETARIO_MUNICIPAL"
          ? { agendaStatus: { not: "BORRADOR" } }
          : {}),
        ...(status ? { agendaStatus: status } : {}),
      };
      const [items, total] = await Promise.all([
        db.councilSession.findMany({
          where,
          ...paging,
          orderBy: { event: { start: "desc" } },
          include: {
            event: true,
            minutes: true,
            recordings: true,
            _count: { select: { items: true, agreements: true } },
          },
        }),
        db.councilSession.count({ where }),
      ]);
      return { items, total, page };
    }
    case "acuerdos": {
      const where = {
        text: { contains: q, mode: "insensitive" as const },
        ...(status ? { status } : {}),
      };
      const [items, total] = await Promise.all([
        db.agreement.findMany({
          where,
          ...paging,
          orderBy: { deadline: "asc" },
          include: { progress: { orderBy: { createdAt: "desc" }, take: 1 } },
        }),
        db.agreement.count({ where }),
      ]);
      return { items, total, page };
    }
    case "solicitudes": {
      const where: Prisma.InformationRequestWhereInput = {
        AND: [
          requestWhere(user),
          { subject: { contains: q, mode: "insensitive" } },
          ...(status ? [{ status }] : []),
        ],
      };
      const [items, total] = await Promise.all([
        db.informationRequest.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { name: true } },
            assignee: { select: { name: true } },
          },
        }),
        db.informationRequest.count({ where }),
      ]);
      return { items, total, page };
    }
    case "presupuesto": {
      const items = await db.budget.findMany({
        orderBy: { year: "desc" },
        include: {
          lines: { include: { executions: true } },
          modifications: true,
        },
      });
      return { items, total: items.length, page: 1 };
    }
    case "notificaciones": {
      const where = {
        userId: user.id,
        archivedAt: null,
        title: { contains: q, mode: "insensitive" as const },
      };
      const [items, total] = await Promise.all([
        db.notification.findMany({
          where,
          ...paging,
          orderBy: { createdAt: "desc" },
        }),
        db.notification.count({ where }),
      ]);
      return { items, total, page };
    }
    case "admin": {
      const where = {
        deletedAt: null,
        name: { contains: q, mode: "insensitive" as const },
      };
      const [items, total] = await Promise.all([
        db.user.findMany({
          where,
          ...paging,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            roleId: true,
            active: true,
            createdAt: true,
          },
        }),
        db.user.count({ where }),
      ]);
      return { items, total, page };
    }
    case "auditoria": {
      const items = await db.auditLog.findMany({
        where: { resource: { contains: q } },
        ...paging,
        orderBy: { sequence: "desc" },
      });
      return {
        items,
        total: await db.auditLog.count({
          where: { resource: { contains: q } },
        }),
        page,
      };
    }
  }
}
export async function detail(resource: Resource, id: string, user: User) {
  if (resource !== "documentos") authorize(user, resource, "ver");
  switch (resource) {
    case "documentos": {
      const value = await db.document.findFirst({
        where: { AND: [{ id }, documentWhere(user)] },
        include: {
          tags: true,
          versions: { orderBy: { version: "desc" } },
          sourceRelations: {
            include: {
              target: {
                select: {
                  id: true,
                  title: true,
                  classification: true,
                  access: {
                    where: { userId: user.id },
                    select: { userId: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!value) throw new Forbidden();
      await audit({
        actorId: user.id,
        action: "VIEW",
        resource,
        resourceId: id,
      });
      return {
        ...value,
        sourceRelations: value.sourceRelations.filter(
          (r) =>
            r.target.classification !== "RESERVADO" || r.target.access.length,
        ),
      };
    }
    case "solicitudes": {
      const value = await db.informationRequest.findFirst({
        where: { AND: [{ id }, requestWhere(user)] },
        include: {
          author: { select: { name: true } },
          assignee: { select: { name: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { name: true } } },
          },
          statusLogs: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!value) throw new Forbidden();
      return value;
    }
    case "sesiones":
    case "archivo": {
      const value = await db.councilSession.findFirst({
        where: {
          id,
          ...(user.roleId !== "SECRETARIO_MUNICIPAL"
            ? { agendaStatus: { not: "BORRADOR" } }
            : {}),
        },
        include: {
          event: {
            include: {
              attendance: { include: { user: { select: { name: true } } } },
            },
          },
          items: {
            orderBy: { order: "asc" },
            include: {
              attachments: {
                include: {
                  document: {
                    select: {
                      id: true,
                      title: true,
                      classification: true,
                      access: {
                        where: { userId: user.id },
                        select: { userId: true },
                      },
                    },
                  },
                },
              },
              vote: {
                include: {
                  records: { include: { user: { select: { name: true } } } },
                },
              },
              notes: { where: { userId: user.id } },
              reviews: { where: { userId: user.id } },
            },
          },
          minutes: true,
          agreements: true,
          recordings: true,
        },
      });
      if (!value) throw new Forbidden();
      return {
        ...value,
        items: value.items.map((item) => ({
          ...item,
          attachments: item.attachments.filter(
            (a) =>
              a.document.classification !== "RESERVADO" ||
              a.document.access.length,
          ),
          notes: item.notes.map((n) => ({
            id: n.id,
            text: decrypt(n.ciphertext),
          })),
        })),
      };
    }
    case "acuerdos":
      return db.agreement.findUniqueOrThrow({
        where: { id },
        include: {
          progress: { orderBy: { createdAt: "asc" } },
          councilSession: { include: { event: true } },
        },
      });
    default:
      throw new Forbidden();
  }
}
export async function create(resource: Resource, user: User, body: unknown) {
  authorize(user, resource, resource === "admin" ? "administrar" : "crear");
  let result: { id: string };
  switch (resource) {
    case "solicitudes": {
      const v = z
        .object({
          subject: text,
          description,
          basis: description,
          recipient: text,
          priority: z.enum(["NORMAL", "ALTA", "URGENTE"]).default("NORMAL"),
        })
        .parse(body);
      const [holidays, setting] = await Promise.all([
        db.holiday.findMany(),
        db.systemSetting.findUnique({ where: { key: "requestBusinessDays" } }),
      ]);
      result = await db.informationRequest.create({
        data: {
          ...v,
          authorId: user.id,
          deadline: businessDeadline(
            new Date(),
            z
              .number()
              .int()
              .min(1)
              .max(365)
              .parse(setting?.value ?? 15),
            new Set(holidays.map((h) => h.date)),
          ),
          statusLogs: { create: { actorId: user.id, next: "ENVIADA" } },
        },
      });
      break;
    }
    case "calendario": {
      const v = z
        .object({
          title: text,
          type: z.enum([
            "SESION_ORDINARIA",
            "SESION_EXTRAORDINARIA",
            "COMISION",
            "AUDIENCIA",
            "REUNION",
            "OTRO",
          ]),
          start: z.iso.datetime(),
          end: z.iso.datetime(),
          location: text,
        })
        .refine(
          (v) => new Date(v.end) > new Date(v.start),
          "La hora de término debe ser posterior",
        )
        .parse(body);
      result = await db.calendarEvent.create({ data: v });
      break;
    }
    case "documentos": {
      const v = z
        .object({
          title: text,
          type: z.enum([
            "ORDENANZA",
            "DECRETO",
            "REGLAMENTO",
            "CONVENIO",
            "RESOLUCION",
            "OTRO",
          ]),
          number: z.string().min(1).max(30),
          year: z.coerce.number().int().min(1900).max(2200),
          subject: text,
          unit: text,
          classification: z.enum(["PUBLICO", "INTERNO", "RESERVADO"]),
          publicationDate: z.iso.datetime(),
        })
        .parse(body);
      result = await db.document.create({
        data: {
          ...v,
          access:
            v.classification === "RESERVADO"
              ? { create: { userId: user.id } }
              : undefined,
        },
      });
      break;
    }
    case "sesiones": {
      const v = z
        .object({
          eventId: z.string(),
          periodId: z.string(),
          number: z.coerce.number().int().positive(),
          type: z.enum(["ORDINARIA", "EXTRAORDINARIA"]),
        })
        .parse(body);
      result = await db.councilSession.create({ data: v });
      break;
    }
    case "acuerdos": {
      const v = z
        .object({
          number: z.coerce.number().int().positive(),
          year: z.coerce.number().int(),
          councilSessionId: z.string(),
          text: description,
          subject: text,
          responsible: text,
          deadline: z.iso.datetime(),
          priority: z.enum(["NORMAL", "ALTA", "URGENTE"]).default("NORMAL"),
        })
        .parse(body);
      result = await db.agreement.create({ data: { ...v, date: new Date() } });
      break;
    }
    case "notificaciones": {
      const v = z
        .object({
          title: text,
          body: description,
          priority: z.enum(["NORMAL", "ALTA", "URGENTE"]),
          expiresAt: z.iso.datetime(),
        })
        .parse(body);
      result = await db.announcement.create({ data: v });
      const users = await db.user.findMany({
        where: { active: true, deletedAt: null },
        select: { id: true },
      });
      await db.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: "ANUNCIO",
          title: v.title,
          body: v.body,
          href: "/inicio",
        })),
      });
      break;
    }
    case "admin": {
      const v = z
        .object({
          name: text,
          email: z.email().transform((x) => x.toLowerCase()),
          roleId: z.enum([
            "SUPERADMIN_TI",
            "SECRETARIO_MUNICIPAL",
            "ALCALDE",
            "CONCEJAL",
            "FUNCIONARIO_FINANZAS",
            "FUNCIONARIO_JURIDICO",
            "FUNCIONARIO_RESPUESTAS",
            "AUDITOR",
          ]),
        })
        .parse(body);
      const roleId = v.roleId as User["roleId"];
      const raw = token();
      result = await db.user.create({
        data: {
          ...v,
          roleId,
          invitations: {
            create: {
              tokenHash: sha256(raw),
              expiresAt: new Date(Date.now() + 48 * 3600000),
            },
          },
        },
      });
      await sendMail(
        v.email,
        "Invitación a la intranet del Concejo",
        `Active su cuenta: ${env().APP_URL}/activar?tipo=invitacion&token=${raw}`,
      );
      break;
    }
    default:
      throw new Forbidden();
  }
  await audit({
    actorId: user.id,
    action: "CREATE",
    resource,
    resourceId: result.id,
  });
  return result;
}
export async function mutate(
  resource: Resource,
  id: string,
  user: User,
  body: unknown,
) {
  const input = z
    .object({ action: z.string().max(30), data: z.unknown().optional() })
    .parse(body);
  const data = input.data;
  if (resource === "notificaciones") {
    const action = z.enum(["leer", "archivar"]).parse(input.action);
    const updated = await db.notification.updateMany({
      where: { id, userId: user.id },
      data:
        action === "leer" ? { readAt: new Date() } : { archivedAt: new Date() },
    });
    if (!updated.count) throw new Forbidden();
    return { ok: true };
  }
  if (resource === "documentos" && input.action === "favorito") {
    await detail(resource, id, user);
    const key = { userId: user.id, documentId: id };
    const found = await db.favorite.findUnique({
      where: { userId_documentId: key },
    });
    if (found) await db.favorite.delete({ where: { userId_documentId: key } });
    else await db.favorite.create({ data: key });
    return { ok: true };
  }
  if (resource === "calendario" && input.action === "asistencia") {
    authorize(user, "calendario", "ver");
    if (user.roleId !== "CONCEJAL") throw new Forbidden();
    const v = z
      .object({
        status: z.enum(["ASISTIRE", "NO_ASISTIRE", "CON_RETRASO"]),
        justification: z.string().max(2000).optional(),
      })
      .parse(data);
    await db.calendarEvent.findUniqueOrThrow({ where: { id } });
    await db.eventAttendance.upsert({
      where: { eventId_userId: { eventId: id, userId: user.id } },
      create: { eventId: id, userId: user.id, ...v },
      update: v,
    });
  } else if (
    resource === "sesiones" &&
    ["nota", "revisado"].includes(input.action)
  ) {
    authorize(user, "sesiones", "ver");
    const item = await db.agendaItem.findUniqueOrThrow({
      where: { id },
      include: { councilSession: true },
    });
    if (
      item.councilSession.agendaStatus === "BORRADOR" &&
      user.roleId !== "SECRETARIO_MUNICIPAL"
    )
      throw new Forbidden();
    if (input.action === "nota") {
      const v = z.object({ text: z.string().max(20000) }).parse(data);
      await db.personalNote.upsert({
        where: { userId_agendaItemId: { userId: user.id, agendaItemId: id } },
        create: {
          userId: user.id,
          agendaItemId: id,
          ciphertext: encrypt(v.text),
        },
        update: { ciphertext: encrypt(v.text) },
      });
    } else
      await db.agendaReview.upsert({
        where: { agendaItemId_userId: { agendaItemId: id, userId: user.id } },
        create: { agendaItemId: id, userId: user.id },
        update: {
          reviewed: z.object({ reviewed: z.boolean() }).parse(data).reviewed,
        },
      });
  } else if (resource === "solicitudes") {
    const request = await db.informationRequest.findFirst({
      where: { AND: [{ id }, requestWhere(user)] },
    });
    if (!request) throw new Forbidden();
    if (input.action === "mensaje") {
      const v = z
        .object({ body: description, official: z.boolean().default(false) })
        .parse(data);
      if (
        v.official &&
        (!can(user, resource, "editar") ||
          user.roleId === "SECRETARIO_MUNICIPAL")
      )
        throw new Forbidden();
      if (user.roleId === "CONCEJAL" && request.authorId !== user.id)
        throw new Forbidden();
      await db.requestMessage.create({
        data: { requestId: id, authorId: user.id, ...v },
      });
    } else if (input.action === "estado") {
      const v = z.object({ status: z.string() }).parse(data);
      if (user.roleId === "CONCEJAL") {
        if (
          request.authorId !== user.id ||
          !["CERRADA", "DESISTIDA"].includes(v.status)
        )
          throw new Forbidden();
      } else authorize(user, resource, "editar");
      if (!requestTransitions[request.status]?.includes(v.status))
        throw new Error("Transición inválida");
      if (
        v.status === "RESPONDIDA" &&
        !(await db.requestMessage.count({
          where: { requestId: id, official: true },
        }))
      )
        throw new Error("Falta una respuesta oficial");
      await db.$transaction(async (tx) => {
        const updated = await tx.informationRequest.updateMany({
          where: { id, status: request.status },
          data: { status: v.status },
        });
        if (!updated.count) throw new Error("Conflicto de estado");
        await tx.requestStatusLog.create({
          data: {
            requestId: id,
            actorId: user.id,
            previous: request.status,
            next: v.status,
          },
        });
      });
    } else if (input.action === "asignar") {
      if (!["SECRETARIO_MUNICIPAL", "ALCALDE"].includes(user.roleId))
        throw new Forbidden();
      const v = z.object({ assigneeId: z.string() }).parse(data);
      await db.user.findFirstOrThrow({
        where: {
          id: v.assigneeId,
          roleId: "FUNCIONARIO_RESPUESTAS",
          active: true,
        },
      });
      await db.informationRequest.update({ where: { id }, data: v });
    } else if (input.action === "compartir") {
      if (user.roleId !== "SECRETARIO_MUNICIPAL") throw new Forbidden();
      const v = z.object({ visibleToCouncil: z.boolean() }).parse(data);
      await db.informationRequest.update({ where: { id }, data: v });
    } else throw new Forbidden();
  } else if (resource === "acuerdos") {
    authorize(user, resource, "editar");
    const v = z
      .object({
        comment: description,
        percent: z.coerce.number().int().min(0).max(100),
        status: z.enum([
          "APROBADO",
          "EN_EJECUCION",
          "CUMPLIDO",
          "VENCIDO",
          "RECHAZADO",
          "SUSPENDIDO",
        ]),
      })
      .refine((x) => x.status !== "CUMPLIDO" || x.percent === 100)
      .parse(data);
    await db.agreement.update({
      where: { id },
      data: {
        status: v.status,
        progress: {
          create: { authorId: user.id, comment: v.comment, percent: v.percent },
        },
      },
    });
  } else if (resource === "sesiones") {
    if (input.action === "publicar") {
      authorize(user, resource, "publicar");
      await db.councilSession.update({
        where: { id },
        data: { agendaStatus: "PUBLICADA", publishedAt: new Date() },
      });
      const users = await db.user.findMany({
        where: {
          active: true,
          roleId: { in: ["CONCEJAL", "ALCALDE", "SECRETARIO_MUNICIPAL"] },
        },
        select: { id: true },
      });
      await db.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: "TABLA_PUBLICADA",
          title: "Tabla de sesión publicada",
          body: "Revise los puntos y antecedentes de la próxima sesión.",
          href: `/sesiones/${id}`,
        })),
      });
    } else if (input.action === "punto") {
      authorize(user, resource, "editar");
      const v = z
        .object({
          order: z.coerce.number().int().positive(),
          title: text,
          description,
          presenter: text,
          minutes: z.coerce.number().int().min(1).max(600),
          type: z.enum(["INFORMACION", "VOTACION", "CUENTA", "INCIDENTES"]),
          requiresVote: z.boolean(),
        })
        .parse(data);
      await db.agendaItem.create({ data: { ...v, councilSessionId: id } });
    } else if (input.action === "votar") {
      authorize(user, resource, "editar");
      const v = z.record(z.string(), z.string()).parse(data);
      const result = z
        .enum(["APROBADO", "RECHAZADO", "EMPATE"])
        .parse(v.result);
      const records = Object.entries(v)
        .filter(([k]) => k.startsWith("voto:"))
        .map(([key, choice]) => ({
          userId: key.slice(5),
          choice: z
            .enum(["A_FAVOR", "EN_CONTRA", "ABSTENCION", "INHABILITADO"])
            .parse(choice),
        }));
      if (!records.length || records.length > 100)
        throw new Error("Votación vacía");
      const item = await db.agendaItem.findUniqueOrThrow({
        where: { id },
        include: { councilSession: true },
      });
      if (!item.requiresVote) throw new Error("Punto sin votación");
      const count = await db.user.count({
        where: {
          id: { in: records.map((r) => r.userId) },
          active: true,
          roleId: { in: ["CONCEJAL", "ALCALDE"] },
        },
      });
      if (count !== records.length) throw new Forbidden();
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(812902)`;
        const vote = await tx.vote.upsert({
          where: { agendaItemId: id },
          create: { agendaItemId: id, result, records: { create: records } },
          update: { result, records: { deleteMany: {}, create: records } },
        });
        if (
          result === "APROBADO" &&
          !(await tx.agreement.findUnique({ where: { voteId: vote.id } }))
        ) {
          const year = new Date().getUTCFullYear();
          const last = await tx.agreement.aggregate({
            where: { year },
            _max: { number: true },
          });
          await tx.agreement.create({
            data: {
              number: (last._max.number ?? 0) + 1,
              year,
              date: new Date(),
              councilSessionId: item.councilSessionId,
              voteId: vote.id,
              text: item.title,
              subject: item.description,
              responsible: item.presenter,
              deadline: businessDeadline(new Date(), 15, new Set()),
              status: "APROBADO",
            },
          });
        }
      });
    } else throw new Forbidden();
  } else if (resource === "archivo") {
    authorize(user, resource, "editar");
    const v = z
      .object({
        version: z.coerce.number().int().positive(),
        status: z.enum(["BORRADOR", "EN_REVISION", "APROBADA", "FIRMADA"]),
        text: description,
      })
      .parse(data);
    await db.minutes.upsert({
      where: {
        councilSessionId_version: { councilSessionId: id, version: v.version },
      },
      create: { councilSessionId: id, ...v },
      update: { status: v.status, text: v.text },
    });
  } else if (resource === "admin") {
    authorize(user, "admin", "administrar");
    if (id === user.id) throw new Forbidden();
    const v = z
      .object({
        active: z.boolean(),
        roleId: z.enum([
          "SUPERADMIN_TI",
          "SECRETARIO_MUNICIPAL",
          "ALCALDE",
          "CONCEJAL",
          "FUNCIONARIO_FINANZAS",
          "FUNCIONARIO_JURIDICO",
          "FUNCIONARIO_RESPUESTAS",
          "AUDITOR",
        ]),
      })
      .parse(data);
    await db.$transaction([
      db.user.update({ where: { id }, data: v }),
      db.session.deleteMany({ where: { userId: id } }),
    ]);
  } else throw new Forbidden();
  await audit({
    actorId: user.id,
    action: input.action.toUpperCase(),
    resource,
    resourceId: id,
  });
  return { ok: true };
}
