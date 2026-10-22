import Link from "next/link";
import { Bar, Banner, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { NoSemester } from "@/components/no-semester";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getSyncStatus } from "@/lib/dues-sync";
import { checkPool, spendState } from "@/lib/budget";
import { formatGHS } from "@/lib/money";
import { getCurrentSemester, programsWithActuals, semesterTotals } from "@/lib/queries";
import { semesterLabel, toDateInput } from "@/lib/semesters";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { role } = await requireAccess();
  const { current } = await getCurrentSemester();
  if (!current) return <NoSemester isSuperAdmin={role === "SUPER_ADMIN"} />;

  const [totals, programs, recent, sync] = await Promise.all([
    semesterTotals(current),
    programsWithActuals(current.id),
    prisma.transaction.findMany({
      where: { date: { gte: current.startDate, lte: current.endDate } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    getSyncStatus(),
  ]);

  const pool = checkPool(current.programsPool, programs.map((p) => ({ status: p.status, upfrontCost: p.upfrontCost })));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${semesterLabel(current)} · ${toDateInput(current.startDate)} to ${toDateInput(current.endDate)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Dues collected" value={totals.duesIncome} hint={`${totals.duesCount} payments, live from the dues portal`} />
        <Stat label="Other income" value={totals.otherIncome} />
        <Stat label="Expenditure" value={totals.expenditure} />
        <Stat label="Balance" value={totals.balance} tone={totals.balance < 0 ? "bad" : "good"} hint="Income minus expenditure this semester" />
      </div>

      {totals.duesRefundedCount > 0 && (
        <p className="mt-3 text-xs text-paper/60">
          {totals.duesRefundedCount} refunded dues payment{totals.duesRefundedCount === 1 ? "" : "s"} ({formatGHS(totals.duesRefunded)}) are not counted as income.
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Programs pool</h2>
            <Link href="/budget" className="text-sm text-goldBright underline">Open budgets</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-paper/50">Pool</p><p className="figure text-lg">{formatGHS(pool.pool)}</p></div>
            <div><p className="text-paper/50">Planned</p><p className="figure text-lg">{formatGHS(pool.planned)}</p></div>
            <div><p className="text-paper/50">Left</p><p className={`figure text-lg ${pool.remaining < 0 ? "text-bad" : "text-good"}`}>{formatGHS(pool.remaining)}</p></div>
          </div>
          <div className="mt-4 space-y-3">
            {pool.state === "OVER" && <Banner tone="bad">Programs add up to {formatGHS(pool.planned)}, which is {formatGHS(pool.overBy)} over the pool. <Link href="/budget" className="underline">See where to cut.</Link></Banner>}
            {pool.state === "NO_POOL" && <Banner tone="warn">Programs are planned but no pool has been set for this semester.</Banner>}
            {pool.pool > totals.income && (
              <Banner tone="warn">
                The pool is {formatGHS(pool.pool - totals.income)} more than the income received so far. More dues may still come in, but don&apos;t commit money you haven&apos;t received.
              </Banner>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Spending by program</h2>
          {programs.length === 0 ? (
            <Empty>No programs yet for this semester.</Empty>
          ) : (
            <ul className="space-y-4">
              {programs.map((p) => (
                <li key={p.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <Link href={`/budget/${p.id}`} className="font-medium underline-offset-2 hover:underline">{p.name}</Link>
                    <span className="figure text-paper/70">{formatGHS(p.spent)} / {formatGHS(p.upfrontCost)}</span>
                  </div>
                  <Bar spent={p.spent} budget={p.upfrontCost} />
                  {spendState(p.spent, p.upfrontCost) === "OVER" && <p className="mt-1 text-xs text-bad">Spent more than budgeted.</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent entries</h2>
          <Link href="/ledger" className="text-sm text-goldBright underline">Open ledger</Link>
        </div>
        {recent.length === 0 ? (
          <Empty>Nothing logged yet this semester.</Empty>
        ) : (
          <table className="w-full">
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className={t.voidedAt ? "text-paper/40 line-through" : ""}>
                  <td className="td figure whitespace-nowrap">{toDateInput(t.date)}</td>
                  <td className="td">{t.description}</td>
                  <td className={`td figure text-right ${t.type === "INCOME" ? "text-good" : "text-bad"}`}>
                    {t.type === "INCOME" ? "+" : "-"}{formatGHS(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper/50">
        Dues data {sync.lastSyncAt ? `last checked ${sync.lastSyncAt.toUTCString()}` : "has not been synced yet"}
        {sync.lastError ? ` · last problem: ${sync.lastError}` : ""}. New payments arrive instantly; <Link href="/dues" className="underline">Dues income</Link> has a manual sync.
      </p>
    </>
  );
}
