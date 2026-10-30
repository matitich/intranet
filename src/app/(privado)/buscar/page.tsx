import Link from "next/link";
import { requireUser } from "@/modules/auth/service";
import { list } from "@/modules/concejo/service";
import { can, type Resource } from "@/lib/permissions";
import { labels } from "@/modules/concejo/presentation";
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser(),
    { q = "" } = await searchParams;
  const modules: Resource[] = [
    "documentos",
    "sesiones",
    "acuerdos",
    "solicitudes",
  ];
  const results = await Promise.all(
    modules
      .filter((r) => can(user, r, "ver"))
      .map(async (resource) => ({
        resource,
        result: await list(resource, user, { q }),
      })),
  );
  return (
    <div className="stack">
      <h1>Resultados de búsqueda</h1>
      <p className="muted">
        Resultados para «{q}», según los permisos de su cuenta.
      </p>
      {results.map(({ resource, result }) => (
        <section key={resource} className="card">
          <h2>
            {labels[resource]} · {result.total}
          </h2>
          {(
            JSON.parse(JSON.stringify(result.items)) as {
              id: string;
              title?: string;
              subject?: string;
              text?: string;
              number?: number;
            }[]
          ).map((r) => (
            <p key={r.id}>
              <Link href={`/${resource}/${r.id}`}>
                {r.title ?? r.subject ?? r.text ?? `Sesión ${r.number}`}
              </Link>
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
