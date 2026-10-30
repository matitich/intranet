import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Landmark,
  Home,
  Files,
  CalendarDays,
  ListOrdered,
  ChartColumn,
  CheckCheck,
  MessagesSquare,
  Archive,
  Bell,
  Settings,
  Shield,
  Search,
} from "lucide-react";
import { currentUser } from "@/modules/auth/service";
import { can, type Resource } from "@/lib/permissions";
import { labels } from "@/modules/concejo/presentation";
import { db } from "@/lib/db";
import { ThemeControls } from "@/components/theme-controls";
import { LogoutButton } from "@/components/logout-button";
const navigation: [Resource, typeof Files][] = [
  ["documentos", Files],
  ["calendario", CalendarDays],
  ["sesiones", ListOrdered],
  ["presupuesto", ChartColumn],
  ["acuerdos", CheckCheck],
  ["solicitudes", MessagesSquare],
  ["archivo", Archive],
  ["notificaciones", Bell],
  ["admin", Settings],
  ["auditoria", Shield],
];
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const unread = await db.notification.count({
    where: { userId: user.id, readAt: null, archivedAt: null },
  });
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/inicio" className="brand">
          <Landmark size={32} />
          <span>
            Villa del Roble<small>Concejo Municipal</small>
          </span>
        </Link>
        <p className="nav-caption">ESPACIO DEL CONCEJO</p>
        <nav aria-label="Navegación principal">
          <Link href="/inicio">
            <Home size={19} />
            Inicio
          </Link>
          {navigation
            .filter(([r]) => can(user, r, "ver"))
            .map(([r, Icon]) => (
              <Link key={r} href={`/${r}`}>
                <Icon size={19} />
                {labels[r]}
              </Link>
            ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.roleId.replaceAll("_", " ")}</small>
            <Link href="/cuenta">Mi cuenta</Link>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <form action="/buscar" className="global-search">
            <Search size={19} />
            <label htmlFor="global-search" className="sr-only">
              Buscar en la intranet
            </label>
            <input
              id="global-search"
              name="q"
              placeholder="Buscar documentos, sesiones, acuerdos…"
              maxLength={200}
            />
          </form>
          <div className="topline">
            <ThemeControls />
            <Link
              className="notification-link"
              href="/notificaciones"
              aria-label={`${unread} notificaciones sin leer`}
            >
              <Bell size={22} />
              {unread > 0 && <span>{unread}</span>}
            </Link>
            <LogoutButton />
          </div>
        </header>
        <main id="contenido" className="shell private-content">
          {children}
        </main>
      </div>
    </div>
  );
}
