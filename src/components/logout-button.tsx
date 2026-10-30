"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function LogoutButton({ all = false }: { all?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(
              `/api/auth/${all ? "logout-all" : "logout"}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              },
            );
            if (!r.ok) throw new Error("No fue posible cerrar la sesión.");
            router.push("/login");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error de conexión");
          } finally {
            setBusy(false);
          }
        }}
      >
        {all ? "Cerrar todas las sesiones" : "Cerrar sesión"}
      </Button>
      {error && <p role="status">{error}</p>}
    </>
  );
}
