import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { NoSemester } from "@/components/no-semester";
import { resyncEverything, syncNow, verifyDrift } from "@/lib/actions/sync";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getSyncStatus } from "@/lib/dues-sync";
import { formatGHS } from "@/lib/money";
import { getCurrentSemester, listSemesters, semesterTotals } from "@/lib/queries";
import { semesterLabel, windowEndExclusive } from "@/lib/semesters";

export const dynamic = "force-dynamic";

export default async function DuesPage() {
  const { role } = await requireAccess();
  const [{ current }, semesters, sync] = await Promise.all([getCurrentSemester(), listSemesters(), getSyncStatus()]);

  const unassigned = await prisma.duesPayment.aggregate({
    where: {
      status: "SUCCESS",
      NOT: { OR: semesters.map((s) => ({ paidAt: { gte: s.startDate, lt: windowEndExclusive(s.endDate) } })) },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const syncPanel = (
    <Card className="mb-6">
      <h2 className="mb-1 text-lg font-semibold">Connection to the dues portal</h2>
      <p className="mb-3 text-sm text-paper/60">
        Payments arrive the moment they are confirmed. Syncing re-checks everything and picks up corrections such as refunds.{" "}
        {sync.lastSyncAt ? `Last checked ${sync.lastSyncAt.toUTCString()}.` : "Not synced yet."}
        {sync.lastError ? ` Last problem: ${sync.lastError}.` : ""}
      </p>
      <div className="flex flex-wrap gap-3">
        <ActionForm action={syncNow}><SubmitButton pendingText="Syncing...">Sync now</SubmitButton></ActionForm>
        <ActionForm action={verifyDrift}><SubmitButton className="btn-ghost" pendingText="Comparing...">Compare totals</SubmitButton></ActionForm>
        {role === "SUPER_ADMIN" && (
          <ActionForm action={resyncEverything}>
            <SubmitButton className="btn-ghost" pendingText="Re-syncing..." confirm="Re-fetch the whole payment history from the dues portal? It is safe, but can take a while.">Re-sync everything</SubmitButton>
          </ActionForm>
        )}
      </div>
    </Card>
  );

  if (!current) {
    return (
      <>
        <PageHeader title="Dues income" />
        {syncPanel}
        <NoSemester isSuperAdmin={role === "SUPER_ADMIN"} />
      </>
    );
  }

  const [totals, payments, changes] = await Promise.all([
    semesterTotals(current),
    prisma.duesPayment.findMany({
      where: { status: "SUCCESS", paidAt: { gte: current.startDate, lt: windowEndExclusive(current.endDate) } },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
    prisma.duesPaymentChange.findMany({ orderBy: { at: "desc" }, take: 15 }),
  ]);

  return (
    <>
      <PageHeader title="Dues income" subtitle={`${semesterLabel(current)} · a payment belongs to the semester its paid date falls in`} />
      {syncPanel}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Collected" value={totals.duesIncome} hint={`${totals.duesCount} payments`} />
        <Stat label="Freshers" value={totals.duesByType.FRESHER.total} hint={`${totals.duesByType.FRESHER.count} payments`} />
        <Stat label="Continuing" value={totals.duesByType.CONTINUING.total} hint={`${totals.duesByType.CONTINUING.count} payments`} />
      </div>

      {unassigned._count._all > 0 && (
        <p className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          {unassigned._count._all} payment{unassigned._count._all === 1 ? "" : "s"} totalling {formatGHS(unassigned._sum.amount ?? 0)} fall outside every semester&apos;s dates, so they are not in any semester total. A super admin can fix the dates under Semesters.
        </p>
      )}

      <Card className="mt-6 overflow-x-auto p-2">
        <h2 className="px-3 pb-1 pt-2 text-lg font-semibold">Latest payments</h2>
        {payments.length === 0 ? (
          <Empty>No dues payments in this semester yet.</Empty>
        ) : (
          <table className="w-full min-w-[480px]">
            <thead><tr><th className="th">Paid</th><th className="th">Type</th><th className="th">Reference</th><th className="th text-right">Amount</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-gold/10">
                  <td className="td figure whitespace-nowrap">{p.paidAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="td">{p.paymentType === "FRESHER" ? "Fresher" : "Continuing"}</td>
                  <td className="td figure text-paper/50">…{p.id.slice(-6)}</td>
                  <td className="td figure text-right text-good">+{formatGHS(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-3 pb-2 text-xs text-paper/50">Student names are never sent to the finance portal - only the amounts.</p>
      </Card>

      <Card className="mt-6 overflow-x-auto p-2">
        <h2 className="px-3 pb-1 pt-2 text-lg font-semibold">Corrections from the dues portal</h2>
        {changes.length === 0 ? (
          <Empty>No payments have been corrected or refunded.</Empty>
        ) : (
          <table className="w-full min-w-[480px]">
            <thead><tr><th className="th">When</th><th className="th">Reference</th><th className="th">Change</th><th className="th text-right">Amount</th></tr></thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id} className="border-t border-gold/10">
                  <td className="td figure whitespace-nowrap">{c.at.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="td figure text-paper/50">…{c.paymentId.slice(-6)}</td>
                  <td className="td">{c.fromStatus} → {c.toStatus}</td>
                  <td className="td figure text-right">{formatGHS(c.toAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
