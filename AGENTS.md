# Intranet municipal

- Interfaz y mensajes en español de Chile; America/Santiago, CLP y fechas dd-mm-aaaa.
- Next.js App Router, TypeScript estricto, PostgreSQL 16 y Prisma. Reglas de negocio en módulos y utilidades, nunca en componentes.
- Denegación por defecto. Toda lectura y mutación se autoriza en servidor; los filtros de acceso deben preceder paginación y búsqueda.
- Sesiones opacas en servidor, cookies httpOnly; MFA obligatorio. No almacenar credenciales en localStorage ni registrar secretos.
- Validar entradas con Zod. Dinero con Decimal. Consultas parametrizadas. Notas y TOTP cifrados con AES-256-GCM.
- Antes de cerrar cambios ejecutar npm run lint, npm run typecheck y npm test; para flujos web ejecutar npm run test:e2e con servicios y seed.
- No afirmar certificación ASVS/WCAG ni resultados de pruebas no ejecutadas. Registrar limitaciones en docs/ESTADO.md.
- Datos exclusivamente ficticios. Secretos locales en .env, excluido de Git. No credenciales de producción.
- Commits convencionales; migraciones versionadas. Preferir módulos pequeños, accesibles y pruebas de límites de autorización.
- Cada tarea cloud ya es aislada: usar este checkout y no crear worktrees salvo solicitud expresa.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
