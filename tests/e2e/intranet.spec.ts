import "dotenv/config";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { generate } from "otplib";
import { PDFDocument } from "pdf-lib";
const origin = "http://localhost:3000";
let createdRequestId = "";
async function login(api: APIRequestContext, account: string) {
  const result = await api.post("/api/auth/login", {
    headers: { origin },
    data: {
      email: `${account}@villa-roble.example.invalid`,
      password: process.env.DEMO_PASSWORD,
    },
  });
  expect(result.status()).toBe(200);
  const before = await api.get("/api/concejo/solicitudes");
  expect(before.status()).toBe(401);
  const otp = await generate({ secret: process.env.DEMO_TOTP_SECRET! });
  const verified = await api.post("/api/auth/mfa", {
    headers: { origin },
    data: { code: otp },
  });
  expect(verified.status()).toBe(200);
  const replay = await api.post("/api/auth/mfa", {
    headers: { origin },
    data: { code: otp },
  });
  expect(replay.status()).toBe(400);
}
test("concejal: MFA, navegación, solicitudes propias y nota privada", async ({
  page,
}) => {
  await login(page.request, "concejal1");
  await page.goto("/inicio");
  await expect(
    page.getByRole("heading", { name: "Bienvenido, Concejal de ejemplo 1" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Documentos municipales", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Documentos municipales", exact: true }),
  ).toBeVisible();
  expect(
    (await page.request.get("/api/concejo/solicitudes/solicitud-2")).status(),
  ).toBe(403);
  expect(
    (await page.request.get("/api/concejo/solicitudes/solicitud-1")).status(),
  ).toBe(200);
  expect((await page.request.get("/api/concejo/admin")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/concejo/documentos", {
        headers: { origin },
        data: { title: "Intento sin permisos" },
      })
    ).status(),
  ).toBe(403);
  const made = await page.request.post("/api/concejo/solicitudes", {
    headers: { origin },
    data: {
      subject: "Consulta de prueba e2e",
      description:
        "Solicito los antecedentes ficticios del programa de mejoras comunales.",
      basis:
        "Seguimiento institucional con datos ficticios para prueba automatizada.",
      recipient: "Alcaldía",
      priority: "NORMAL",
    },
  });
  expect(made.status()).toBe(201);
  const row = await made.json();
  createdRequestId = row.id;
  expect(
    (await page.request.get(`/api/concejo/solicitudes/${row.id}`)).status(),
  ).toBe(200);
  const note = await page.request.patch("/api/concejo/sesiones/punto-1-1", {
    headers: { origin },
    data: {
      action: "nota",
      data: { text: "Nota privada de prueba del concejal 1" },
    },
  });
  expect(note.status()).toBe(200);
  await page.goto("/sesiones/sesion-1");
  await expect(
    page.getByText("Nota privada de prueba del concejal 1", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inicio");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("secretario: carga S3, antivirus, versionado y marca de agua reservada", async ({
  request,
}) => {
  await login(request, "secretario");
  if (createdRequestId) {
    expect(
      (
        await request.patch(`/api/concejo/solicitudes/${createdRequestId}`, {
          headers: { origin },
          data: { action: "asignar", data: { assigneeId: "respuestas" } },
        })
      ).status(),
    ).toBe(200);
  }
  const privateSession = await (
    await request.get("/api/concejo/sesiones/sesion-1")
  ).json();
  expect(
    privateSession.items.some((i: { notes: { text: string }[] }) =>
      i.notes.some((n) => n.text === "Nota privada de prueba del concejal 1"),
    ),
  ).toBe(false);
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  const response = await request.post("/api/documentos/documento-12/archivo", {
    headers: { origin },
    multipart: {
      file: {
        name: "../antecedente.pdf",
        mimeType: "application/pdf",
        buffer: bytes,
      },
    },
  });
  expect(response.status()).toBe(201);
  const downloaded = await request.get("/api/documentos/documento-12/archivo");
  expect(downloaded.status()).toBe(200);
  expect(downloaded.headers()["content-disposition"]).toContain("attachment");
  expect((await downloaded.body()).equals(bytes)).toBe(false);
  expect((await PDFDocument.load(await downloaded.body())).getPageCount()).toBe(
    1,
  );
});
for (const [account, allowed, denied] of [
  ["admin", "admin", "documentos/documento-12"],
  ["alcalde", "sesiones", "admin"],
  ["finanzas", "presupuesto", "solicitudes"],
  ["juridico", "documentos", "auditoria"],
  ["respuestas", "solicitudes", "presupuesto"],
  ["auditor", "auditoria", "documentos/documento-12"],
] as const) {
  test(`${account}: permiso de lectura e intento de acceso prohibido`, async ({
    request,
  }) => {
    await login(request, account);
    expect((await request.get(`/api/concejo/${allowed}`)).status()).toBe(200);
    expect((await request.get(`/api/concejo/${denied}`)).status()).toBe(403);
    if (account === "finanzas") {
      const payload = {
        year: 2026,
        lines: [
          {
            kind: "GASTO",
            subtitle: "22",
            item: "01",
            assignment: "099",
            area: "Demostración",
            description: "Partida de prueba exacta",
            initial: "100000000001",
            current: "100000000001",
          },
        ],
      };
      const preview = await request.post("/api/presupuesto/importar", {
        headers: { origin },
        data: payload,
      });
      expect(preview.status()).toBe(200);
      expect((await preview.json()).total).toBe("100000000001");
      expect(
        (
          await request.post("/api/presupuesto/importar", {
            headers: { origin },
            data: { ...payload, confirm: true },
          })
        ).status(),
      ).toBe(200);
    }
    if (account === "respuestas" && createdRequestId) {
      for (const status of ["RECIBIDA", "EN_PROCESO"])
        expect(
          (
            await request.patch(
              `/api/concejo/solicitudes/${createdRequestId}`,
              {
                headers: { origin },
                data: { action: "estado", data: { status } },
              },
            )
          ).status(),
        ).toBe(200);
      expect(
        (
          await request.patch(`/api/concejo/solicitudes/${createdRequestId}`, {
            headers: { origin },
            data: {
              action: "mensaje",
              data: {
                body: "Respuesta oficial ficticia con antecedentes de prueba.",
                official: true,
              },
            },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await request.patch(`/api/concejo/solicitudes/${createdRequestId}`, {
            headers: { origin },
            data: { action: "estado", data: { status: "RESPONDIDA" } },
          })
        ).status(),
      ).toBe(200);
    }
  });
}

test("login completo desde el formulario y segundo factor", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Correo institucional")
    .fill("concejal2@villa-roble.example.invalid");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar de forma segura" }).click();
  await expect(
    page.getByRole("heading", { name: "Verifique su identidad" }),
  ).toBeVisible();
  await page
    .getByLabel("Código de verificación")
    .fill(await generate({ secret: process.env.DEMO_TOTP_SECRET! }));
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenido, Concejal de ejemplo 2" }),
  ).toBeVisible();
});
