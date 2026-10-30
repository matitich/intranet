"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
export function ActivationForm({
  token,
  kind,
}: {
  token: string;
  kind: string;
}) {
  const [message, setMessage] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="auth-form card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const data = new FormData(e.currentTarget);
        try {
          if (data.get("password") !== data.get("confirmation"))
            throw new Error("Las contraseñas no coinciden.");
          const r = await fetch("/api/auth/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              kind,
              password: data.get("password"),
            }),
          });
          if (!r.ok)
            throw new Error("Revise la contraseña o solicite un nuevo enlace.");
          setDone(true);
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Error de conexión");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>{kind === "invitacion" ? "Active su cuenta" : "Nueva contraseña"}</h1>
      {done ? (
        <p>
          Su contraseña quedó establecida.{" "}
          <Link href="/login">Inicie sesión y configure MFA.</Link>
        </p>
      ) : (
        <>
          <p className="muted">
            Use al menos 12 caracteres, con mayúscula, minúscula, número y
            símbolo. Evite contraseñas comunes.
          </p>
          <div className="field">
            <label htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirmation">Repita la contraseña</label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </div>
          {message && (
            <p className="alert" role="status">
              {message}
            </p>
          )}
          <Button disabled={busy}>Guardar contraseña</Button>
        </>
      )}
    </form>
  );
}
