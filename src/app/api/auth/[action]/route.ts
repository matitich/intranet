import { z } from "zod";
import { csrf, failure, json } from "@/lib/http";
import {
  login,
  completeMfa,
  mfaSetup,
  logout,
  recover,
  activate,
  requireUser,
  changePassword,
} from "@/modules/auth/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    csrf(request);
    const { action } = await params;
    const body = await request.json();
    switch (action) {
      case "login": {
        const v = z
          .object({
            email: z
              .string()
              .email()
              .max(200)
              .transform((s) => s.toLowerCase()),
            password: z.string().min(1).max(128),
          })
          .parse(body);
        return json(await login(v.email, v.password));
      }
      case "mfa":
        return json(
          await completeMfa(
            z
              .object({ code: z.string().regex(/^[A-Za-z0-9_-]{6,32}$/) })
              .parse(body).code,
          ),
        );
      case "setup":
        return json(await mfaSetup());
      case "logout":
        await logout(false);
        return json({ ok: true });
      case "logout-all":
        await logout(true);
        return json({ ok: true });
      case "recover":
        await recover(
          z
            .object({
              email: z
                .string()
                .email()
                .transform((s) => s.toLowerCase()),
            })
            .parse(body).email,
        );
        return json({
          message: "Si la cuenta existe, recibirá las instrucciones.",
        });
      case "activate": {
        const v = z
          .object({
            token: z.string().min(20),
            password: z.string(),
            kind: z.enum(["invitacion", "recuperacion"]),
          })
          .parse(body);
        await activate(v.token, v.password, v.kind);
        return json({ ok: true });
      }
      case "password": {
        const user = await requireUser();
        await changePassword(
          user.id,
          z.object({ password: z.string() }).parse(body).password,
          z.object({ currentPassword: z.string().min(1).max(128) }).parse(body)
            .currentPassword,
        );
        return json({ ok: true });
      }
      default:
        return json({ error: "Operación no encontrada" }, 404);
    }
  } catch (e) {
    return failure(e);
  }
}
