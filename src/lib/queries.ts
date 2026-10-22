import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { summarizeProgram, type LineInput } from "@/lib/budget";
import { pickCurrentSemester, windowEndExclusive } from "@/lib/semesters";

export const SEMESTER_COOKIE = "finance_semester";

export async function listSemesters() {
  return prisma.semester.findMany({ orderBy: { startDate: "desc" } });
}

export async function getCurrentSemester() {
  const semesters = await listSemesters();
  const preferred = cookies().get(SEMESTER_COOKIE)?.value;
  return { semesters, current: pickCurrentSemester(semesters, new Date(), preferred) };
}

type Window = { startDate: Date; endDate: Date };

/** Everything the dashboard needs for one semester. Dues income counts SUCCESS payments by paid date; refunds are shown separately and never counted. */
export async function semesterTotals(s: Window) {
  const end = windowEndExclusive(s.endDate);
  const duesWhere = (status: "SUCCESS" | "REFUNDED") => ({ status, paidAt: { gte: s.startDate, lt: end } });
  const txWhere = (type: "INCOME" | "EXPENDITURE") => ({ type, voidedAt: null, date: { gte: s.startDate, lte: s.endDate } });

  const [success, refunded, byType, other, spent] = await Promise.all([
    prisma.duesPayment.aggregate({ where: duesWhere("SUCCESS"), _sum: { amount: true }, _count: { _all: true } }),
    prisma.duesPayment.aggregate({ where: duesWhere("REFUNDED"), _sum: { amount: true }, _count: { _all: true } }),
    prisma.duesPayment.groupBy({ by: ["paymentType"], where: duesWhere("SUCCESS"), _sum: { amount: true }, _count: { _all: true } }),
    prisma.transaction.aggregate({ where: txWhere("INCOME"), _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: txWhere("EXPENDITURE"), _sum: { amount: true } }),
  ]);

  const duesIncome = success._sum.amount ?? 0;
  const otherIncome = other._sum.amount ?? 0;
  const expenditure = spent._sum.amount ?? 0;
  const pick = (t: "FRESHER" | "CONTINUING") => {
    const g = byType.find((x) => x.paymentType === t);
    return { count: g?._count._all ?? 0, total: g?._sum.amount ?? 0 };
  };
  return {
    duesIncome,
    duesCount: success._count._all,
    duesRefunded: refunded._sum.amount ?? 0,
    duesRefundedCount: refunded._count._all,
    duesByType: { FRESHER: pick("FRESHER"), CONTINUING: pick("CONTINUING") },
    otherIncome,
    expenditure,
    income: duesIncome + otherIncome,
    balance: duesIncome + otherIncome - expenditure,
  };
}

/** Programs of a semester with their summary maths and what has actually been logged against them. */
export async function programsWithActuals(semesterId: string) {
  const programs = await prisma.program.findMany({
    where: { semesterId },
    include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
    orderBy: { createdAt: "asc" },
  });
  const ids = programs.map((p) => p.id);
  const sums = ids.length
    ? await prisma.transaction.groupBy({ by: ["programId", "type"], where: { programId: { in: ids }, voidedAt: null }, _sum: { amount: true } })
    : [];

  return programs.map((p) => {
    const lineInputs: LineInput[] = p.lines.map((l) => ({ id: l.id, kind: l.kind, name: l.name, quantity: l.quantity, unitAmount: l.unitAmount }));
    const sum = (type: "INCOME" | "EXPENDITURE") => sums.find((x) => x.programId === p.id && x.type === type)?._sum.amount ?? 0;
    return { ...p, lineInputs, ...summarizeProgram(lineInputs), spent: sum("EXPENDITURE"), earned: sum("INCOME") };
  });
}
