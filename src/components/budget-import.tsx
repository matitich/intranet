"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parse } from "csv-parse/browser/esm/sync";
import { Button } from "./ui/button";
type Preview = {
  count: number;
  total: string;
  lines: Record<string, string>[];
};
export function BudgetImport() {
  const [preview, setPreview] = useState<Preview | null>(null),
    [year, setYear] = useState(2026),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(lines: Record<string, string>[], confirm: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/presupuesto/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, lines, confirm }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error("Revise columnas, códigos y montos enteros en CLP.");
      if (confirm) {
        setPreview(null);
        setMessage("Importación confirmada.");
        router.refresh();
      } else setPreview(d);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No fue posible importar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Importar presupuesto</h2>
      <p className="muted">
        CSV UTF-8 con columnas kind, subtitle, item, assignment, area,
        description, initial, current. Los montos son enteros CLP sin
        separadores. La importación actualiza las partidas incluidas y conserva
        las demás.
      </p>
      <a href="/plantilla-presupuesto.csv" download>
        Descargar plantilla CSV
      </a>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const file = new FormData(e.currentTarget).get("file");
          if (!(file instanceof File) || file.size > 2000000) {
            setMessage("Seleccione un CSV de hasta 2 MB.");
            return;
          }
          try {
            await submit(
              parse(await file.text(), {
                columns: true,
                skip_empty_lines: true,
                bom: true,
                trim: true,
              }) as Record<string, string>[],
              false,
            );
          } catch {
            setMessage("No fue posible interpretar el CSV.");
          }
        }}
      >
        <div className="field">
          <label htmlFor="budget-year">Año</label>
          <input
            id="budget-year"
            type="number"
            min={2000}
            max={2200}
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPreview(null);
            }}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="budget-file">Archivo CSV</label>
          <input
            id="budget-file"
            name="file"
            type="file"
            accept=".csv"
            required
            onChange={() => setPreview(null)}
          />
        </div>
        <Button disabled={busy}>Validar y previsualizar</Button>
      </form>
      {preview && (
        <div style={{ marginTop: 24 }}>
          <p>
            {preview.count} partidas · Total vigente: $
            {BigInt(preview.total).toLocaleString("es-CL")}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Descripción</th>
                  <th>Vigente</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.slice(0, 20).map((l, i) => (
                  <tr key={i}>
                    <td>{l.area}</td>
                    <td>{l.description}</td>
                    <td>{l.current}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button disabled={busy} onClick={() => submit(preview.lines, true)}>
            Confirmar importación de {preview.count} partidas
          </Button>
        </div>
      )}
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
