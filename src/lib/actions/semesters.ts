"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ActionError, requireAccess, requireSuperAdmin } from "@/lib/authz";
import { formatGHS, parseCedis } from "@/lib/money";
import { parseDateInput, semesterLabel, validateSemester } from "@/lib/semesters";
import { SEMESTER_COOKIE } from "@/lib/queries";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "./run";

export async function saveSemester(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    const id = String(fd.get("id") ?? "") || undefined;

    const startDate = parseDateInput(String(fd.get("startDate") ?? ""));
    const endDate = parseDateInput(String(fd.get("endDate") ?? ""));
    if (!startDate || !endDate) throw new ActionError("Enter both dates.");
    const input = { id, academicSession: String(fd.get("academicSession") ?? "").trim(), number: Number(fd.get("number")), startDate, endDate };

    const others = await prisma.semester.findMany();
    const problem = validateSemester(input, others);
    if (problem) throw new ActionError(problem);

    const data = { academicSession: input.academicSession, number: input.number, startDate, endDate };
    const saved = id
      ? await prisma.semester.update({ where: { id }, data })
      : await prisma.semester.create({ data });
    await audit(user.id, id ? "SEMESTER_UPDATED" : "SEMESTER_CREATED", "Semester", saved.id, semesterLabel(saved));
    revalidatePath("/", "layout");
    return id ? "Semester updated." : "Semester created.";
  });
}

export async function setPool(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    const semesterId = String(fd.get("semesterId") ?? "");
    const pool = parseCedis(String(fd.get("programsPool") ?? ""));
    if (pool === null) throw new ActionError("Enter the pool amount, like 10000 or 10000.00.");

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) throw new ActionError("Semester not found.");
    await prisma.semester.update({ where: { id: semesterId }, data: { programsPool: pool } });
    await audit(user.id, "POOL_SET", "Semester", semesterId, `${semesterLabel(semester)}: ${formatGHS(semester.programsPool)} -> ${formatGHS(pool)}`);
    revalidatePath("/", "layout");
    return "Programs pool updated.";
  });
}

/** Remembers which semester the person is looking at. */
export async function selectSemester(fd: FormData) {
  await requireAccess();
  const id = String(fd.get("semesterId") ?? "");
  if (id && (await prisma.semester.findUnique({ where: { id }, select: { id: true } }))) {
    cookies().set(SEMESTER_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/", "layout");
}
