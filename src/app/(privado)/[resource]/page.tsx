import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/modules/auth/service";
import { list, resourceSchema } from "@/modules/concejo/service";
import { labels, forms } from "@/modules/concejo/presentation";
import { can } from "@/lib/permissions";
import { date, currency } from "@/lib/chile";
import { ResourceForm, ActionButton } from "@/components/resource-form";
import { BudgetImport } from "@/components/budget-import";
import { db } from "@/lib/db";
import { BudgetChart } from "@/components/budget-chart";
export const dynamic = "force-dynamic";
export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const parsed = resourceSchema.safeParse((await params).resource);
  if (!parsed.success) notFound();
  const resource = parsed.data,
    user = await requireUser();
  if (resource !== "documentos" && !can(user, resource, "ver")) notFound();
  const q = await searchParams;
  const result = await list(resource, user, q);
  // A shared view model keeps table presentation separate from typed domain queries.
  const items = JSON.parse(
    JSON.stringify(result.items, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  ) as Record<string, unknown>[];
  const title = (r: Record<string, unknown>) =>
    String(
      r.title ??
        r.subject ??
        r.text ??
        r.name ??
        (resource === "presupuesto"
          ? `Presupuesto ${r.year}`
          : resource === "auditoria"
            ? `${r.action} · ${r.resource}`
            : `Sesión ${r.number} · ${r.type}`),
    );
  const formFields = forms[resource]
    ? await Promise.all(
        forms[resource]!.map(async (f) => {
          if (f.name === "eventId") {
            const rows = await db.calendarEvent.findMany({
              orderBy: { start: "desc" },
              take: 100,
            });
            return {
              ...f,
              type: "select" as const,
              choices: rows.map((r) => ({ value: r.id, label: r.title })),
            };
          }
          if (f.name === "periodId") {
            const rows = await db.councilPeriod.findMany();
            return {
              ...f,
              type: "select" as const,
              choices: rows.map((r) => ({ value: r.id, label: r.name })),
            };
          }
          if (f.name === "councilSessionId") {
            const rows = await db.councilSession.findMany({
              include: { event: true },
              orderBy: { event: { start: "desc" } },
              take: 100,
            });
            return {
              ...f,
              type: "select" as const,
              choices: rows.map((r) => ({ value: r.id, label: r.event.title })),
            };
          }
          return f;
        }),
      )
    : [];
  const adminData =
    resource === "admin"
      ? await Promise.all([
          db.systemSetting.findMany(),
          db.holiday.findMany({ orderBy: { date: "asc" } }),
          db.commission.findMany(),
          db.user.findMany({
            where: { active: true },
            select: { id: true, name: true },
          }),
        ])
      : null;
  const endpoint = `/api/concejo/${resource}`;
  const hasDetails = [
    "documentos",
    "solicitudes",
    "sesiones",
    "archivo",
    "acuerdos",
  ].includes(resource);
  const canCreate =
    can(user, resource, resource === "admin" ? "administrar" : "crear") &&
    forms[resource];
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Concejo municipal</p>
          <h1>{labels[resource]}</h1>
          <p className="muted">
            {result.total}{" "}
            {result.total === 1
              ? "registro disponible"
              : "registros disponibles"}{" "}
            para su cuenta.
          </p>
        </div>
        <span className="page-symbol">
          <ArrowUpRight />
        </span>
      </div>
      {can(user, resource, "descargar") && (
        <div className="topline">
          <span className="muted">Exportación de la página actual</span>
          <div>
            <a
              className="button button-outline"
              href={`${endpoint}/export?q=${encodeURIComponent(q.q ?? "")}&page=${q.page ?? 1}`}
            >
              Descargar CSV
            </a>{" "}
            <a
              className="button button-outline"
              href={`${endpoint}/export?format=pdf&q=${encodeURIComponent(q.q ?? "")}&page=${q.page ?? 1}`}
            >
              Descargar PDF
            </a>
          </div>
        </div>
      )}
      <form className="filters">
        <label htmlFor="query" className="sr-only">
          Buscar registros
        </label>
        <input
          id="query"
          name="q"
          placeholder="Buscar por palabra o materia…"
          defaultValue={q.q}
        />
        <label htmlFor="status" className="sr-only">
          Estado
        </label>
        <input
          id="status"
          name="status"
          placeholder="Filtrar por estado"
          defaultValue={q.status}
        />
        <button className="button button-outline">Filtrar</button>
        <Link className="button button-ghost" href={`/${resource}`}>
          Limpiar
        </Link>
      </form>
      {canCreate && (
        <details className="card create-panel">
          <summary>
            <Plus size={18} />{" "}
            {resource === "admin"
              ? "Invitar usuario"
              : resource === "notificaciones"
                ? "Publicar anuncio"
                : "Crear registro"}
          </summary>
          <ResourceForm endpoint={endpoint} fields={formFields} />
        </details>
      )}
      {adminData && (
        <section className="card stack">
          <h2>Parámetros institucionales</h2>
          <ResourceForm
            endpoint="/api/admin/configuracion"
            extra={{ kind: "setting" }}
            fields={[
              {
                name: "key",
                label: "Parámetro",
                type: "select",
                choices: [
                  {
                    value: "requestBusinessDays",
                    label: "Plazo de respuesta (días hábiles)",
                  },
                  {
                    value: "sessionIdleMinutes",
                    label: "Inactividad de sesión (minutos)",
                  },
                  {
                    value: "agendaNoticeHours",
                    label: "Anticipación de tablas (horas)",
                  },
                  { value: "retentionDays", label: "Retención (días)" },
                  {
                    value: "executionAlertPercent",
                    label: "Alerta de ejecución (%)",
                  },
                ],
              },
              { name: "value", label: "Valor", type: "number" },
            ]}
          />
          <h3>Feriados del calendario</h3>
          <p className="muted">
            {adminData[1].map((h) => `${h.date}: ${h.name}`).join(" · ")}
          </p>
          <ResourceForm
            endpoint="/api/admin/configuracion"
            extra={{ kind: "holiday" }}
            fields={[
              { name: "date", label: "Fecha", type: "date" },
              { name: "name", label: "Nombre del feriado" },
            ]}
          />
          <h3>Comisiones</h3>
          <ResourceForm
            endpoint="/api/admin/configuracion"
            extra={{ kind: "commission" }}
            fields={[{ name: "name", label: "Nombre de la comisión" }]}
          />
          <h3>Integrantes de comisiones</h3>
          <ResourceForm
            endpoint="/api/admin/configuracion"
            extra={{ kind: "membership" }}
            fields={[
              {
                name: "commissionId",
                label: "Comisión",
                type: "select",
                choices: adminData[2].map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              },
              {
                name: "userId",
                label: "Integrante",
                type: "select",
                choices: adminData[3].map((u) => ({
                  value: u.id,
                  label: u.name,
                })),
              },
            ]}
          />
        </section>
      )}
      {resource === "presupuesto" && can(user, "presupuesto", "editar") && (
        <BudgetImport />
      )}
      {resource === "presupuesto" ? (
        items.map((b) => {
          const lines = b.lines as {
            id: string;
            area: string;
            description: string;
            initial: string;
            current: string;
            executions: { accrued: string; received: string }[];
          }[];
          return (
            <section key={String(b.id)} className="card">
              <h2>{title(b)}</h2>
              <BudgetChart
                lines={lines.map((l) => ({
                  name: l.area,
                  current: l.current,
                  accrued: l.executions
                    .reduce((sum, e) => sum + BigInt(e.accrued), BigInt(0))
                    .toString(),
                }))}
              />
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Área</th>
                      <th>Inicial</th>
                      <th>Vigente</th>
                      <th>Devengado</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const accrued = l.executions.reduce(
                        (sum, e) => sum + BigInt(e.accrued),
                        BigInt(0),
                      );
                      return (
                        <tr key={l.id}>
                          <td>{l.area}</td>
                          <td>{currency(l.initial)}</td>
                          <td>{currency(l.current)}</td>
                          <td>{currency(accrued.toString())}</td>
                          <td>
                            {currency((BigInt(l.current) - accrued).toString())}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      ) : items.length ? (
        <div className="record-list">
          {items.map((r) => (
            <article key={String(r.id ?? r.sequence)} className="card record">
              <div>
                <span
                  className={`badge status-${String(r.status ?? r.agendaStatus ?? "").toLowerCase()}`}
                >
                  {String(
                    r.status ??
                      r.agendaStatus ??
                      r.roleId ??
                      r.type ??
                      (r.active === false ? "INACTIVO" : "INSTITUCIONAL"),
                  ).replaceAll("_", " ")}
                </span>
                <h2>
                  {hasDetails ? (
                    <Link href={`/${resource}/${r.id}`}>{title(r)}</Link>
                  ) : (
                    title(r)
                  )}
                </h2>
                <p className="muted">
                  {String(
                    r.unit ??
                      r.responsible ??
                      r.location ??
                      r.email ??
                      r.body ??
                      "",
                  )}
                </p>
                <p className="muted">
                  {(r.deadline ?? r.start ?? r.publicationDate ?? r.createdAt)
                    ? date(
                        String(
                          r.deadline ??
                            r.start ??
                            r.publicationDate ??
                            r.createdAt,
                        ),
                      )
                    : ""}
                </p>
              </div>
              <div className="record-actions">
                {hasDetails && (
                  <Link
                    href={`/${resource}/${r.id}`}
                    className="button button-outline"
                  >
                    Ver detalle <ArrowUpRight size={16} />
                  </Link>
                )}
                {resource === "admin" && String(r.id) !== user.id && (
                  <details>
                    <summary>Gestionar acceso</summary>
                    <ResourceForm
                      endpoint={`${endpoint}/${r.id}`}
                      method="PATCH"
                      action="permisos"
                      fields={[
                        {
                          name: "active",
                          label: "Cuenta activa",
                          type: "select",
                          options: ["true", "false"],
                        },
                        {
                          name: "roleId",
                          label: "Rol",
                          type: "select",
                          options: [
                            "CONCEJAL",
                            "ALCALDE",
                            "SECRETARIO_MUNICIPAL",
                            "SUPERADMIN_TI",
                            "FUNCIONARIO_FINANZAS",
                            "FUNCIONARIO_JURIDICO",
                            "FUNCIONARIO_RESPUESTAS",
                            "AUDITOR",
                          ],
                        },
                      ]}
                    />
                  </details>
                )}
                {resource === "notificaciones" && (
                  <>
                    <ActionButton
                      endpoint={`${endpoint}/${r.id}`}
                      action="leer"
                      label={r.readAt ? "Leída" : "Marcar leída"}
                    />
                    <ActionButton
                      endpoint={`${endpoint}/${r.id}`}
                      action="archivar"
                      label="Archivar"
                    />
                  </>
                )}
                {resource === "calendario" && (
                  <a
                    className="button button-outline"
                    href={`/api/calendario/${r.id}/ics`}
                  >
                    Añadir a mi calendario
                  </a>
                )}
                {resource === "calendario" && user.roleId === "CONCEJAL" && (
                  <>
                    <ActionButton
                      endpoint={`${endpoint}/${r.id}`}
                      action="asistencia"
                      data={{ status: "ASISTIRE" }}
                      label="Asistiré"
                    />
                    <ActionButton
                      endpoint={`${endpoint}/${r.id}`}
                      action="asistencia"
                      data={{ status: "NO_ASISTIRE" }}
                      label="No asistiré"
                    />
                  </>
                )}
                {resource === "documentos" && (
                  <ActionButton
                    endpoint={`${endpoint}/${r.id}`}
                    action="favorito"
                    label={
                      (r.favorites as unknown[])?.length
                        ? "Quitar favorito"
                        : "Guardar favorito"
                    }
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card empty-state">
          <h2>No hay registros para estos filtros</h2>
          <p className="muted">
            Pruebe con otra palabra o quite el filtro de estado.
          </p>
        </section>
      )}
      {resource !== "presupuesto" && (
        <nav aria-label="Paginación" className="pagination">
          {result.page > 1 && (
            <Link
              className="button button-outline"
              href={`?${new URLSearchParams({ ...q, page: String(result.page - 1) })}`}
            >
              Anterior
            </Link>
          )}
          <span>Página {result.page}</span>
          {result.page * 20 < result.total && (
            <Link
              className="button button-outline"
              href={`?${new URLSearchParams({ ...q, page: String(result.page + 1) })}`}
            >
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
