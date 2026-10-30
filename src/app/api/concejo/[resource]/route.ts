import { requireUser } from "@/modules/auth/service";
import { list, create, resourceSchema } from "@/modules/concejo/service";
import { csrf, failure, json } from "@/lib/http";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, ctx: Context) {
  try {
    const user = await requireUser();
    const resource = resourceSchema.parse((await ctx.params).resource);
    return json(
      await list(
        resource,
        user,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, ctx: Context) {
  try {
    csrf(request);
    const user = await requireUser();
    const resource = resourceSchema.parse((await ctx.params).resource);
    return json(await create(resource, user, await request.json()), 201);
  } catch (e) {
    return failure(e);
  }
}
