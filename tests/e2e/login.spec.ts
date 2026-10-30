import { test, expect } from "@playwright/test";
test("acceso institucional en español, teclado y recuperación genérica", async ({
  page,
}) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir al contenido principal" }),
  ).toBeFocused();
  await page.screenshot({ path: "/tmp/intranet-login.png", fullPage: true });
  await expect(
    page.getByRole("heading", { name: "Bienvenido a su Concejo" }),
  ).toBeVisible();
  await expect(page.getByLabel("Correo institucional")).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "¿Olvidó su contraseña?" }).click();
  await expect(
    page.getByRole("heading", { name: "Recuperar acceso" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al inicio de sesión" })
    .click();
  await page.getByRole("button", { name: "Usar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Aumentar tamaño de letra" }).click();
  await expect(page.locator("html")).toHaveCSS("font-size", "19px");
});
test("mutación desde un origen ajeno se rechaza antes de autenticar", async ({
  request,
}) => {
  const r = await request.post("/api/auth/login", {
    headers: { origin: "https://ajeno.example.invalid" },
    data: { email: "x@example.invalid", password: "irrelevante" },
  });
  expect(r.status()).toBe(403);
});
