import { requireUser } from "@/modules/auth/service";
import { upload, download } from "@/modules/documentos/storage";
import { csrf, failure, json } from "@/lib/http";
import { rateLimit } from "@/lib/redis";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, ctx: Context) {
  try {
    csrf(request);
    const user = await requireUser();
    await rateLimit(`upload:${user.id}`, 10, 60);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File))
      return json({ error: "Seleccione un archivo." }, 400);
    return json(await upload((await ctx.params).id, user, file), 201);
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request, ctx: Context) {
  try {
    const user = await requireUser();
    await rateLimit(`download:${user.id}`, 60, 60);
    const file = await download(
      (await ctx.params).id,
      new URL(request.url).searchParams.get("version") ?? undefined,
      user,
    );
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
