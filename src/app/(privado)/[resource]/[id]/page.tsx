import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { detail, resourceSchema } from "@/modules/concejo/service";
import { labels } from "@/modules/concejo/presentation";
import { dateTime, date, requestTransitions } from "@/lib/chile";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ResourceForm, ActionButton } from "@/components/resource-form";
import { DocumentUpload } from "@/components/document-upload";
interface View {
  id: string;
  title?: string;
  subject?: string;
  description?: string;
  text?: string;
  number?: number;
  status?: string;
  agendaStatus?: string;
  publishedAt?: string;
  deadline?: string;
  recipient?: string;
  basis?: string;
  responsible?: string;
  author?: { name: string };
  event?: { title: string; start: string; location: string };
  versions?: {
    id: string;
    version: number;
    name: string;
    sha256: string;
    scanStatus: string;
    createdAt: string;
  }[];
  messages?: {
    id: string;
    body: string;
    official: boolean;
    createdAt: string;
    author: { name: string };
  }[];
  progress?: {
    id: string;
    comment: string;
    percent: number;
    createdAt: string;
  }[];
  items?: {
    id: string;
    order: number;
    title: string;
    description: string;
    presenter: string;
    minutes: number;
    requiresVote: boolean;
    notes: { text: string }[];
    reviews: { reviewed: boolean }[];
    attachments: { document: { id: string; title: string } }[];
    vote?: {
      result: string;
      records: { choice: string; user: { name: string } }[];
    };
  }[];
  minutes?: { id: string; version: number; status: string; text: string }[];
}
export const dynamic = "force-dynamic";
export default async function DetailPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const p = await params,
    parsed = resourceSchema.safeParse(p.resource);
  if (!parsed.success) notFound();
  const resource = parsed.data,
    user = await requireUser();
  let raw;
  try {
    raw = await detail(resource, p.id, user);
  } catch {
    notFound();
  }
  const data = JSON.parse(JSON.stringify(raw)) as View;
  const voters =
    user.roleId === "SECRETARIO_MUNICIPAL"
      ? await db.user.findMany({
          where: { active: true, roleId: "CONCEJAL" },
          select: { id: true, name: true },
        })
      : [];
  const endpoint = `/api/concejo/${resource}/${p.id}`;
  return (
    <div className="stack">
      <Link href={`/${resource}`}>← {labels[resource]}</Link>
      <header className="detail-header">
        <p className="eyebrow">{labels[resource]}</p>
        <h1>{data.title ?? data.subject ?? data.event?.title ?? data.text}</h1>
        <span className="badge">
          {(data.status ?? data.agendaStatus ?? "INSTITUCIONAL").replaceAll(
            "_",
            " ",
          )}
        </span>
        {data.deadline && (
          <p>
            Plazo: <strong>{date(data.deadline)}</strong>
          </p>
        )}
        {data.publishedAt && (
          <p className="muted">Publicada el {dateTime(data.publishedAt)}</p>
        )}
      </header>
      {data.description && (
        <section className="card">
          <h2>Antecedentes</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{data.description}</p>
          {data.basis && (
            <>
              <h3>Fundamento</h3>
              <p>{data.basis}</p>
            </>
          )}
          {data.author && (
            <p className="muted">
              Solicitante: {data.author.name} · Destinatario: {data.recipient}
            </p>
          )}
        </section>
      )}
      {resource === "documentos" && (
        <>
          <section className="card">
            <h2>Historial de versiones</h2>
            {data.versions?.length ? (
              data.versions.map((v) => (
                <article key={v.id} style={{ marginBottom: 20 }}>
                  <h3>
                    Versión {v.version} · {v.name}
                  </h3>
                  <p className="muted">
                    {dateTime(v.createdAt)} ·{" "}
                    {v.scanStatus === "CLEAN"
                      ? "Archivo verificado"
                      : "En cuarentena"}
                  </p>
                  <p
                    className="muted"
                    style={{ overflowWrap: "anywhere", fontSize: ".75rem" }}
                  >
                    SHA-256: {v.sha256}
                  </p>
                  {v.scanStatus === "CLEAN" && (
                    <a
                      className="button button-outline"
                      href={`/api/documentos/${data.id}/archivo?version=${v.id}`}
                    >
                      Descargar archivo
                    </a>
                  )}
                </article>
              ))
            ) : (
              <p className="muted">
                Aún no se ha cargado una versión de este documento.
              </p>
            )}
          </section>
          {can(user, "documentos", "editar") && (
            <section className="card">
              <h2>Cargar una nueva versión</h2>
              <DocumentUpload documentId={data.id} />
            </section>
          )}
        </>
      )}
      {resource === "solicitudes" && (
        <>
          <a
            className="button button-outline"
            href={`${endpoint.replace(/\/[^/]+$/, "")}/export?id=${data.id}&format=pdf`}
          >
            Exportar historial PDF
          </a>
          <section className="card">
            <h2>Comunicación y respuestas</h2>
            <div className="timeline">
              {data.messages?.map((m) => (
                <article key={m.id}>
                  <span className="badge">
                    {m.official ? "Respuesta oficial" : m.author.name}
                  </span>
                  <p>{m.body}</p>
                  <small className="muted">{dateTime(m.createdAt)}</small>
                </article>
              ))}
            </div>
            <ResourceForm
              endpoint={endpoint}
              method="PATCH"
              action="mensaje"
              title="Enviar mensaje"
              fields={[
                { name: "body", label: "Su mensaje", type: "textarea" },
                ...(can(user, "solicitudes", "editar") &&
                user.roleId !== "SECRETARIO_MUNICIPAL"
                  ? [
                      {
                        name: "official",
                        label: "Respuesta oficial",
                        type: "select" as const,
                        options: ["false", "true"],
                      },
                    ]
                  : []),
              ]}
            />
          </section>
          <section className="card">
            <h2>Gestionar solicitud</h2>
            <ResourceForm
              endpoint={endpoint}
              method="PATCH"
              action="estado"
              title="Actualizar estado"
              fields={[
                {
                  name: "status",
                  label: "Nuevo estado",
                  type: "select",
                  options: requestTransitions[data.status ?? ""] ?? [],
                },
              ]}
            />
            {user.roleId === "SECRETARIO_MUNICIPAL" && (
              <>
                <h3>Visibilidad para el Concejo</h3>
                <ResourceForm
                  endpoint={endpoint}
                  method="PATCH"
                  action="compartir"
                  fields={[
                    {
                      name: "visibleToCouncil",
                      label: "Compartir con el Concejo",
                      type: "select",
                      options: ["false", "true"],
                    },
                  ]}
                />
              </>
            )}
          </section>
        </>
      )}
      {resource === "acuerdos" && (
        <>
          <section className="card">
            <h2>Seguimiento</h2>
            <p>Responsable: {data.responsible}</p>
            <div className="timeline">
              {data.progress?.map((v) => (
                <article key={v.id}>
                  <strong>{v.percent}% de avance</strong>
                  <p>{v.comment}</p>
                  <small className="muted">{dateTime(v.createdAt)}</small>
                </article>
              ))}
            </div>
          </section>
          {can(user, "acuerdos", "editar") && (
            <section className="card">
              <h2>Registrar avance</h2>
              <ResourceForm
                endpoint={endpoint}
                method="PATCH"
                action="avance"
                fields={[
                  {
                    name: "comment",
                    label: "Comentario de avance",
                    type: "textarea",
                  },
                  {
                    name: "percent",
                    label: "Porcentaje de avance",
                    type: "number",
                  },
                  {
                    name: "status",
                    label: "Estado",
                    type: "select",
                    options: [
                      "EN_EJECUCION",
                      "CUMPLIDO",
                      "VENCIDO",
                      "SUSPENDIDO",
                      "RECHAZADO",
                      "APROBADO",
                    ],
                  },
                ]}
              />
            </section>
          )}
        </>
      )}
      {resource === "archivo" && can(user, "archivo", "editar") && (
        <section className="card">
          <h2>Versionar acta</h2>
          <ResourceForm
            endpoint={endpoint}
            method="PATCH"
            action="acta"
            fields={[
              { name: "version", label: "Número de versión", type: "number" },
              {
                name: "status",
                label: "Estado",
                type: "select",
                options: ["BORRADOR", "EN_REVISION", "APROBADA", "FIRMADA"],
              },
              { name: "text", label: "Contenido del acta", type: "textarea" },
            ]}
          />
        </section>
      )}
      {data.items && (
        <>
          {user.roleId === "SECRETARIO_MUNICIPAL" && (
            <details className="card">
              <summary>Añadir punto a la tabla</summary>
              <ResourceForm
                endpoint={`/api/concejo/sesiones/${data.id}`}
                method="PATCH"
                action="punto"
                fields={[
                  { name: "order", label: "Orden", type: "number" },
                  { name: "title", label: "Título" },
                  {
                    name: "description",
                    label: "Descripción",
                    type: "textarea",
                  },
                  { name: "presenter", label: "Responsable o expositor" },
                  {
                    name: "minutes",
                    label: "Minutos estimados",
                    type: "number",
                  },
                  {
                    name: "type",
                    label: "Tipo",
                    type: "select",
                    options: [
                      "INFORMACION",
                      "VOTACION",
                      "CUENTA",
                      "INCIDENTES",
                    ],
                  },
                  {
                    name: "requiresVote",
                    label: "Requiere votación",
                    type: "select",
                    options: ["false", "true"],
                  },
                ]}
              />
            </details>
          )}
          <section className="card">
            <h2>Tabla de la sesión</h2>
            <p className="muted">
              {data.event?.start && dateTime(data.event.start)} ·{" "}
              {data.event?.location}
            </p>
            {can(user, "sesiones", "publicar") && (
              <ActionButton
                endpoint={`/api/concejo/sesiones/${data.id}`}
                action="publicar"
                label="Publicar tabla"
              />
            )}
          </section>
          {data.items.map((item) => (
            <section key={item.id} className="card agenda-item">
              <p className="eyebrow">
                Punto {item.order}{" "}
                {item.requiresVote ? "· REQUIERE VOTACIÓN" : ""}
              </p>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <p className="muted">
                {item.presenter} · {item.minutes} minutos
              </p>
              {item.attachments.map((a) => (
                <p key={a.document.id}>
                  <Link href={`/documentos/${a.document.id}`}>
                    {a.document.title}
                  </Link>
                </p>
              ))}
              <ActionButton
                endpoint={`/api/concejo/sesiones/${item.id}`}
                action="revisado"
                data={{ reviewed: !item.reviews[0]?.reviewed }}
                label={
                  item.reviews[0]?.reviewed
                    ? "Revisado ✓"
                    : "Marcar como revisado"
                }
              />
              {item.notes[0] && (
                <p style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>
                  <strong>Mi nota privada:</strong> {item.notes[0].text}
                </p>
              )}
              <details style={{ marginTop: 20 }}>
                <summary>Escribir nota privada</summary>
                <ResourceForm
                  endpoint={`/api/concejo/sesiones/${item.id}`}
                  method="PATCH"
                  action="nota"
                  title="Guardar nota privada"
                  fields={[
                    {
                      name: "text",
                      label: "Solo usted puede ver esta nota",
                      type: "textarea",
                    },
                  ]}
                />
              </details>
              {user.roleId === "SECRETARIO_MUNICIPAL" && item.requiresVote && (
                <details>
                  <summary>Registrar votación</summary>
                  <ResourceForm
                    endpoint={`/api/concejo/sesiones/${item.id}`}
                    method="PATCH"
                    action="votar"
                    fields={[
                      {
                        name: "result",
                        label: "Resultado oficial",
                        type: "select",
                        options: ["APROBADO", "RECHAZADO", "EMPATE"],
                      },
                      ...voters.map((v) => ({
                        name: `voto:${v.id}`,
                        label: v.name,
                        type: "select" as const,
                        options: [
                          "A_FAVOR",
                          "EN_CONTRA",
                          "ABSTENCION",
                          "INHABILITADO",
                        ],
                      })),
                    ]}
                  />
                </details>
              )}
              {item.vote && (
                <div className="timeline">
                  <h3>Resultado: {item.vote.result}</h3>
                  {item.vote.records.map((r, i) => (
                    <p key={i}>
                      {r.user.name}: {r.choice.replaceAll("_", " ")}
                    </p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
      {data.minutes?.map((m) => (
        <section className="card" key={m.id}>
          <h2>Acta · versión {m.version}</h2>
          <span className="badge">{m.status}</span>
          <p style={{ whiteSpace: "pre-wrap", marginTop: 18 }}>{m.text}</p>
        </section>
      ))}
    </div>
  );
}
