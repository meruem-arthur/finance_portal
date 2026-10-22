import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Banner, Bar, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { addLine, approveProgram, deleteLine, deleteProgram, rejectProgram, reopenProgram, submitProgram, updateLine, updateProgram } from "@/lib/actions/budget";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { lineAmount, spendState } from "@/lib/budget";
import { formatGHS, pesewasToInput } from "@/lib/money";
import { canEditProgram } from "@/lib/program-rules";
import { programsWithActuals } from "@/lib/queries";
import { toDateInput } from "@/lib/semesters";

export const dynamic = "force-dynamic";

type LineDefaults = { id?: string; kind?: "COST" | "REVENUE"; name?: string; quantity?: number; unitAmount?: number; note?: string | null };

function LineFields({ d = {} }: { d?: LineDefaults }) {
  return (
    <>
      <div>
        <label className="label">Kind</label>
        <select name="kind" defaultValue={d.kind ?? "COST"} className="input">
          <option value="COST">Cost (money out)</option>
          <option value="REVENUE">Expected sales (money in)</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label">Line</label>
        <input name="name" required defaultValue={d.name} maxLength={100} placeholder="e.g. Shirt printing" className="input" />
      </div>
      <div>
        <label className="label">Quantity</label>
        <input name="quantity" required inputMode="numeric" defaultValue={d.quantity ?? 1} className="input" />
      </div>
      <div>
        <label className="label">Per unit (GH₵)</label>
        <input name="unitAmount" required inputMode="decimal" defaultValue={d.unitAmount !== undefined ? pesewasToInput(d.unitAmount) : ""} placeholder="42.00" className="input" />
      </div>
      <div className="md:col-span-5">
        <label className="label">Note (optional)</label>
        <input name="note" maxLength={200} defaultValue={d.note ?? ""} className="input" />
      </div>
    </>
  );
}

