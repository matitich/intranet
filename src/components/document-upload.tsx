"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function DocumentUpload({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const form = new FormData(e.currentTarget);
          const r = await fetch(`/api/documentos/${documentId}/archivo`, {
            method: "POST",
            body: form,
          });
          const v = await r.json();
          if (!r.ok) throw new Error(v.error);
          setMessage("Versión recibida y escaneada correctamente.");
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Error de conexión");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="upload">
          Archivo PDF, DOCX, XLSX, PNG o JPEG (máximo 20 MB)
        </label>
        <input
          type="file"
          id="upload"
          name="file"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          required
        />
      </div>
      <p className="muted">
        El archivo se mantiene en cuarentena hasta completar el escaneo.
      </p>
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <Button disabled={busy}>
        {busy ? "Verificando archivo…" : "Cargar y verificar"}
      </Button>
    </form>
  );
}
