import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { csvRow } from "@/lib/csv";
import { semesterLabel, toDateInput } from "@/lib/semesters";
import { semesterTotals } from "@/lib/queries";
import { pesewasToInput } from "@/lib/money";

// GET /api/export/ledger?semester=<id> - CSV of one semester: summary, then every logged transaction (voided ones marked).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.financeRole !== "SUPER_ADMIN" && user.financeRole !== "FINANCIAL_SECRETARY")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const semester = await prisma.semester.findUnique({ where: { id: req.nextUrl.searchParams.get("semester") ?? "" } });
  if (!semester) return NextResponse.json({ error: "Semester not found" }, { status: 404 });

  const [totals, transactions] = await Promise.all([
    semesterTotals(semester),
    prisma.transaction.findMany({
      where: { date: { gte: semester.startDate, lte: semester.endDate } },
      include: { program: { select: { name: true } }, createdBy: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const cedis = (p: number) => pesewasToInput(p);
  const lines = [
    csvRow([`Ledger - ${semesterLabel(semester)}`, `${toDateInput(semester.startDate)} to ${toDateInput(semester.endDate)}`]),
    csvRow(["Dues collected (GHS)", cedis(totals.duesIncome), `${totals.duesCount} payments`]),
    csvRow(["Dues refunded, not counted (GHS)", cedis(totals.duesRefunded), `${totals.duesRefundedCount} payments`]),
    csvRow(["Other income (GHS)", cedis(totals.otherIncome)]),
    csvRow(["Expenditure (GHS)", cedis(totals.expenditure)]),
    csvRow(["Balance (GHS)", totals.balance < 0 ? `-${cedis(-totals.balance)}` : cedis(totals.balance)]),
    "",
    csvRow(["Date", "Type", "Amount (GHS)", "Description", "Category", "Program", "Logged by", "Status", "Void reason"]),
    ...transactions.map((t) =>
      csvRow([toDateInput(t.date), t.type, cedis(t.amount), t.description, t.category, t.program?.name, t.createdBy.name, t.voidedAt ? "VOIDED" : "ACTIVE", t.voidReason])
    ),
  ];

  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ledger-${semester.academicSession.replace(/\W+/g, "-")}-sem${semester.number}.csv"`,
    },
  });
}
