import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";
import { verifyPush } from "@/lib/signing";
import { upsertDuesPayment, WrongDepartmentError } from "@/lib/dues-sync";

// POST /api/webhooks/dues - real-time payment push from the dues portal.
// Signed with the shared DUES_PUSH_TOKEN. Best-effort on the dues side: if
// this ever fails, the scheduled/manual sync picks the payment up later.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const timestamp = Number(req.headers.get("x-dues-timestamp"));
    const signature = req.headers.get("x-dues-signature") ?? "";
    if (!verifyPush(body, timestamp, signature, env.duesPushToken)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const parsed = JSON.parse(body) as { event?: string; payment?: unknown };
    if (parsed.event !== "payment.updated") return NextResponse.json({ ok: true, ignored: true }, { status: 202 });

    const result = await upsertDuesPayment(parsed.payment);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof WrongDepartmentError) return NextResponse.json({ error: "Wrong department" }, { status: 422 });
    if (err instanceof ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    console.error("dues webhook failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
