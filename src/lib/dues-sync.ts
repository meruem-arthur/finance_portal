import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { parseCedis } from "@/lib/money";

/**
 * Keeps a local copy of the dues portal's payments.
 *
 * Two feeds write here and are safe together because every write is keyed by
 * the dues payment id and ignores anything older than what is already stored:
 *   - the real-time push (POST /api/webhooks/dues), and
 *   - the pull sync (cron + "Sync now"), which asks the dues portal for
 *     "everything that changed since my cursor" and so picks up corrections
 *     (a payment later refunded) and anything a push missed.
 */
export const duesPaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "invalid amount"),
  currency: z.string().default("GHS"),
  paymentType: z.enum(["FRESHER", "CONTINUING"]),
  status: z.enum(["SUCCESS", "REFUNDED"]),
  paidAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  departmentCode: z.string().min(1),
  academicSession: z.object({ id: z.string(), name: z.string() }),
});

export class WrongDepartmentError extends Error {
  constructor() {
    super("Payment belongs to a different department");
  }
}

export type UpsertResult = "created" | "updated" | "unchanged" | "stale";

export async function upsertDuesPayment(raw: unknown, retried = false): Promise<UpsertResult> {
  const p = duesPaymentSchema.parse(raw);
  if (p.departmentCode.trim().toLowerCase() !== env.departmentCode.trim().toLowerCase()) throw new WrongDepartmentError();

  const amount = parseCedis(p.amount);
  if (amount === null || amount <= 0) throw new Error("Invalid payment amount");

  const duesUpdatedAt = new Date(p.updatedAt);
  const paidAt = new Date(p.paidAt ?? p.updatedAt);
  const data = {
    amount,
    currency: p.currency,
    paymentType: p.paymentType,
    status: p.status,
    paidAt,
    duesUpdatedAt,
    academicSessionId: p.academicSession.id,
    academicSessionName: p.academicSession.name,
  };

  const existing = await prisma.duesPayment.findUnique({ where: { id: p.id } });
  if (!existing) {
    try {
      await prisma.duesPayment.create({ data: { id: p.id, ...data } });
      return "created";
    } catch (err) {
      // The push and the pull sync can race to create the same row; the loser just updates.
      if ((err as { code?: string })?.code === "P2002" && !retried) return upsertDuesPayment(raw, true);
      throw err;
    }
  }

  if (existing.duesUpdatedAt.getTime() > duesUpdatedAt.getTime()) return "stale";

  const moneyChanged = existing.status !== data.status || existing.amount !== data.amount;
  const anyChange = moneyChanged || existing.paidAt.getTime() !== paidAt.getTime() || existing.duesUpdatedAt.getTime() !== duesUpdatedAt.getTime();
  if (!anyChange) return "unchanged";

  const ops = [prisma.duesPayment.update({ where: { id: p.id }, data: { ...data, syncedAt: new Date() } })];
  if (moneyChanged) {
    ops.push(
      prisma.duesPaymentChange.create({
        data: { paymentId: p.id, fromStatus: existing.status, toStatus: data.status, fromAmount: existing.amount, toAmount: data.amount },
      }) as never
    );
  }
  await prisma.$transaction(ops);
  return moneyChanged ? "updated" : "unchanged";
}

// ---- pull sync --------------------------------------------------------

const CURSOR_KEY = "dues.cursor";
const LAST_OK_KEY = "dues.lastSyncAt";
const LAST_ERROR_KEY = "dues.lastError";

async function getState(key: string): Promise<string | null> {
  return (await prisma.syncState.findUnique({ where: { key } }))?.value ?? null;
}
async function setState(key: string, value: string) {
  await prisma.syncState.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export type SyncStats = { fetched: number; created: number; updated: number; pages: number };

export async function syncFromDues(opts: { maxPages?: number; full?: boolean } = {}): Promise<SyncStats> {
  const maxPages = opts.maxPages ?? 20;
  const stats: SyncStats = { fetched: 0, created: 0, updated: 0, pages: 0 };
  let cursor = opts.full ? null : await getState(CURSOR_KEY);

  try {
    for (let i = 0; i < maxPages; i++) {
      const url = new URL(`${env.duesPortalUrl}/api/finance/payments`);
      url.searchParams.set("limit", "500");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url, {
        headers: { authorization: `Bearer ${env.duesApiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Dues portal answered ${res.status}`);
      const body = (await res.json()) as { payments: unknown[]; nextCursor: string | null; hasMore: boolean };

      stats.pages += 1;
      for (const payment of body.payments) {
        stats.fetched += 1;
        const result = await upsertDuesPayment(payment);
        if (result === "created") stats.created += 1;
        if (result === "updated") stats.updated += 1;
      }
      if (body.nextCursor) {
        cursor = body.nextCursor;
        await setState(CURSOR_KEY, cursor);
      }
      if (!body.hasMore) break;
    }
    await setState(LAST_OK_KEY, new Date().toISOString());
    await setState(LAST_ERROR_KEY, "");
    return stats;
  } catch (err) {
    await setState(LAST_ERROR_KEY, err instanceof Error ? err.message : "Sync failed").catch(() => {});
    throw err;
  }
}

export async function getSyncStatus() {
  const [lastOk, lastError] = await Promise.all([getState(LAST_OK_KEY), getState(LAST_ERROR_KEY)]);
  return { lastSyncAt: lastOk ? new Date(lastOk) : null, lastError: lastError || null };
}

/** Compares our copy with the dues portal's own totals. */
export async function checkDrift() {
  const res = await fetch(`${env.duesPortalUrl}/api/finance/summary`, {
    headers: { authorization: `Bearer ${env.duesApiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Dues portal answered ${res.status}`);
  const remote = (await res.json()) as { success: { count: number; total: string }; refunded: { count: number; total: string } };

  const [local, localRefunded] = await Promise.all([
    prisma.duesPayment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.duesPayment.aggregate({ where: { status: "REFUNDED" }, _count: { _all: true } }),
  ]);
  const remoteTotal = parseCedis(remote.success.total) ?? 0;
  const localTotal = local._sum.amount ?? 0;
  return {
    remote: { count: remote.success.count, total: remoteTotal },
    local: { count: local._count._all, total: localTotal },
    inSync: remote.success.count === local._count._all && remoteTotal === localTotal && remote.refunded.count === localRefunded._count._all,
    difference: remoteTotal - localTotal,
  };
}
