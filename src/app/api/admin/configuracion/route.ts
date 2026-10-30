import { requireUser } from "@/modules/auth/service";
import { updateSettings } from "@/modules/admin/settings";
import { csrf, failure, json } from "@/lib/http";
export async function POST(request: Request) {
  try {
    csrf(request);
    return json(
      await updateSettings(await requireUser(), await request.json()),
    );
  } catch (e) {
    return failure(e);
  }
}
