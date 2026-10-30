import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Concejo · Intranet municipal",
    short_name: "Concejo",
    description: "Espacio privado de trabajo del Concejo Municipal",
    lang: "es-CL",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#17375d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
