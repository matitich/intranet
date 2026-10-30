import { redirect } from "next/navigation";
import { currentUser } from "@/modules/auth/service";
export const dynamic = "force-dynamic";
export default async function Home() {
  redirect((await currentUser()) ? "/inicio" : "/login");
}
