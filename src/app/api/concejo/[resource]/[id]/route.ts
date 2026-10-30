import { requireUser } from "@/modules/auth/service";
import { detail, mutate, resourceSchema } from "@/modules/concejo/service";
import { csrf, failure, json } from "@/lib/http";
type Context = { params: Promise<{ resource: string; id: string }> };
export async function GET(_request: Request, ctx: Context) {
  try {
    const user = await requireUser();
    const p = await ctx.params;
    return json(await detail(resourceSchema.parse(p.resource), p.id, user));
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request, ctx: Context) {
  try {
    csrf(request);
    const user = await requireUser();
    const p = await ctx.params;
    return json(
      await mutate(
        resourceSchema.parse(p.resource),
        p.id,
        user,
        await request.json(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
