"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { Button } from "./ui/button";
import type { Field } from "@/modules/concejo/presentation";
export function ResourceForm({
  endpoint,
  fields,
  action,
  title = "Guardar",
  method = "POST",
  extra = {},
}: {
  endpoint: string;
  fields: Field[];
  action?: string;
  title?: string;
  method?: "POST" | "PATCH";
  extra?: Record<string, unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setMessage("");
        const data: Record<string, unknown> = { ...extra };
        for (const f of fields) {
          const value = new FormData(form).get(f.name);
          data[f.name] = [
            "official",
            "requiresVote",
            "active",
            "visibleToCouncil",
            "reviewed",
          ].includes(f.name)
            ? value === "true"
            : f.type === "datetime-local" && value
              ? fromZonedTime(String(value), "America/Santiago").toISOString()
              : value;
        }
        if (
          data.active === false &&
          !window.confirm(
            "¿Desea desactivar esta cuenta y cerrar sus sesiones?",
          )
        ) {
          setBusy(false);
          return;
        }
        try {
          const response = await fetch(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action ? { action, data } : data),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error ?? "No fue posible guardar.");
          setMessage("Cambios guardados correctamente.");
          form.reset();
          router.refresh();
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Error de conexión.");
        } finally {
          setBusy(false);
        }
      }}
      aria-busy={busy}
    >
      <div className="form-grid">
        {fields.map((f) => (
          <div className="field" key={f.name}>
            <label htmlFor={`field-${f.name}`}>{f.label}</label>
            {f.type === "select" ? (
              <select
                id={`field-${f.name}`}
                name={f.name}
                required={f.required !== false}
              >
                {f.choices
                  ? f.choices.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))
                  : f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o === "true"
                          ? "Sí"
                          : o === "false"
                            ? "No"
                            : o.replaceAll("_", " ")}
                      </option>
                    ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={`field-${f.name}`}
                name={f.name}
                required={f.required !== false}
                maxLength={20000}
              />
            ) : (
              <input
                id={`field-${f.name}`}
                name={f.name}
                type={f.type ?? "text"}
                required={f.required !== false}
                maxLength={300}
              />
            )}
          </div>
        ))}
      </div>
      {message && (
        <p role="status" className="alert">
          {message}
        </p>
      )}
      <Button disabled={busy}>{busy ? "Guardando…" : title}</Button>
    </form>
  );
}
export function ActionButton({
  endpoint,
  action,
  data,
  label,
}: {
  endpoint: string;
  action: string;
  data?: unknown;
  label: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <span>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const r = await fetch(endpoint, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, data }),
            });
            if (!r.ok) throw new Error("No fue posible completar el cambio.");
            router.refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Error de conexión.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {message && <span role="status">{message}</span>}
    </span>
  );
}
