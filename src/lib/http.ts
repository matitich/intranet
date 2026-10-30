import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Forbidden } from "./permissions";
import { env } from "./env";
export function csrf(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(env().APP_URL).origin)
    throw new Forbidden();
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite))
    throw new Forbidden();
}
export function failure(error: unknown) {
  if (error instanceof Forbidden)
    return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Revise los datos ingresados." },
      { status: 400 },
    );
  if (error instanceof Error && error.message === "UNAUTHENTICATED")
    return NextResponse.json({ error: "Inicie sesión." }, { status: 401 });
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_failed",
      kind: error instanceof Error ? error.name : "unknown",
    }),
  );
  return NextResponse.json(
    { error: "No fue posible completar la operación." },
    { status: 400 },
  );
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(
    JSON.parse(
      JSON.stringify(data, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ),
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
