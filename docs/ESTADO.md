# Estado de la entrega

Actualización: 30-10-2026. El entorno publicado conservó los archivos, pero el repositorio remoto estaba vacío porque no se habían creado commits ni enviado código. Los bloqueos previos de Prisma y compilación de MinIO quedaron resueltos al arrancar con la política publicada. No se volvió a publicar ni modificar el borrador del entorno durante esta implementación.

## Funcional y verificado en esta instancia

- Cliente Prisma 7.10.1 generado; migración inicial aplicada; 48 modelos, índices GIN de búsqueda española, restricciones y trigger append-only de auditoría. El seed conserva datos existentes.
- Quince usuarios ficticios con los ocho roles, un año de sesiones, presupuesto, acuerdos y solicitudes; biblioteca con PDFs reales escaneados, cifrados y versionados. Feriados base de 2026 cargados sin sobrescribir cambios existentes.
- Sesiones opacas, argon2id, TOTP y protección contra repetición; validación local de contraseñas comunes con zxcvbn, recuperación/activación de un solo uso, historial de contraseñas y revocación.
- Navegación privada con permisos, inicio, búsqueda, listados paginados, detalles, formularios y acciones en servidor. Los recursos reservados y las solicitudes ajenas se filtran en SQL/Prisma antes de devolver datos.
- Documentos con validación de contenido, cuarentena, ClamAV, almacenamiento cifrado mediante AES-GCM, hash SHA-256 y marca de agua para PDFs reservados. Se entregan como adjuntos; no hay visor PDF aislado todavía.
- Calendario/ICS/asistencia, tablas publicables, notas y revisión por punto, registro de votaciones y acuerdo vinculado al aprobar; actas versionadas.
- Acuerdos con avances y solicitudes con estados/hilo oficial/plazos/visibilidad/asignación; importación presupuestaria CSV con vista previa, Decimal/BigInt, tabla y gráfico.
- Invitaciones y gestión de acceso; comisiones, feriados y parámetros; notificaciones internas y worker SMTP/BullMQ con recordatorios de sesiones, acuerdos y solicitudes.
- Manifiesto PWA y service worker sin caché de datos privados. Interfaz responsiva con tema y ajuste de texto; no equivalen a una certificación de accesibilidad.

## Evidencia

- `npm run lint` y `npm run typecheck` aprobados.
- 26 unitarias/esquema aprobadas: permisos, ACL, RUT, CLP exacto, fechas civiles, cifrado, contraseñas y estructura Prisma.
- 6 pruebas de integración aprobadas: roles/datos, búsqueda española, rechazo SQL de cambios de auditoría, cadena bajo concurrencia, EICAR y exactitud/no escritura en vista previa presupuestaria.
- 11 e2e finales aprobados contra la aplicación de producción: MFA para ocho roles, formulario completo de login, denegaciones HTTP, privacidad, carga/descarga S3 con ClamAV y watermark, importación presupuestaria exacta y respuesta oficial de solicitudes.
- Se corrigieron dos problemas detectados durante la validación: espera insuficiente de navegación durante compilación fría en desarrollo y login prerenderizado sin nonces de CSP. Se confirmó HTML real con nonce en los 12 scripts y funcionamiento del formulario sin relajar CSP.
- El build final pasó dentro de Docker. La app usa el servidor standalone y los assets copiados explícitamente; app y worker comparten una única imagen. Ambos arrancaron y Mailpit recibió 41 mensajes ficticios de las pruebas/recordatorios.
- Se resolvió el disco lleno retirando caché e imágenes anteriores sin uso; se preservaron código, configuración y volúmenes. El runtime final parte de una imagen limpia para evitar heredar capas de caché del build.
- PostgreSQL, Redis, MinIO y ClamAV respondieron operaciones reales. MinIO se construyó desde el commit oficial fijado y verificó todos los módulos Go. No se desactivaron TLS, checksums ni firmas.
- Lint aprobado con ESLint 10.14.0; el plugin React transitivo de Next todavía declara peer hasta ESLint 9 y npm avisa al instalar. La combinación actual se comprobó ejecutando lint, pero conviene revisar la declaración upstream al actualizar herramientas.
- npm audit final: cero vulnerabilidades reportadas. GitHub Actions no se ha ejecutado todavía en el repositorio remoto; no se declara su resultado por anticipado.

## Alcance que todavía falta del encargo completo

Esta es una primera versión funcional, **no la totalidad de las once fases ni una entrega lista para producción**. Persisten, entre otros:

- Gestión completa del perfil/foto, recuperación MFA por correo opcional, restablecimiento forzado completo y rotación de claves con llavero. La invitación y recuperación necesitan revisión de casos de concurrencia y abuso adicional.
- Edición avanzada/relaciones/ACL desde UI, comparación visual de versiones, carga múltiple y PDF OCR/texto extraído; visor con origen separado, reproducción de grabaciones y paquete ZIP de antecedentes.
- Vistas mes/semana/día, feed personal revocable, agenda con controles de anticipación y registro visible de modificaciones, gestión avanzada de asistencia y convocados.
- Kanban, evidencias de avances, reportes y filtros avanzados; importación Excel, modificaciones y carga mensual de ejecución desde UI, comparaciones interanuales y exportaciones financieras completas.
- Grabaciones y streaming, observaciones sobre actas, preferencias por evento/canal/resumen diario y cobertura de todos los eventos de notificación. OIDC y push siguen desactivados; no se afirma que estén integrados.
- Gestión completa de períodos y marca municipal, retención/exportación/eliminación de datos personales, verificación integral de contenido histórico de la cadena de auditoría y panel de salud/respaldos/restauración probados.
- Pruebas completas de IDOR y concurrencia para todas las operaciones, instalación limpia en otra máquina, auditoría independiente ASVS/WCAG, medición Lighthouse y revisión de vulnerabilidades de la imagen MinIO/fuentes Go.

Los parámetros guardados no implican por sí mismos que toda política de retención o alerta esté automatizada. Las comprobaciones enumeradas son límites concretos de la evidencia, no una certificación institucional o legal.
