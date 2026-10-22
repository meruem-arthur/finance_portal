import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncFromDues } from "@/lib/dues-sync";
import { timingSafeEqualStrings } from "@/lib/signing";

// GET /api/cron/sync-dues - scheduled catch-up sync (vercel.json, daily).
// Vercel sends "Authorization: Bearer $CRON_SECRET". Closed while CRON_SECRET is unset.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = env.cronSecret;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqualStrings(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await syncFromDues()) });
  } catch (err) {
    console.error("cron sync failed", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
}
