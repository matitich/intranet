import type { RoleName, Prisma } from "@prisma/client";
export const resources = [
  "documentos",
  "calendario",
  "sesiones",
  "presupuesto",
  "acuerdos",
  "solicitudes",
  "archivo",
  "notificaciones",
  "admin",
  "auditoria",
] as const;
export type Resource = (typeof resources)[number];
export type Action =
  | "ver"
  | "crear"
  | "editar"
  | "eliminar"
  | "publicar"
  | "descargar"
  | "administrar";
export type Actor = { id: string; roleId: RoleName };
const read: Action[] = ["ver", "descargar"];
const manage: Action[] = [
  "ver",
  "crear",
  "editar",
  "eliminar",
  "publicar",
  "descargar",
];
export const matrix: Record<RoleName, Partial<Record<Resource, Action[]>>> = {
  SUPERADMIN_TI: {
    admin: ["ver", "administrar"],
    auditoria: read,
    notificaciones: read,
  },
  SECRETARIO_MUNICIPAL: {
    documentos: manage,
    calendario: manage,
    sesiones: manage,
    presupuesto: read,
    acuerdos: manage,
    solicitudes: ["ver", "editar", "descargar"],
    archivo: manage,
    notificaciones: manage,
  },
  ALCALDE: {
    documentos: read,
    calendario: read,
    sesiones: ["ver", "publicar", "descargar"],
    presupuesto: read,
    acuerdos: read,
    solicitudes: ["ver", "editar", "descargar"],
    archivo: read,
    notificaciones: read,
  },
  CONCEJAL: {
    documentos: read,
    calendario: read,
    sesiones: read,
    presupuesto: read,
    acuerdos: read,
    solicitudes: ["ver", "crear", "descargar"],
    archivo: read,
    notificaciones: read,
  },
  FUNCIONARIO_FINANZAS: {
    presupuesto: manage,
    documentos: read,
    acuerdos: read,
    notificaciones: read,
  },
  FUNCIONARIO_JURIDICO: { documentos: manage, notificaciones: read },
  FUNCIONARIO_RESPUESTAS: {
    solicitudes: ["ver", "editar", "descargar"],
    notificaciones: read,
  },
  AUDITOR: {
    auditoria: read,
    presupuesto: read,
    acuerdos: read,
    notificaciones: read,
  },
};
export function can(actor: Actor, resource: Resource, action: Action) {
  return matrix[actor.roleId][resource]?.includes(action) ?? false;
}
export class Forbidden extends Error {
  constructor() {
    super("No tiene permiso para esta operación");
  }
}
export function authorize(actor: Actor, resource: Resource, action: Action) {
  if (!can(actor, resource, action)) throw new Forbidden();
}
export function documentWhere(actor: Actor): Prisma.DocumentWhereInput {
  const base = { deletedAt: null };
  if (can(actor, "documentos", "ver"))
    return {
      ...base,
      OR: [
        { classification: { in: ["PUBLICO", "INTERNO"] } },
        { access: { some: { userId: actor.id } } },
      ],
    };
  return { ...base, access: { some: { userId: actor.id } } };
}
export function requestWhere(
  actor: Actor,
): Prisma.InformationRequestWhereInput {
  if (["ALCALDE", "SECRETARIO_MUNICIPAL"].includes(actor.roleId)) return {};
  if (actor.roleId === "CONCEJAL")
    return { OR: [{ authorId: actor.id }, { visibleToCouncil: true }] };
  if (actor.roleId === "FUNCIONARIO_RESPUESTAS")
    return { assigneeId: actor.id };
  return { id: "__DENIED__" };
}
export function canReadDocument(
  actor: Actor,
  doc: { classification: string; access: { userId: string }[] },
) {
  return (
    doc.access.some((a) => a.userId === actor.id) ||
    (doc.classification !== "RESERVADO" && can(actor, "documentos", "ver"))
  );
}
