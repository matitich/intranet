# Arquitectura

Aplicación privada del Concejo Municipal, organizada por dominios. Next.js App Router aporta vistas del servidor y endpoints; los servicios realizan validación Zod, autorización por recurso y persistencia con Prisma/PostgreSQL 16. Se utilizan sesiones opacas revocables en base de datos y argon2id; MFA TOTP obligatorio antes de emitir una sesión autenticada. Redis mantiene límites y BullMQ los trabajos asíncronos.

Los documentos viven fuera del webroot en MinIO/S3. Se escanean antes de publicación, se verifica SHA-256 y se controla cada descarga; los reservados requieren una ACL explícita. No se confunde ser administrador técnico con poder leer contenido municipal. Las notas son privadas de su autor y cifradas. Las mutaciones verifican origen y sesión, además de permisos y entradas.

PostgreSQL contiene datos institucionales normalizados, importes Decimal, índices de búsqueda española GIN y auditoría encadenada. El registro de auditoría se serializa con un bloqueo de transacción y un trigger impide UPDATE/DELETE. La cuenta de aplicación de producción no debe ser propietaria ni superusuario.

Desarrollo: Compose separa PostgreSQL, Redis, MinIO, ClamAV y Mailpit. La aplicación puede ejecutarse en el host para iterar o dentro del contenedor multi-stage. Producción exige HTTPS, claves externas, almacenamiento cifrado, gestión de backups y revisión independiente de seguridad.

El cumplimiento se comprobará por fases con unitarias, pruebas de permisos, integración y Playwright. docs/ESTADO.md distingue entregado, validado y pendiente; este documento expresa la arquitectura objetivo y no certifica controles todavía no verificados.
