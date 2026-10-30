"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "mfa" | "recover">("password");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null),
    [codes, setCodes] = useState<string[]>([]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const action =
        step === "password" ? "login" : step === "mfa" ? "mfa" : "recover";
      const body =
        step === "password"
          ? { email: data.get("email"), password: data.get("password") }
          : step === "mfa"
            ? { code: data.get("code") }
            : { email: data.get("email") };
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          step === "password"
            ? "No fue posible ingresar. Revise sus datos o intente más tarde."
            : result.error,
        );
      if (step === "password") setStep("mfa");
      else if (step === "recover") setError(result.message);
      else if (result.recoveryCodes?.length) setCodes(result.recoveryCodes);
      else {
        router.push("/inicio");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible conectarse.");
    } finally {
      setBusy(false);
    }
  }
  async function setupMfa() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          "Si ya tiene MFA configurado, use su aplicación autenticadora.",
        );
      setSetup(d);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No fue posible configurar MFA",
      );
    } finally {
      setBusy(false);
    }
  }
  if (codes.length)
    return (
      <div>
        <h1>Guarde sus códigos</h1>
        <p>
          Permiten recuperar el acceso si pierde su autenticador. Cada código
          puede utilizarse una sola vez.
        </p>
        <pre className="card">{codes.join("\n")}</pre>
        <Button
          onClick={() => {
            router.push("/inicio");
            router.refresh();
          }}
        >
          Ya los guardé, continuar
        </Button>
      </div>
    );
  return (
    <form className="auth-form" onSubmit={submit} aria-busy={busy}>
      <p className="eyebrow">Acceso institucional</p>
      <h1>
        {step === "password"
          ? "Bienvenido a su Concejo"
          : step === "mfa"
            ? "Verifique su identidad"
            : "Recuperar acceso"}
      </h1>
      <p className="muted">
        {step === "password"
          ? "Ingrese con su cuenta municipal para continuar."
          : step === "mfa"
            ? "Ingrese el código de su aplicación autenticadora o un código de recuperación."
            : "Le enviaremos instrucciones si su cuenta está habilitada."}
      </p>
      {error && (
        <p role="status" className="alert">
          {error}
        </p>
      )}
      {step !== "mfa" && (
        <div className="field">
          <label htmlFor="email">Correo institucional</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={200}
            placeholder="nombre@municipalidad.cl"
          />
        </div>
      )}
      {step === "password" && (
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </div>
      )}
      {step === "mfa" && (
        <>
          <div className="field">
            <label htmlFor="code">Código de verificación</label>
            <input
              id="code"
              name="code"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={32}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={setupMfa}
          >
            Configurar mi autenticador por primera vez
          </Button>
          {setup && (
            <div className="card">
              <p>Agregue esta clave a su autenticador. No la comparta.</p>
              <code style={{ overflowWrap: "anywhere" }}>{setup.secret}</code>
              <p className="muted">
                Tipo TOTP, 6 dígitos, intervalo 30 segundos.
              </p>
            </div>
          )}
        </>
      )}
      <Button type="submit" disabled={busy}>
        {busy
          ? "Procesando…"
          : step === "password"
            ? "Ingresar de forma segura"
            : step === "mfa"
              ? "Verificar y continuar"
              : "Enviar instrucciones"}
      </Button>
      <div className="auth-links">
        <button
          className="button button-ghost"
          type="button"
          onClick={() => {
            setStep(step === "recover" ? "password" : "recover");
            setError("");
          }}
        >
          {step === "recover"
            ? "Volver al inicio de sesión"
            : "¿Olvidó su contraseña?"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: ".8rem", marginTop: 24 }}>
        Acceso exclusivo por invitación. Si necesita ayuda, comuníquese con el
        soporte de su municipalidad.
      </p>
    </form>
  );
}
