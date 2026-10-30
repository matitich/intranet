# Decisiones

1. Next.js estable consultado al preparar el proyecto; Node 24 LTS. Prisma 7.10.1 con el adaptador oficial PostgreSQL: la auditoría descartó la línea 6 por vulnerabilidades transitivas.
2. Autenticación propia equivalente: sesiones opacas en PostgreSQL y desafíos MFA separados. Sin registro público ni JWT en el cliente.
3. Localmente la cookie puede circular por HTTP únicamente en desarrollo; en producción requiere HTTPS y prefijo __Host-.
4. Los días hábiles excluyen sábados, domingos y feriados configurados, sin pretender interpretación legal. El día de creación no cuenta.
5. No se crea código OIDC/push ficticio: las opciones opcionales permanecen desactivadas y documentadas.
6. El encargo adjunto autoriza crear y modificar el proyecto, ampliando la configuración inicial del entorno.

7. Las imágenes oficiales precompiladas de MinIO fueron rechazadas por ambos registros. Se construye desde su fuente oficial, fijada al commit 07c3a429bfed433e49018cb0f78a52145d4bedeb; Go verifica go.sum y se conserva la licencia AGPL. Es una imagen de desarrollo, pendiente de revisión para producción.

8. La publicación del entorno no envía commits a GitHub. El código debe versionarse y enviarse por Git por separado; no se vuelve a publicar el entorno para actualizar el repositorio.
9. APP_ENV separa el modo de seguridad de la demostración del NODE_ENV del bundle Next.js. Producción real requiere APP_ENV=production y HTTPS; el seed se omite.
10. Los objetos S3 se cifran a nivel de aplicación con AES-256-GCM. La app usa una URL S3 firmada de 60 segundos internamente, verifica integridad y aplica la marca de agua antes de responder como adjunto. Se prioriza no servir contenido subido inline mientras falta el origen de archivos aislado.
11. La lista de contraseñas comunes se evalúa localmente con la API actual ZxcvbnFactory; las contraseñas nunca se envían a un proveedor externo.
12. El servidor de producción usa la salida standalone y copia explícitamente public y .next/static; se ejecuta como usuario no root en el contenedor.
