import { ActivationForm } from "@/components/activation-form";
export default async function Activate({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; tipo?: string }>;
}) {
  const q = await searchParams;
  return (
    <main id="contenido" className="auth-main" style={{ minHeight: "100vh" }}>
      <ActivationForm
        token={q.token ?? ""}
        kind={q.tipo === "recuperacion" ? "recuperacion" : "invitacion"}
      />
    </main>
  );
}
