import { describe, it, expect } from "vitest";
import {
  validRut,
  formatRut,
  businessDeadline,
  date,
  currency,
  requestTransitions,
} from "../src/lib/chile";
describe("Convenciones chilenas", () => {
  it("valida dígito verificador y formato", () => {
    expect(validRut("12.345.678-5")).toBe(true);
    expect(validRut("12.345.678-9")).toBe(false);
    expect(validRut("")).toBe(false);
    expect(validRut("abc")).toBe(false);
    expect(formatRut("123456785")).toBe("12.345.678-5");
  });
  it("usa CLP sin perder precisión para importes grandes", () =>
    expect(currency("123456789012345678")).toContain(
      "123.456.789.012.345.678",
    ));
  it("excluye fines de semana, feriados y día de recepción", () => {
    const due = businessDeadline(
      new Date("2026-09-17T14:00:00Z"),
      2,
      new Set(["2026-09-18"]),
    );
    expect(date(due)).toBe("22-09-2026");
  });
  it("conserva fechas civiles al cruzar horario de verano", () =>
    expect(
      date(businessDeadline(new Date("2026-09-04T14:00:00Z"), 1, new Set())),
    ).toBe("07-09-2026"));
  it("rechaza plazos inválidos", () =>
    expect(() => businessDeadline(new Date(), 0, new Set())).toThrow());
  it("no permite reabrir estados terminales silenciosamente", () => {
    expect(requestTransitions.CERRADA).toEqual([]);
    expect(requestTransitions.DESISTIDA).toEqual([]);
  });
});
