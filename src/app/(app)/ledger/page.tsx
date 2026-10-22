import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Empty, PageHeader } from "@/components/ui";
import { NoSemester } from "@/components/no-semester";
import { addTransaction, voidTransaction } from "@/lib/actions/ledger";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { getCurrentSemester } from "@/lib/queries";
import { semesterLabel, toDateInput } from "@/lib/semesters";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }: { searchParams: { type?: string } }) {
  const { role } = await requireAccess();
  const { current } = await getCurrentSemester();
  if (!current) return <NoSemester isSuperAdmin={role === "SUPER_ADMIN"} />;

  const type = searchParams.type === "INCOME" || searchParams.type === "EXPENDITURE" ? searchParams.type : undefined;
  const [transactions, programs] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: current.startDate, lte: current.endDate }, ...(type ? { type } : {}) },
      include: { program: { select: { name: true } }, createdBy: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.program.findMany({ where: { semesterId: current.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const filterLink = (value: string | undefined, label: string) => (
    <a
      href={value ? `/ledger?type=${value}` : "/ledger"}
      className={`btn-ghost ${type === value ? "bg-white/10" : ""}`}
    >
      {label}
    </a>
  );

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle={`Money in and out · ${semesterLabel(current)}. Dues payments flow in automatically on the Dues income page.`}
        actions={<a className="btn-ghost" href={`/api/export/ledger?semester=${current.id}`}>Export CSV</a>}
      />

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Log money in or out</h2>
        <ActionForm action={addTransaction} resetOnSuccess className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-1">
            <label className="label" htmlFor="type">Type</label>
            <select id="type" name="type" className="input" defaultValue="EXPENDITURE">
              <option value="EXPENDITURE">Spent</option>
              <option value="INCOME">Received</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="label" htmlFor="amount">Amount (GH₵)</label>
            <input id="amount" name="amount" inputMode="decimal" required placeholder="250.00" className="input" />
          </div>
          <div className="md:col-span-1">
            <label className="label" htmlFor="date">Date</label>
            <input id="date" name="date" type="date" required defaultValue={toDateInput(new Date())} className="input" />
          </div>
          <div className="md:col-span-3">
            <label className="label" htmlFor="description">What was it?</label>
            <input id="description" name="description" required maxLength={200} placeholder="e.g. Printing of flyers" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="category">Category (optional)</label>
            <input id="category" name="category" maxLength={60} placeholder="e.g. Printing" className="input" />
          </div>
          <div className="md:col-span-3">
            <label className="label" htmlFor="programId">Program (optional)</label>
            <select id="programId" name="programId" className="input" defaultValue="">
              <option value="">Not tied to a program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-span-1">
            <SubmitButton>Save entry</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <div className="mb-3 flex gap-2">
        {filterLink(undefined, "All")}
        {filterLink("INCOME", "Received")}
        {filterLink("EXPENDITURE", "Spent")}
      </div>

      <Card className="overflow-x-auto p-2">
        {transactions.length === 0 ? (
          <Empty>No entries in this view yet.</Empty>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th">Description</th>
                <th className="th">Program</th>
                <th className="th">Logged by</th>
                <th className="th text-right">Amount</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-gold/10">
                  <td className={`td figure whitespace-nowrap ${t.voidedAt ? "text-paper/40" : ""}`}>{toDateInput(t.date)}</td>
                  <td className={`td ${t.voidedAt ? "text-paper/40 line-through" : ""}`}>
                    {t.description}
                    {t.category && <span className="ml-2 text-xs text-paper/50">{t.category}</span>}
                    {t.voidedAt && <p className="text-xs no-underline text-bad">Voided: {t.voidReason}</p>}
                  </td>
                  <td className="td text-paper/70">{t.program?.name ?? "-"}</td>
                  <td className="td text-paper/70">{t.createdBy.name}</td>
                  <td className={`td figure text-right ${t.voidedAt ? "text-paper/40 line-through" : t.type === "INCOME" ? "text-good" : "text-bad"}`}>
                    {t.type === "INCOME" ? "+" : "-"}{formatGHS(t.amount)}
                  </td>
                  <td className="td">
                    {!t.voidedAt && (
                      <details>
                        <summary className="cursor-pointer text-xs text-paper/60 hover:text-bad">Void</summary>
                        <ActionForm action={voidTransaction} className="mt-2 flex flex-col gap-2">
                          <input type="hidden" name="id" value={t.id} />
                          <input name="reason" required minLength={3} maxLength={200} placeholder="Why?" className="input" />
                          <SubmitButton className="btn-danger" pendingText="Voiding..." confirm="Void this entry? It stays visible but stops counting.">Void entry</SubmitButton>
                        </ActionForm>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {transactions.length === 200 && <p className="mt-2 text-xs text-paper/50">Showing the latest 200 entries. Export the CSV for everything.</p>}
    </>
  );
}
