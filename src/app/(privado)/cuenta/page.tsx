import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, sessionIdleMinutes } from "@/modules/auth/service";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/chile";
import { LogoutButton } from "@/components/logout-button";
import { PasswordForm } from "@/components/password-form";
export const dynamic = "force-dynamic";
export default async function Cuenta() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - (await sessionIdleMinutes()));
  const sessions = await db.session.findMany({
    where: {
      userId: user.id,
      expiresAt: { gt: new Date() },
      lastSeenAt: { gte: cutoff },
    },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, device: true, lastSeenAt: true, createdAt: true },
  });
  return (
    <div className="stack">
      <Link href="/inicio">← Volver al inicio</Link>
      <h1>Mi cuenta</h1>
      <section className="card">
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <span className="badge">{user.roleId.replaceAll("_", " ")}</span>
      </section>
      <section className="card">
        <h2>Mis sesiones activas</h2>
        <p className="muted">
          Cierre todas las sesiones si no reconoce un dispositivo.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">
              Dispositivos con acceso a su cuenta
            </caption>
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Inicio</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ overflowWrap: "anywhere" }}>{s.device}</td>
                  <td>{dateTime(s.createdAt)}</td>
                  <td>{dateTime(s.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 20 }}>
          <LogoutButton all />
        </div>
      </section>
      <section className="card">
        <h2>Cambiar contraseña</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
