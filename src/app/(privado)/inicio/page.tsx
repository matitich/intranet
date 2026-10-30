import Link from "next/link";
import { CalendarDays, Bell, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/modules/auth/service";
import { db } from "@/lib/db";
import { can, requestWhere, documentWhere } from "@/lib/permissions";
import { dateTime } from "@/lib/chile";
export const dynamic = "force-dynamic";
export default async function Inicio() {
  const user = await requireUser();
  const [
    events,
    notifications,
    announcements,
    agreements,
    requests,
    documents,
  ] = await Promise.all([
    can(user, "calendario", "ver")
      ? db.calendarEvent.findMany({
          where: {
            start: { gte: new Date() },
            status: { in: ["PROGRAMADA", "CONFIRMADA"] },
          },
          orderBy: { start: "asc" },
          take: 3,
          include: { councilSession: { select: { id: true } } },
        })
      : [],
    db.notification.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.announcement.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
    can(user, "acuerdos", "ver")
      ? db.agreement.groupBy({ by: ["status"], _count: true })
      : [],
    can(user, "solicitudes", "ver")
      ? db.informationRequest.count({
          where: {
            AND: [
              requestWhere(user),
              { status: { notIn: ["RESPONDIDA", "CERRADA", "DESISTIDA"] } },
            ],
          },
        })
      : null,
    can(user, "documentos", "ver")
      ? db.document.findMany({
          where: documentWhere(user),
          orderBy: { createdAt: "desc" },
          take: 4,
        })
      : [],
  ]);
  const total = agreements.reduce((sum, g) => sum + g._count, 0),
    complete = agreements.find((g) => g.status === "CUMPLIDO")?._count ?? 0;
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Su espacio de trabajo</p>
          <h1>Bienvenido, {user.name}</h1>
          <p className="muted">
            Todo lo que necesita para preparar su próxima sesión.
          </p>
        </div>
        <span className="badge">Concejo municipal</span>
      </div>
      <div className="metrics">
        {can(user, "acuerdos", "ver") && (
          <section className="card">
            <span className="metric-label">Acuerdos cumplidos</span>
            <p className="metric-value">
              {total ? Math.round((complete * 100) / total) : 0}%
            </p>
            <span className="muted">
              {complete} de {total} acuerdos
            </span>
          </section>
        )}
        {requests !== null && (
          <section className="card">
            <span className="metric-label">Solicitudes pendientes</span>
            <p className="metric-value">{requests}</p>
            <Link href="/solicitudes">
              Ver solicitudes <ArrowUpRight size={15} />
            </Link>
          </section>
        )}
        <section className="card">
          <span className="metric-label">Avisos recientes</span>
          <p className="metric-value">{notifications.length}</p>
          <Link href="/notificaciones">
            Abrir notificaciones <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      {announcements.map((a) => (
        <article className="card" key={a.id}>
          <span className="badge">Aviso institucional</span>
          <h2>{a.title}</h2>
          <p>{a.body}</p>
        </article>
      ))}
      <div className="grid">
        {can(user, "calendario", "ver") && (
          <section className="card">
            <CalendarDays />
            <h2>Próximas sesiones</h2>
            {events.length ? (
              events.map((e) => (
                <article key={e.id}>
                  <h3>
                    {e.councilSession ? (
                      <Link href={`/sesiones/${e.councilSession.id}`}>
                        {e.title}
                      </Link>
                    ) : (
                      e.title
                    )}
                  </h3>
                  <p className="muted">
                    {dateTime(e.start)} · {e.location}
                  </p>
                </article>
              ))
            ) : (
              <p className="muted">No tiene sesiones próximas.</p>
            )}
          </section>
        )}
        <section className="card">
          <Bell />
          <h2>Notificaciones recientes</h2>
          {notifications.length ? (
            notifications.map((n) => (
              <article key={n.id}>
                <h3>{n.title}</h3>
                <p className="muted">{n.body}</p>
              </article>
            ))
          ) : (
            <p className="muted">Está al día con sus notificaciones.</p>
          )}
        </section>
      </div>
      {documents.length > 0 && (
        <section className="card">
          <h2>Últimos documentos</h2>
          {documents.map((d) => (
            <p key={d.id}>
              <Link href={`/documentos/${d.id}`}>{d.title}</Link>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
