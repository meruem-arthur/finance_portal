import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { saveSemester } from "@/lib/actions/semesters";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { formatGHS } from "@/lib/money";
import { listSemesters } from "@/lib/queries";
import { semesterLabel, toDateInput } from "@/lib/semesters";

export const dynamic = "force-dynamic";

export default async function SemestersPage({ searchParams }: { searchParams: { edit?: string } }) {
  const { role } = await requireAccess();
  if (role !== "SUPER_ADMIN") redirect("/");

  const [semesters, sessions] = await Promise.all([
    listSemesters(),
    prisma.duesPayment.findMany({ distinct: ["academicSessionName"], select: { academicSessionName: true } }),
  ]);
  const editing = semesters.find((s) => s.id === searchParams.edit);

  return (
    <>
      <PageHeader title="Semesters" subtitle="An academic year has two semesters. Dues and ledger entries belong to the semester whose dates contain them, so the dates can't overlap." />

      <Card className="mb-6 overflow-x-auto p-2">
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="th">Semester</th><th className="th">From</th><th className="th">To</th><th className="th text-right">Programs pool</th><th className="th" /></tr></thead>
          <tbody>
            {semesters.map((s) => (
              <tr key={s.id} className="border-t border-gold/10">
                <td className="td font-medium">{semesterLabel(s)}</td>
                <td className="td figure">{toDateInput(s.startDate)}</td>
                <td className="td figure">{toDateInput(s.endDate)}</td>
                <td className="td figure text-right">{formatGHS(s.programsPool)}</td>
                <td className="td"><a href={`/semesters?edit=${s.id}`} className="text-sm text-goldBright underline">Edit</a></td>
              </tr>
            ))}
            {semesters.length === 0 && <tr><td className="td text-paper/50" colSpan={5}>No semesters yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{editing ? `Edit ${semesterLabel(editing)}` : "Add a semester"}</h2>
        <ActionForm action={saveSemester} key={editing?.id ?? "new"} resetOnSuccess={!editing} className="grid gap-3 md:grid-cols-5">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="md:col-span-2">
            <label className="label" htmlFor="academicSession">Academic session</label>
            <input id="academicSession" name="academicSession" list="sessions" required defaultValue={editing?.academicSession} placeholder="2026/2027" className="input" />
            <datalist id="sessions">{sessions.map((s) => <option key={s.academicSessionName} value={s.academicSessionName} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor="number">Semester</label>
            <select id="number" name="number" defaultValue={editing?.number ?? 1} className="input"><option value={1}>1</option><option value={2}>2</option></select>
          </div>
          <div>
            <label className="label" htmlFor="startDate">Starts</label>
            <input id="startDate" name="startDate" type="date" required defaultValue={editing ? toDateInput(editing.startDate) : undefined} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="endDate">Ends (inclusive)</label>
            <input id="endDate" name="endDate" type="date" required defaultValue={editing ? toDateInput(editing.endDate) : undefined} className="input" />
          </div>
          <div className="md:col-span-5 flex items-center gap-3">
            <SubmitButton>{editing ? "Save changes" : "Create semester"}</SubmitButton>
            {editing && <a href="/semesters" className="btn-ghost">Cancel</a>}
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
