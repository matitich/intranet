import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createConnection } from "node:net";
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { encrypt, decrypt, sha256 } from "@/lib/crypto";
import {
  authorize,
  documentWhere,
  Forbidden,
  type Actor,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { dateTime } from "@/lib/chile";
const allowed = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);
function client() {
  const e = env();
  return new S3Client({
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: e.S3_ACCESS_KEY,
      secretAccessKey: e.S3_SECRET_KEY,
    },
  });
}
export async function ensureBucket() {
  const c = client();
  try {
    await c.send(new HeadBucketCommand({ Bucket: env().S3_BUCKET }));
  } catch (e) {
    if (
      (e as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 404
    )
      throw e;
    await c.send(new CreateBucketCommand({ Bucket: env().S3_BUCKET }));
  }
}
export async function scan(bytes: Buffer) {
  return new Promise<void>((resolve, reject) => {
    const socket = createConnection({
      host: env().CLAMAV_HOST,
      port: env().CLAMAV_PORT,
    });
    let reply = "";
    let settled = false;
    const done = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(60000, () =>
      done(new Error("Tiempo de escaneo agotado")),
    );
    socket.on("error", () => done(new Error("Antivirus no disponible")));
    socket.on("data", (chunk) => {
      reply += chunk.toString();
      if (reply.includes("\0") || reply.includes("\n")) {
        if (!reply.includes(": OK"))
          done(new Error("Archivo rechazado por el antivirus"));
        else done();
      }
    });
    socket.on("close", () => {
      if (!settled) done(new Error("Escaneo incompleto"));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const chunk = bytes.subarray(offset, offset + 65536);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        socket.write(len);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
export async function upload(documentId: string, actor: Actor, file: File) {
  authorize(actor, "documentos", "editar");
  const doc = await db.document.findFirst({
    where: { AND: [{ id: documentId }, documentWhere(actor)] },
  });
  if (!doc) throw new Forbidden();
  if (file.size < 1 || file.size > env().MAX_UPLOAD_MB * 1024 * 1024)
    throw new Error("Tamaño de archivo inválido");
  const bytes = Buffer.from(await file.arrayBuffer()),
    type = await fileTypeFromBuffer(bytes);
  if (!type || !allowed.has(type.mime))
    throw new Error("Tipo de archivo no permitido");
  if (doc.classification === "RESERVADO" && type.mime !== "application/pdf")
    throw new Error(
      "Los documentos reservados deben ser PDF para aplicar marca de agua",
    );
  const name =
    file.name
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}._ -]/gu, "_")
      .replace(/^\.+/, "")
      .slice(0, 150) || `documento.${type.ext}`;
  const objectKey = `quarantine/${randomUUID()}`;
  await ensureBucket();
  await client().send(
    new PutObjectCommand({
      Bucket: env().S3_BUCKET,
      Key: objectKey,
      Body: encrypt(bytes.toString("base64")),
      ContentType: "application/octet-stream",
    }),
  );
  let version;
  try {
    await scan(bytes);
    version = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${documentId}))`;
      const previous = await tx.documentVersion.findFirst({
        where: { documentId },
        orderBy: { version: "desc" },
      });
      return tx.documentVersion.create({
        data: {
          documentId,
          version: (previous?.version ?? 0) + 1,
          objectKey,
          name,
          mime: type.mime,
          size: bytes.length,
          sha256: sha256(bytes),
          scanStatus: "CLEAN",
          metadata: {
            title: doc.title,
            classification: doc.classification,
            status: doc.status,
          },
        },
      });
    });
  } catch {
    await audit({
      actorId: actor.id,
      action: "UPLOAD_REJECTED",
      resource: "documentos",
      resourceId: documentId,
    });
    throw new Error("El archivo permanece en cuarentena. No fue publicado.");
  }
  await audit({
    actorId: actor.id,
    action: "UPLOAD",
    resource: "documentos",
    resourceId: documentId,
    metadata: { version: version.version, sha256: version.sha256 },
  });
  return { id: version.id, version: version.version };
}
export async function download(
  documentId: string,
  versionId: string | undefined,
  actor: Actor & { name: string },
) {
  const doc = await db.document.findFirst({
    where: { AND: [{ id: documentId }, documentWhere(actor)] },
    include: {
      versions: {
        where: { ...(versionId ? { id: versionId } : {}), scanStatus: "CLEAN" },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  if (!doc || !doc.allowDownload || !doc.versions[0]) throw new Forbidden();
  const version = doc.versions[0];
  const url = await getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: version.objectKey }),
    { expiresIn: 60 },
  );
  const response = await fetch(url);
  if (!response.ok) throw new Error("Archivo no disponible");
  let bytes = Buffer.from(decrypt(await response.text()), "base64");
  if (sha256(bytes) !== version.sha256)
    throw new Error("Integridad de archivo inválida");
  if (doc.classification === "RESERVADO") {
    const pdf = await PDFDocument.load(bytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const mark = `RESERVADO · ${actor.name} · ${dateTime(new Date())}`
      .normalize("NFD")
      .replace(/[^\x20-\x7E]/g, "");
    for (const page of pdf.getPages())
      page.drawText(mark, {
        x: 30,
        y: page.getHeight() / 2,
        size: 12,
        font,
        color: rgb(0.5, 0.12, 0.12),
        opacity: 0.35,
        rotate: degrees(25),
        maxWidth: page.getWidth() - 60,
      });
    bytes = Buffer.from(await pdf.save());
  }
  await audit({
    actorId: actor.id,
    action: "DOWNLOAD",
    resource: "documentos",
    resourceId: documentId,
    metadata: { version: version.version },
  });
  return { bytes, mime: version.mime, name: version.name };
}
