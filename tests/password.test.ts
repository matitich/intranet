import { it, expect } from "vitest";
import { strongPassword } from "../src/lib/password-policy";
it("rechaza contraseñas filtradas comunes y secuencias predecibles aunque tengan 12 caracteres", () => {
  expect(strongPassword("Password123!")).toBe(false);
  expect(strongPassword("Qwerty123456!")).toBe(false);
  expect(strongPassword("Contraseña1!")).toBe(false);
});
it("acepta una contraseña aleatoria larga", () =>
  expect(strongPassword("J9!vR7p2$Kq8#Nx4")).toBe(true));
