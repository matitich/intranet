import "dotenv/config";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { db } from "../src/lib/db";
import { upload, scan } from "../src/modules/documentos/storage";
async function main() {
  if (process.env.APP_ENV === "production") return;
  if (new Date().getUTCFullYear() === 2026) {
    for (const [day, name] of [
      ["01-01", "Año Nuevo"],
      ["04-03", "Viernes Santo"],
      ["04-04", "Sábado Santo"],
      ["05-01", "Día del Trabajo"],
      ["05-21", "Glorias Navales"],
      ["06-21", "Día Nacional de los Pueblos Indígenas"],
      ["06-29", "San Pedro y San Pablo"],
      ["07-16", "Virgen del Carmen"],
      ["08-15", "Asunción de la Virgen"],
      ["09-18", "Independencia Nacional"],
      ["09-19", "Glorias del Ejército"],
      ["10-12", "Encuentro de Dos Mundos"],
      ["10-31", "Iglesias Evangélicas y Protestantes"],
      ["11-01", "Todos los Santos"],
      ["12-08", "Inmaculada Concepción"],
      ["12-25", "Navidad"],
    ])
      await db.holiday.upsert({
        where: { date: `2026-${day}` },
        create: { date: `2026-${day}`, name },
        update: {},
      });
  }
  const docs = await db.document.findMany({
    where: { versions: { none: {} } },
  });
  if (!docs.length) {
    console.log("Se conservan las versiones existentes.");
    return;
  }
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      await scan(Buffer.from("Comprobacion de disponibilidad del antivirus"));
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!ready)
    throw new Error("Antivirus no disponible; no se publicaron archivos.");
  for (const doc of docs) {
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica),
      page = pdf.addPage();
    page.drawText("MUNICIPALIDAD FICTICIA DE VILLA DEL ROBLE", {
      x: 45,
      y: 780,
      size: 15,
      font,
    });
    page.drawText(doc.title, { x: 45, y: 730, size: 12, font, maxWidth: 500 });
    page.drawText("Antecedente de demostracion sin validez institucional.", {
      x: 45,
      y: 690,
      size: 11,
      font,
    });
    page.drawText(`Materia: ${doc.subject}`, {
      x: 45,
      y: 650,
      size: 11,
      font,
      maxWidth: 500,
    });
    await upload(
      doc.id,
      { id: "secretario", roleId: "SECRETARIO_MUNICIPAL" },
      new File(
        [new Uint8Array(await pdf.save())],
        `documento-${doc.number}.pdf`,
        { type: "application/pdf" },
      ),
    );
  }
  console.log(
    `${docs.length} documentos PDF ficticios escaneados y almacenados con cifrado.`,
  );
}
main()
  .catch(() => {
    console.error(
      "No fue posible preparar archivos de ejemplo. Revise S3 y ClamAV.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
