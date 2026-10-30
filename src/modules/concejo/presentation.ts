import type { Resource } from "@/lib/permissions";
export const labels: Record<Resource, string> = {
  documentos: "Documentos municipales",
  calendario: "Calendario del Concejo",
  sesiones: "Sesiones y tablas",
  presupuesto: "Información presupuestaria",
  acuerdos: "Seguimiento de acuerdos",
  solicitudes: "Solicitudes de información",
  archivo: "Archivo de sesiones",
  notificaciones: "Notificaciones",
  admin: "Administración",
  auditoria: "Registro de auditoría",
};
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "datetime-local"
    | "number"
    | "email"
    | "select";
  options?: string[];
  choices?: { value: string; label: string }[];
  required?: boolean;
};
export const forms: Partial<Record<Resource, Field[]>> = {
  documentos: [
    { name: "title", label: "Título" },
    {
      name: "type",
      label: "Tipo",
      type: "select",
      options: [
        "ORDENANZA",
        "DECRETO",
        "REGLAMENTO",
        "CONVENIO",
        "RESOLUCION",
        "OTRO",
      ],
    },
    { name: "number", label: "Número" },
    { name: "year", label: "Año", type: "number" },
    { name: "subject", label: "Materia" },
    { name: "unit", label: "Unidad emisora" },
    {
      name: "classification",
      label: "Clasificación",
      type: "select",
      options: ["INTERNO", "PUBLICO", "RESERVADO"],
    },
    {
      name: "publicationDate",
      label: "Fecha de publicación",
      type: "datetime-local",
    },
  ],
  calendario: [
    { name: "title", label: "Título" },
    {
      name: "type",
      label: "Tipo de evento",
      type: "select",
      options: [
        "SESION_ORDINARIA",
        "SESION_EXTRAORDINARIA",
        "COMISION",
        "AUDIENCIA",
        "REUNION",
        "OTRO",
      ],
    },
    { name: "start", label: "Inicio", type: "datetime-local" },
    { name: "end", label: "Término", type: "datetime-local" },
    { name: "location", label: "Lugar o videoconferencia" },
  ],
  solicitudes: [
    { name: "subject", label: "Asunto" },
    { name: "recipient", label: "Destinatario" },
    {
      name: "description",
      label: "Información que solicita",
      type: "textarea",
    },
    { name: "basis", label: "Fundamento", type: "textarea" },
    {
      name: "priority",
      label: "Prioridad",
      type: "select",
      options: ["NORMAL", "ALTA", "URGENTE"],
    },
  ],
  acuerdos: [
    { name: "number", label: "Número", type: "number" },
    { name: "year", label: "Año", type: "number" },
    { name: "councilSessionId", label: "Sesión de origen" },
    { name: "text", label: "Texto del acuerdo", type: "textarea" },
    { name: "subject", label: "Materia" },
    { name: "responsible", label: "Unidad responsable" },
    { name: "deadline", label: "Plazo", type: "datetime-local" },
    {
      name: "priority",
      label: "Prioridad",
      type: "select",
      options: ["NORMAL", "ALTA", "URGENTE"],
    },
  ],
  sesiones: [
    { name: "eventId", label: "Evento del calendario" },
    { name: "periodId", label: "Período del Concejo" },
    { name: "number", label: "Número", type: "number" },
    {
      name: "type",
      label: "Tipo",
      type: "select",
      options: ["ORDINARIA", "EXTRAORDINARIA"],
    },
  ],
  notificaciones: [
    { name: "title", label: "Título del anuncio" },
    { name: "body", label: "Mensaje", type: "textarea" },
    {
      name: "priority",
      label: "Prioridad",
      type: "select",
      options: ["NORMAL", "ALTA", "URGENTE"],
    },
    { name: "expiresAt", label: "Vigencia hasta", type: "datetime-local" },
  ],
  admin: [
    { name: "name", label: "Nombre completo" },
    { name: "email", label: "Correo institucional", type: "email" },
    {
      name: "roleId",
      label: "Rol",
      type: "select",
      options: [
        "CONCEJAL",
        "ALCALDE",
        "SECRETARIO_MUNICIPAL",
        "FUNCIONARIO_FINANZAS",
        "FUNCIONARIO_JURIDICO",
        "FUNCIONARIO_RESPUESTAS",
        "AUDITOR",
        "SUPERADMIN_TI",
      ],
    },
  ],
};
