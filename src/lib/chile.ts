import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export const currency = (value: string | number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(typeof value === "string" ? BigInt(value) : value);
export const date = (value: Date | string) =>
  formatInTimeZone(value, "America/Santiago", "dd-MM-yyyy");
export const dateTime = (value: Date | string) =>
  formatInTimeZone(value, "America/Santiago", "dd-MM-yyyy HH:mm");
export function validRut(value: string) {
  const clean = value.replace(/[.\-\s]/g, "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  let sum = 0,
    m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const dv = 11 - (sum % 11);
  return (dv === 11 ? "0" : dv === 10 ? "K" : String(dv)) === clean.at(-1);
}
export function formatRut(value: string) {
  const clean = value.replace(/[.\-\s]/g, "").toUpperCase();
  return `${clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${clean.at(-1)}`;
}
export function businessDeadline(
  start: Date,
  days: number,
  holidays: Set<string>,
) {
  if (!Number.isInteger(days) || days < 1 || days > 365)
    throw new Error("Plazo inválido");
  // Avanzar fechas civiles de Santiago, evitando errores por cambios de horario de verano.
  const civil = formatInTimeZone(start, "America/Santiago", "yyyy-MM-dd");
  const cursor = new Date(`${civil}T12:00:00Z`);
  let remaining = days;
  while (remaining) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = cursor.toISOString().slice(0, 10);
    if (![0, 6].includes(cursor.getUTCDay()) && !holidays.has(key)) remaining--;
  }
  return fromZonedTime(
    `${cursor.toISOString().slice(0, 10)}T23:59:59`,
    "America/Santiago",
  );
}
export const requestTransitions: Record<string, string[]> = {
  ENVIADA: ["RECIBIDA", "DESISTIDA"],
  RECIBIDA: ["EN_PROCESO", "OBSERVADA", "DESISTIDA"],
  EN_PROCESO: ["RESPONDIDA", "OBSERVADA", "VENCIDA", "DESISTIDA"],
  OBSERVADA: ["EN_PROCESO", "DESISTIDA"],
  VENCIDA: ["EN_PROCESO", "RESPONDIDA"],
  RESPONDIDA: ["CERRADA", "EN_PROCESO"],
  CERRADA: [],
  DESISTIDA: [],
};
