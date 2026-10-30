import { requireUser } from "@/modules/auth/service";
import { importBudget } from "@/modules/presupuesto/import";
import { csrf, failure, json } from "@/lib/http";
export async function POST(request: Request) {
  try {
    csrf(request);
    const user = await requireUser();
    return json(await importBudget(user, await request.json()));
  } catch (e) {
    return failure(e);
  }
}
