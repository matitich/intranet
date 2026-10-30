import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  href: string,
  dedupeKey: string,
) {
  const preference = await db.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
  });
  const existing = await db.notification.findUnique({ where: { dedupeKey } });
  if (existing) return;
  const user = await db.user.findFirst({
    where: { id: userId, active: true, deletedAt: null },
    select: { email: true },
  });
  if (!user) return;
  try {
    await db.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        href,
        dedupeKey,
        ...(preference?.internal === false ? { archivedAt: new Date() } : {}),
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return;
    throw error;
  }
  if (preference?.email !== false) await sendMail(user.email, title, body);
}
export async function reminders() {
  const now = new Date();
  const users = await db.user.findMany({
    where: {
      active: true,
      roleId: { in: ["CONCEJAL", "ALCALDE", "SECRETARIO_MUNICIPAL"] },
    },
    select: { id: true },
  });
  const events = await db.calendarEvent.findMany({
    where: {
      start: { gt: now, lte: new Date(now.getTime() + 48 * 3600000) },
      status: { in: ["PROGRAMADA", "CONFIRMADA"] },
    },
  });
  for (const event of events) {
    const hours = (event.start.getTime() - now.getTime()) / 3600000;
    const window = hours <= 2 ? "2h" : "48h";
    for (const user of users)
      await notify(
        user.id,
        "SESION",
        "Próxima actividad del Concejo",
        `${event.title}. Consulte el calendario para revisar los antecedentes.`,
        `/calendario`,
        `event:${event.id}:${event.updatedAt.toISOString()}:${window}:${user.id}`,
      );
  }
  const agreements = await db.agreement.findMany({
    where: {
      status: { in: ["APROBADO", "EN_EJECUCION"] },
      deadline: { lte: new Date(now.getTime() + 7 * 86400000) },
    },
  });
  for (const agreement of agreements) {
    const days = Math.ceil(
      (agreement.deadline.getTime() - now.getTime()) / 86400000,
    );
    const window = days <= 1 ? "1d" : days <= 3 ? "3d" : "7d";
    for (const user of users)
      await notify(
        user.id,
        "ACUERDO",
        "Acuerdo próximo a vencer",
        `Revise el seguimiento del acuerdo ${agreement.number}/${agreement.year}.`,
        `/acuerdos/${agreement.id}`,
        `agreement:${agreement.id}:${agreement.deadline.toISOString()}:${window}:${user.id}`,
      );
    if (days < 0)
      await db.agreement.updateMany({
        where: {
          id: agreement.id,
          status: { in: ["APROBADO", "EN_EJECUCION"] },
        },
        data: { status: "VENCIDO" },
      });
  }
  const requests = await db.informationRequest.findMany({
    where: {
      deadline: { lt: now },
      status: { in: ["ENVIADA", "RECIBIDA", "EN_PROCESO", "OBSERVADA"] },
    },
  });
  for (const request of requests) {
    await db.$transaction(async (tx) => {
      const changed = await tx.informationRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: { status: "VENCIDA" },
      });
      if (changed.count)
        await tx.requestStatusLog.create({
          data: {
            requestId: request.id,
            actorId: "SYSTEM",
            previous: request.status,
            next: "VENCIDA",
          },
        });
    });
    await notify(
      request.authorId,
      "SOLICITUD",
      "Solicitud fuera de plazo",
      "Una de sus solicitudes de información superó el plazo configurado.",
      `/solicitudes/${request.id}`,
      `request:${request.id}:overdue`,
    );
  }
  return {
    events: events.length,
    agreements: agreements.length,
    requests: requests.length,
  };
}