export default async function ProgramPage({ params }: { params: { programId: string } }) {
  const { role } = await requireAccess();
  const { semesterId } = (await prisma.program.findUnique({ where: { id: params.programId }, select: { semesterId: true } })) ?? {};
  if (!semesterId) notFound();

  const program = (await programsWithActuals(semesterId)).find((p) => p.id === params.programId);
  if (!program) notFound();

  const recent = await prisma.transaction.findMany({
    where: { programId: program.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 15,
  });

  const edit = canEditProgram(program.status, role);
  const state = spendState(program.spent, program.upfrontCost);
  const isSuper = role === "SUPER_ADMIN";

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/budget" className="text-goldBright underline">← All budgets</Link></p>
      <PageHeader
        title={program.name}
        subtitle={program.description ?? undefined}
        actions={<><Badge kind={program.priority} /><Badge kind={program.status} /></>}
      />

      {program.reviewNote && <div className="mb-4"><Banner tone="warn">Sent back: {program.reviewNote}</Banner></div>}
      {!edit.ok && <div className="mb-4"><Banner tone="info">{edit.reason}</Banner></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Upfront cost" value={program.upfrontCost} hint="What this ties up in the pool" />
        <Stat label="Expected sales" value={program.expectedRevenue} />
        <Stat label="Expected net" value={program.expectedNet} tone={program.expectedNet < 0 ? "bad" : "good"} hint="Sales minus cost, if the plan holds" />
        <Stat label="Spent so far" value={program.spent} tone={state === "OVER" ? "bad" : state === "WATCH" ? "warn" : undefined} hint={program.earned ? `${formatGHS(program.earned)} received back` : undefined} />
      </div>

      <Card className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>Spent against budget</span>
          <span className="flex items-center gap-2"><span className="figure">{formatGHS(program.spent)} / {formatGHS(program.upfrontCost)}</span><Badge kind={state} /></span>
        </div>
        <Bar spent={program.spent} budget={program.upfrontCost} />
        {program.breakEven.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {program.breakEven.map((b) => (
              <li key={b.lineId} className={b.covered ? "text-good" : "text-warn"}>
                {b.covered
                  ? `Selling ${b.unitsToCoverCost} of the ${b.plannedQuantity} planned "${b.name}" covers the whole program cost.`
                  : `"${b.name}": ${b.unitsToCoverCost} must sell to cover the cost, but only ${b.plannedQuantity} are planned - ${b.unitsToCoverCost - b.plannedQuantity} short.`}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 overflow-x-auto p-2">
        <h2 className="px-3 pb-1 pt-2 text-lg font-semibold">Budget lines</h2>
        {program.lines.length === 0 ? (
          <Empty>No lines yet. Add the costs (and any expected sales) below.</Empty>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead><tr><th className="th">Line</th><th className="th">Kind</th><th className="th text-right">Qty</th><th className="th text-right">Per unit</th><th className="th text-right">Total</th><th className="th" /></tr></thead>
            <tbody>
              {program.lines.map((l) => (
                <tr key={l.id} className="border-t border-gold/10">
                  <td className="td">{l.name}{l.note && <p className="text-xs text-paper/50">{l.note}</p>}</td>
                  <td className="td text-paper/70">{l.kind === "COST" ? "Cost" : "Expected sales"}</td>
                  <td className="td figure text-right">{l.quantity}</td>
                  <td className="td figure text-right">{formatGHS(l.unitAmount)}</td>
                  <td className={`td figure text-right ${l.kind === "REVENUE" ? "text-good" : ""}`}>{formatGHS(lineAmount(l))}</td>
                  <td className="td">
                    {edit.ok && (
                      <details>
                        <summary className="cursor-pointer text-xs text-goldBright">Edit</summary>
                        <div className="mt-2 w-72 space-y-3 sm:w-96">
                          <ActionForm action={updateLine} className="grid gap-2">
                            <input type="hidden" name="lineId" value={l.id} />
                            <LineFields d={l} />
                            <SubmitButton>Save line</SubmitButton>
                          </ActionForm>
                          <ActionForm action={deleteLine}>
                            <input type="hidden" name="lineId" value={l.id} />
                            <SubmitButton className="btn-danger" pendingText="Removing..." confirm="Remove this line?">Remove line</SubmitButton>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {edit.ok && (
        <Card className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Add a line</h2>
          <ActionForm action={addLine} resetOnSuccess className="grid gap-3 md:grid-cols-5">
            <input type="hidden" name="programId" value={program.id} />
            <LineFields />
            <div className="flex items-end"><SubmitButton>Add line</SubmitButton></div>
          </ActionForm>
          <p className="mt-3 text-xs text-paper/50">Example: 80 shirts at GH₵42.00 is a cost line; 70 shirts at GH₵65.00 is an expected-sales line.</p>
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Review</h2>
        <div className="flex flex-wrap items-start gap-3">
          {program.status === "DRAFT" && (
            <ActionForm action={submitProgram}>
              <input type="hidden" name="programId" value={program.id} />
              <SubmitButton pendingText="Submitting...">Submit for approval</SubmitButton>
            </ActionForm>
          )}
          {isSuper && program.status !== "APPROVED" && (
            <ActionForm action={approveProgram}>
              <input type="hidden" name="programId" value={program.id} />
              <SubmitButton className="btn-ghost" pendingText="Approving...">Approve and lock</SubmitButton>
            </ActionForm>
          )}
          {isSuper && program.status === "SUBMITTED" && (
            <ActionForm action={rejectProgram} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="programId" value={program.id} />
              <div><label className="label">What needs to change?</label><input name="note" required minLength={3} maxLength={300} className="input w-72" /></div>
              <SubmitButton className="btn-ghost" pendingText="Sending...">Send back</SubmitButton>
            </ActionForm>
          )}
          {isSuper && program.status === "APPROVED" && (
            <ActionForm action={reopenProgram}>
              <input type="hidden" name="programId" value={program.id} />
              <SubmitButton className="btn-ghost" pendingText="Reopening..." confirm="Reopen this approved budget as a draft?">Reopen for changes</SubmitButton>
            </ActionForm>
          )}
          {program.status === "SUBMITTED" && !isSuper && <p className="text-sm text-paper/60">Waiting for the super admin to review.</p>}
        </div>
        {program.status === "APPROVED" && <p className="mt-3 text-sm text-paper/60">Approved{program.approvedAt ? ` on ${toDateInput(program.approvedAt)}` : ""}. Log spending against it from the Ledger.</p>}
      </Card>

      {edit.ok && (
        <Card className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Program details</h2>
          <ActionForm action={updateProgram} className="grid gap-3 md:grid-cols-4">
            <input type="hidden" name="programId" value={program.id} />
            <div className="md:col-span-2"><label className="label">Name</label><input name="name" required defaultValue={program.name} maxLength={100} className="input" /></div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" defaultValue={program.priority} className="input">
                <option value="MUST">Must have</option><option value="SHOULD">Should have</option><option value="NICE">Nice to have</option>
              </select>
            </div>
            <div className="flex items-end"><SubmitButton>Save details</SubmitButton></div>
            <div className="md:col-span-4"><label className="label">Description</label><input name="description" defaultValue={program.description ?? ""} maxLength={500} className="input" /></div>
          </ActionForm>
          {program.status === "DRAFT" && (
            <ActionForm action={deleteProgram} className="mt-4">
              <input type="hidden" name="programId" value={program.id} />
              <SubmitButton className="btn-danger" pendingText="Deleting..." confirm="Delete this draft program and its lines?">Delete program</SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}

      <Card className="mt-6 overflow-x-auto p-2">
        <h2 className="px-3 pb-1 pt-2 text-lg font-semibold">Money logged against this program</h2>
        {recent.length === 0 ? (
          <Empty>Nothing logged yet. Tick this program when you add a ledger entry.</Empty>
        ) : (
          <table className="w-full min-w-[480px]">
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className={`border-t border-gold/10 ${t.voidedAt ? "text-paper/40 line-through" : ""}`}>
                  <td className="td figure whitespace-nowrap">{toDateInput(t.date)}</td>
                  <td className="td">{t.description}</td>
                  <td className={`td figure text-right ${t.voidedAt ? "" : t.type === "INCOME" ? "text-good" : "text-bad"}`}>{t.type === "INCOME" ? "+" : "-"}{formatGHS(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
