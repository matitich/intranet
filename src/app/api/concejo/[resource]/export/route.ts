import { PDFDocument, StandardFonts } from "pdf-lib";
import { requireUser } from "@/modules/auth/service";
import { authorize } from "@/lib/permissions";
import { list, detail, resourceSchema } from "@/modules/concejo/service";
import { labels } from "@/modules/concejo/presentation";
import { failure } from "@/lib/http";
import { audit } from "@/lib/audit";
import { dateTime } from "@/lib/chile";
function csv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const user = await requireUser(),
      resource = resourceSchema.parse((await params).resource);
    authorize(user, resource, "descargar");
    const q = new URL(request.url).searchParams;
    const result = q.get("id")
      ? await detail(resource, q.get("id")!, user)
      : await list(resource, user, {
          q: q.get("q") ?? "",
          page: q.get("page") ?? "1",
        });
    const data = JSON.parse(
      JSON.stringify(result, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    );
    await audit({
      actorId: user.id,
      action: "EXPORT",
      resource,
      resourceId: q.get("id") ?? undefined,
    });
    if (q.get("format") === "pdf") {
      const pdf = await PDFDocument.create(),
        font = await pdf.embedFont(StandardFonts.Helvetica);
      let page = pdf.addPage(),
        y = 790;
      const write = (line: string) => {
        if (y < 50) {
          page = pdf.addPage();
          y = 790;
        }
        page.drawText(
          line
            .normalize("NFD")
            .replace(/[^\x20-\x7E]/g, "")
            .slice(0, 95),
          { x: 40, y, size: 10, font },
        );
        y -= 17;
      };
      write(labels[resource]);
      write(`Exportado por ${user.name} el ${dateTime(new Date())}`);
      const content = (data.items ?? [data]) as Record<string, unknown>[];
      for (const row of content) {
        write(
          String(
            row.title ??
              row.subject ??
              row.text ??
              row.name ??
              `Registro ${row.number ?? row.id ?? ""}`,
          ),
        );
        if (row.description)
          for (const line of String(row.description).match(/.{1,90}/g) ?? [])
            write(line);
        if (Array.isArray(row.messages))
          for (const m of row.messages) {
            write(`Mensaje ${dateTime(m.createdAt)}`);
            for (const line of String(m.body).match(/.{1,90}/g) ?? [])
              write(line);
          }
        write("");
      }
      return new Response(new Uint8Array(await pdf.save()), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${resource}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const rows: Record<string, unknown>[] = [];
    for (const row of (data.items ?? [data]) as Record<string, unknown>[]) {
      if (resource === "presupuesto" && Array.isArray(row.lines))
        for (const line of row.lines)
          rows.push({ year: row.year, ...line, executions: undefined });
      else
        rows.push(
          Object.fromEntries(
            Object.entries(row).filter(
              ([, v]) => v === null || typeof v !== "object",
            ),
          ),
        );
    }
    const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const content =
      "\uFEFF" +
      [
        headers.map(csv).join(","),
        ...rows.map((r) => headers.map((h) => csv(r[h])).join(",")),
      ].join("\r\n");
    return new Response(content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${resource}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
