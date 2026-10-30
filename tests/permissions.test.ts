import { describe, it, expect } from "vitest";
import {
  can,
  canReadDocument,
  requestWhere,
  matrix,
  authorize,
} from "../src/lib/permissions";
import type { RoleName } from "@prisma/client";
const actor = (roleId: RoleName, id = "alice") => ({ id, roleId });
describe("Autorización con denegación por defecto", () => {
  for (const role of Object.keys(matrix) as RoleName[]) {
    it(`${role}: reservado requiere ACL explícita`, () => {
      expect(
        canReadDocument(actor(role), {
          classification: "RESERVADO",
          access: [],
        }),
      ).toBe(false);
      expect(
        canReadDocument(actor(role), {
          classification: "RESERVADO",
          access: [{ userId: "alice" }],
        }),
      ).toBe(true);
      expect(
        canReadDocument(actor(role, "bob"), {
          classification: "RESERVADO",
          access: [{ userId: "alice" }],
        }),
      ).toBe(false);
    });
  }
  it("TI no lee documentos institucionales por su rol", () =>
    expect(can(actor("SUPERADMIN_TI"), "documentos", "ver")).toBe(false));
  it("concejal no modifica documentos ni administra", () => {
    expect(() =>
      authorize(actor("CONCEJAL"), "documentos", "editar"),
    ).toThrow();
    expect(can(actor("CONCEJAL"), "admin", "administrar")).toBe(false);
  });
  it("auditor no modifica presupuesto", () =>
    expect(can(actor("AUDITOR"), "presupuesto", "editar")).toBe(false));
  it("solicitudes de concejal se filtran por autor o visibilidad explícita", () =>
    expect(requestWhere(actor("CONCEJAL"))).toEqual({
      OR: [{ authorId: "alice" }, { visibleToCouncil: true }],
    }));
  it("respondedor solo ve asignadas", () =>
    expect(requestWhere(actor("FUNCIONARIO_RESPUESTAS"))).toEqual({
      assigneeId: "alice",
    }));
  it("finanzas no accede a solicitudes", () =>
    expect(requestWhere(actor("FUNCIONARIO_FINANZAS"))).toEqual({
      id: "__DENIED__",
    }));
});
