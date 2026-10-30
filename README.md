# Intranet del Concejo Municipal

Primera versión funcional de una intranet privada para una municipalidad chilena ficticia. Next.js 16, TypeScript estricto, PostgreSQL 16/Prisma 7, sesiones de servidor con MFA, MinIO, Redis/BullMQ, ClamAV y Mailpit.

**Esta entrega permite ejecutar y probar los flujos descritos a continuación. Todavía no completa todos los requisitos del encargo original ni está certificada para producción.** El detalle de cobertura y pendientes está en [docs/ESTADO.md](docs/ESTADO.md).

## Inicio rápido

Requisitos: Node.js 24.19.0, npm 11, Docker y Compose v2.

```sh
npm ci --strict-ssl=true
node --import tsx scripts/configure.ts
docker compose up -d --build
```

El script crea `.env` solo si no existe, con permisos 0600 y claves aleatorias. Compose migra PostgreSQL, carga los datos ficticios, verifica los PDFs de ejemplo con ClamAV y arranca la aplicación y el worker. La primera compilación de MinIO desde fuente oficial tarda varios minutos. Espere a que el log de `app` indique que el servidor está listo.

```sh
docker compose logs --tail 30 app worker
docker compose stop
```

Detener conserva los volúmenes. `docker compose down -v` elimina los datos: úselo exclusivamente para reiniciar una demostración que se pueda borrar.

## Desarrollo con Next.js fuera de Docker

```sh
npm ci
node --import tsx scripts/configure.ts
docker compose up -d --build postgres redis minio clamav mailpit
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
# En otra terminal:
npm run worker
```

No ejecute simultáneamente el contenedor `app` y `npm run dev` en el mismo puerto. Si `app` ya está iniciado, deténgalo antes de usar Next.js en el host.

Los puertos locales de desarrollo son app 3000, PostgreSQL 5432, Redis 6379, MinIO 9000/9001, ClamAV 3310 y Mailpit 1025/8025; Compose los publica solo en loopback. No los exponga a Internet.

## Usuarios ficticios y MFA

El seed crea 8 concejales, alcalde, secretario, finanzas, jurídico, respondedor, administrador TI y auditor. Los correos son `concejal1@villa-roble.example.invalid` hasta `concejal8@villa-roble.example.invalid`, y los prefijos `alcalde`, `secretario`, `finanzas`, `juridico`, `respuestas`, `admin` y `auditor` con el mismo dominio ficticio.

La contraseña aleatoria de demostración se guarda únicamente en `DEMO_PASSWORD` de su `.env` local. La clave TOTP de demostración está en `DEMO_TOTP_SECRET`: agréguela manualmente a un autenticador TOTP de seis dígitos y período de 30 segundos. Estos valores nunca se imprimen ni se versionan. Cada código TOTP usado queda consumido: no reutilice un código dentro del mismo intervalo de 30 segundos. La clave compartida entre cuentas es exclusivamente para los datos ficticios de desarrollo; las cuentas invitadas configuran su propio secreto.

`APP_ENV=development` permite la demostración sobre HTTP. `NODE_ENV` es el modo del framework; los contenedores ejecutan el bundle de producción y conservan `APP_ENV=development` para la demostración. En una instalación real use `APP_ENV=production`, HTTPS y credenciales nuevas; el seed se omite. No hay registro público.

## Flujos disponibles

- **Cuenta:** contraseña argon2id, MFA TOTP, recuperación de un solo uso, activación por invitación, códigos de recuperación iniciales, sesiones opacas revocables y cierre en todos los dispositivos. Cambio de contraseña con verificación de la actual.
- **Inicio:** próximas sesiones, avisos, documentos, indicadores de acuerdos y solicitudes filtrados por rol.
- **Documentos:** metadatos, búsqueda española, paginación, favoritos, versiones, carga con tipos reales y antivirus, cifrado de archivos en S3 y SHA-256. Los PDFs reservados reciben marca de agua al descargar y exigen ACL explícita.
- **Concejo:** eventos y asistencia, exportación ICS, sesiones y tabla publicable, puntos revisados, notas privadas cifradas, registro de votos y acuerdo automático al aprobar.
- **Seguimiento:** acuerdos con avances; solicitudes propias/asignadas, plazo hábil con tabla editable de feriados, estados, mensajes y respuestas oficiales, exportación del historial en PDF.
- **Presupuesto:** importación CSV validada con vista previa y confirmación, cálculos exactos, ejecución tabulada por área y gráfico, exportación CSV.
- **Archivo y avisos:** actas versionadas, notificaciones personales, leído/archivado, anuncios y recordatorios en BullMQ.
- **Administración:** invitaciones, roles y desactivación con revocación de sesiones; comisiones, integrantes, parámetros, feriados y auditoría con trigger que impide actualización/eliminación.

Las exportaciones de listas corresponden a la página actual. Las URLs S3 internas firmadas duran 60 segundos; la app autoriza, descifra y registra la descarga. Los archivos se entregan como adjuntos con `nosniff` y CSP sandbox; todavía no se ofrece un visor aislado en un origen separado.

## Pruebas

Con los servicios y el seed preparados:

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
npm audit --audit-level=high
```

Las pruebas e2e incluyen login real con MFA para los ocho roles, denegaciones HTTP, privacidad de solicitudes/notas, carga S3 con antivirus y watermark, y flujos presupuestarios y de respuesta. Por la protección contra repetición TOTP, espere al siguiente intervalo si repite inmediatamente una ejecución usando los mismos usuarios.

Playwright usa Chromium del sistema si existe; en CI instala el navegador de Playwright. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite seleccionar otro ejecutable. Los informes y trazas, que pueden contener datos de prueba o cookies, están excluidos de Git. El workflow de GitHub prepara servicios y ejecuta lint, tipos, unitarias, integración, e2e y auditoría; su resultado remoto solo se conoce después de subir el código.

## Seguridad y operación

Revise [SEGURIDAD.md](docs/SEGURIDAD.md), [ARQUITECTURA.md](docs/ARQUITECTURA.md), [DECISIONES.md](docs/DECISIONES.md) y [ESTADO.md](docs/ESTADO.md). No se declara conformidad ASVS o WCAG ni una puntuación Lighthouse no medida. La revisión independiente, el aislamiento de archivos en otro origen, el endurecimiento de claves/almacenamiento y los demás pendientes son condiciones previas a producción.

En cloud se conservan el proxy y el certificado administrados. Los builds montan la CA temporalmente; nunca desactive TLS, checksums, go.sum ni firmas de ClamAV. Los dominios adicionales ya publicados para esta tarea son `binaries.prisma.sh`, `storage.googleapis.com` y `database.clamav.net`. No se requiere un token GitHub nuevo para clonar: se usa el proxy de la plataforma.
