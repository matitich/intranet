import type { Metadata } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa-registration";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Concejo · Intranet municipal", template: "%s · Concejo" },
  description: "Espacio privado de trabajo del Concejo Municipal",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CL">
      <body>
        <PwaRegistration />
        <a className="skip" href="#contenido">
          Ir al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
