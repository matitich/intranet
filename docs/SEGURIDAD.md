# Seguridad y límites de la entrega

Esta versión no está certificada ni lista para producción. Se distinguen controles comprobados de trabajo pendiente; disponer de este documento no acredita ASVS nivel 2.

## Modelo de amenazas STRIDE

| Amenaza                | Control implementado                                 | Evidencia y límite                                                                                      |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Suplantación           | argon2id, TOTP, límites Redis, sesiones opacas       | Login/MFA real para ocho roles; faltan más casos de abuso y recuperación                                |
| Alteración             | SHA-256, AES-GCM, auditoría encadenada y serializada | Integridad/cifrado unitarios; concurrencia y rechazo UPDATE SQL probados                                |
| Repudio                | Auditoría de accesos y operaciones sensibles         | Trigger impide UPDATE/DELETE/TRUNCATE; falta verificar toda la cadena histórica y anclarla externamente |
| Divulgación            | ACL reservada y filtros por autor/asignación         | Denegaciones HTTP y notas privadas comprobadas; falta cobertura exhaustiva de todos los recursos        |
| Denegación de servicio | Límites de cuenta/IP, entradas y archivos            | Redis y límites disponibles; falta revisión de cargas concurrentes y protección perimetral              |
| Elevación              | Matriz central y autorización en servidor            | Pruebas de roles y endpoints; no equivalen a una auditoría independiente                                |

## Autenticación

Sesiones aleatorias guardadas como hashes, expiración absoluta e inactividad configurable; cookies httpOnly y SameSite=Lax, con Secure y prefijo `__Host-` en producción real. Contraseñas argon2id, historial de cinco, complejidad y evaluación local de patrones/contraseñas comunes con zxcvbn. El cambio de contraseña verifica la contraseña actual y revoca sesiones.

TOTP cifrado con AES-256-GCM y actualización condicional del contador para impedir repetición. Los códigos de recuperación se guardan con hash y se consumen transaccionalmente. Invitaciones y recuperación usan tokens aleatorios con expiración y consumo único. La clave TOTP compartida del seed es solo de demostración; no usar ese seed en producción.

Las mutaciones rechazan orígenes ajenos a APP_URL y peticiones cross-site. Se validan con Zod y no se guardan tokens en localStorage. Los errores son genéricos. Faltan endurecimiento y pruebas adicionales de reautenticación, reset MFA, carreras, enumeración por tiempos y gestión avanzada de dispositivos.

## Archivos

Los archivos se validan por contenido con file-type, tienen tamaño limitado, nombre sanitizado y clave aleatoria fuera del webroot. Se almacenan cifrados en cuarentena y solo una versión con resultado antivirus CLEAN puede descargarse. ClamAV se comprobó con un archivo limpio y con el estándar EICAR. No se omiten firmas ni verificaciones TLS.

La app autoriza la lectura antes de obtener una URL S3 firmada interna de 60 segundos, descifra, compara SHA-256 y marca los PDFs reservados con usuario/fecha. Los reservados admiten únicamente PDF para garantizar la marca. El endpoint entrega adjuntos con nosniff, no-store y CSP sandbox. **Falta un visor en origen separado, política de cuarentena/retención completa y revisión de formatos maliciosos complejos.** Los volúmenes y backups también deben cifrarse en producción; el cifrado de objetos no reemplaza el cifrado de PostgreSQL.

## Auditoría y autorización

Las consultas de solicitudes filtran autor/visibilidad/asignación. La lectura de documentos reservados exige ACL explícita; ser administrador técnico o auditor no la concede. Las notas se consultan exclusivamente por su autor y se cifran. Los resultados de búsqueda y exportación pasan por estos mismos servicios.

La inserción de auditoría usa un bloqueo PostgreSQL de transacción para serializar la cadena SHA-256; un trigger impide actualizaciones, eliminaciones y truncado. Las pruebas verifican continuidad bajo inserciones concurrentes e inmutabilidad por SQL. La cuenta de producción debe carecer de propiedad/superusuario y de capacidad para desactivar triggers. **Falta atomicidad uniforme entre todas las mutaciones de dominio y el registro de auditoría, verificación integral histórica y anclaje externo.** No se afirma resistencia frente a un administrador de infraestructura con control de base y claves.

## Navegador y PWA

CSP con nonce en scripts, frame-ancestors, nosniff, COOP/CORP, Referrer-Policy, Permissions-Policy y HSTS solo en producción HTTPS. Los estilos inline siguen permitidos por los componentes; revisar este punto en el endurecimiento. El service worker no cachea contenido privado y solo presenta un aviso genérico cuando falla una navegación sin conexión. No se declara conformidad WCAG ni resultado Lighthouse.

## Antes de producción

1. Completar los pendientes de docs/ESTADO.md y someter autenticación, autorización, archivos y auditoría a revisión independiente.
2. Usar `APP_ENV=production`, APP_URL HTTPS y reverse proxy confiable que sobrescriba X-Real-IP. No confiar en cabeceras IP arbitrarias desde Internet.
3. Separar usuarios de migración, app, almacenamiento y respaldo; dar permisos mínimos de PostgreSQL/S3. Las credenciales root de MinIO son solo de desarrollo.
4. Usar un gestor de claves, cifrado de volúmenes y backups, rotación de claves y credenciales. El formato actual v1 no implementa un llavero de rotación: preservar la clave anterior hasta migrar los datos.
5. Probar restauraciones, retención, anonimización y exportación/eliminación de datos personales. Guardar parámetros de retención no implementa esos procesos por sí mismo.
6. Revisar la imagen de MinIO y sus dependencias Go, definir monitoreo, alertas y plan institucional de incidentes. El npm audit no audita las imágenes ni acredita ausencia total de vulnerabilidades.

## Respaldos e incidentes

Crear un pg_dump con una cuenta de respaldo y cifrarlo antes de sacarlo del entorno. Respaldar objetos S3 y claves por canales separados con controles de acceso. Verificar la restauración en una instancia aislada y comprobar datos, hashes y permisos; todavía no se ha ejecutado esa restauración en esta entrega.

Ante un incidente: aislar el componente afectado, preservar evidencias restringidas, revocar sesiones/credenciales comprometidas y restaurar únicamente una copia verificada. Seguir los procedimientos institucionales y obligaciones aplicables con los responsables designados. Esto es una guía técnica inicial, no un plan municipal aprobado ni asesoría legal.
