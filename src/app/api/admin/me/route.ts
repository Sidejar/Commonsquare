import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Am I an admin?" for client pages. ADMIN_EMAILS is server-only, so the
// browser can't evaluate isAdminEmail() itself.
export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ admin: false, error: auth.message }, { status: auth.status });
  }
  return NextResponse.json({ admin: true });
}
