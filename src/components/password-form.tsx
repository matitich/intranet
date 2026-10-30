"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function PasswordForm() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      style={{ maxWidth: 500 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const form = new FormData(e.currentTarget);
        try {
          if (form.get("password") !== form.get("confirmation"))
            throw new Error("Las contraseñas no coinciden.");
          const r = await fetch("/api/auth/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              password: form.get("password"),
              currentPassword: form.get("currentPassword"),
            }),
          });
          if (!r.ok)
            throw new Error(
              "Use una contraseña nueva de al menos 12 caracteres, con mayúscula, minúscula, número y símbolo.",
            );
          router.push("/login");
          router.refresh();
        } catch (e) {
          setMessage(
            e instanceof Error ? e.message : "No fue posible guardar.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">Al guardar se cerrarán todas las sesiones.</p>
      <div className="field">
        <label htmlFor="current-password">Contraseña actual</label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Nueva contraseña</label>
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="confirmation">Confirmar contraseña</label>
        <input
          id="confirmation"
          type="password"
          name="confirmation"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </div>
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <Button disabled={busy}>Guardar y cerrar sesiones</Button>
    </form>
  );
}
