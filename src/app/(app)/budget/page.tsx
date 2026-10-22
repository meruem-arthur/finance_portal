import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Banner, Bar, Card, Empty, PageHeader } from "@/components/ui";
import { NoSemester } from "@/components/no-semester";
import { createProgram } from "@/lib/actions/budget";
import { setPool } from "@/lib/actions/semesters";
import { requireAccess } from "@/lib/authz";
import { biggestCostLines, checkPool, suggestCuts } from "@/lib/budget";
import { formatGHS, pesewasToInput } from "@/lib/money";
import { getCurrentSemester, programsWithActuals, semesterTotals } from "@/lib/queries";
import { semesterLabel } from "@/lib/semesters";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const { role } = await requireAccess();
  const { current } = await getCurrentSemester();
  if (!current) return <NoSemester isSuperAdmin={role === "SUPER_ADMIN"} />;

  const [programs, totals] = await Promise.all([programsWithActuals(current.id), semesterTotals(current)]);
  const inputs = programs.map((p) => ({ id: p.id, name: p.name, priority: p.priority, status: p.status, upfrontCost: p.upfrontCost }));
  const pool = checkPool(current.programsPool, inputs);

  // Approved budgets are locked, so suggestions start with the ones that can still change.
  const cuts = suggestCuts(inputs.filter((p) => p.status !== "APPROVED"), pool.overBy);
  const lines = biggestCostLines(programs.map((p) => ({ id: p.id, name: p.name, priority: p.priority, lines: p.lineInputs })));

  return (
    <>
      <PageHeader title="Budgets" subtitle={`${semesterLabel(current)} · what each program ties up is its upfront cost; expected sales never reduce it.`} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Programs pool</h2>
            <p className="text-sm text-paper/60">The amount set aside for programs and activities this semester.</p>
          </div>
          {role === "SUPER_ADMIN" ? (
            <ActionForm action={setPool} className="flex items-end gap-2">
              <input type="hidden" name="semesterId" value={current.id} />
              <div>
                <label className="label" htmlFor="programsPool">Pool (GH₵)</label>
                <input id="programsPool" name="programsPool" inputMode="decimal" defaultValue={pesewasToInput(current.programsPool)} className="input w-40" />
              </div>
              <SubmitButton>Set pool</SubmitButton>
            </ActionForm>
          ) : (
            <p className="figure text-2xl">{formatGHS(current.programsPool)}</p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <div><p className="text-paper/50">Approved</p><p className="figure text-lg">{formatGHS(pool.approved)}</p></div>
          <div><p className="text-paper/50">Submitted</p><p className="figure text-lg">{formatGHS(pool.submitted)}</p></div>
          <div><p className="text-paper/50">Drafts</p><p className="figure text-lg">{formatGHS(pool.draft)}</p></div>
          <div><p className="text-paper/50">Total planned</p><p className="figure text-lg">{formatGHS(pool.planned)}</p></div>
          <div><p className="text-paper/50">Left in pool</p><p className={`figure text-lg ${pool.remaining < 0 ? "text-bad" : "text-good"}`}>{formatGHS(pool.remaining)}</p></div>
        </div>
        <div className="mt-3"><Bar spent={pool.planned} budget={pool.pool} /></div>

        <div className="mt-4 space-y-3">
          {pool.state === "NO_POOL" && <Banner tone="warn">Programs are planned but no pool has been set. {role === "SUPER_ADMIN" ? "Set one above." : "Ask the super admin to set one."}</Banner>}
          {pool.state === "OVER" && (
            <Banner tone="bad">
              Over budget: the programs add up to {formatGHS(pool.planned)}, which is {formatGHS(pool.overBy)} more than the {formatGHS(pool.pool)} pool.
            </Banner>
          )}
          {pool.pool > totals.income && (
            <Banner tone="warn">
              The pool is {formatGHS(pool.pool - totals.income)} more than the income received so far ({formatGHS(totals.income)}). More dues may still arrive, but don&apos;t commit money you haven&apos;t received yet.
            </Banner>
          )}
        </div>
      </Card>

      {pool.overBy > 0 && (
        <Card className="mb-6">
          <h2 className="mb-1 text-lg font-semibold">Where to make changes</h2>
          <p className="mb-3 text-sm text-paper/60">To close the {formatGHS(pool.overBy)} gap, start with the lowest-priority programs that can still change:</p>
          {cuts.suggestions.length === 0 ? (
            <p className="text-sm text-paper/70">Everything planned is already approved. Reopen a program or raise the pool.</p>
          ) : (
            <ul className="space-y-2">
              {cuts.suggestions.map((s) => (
                <li key={s.programId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><Link href={`/budget/${s.programId}`} className="underline">{s.name}</Link><Badge kind={s.priority} /></span>
                  <span className="figure text-paper/70">frees up to {formatGHS(s.upfrontCost)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={`mt-3 text-sm ${cuts.coversGap ? "text-good" : "text-warn"}`}>
            {cuts.coversGap
              ? `Removing these would free ${formatGHS(cuts.freed)} - enough to fit. Trimming individual lines instead of whole programs also works.`
              : "Even removing all of these would not close the gap. Trim must-have budgets, reopen approved programs, or raise the pool."}
          </p>
          {lines.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-paper/60">Biggest single cost lines outside must-have programs:</p>
              <ul className="space-y-1 text-sm">
                {lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2"><span>{l.line} <span className="text-paper/50">({l.programName})</span></span><span className="figure">{formatGHS(l.amount)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card className="mb-6 overflow-x-auto p-2">
        <h2 className="px-3 pb-1 pt-2 text-lg font-semibold">Programs</h2>
        {programs.length === 0 ? (
          <Empty>No programs yet. Add the first one below.</Empty>
        ) : (
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="th">Program</th><th className="th">Priority</th><th className="th">Status</th>
                <th className="th text-right">Upfront cost</th><th className="th text-right">Expected sales</th>
                <th className="th text-right">Spent</th><th className="th w-32" />
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} className="border-t border-gold/10">
                  <td className="td"><Link href={`/budget/${p.id}`} className="font-medium underline-offset-2 hover:underline">{p.name}</Link></td>
                  <td className="td"><Badge kind={p.priority} /></td>
                  <td className="td"><Badge kind={p.status} /></td>
                  <td className="td figure text-right">{formatGHS(p.upfrontCost)}</td>
                  <td className="td figure text-right text-paper/70">{p.expectedRevenue ? formatGHS(p.expectedRevenue) : "-"}</td>
                  <td className="td figure text-right">{formatGHS(p.spent)}</td>
                  <td className="td"><Bar spent={p.spent} budget={p.upfrontCost} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Add a program</h2>
        <ActionForm action={createProgram} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="semesterId" value={current.id} />
          <div className="md:col-span-2">
            <label className="label" htmlFor="name">Name</label>
            <input id="name" name="name" required maxLength={100} placeholder="e.g. Games night" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="priority">Priority</label>
            <select id="priority" name="priority" defaultValue="SHOULD" className="input">
              <option value="MUST">Must have</option>
              <option value="SHOULD">Should have</option>
              <option value="NICE">Nice to have</option>
            </select>
          </div>
          <div className="flex items-end"><SubmitButton pendingText="Creating...">Create and add lines</SubmitButton></div>
          <div className="md:col-span-4">
            <label className="label" htmlFor="description">Description (optional)</label>
            <input id="description" name="description" maxLength={500} className="input" />
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
