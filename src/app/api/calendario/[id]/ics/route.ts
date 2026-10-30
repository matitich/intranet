import { requireUser } from "@/modules/auth/service";
import { authorize } from "@/lib/permissions";
import { db } from "@/lib/db";
import { failure } from "@/lib/http";
function escape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    authorize(user, "calendario", "descargar");
    const e = await db.calendarEvent.findUniqueOrThrow({
      where: { id: (await params).id },
    });
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Villa del Roble//Concejo//ES",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${e.id}@villa-roble.example.invalid`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escape(e.title)}`,
      `LOCATION:${escape(e.location)}`,
      `STATUS:${e.status === "SUSPENDIDA" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    return new Response(text, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="evento.ics"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
