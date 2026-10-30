import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validate } from "@prisma/internals";
it("Prisma valida relaciones, restricciones y tipos del esquema completo con su motor WASM oficial", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  expect(() =>
    validate({ schemas: [["prisma/schema.prisma", schema]] }),
  ).not.toThrow();
});
