"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ActionError, requireAccess, requireSuperAdmin } from "@/lib/authz";
import { approvalHeadroom, summarizeProgram } from "@/lib/budget";
import { formatGHS, MAX_PESEWAS, parseCedis, parseQuantity } from "@/lib/money";
import { canEditProgram, type Role } from "@/lib/program-rules";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "./run";

const programSchema = z.object({
  name: z.string().trim().min(2, "Give the program a name.").max(100),
  description: z.string().trim().max(500).optional(),
  priority: z.enum(["MUST", "SHOULD", "NICE"]),
});

async function loadEditable(programId: string, role: Role) {
  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) throw new ActionError("Program not found.");
  const check = canEditProgram(program.status, role);
  if (!check.ok) throw new ActionError(check.reason);
  return program;
}

export async function createProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAccess();
    const parsed = programSchema.safeParse({ name: fd.get("name"), description: fd.get("description") || undefined, priority: fd.get("priority") });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the program details.");

    const semesterId = String(fd.get("semesterId") ?? "");
    if (!(await prisma.semester.findUnique({ where: { id: semesterId }, select: { id: true } }))) throw new ActionError("Choose a semester first.");

    const program = await prisma.program.create({ data: { ...parsed.data, description: parsed.data.description || null, semesterId, createdById: user.id } });
    await audit(user.id, "PROGRAM_CREATED", "Program", program.id, program.name);
    revalidatePath("/", "layout");
    redirect(`/budget/${program.id}`);
  });
}

export async function updateProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role } = await requireAccess();
    const program = await loadEditable(String(fd.get("programId") ?? ""), role);
    const parsed = programSchema.safeParse({ name: fd.get("name"), description: fd.get("description") || undefined, priority: fd.get("priority") });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the program details.");

    await prisma.program.update({ where: { id: program.id }, data: { ...parsed.data, description: parsed.data.description || null } });
    await audit(user.id, "PROGRAM_UPDATED", "Program", program.id, parsed.data.name);
    revalidatePath("/", "layout");
    return "Saved.";
  });
}

export async function deleteProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role } = await requireAccess();
    const program = await loadEditable(String(fd.get("programId") ?? ""), role);
    if (program.status !== "DRAFT") throw new ActionError("Only draft programs can be deleted.");
    if (await prisma.transaction.count({ where: { programId: program.id } })) {
      throw new ActionError("Money has already been logged against this program, so it can't be deleted.");
    }
    await prisma.program.delete({ where: { id: program.id } });
    await audit(user.id, "PROGRAM_DELETED", "Program", program.id, program.name);
    revalidatePath("/", "layout");
    redirect("/budget");
  });
}

const lineSchema = z.object({
  kind: z.enum(["COST", "REVENUE"]),
  name: z.string().trim().min(2, "Name the line, e.g. Shirt printing.").max(100),
  note: z.string().trim().max(200).optional(),
});

function readLine(fd: FormData) {
  const parsed = lineSchema.safeParse({ kind: fd.get("kind"), name: fd.get("name"), note: fd.get("note") || undefined });
  if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the line.");
  const quantity = parseQuantity(String(fd.get("quantity") ?? "1"));
  if (!quantity) throw new ActionError("Quantity must be a whole number of 1 or more.");
  const unitAmount = parseCedis(String(fd.get("unitAmount") ?? ""));
  if (unitAmount === null || unitAmount <= 0) throw new ActionError("Enter the amount per unit, like 42 or 42.50.");
  if (quantity * unitAmount > MAX_PESEWAS) throw new ActionError("That total is too large.");
  return { ...parsed.data, note: parsed.data.note || null, quantity, unitAmount };
}

export async function addLine(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role } = await requireAccess();
    const program = await loadEditable(String(fd.get("programId") ?? ""), role);
    const data = readLine(fd);
    const last = await prisma.budgetLine.findFirst({ where: { programId: program.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const line = await prisma.budgetLine.create({ data: { ...data, programId: program.id, sortOrder: (last?.sortOrder ?? 0) + 1 } });
    await audit(user.id, "LINE_ADDED", "BudgetLine", line.id, `${program.name}: ${data.name} ${data.quantity} x ${formatGHS(data.unitAmount)}`);
    revalidatePath("/", "layout");
    return "Line added.";
  });
}

export async function updateLine(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role } = await requireAccess();
    const line = await prisma.budgetLine.findUnique({ where: { id: String(fd.get("lineId") ?? "") } });
    if (!line) throw new ActionError("Line not found.");
    const program = await loadEditable(line.programId, role);
    const data = readLine(fd);
    await prisma.budgetLine.update({ where: { id: line.id }, data });
    await audit(user.id, "LINE_UPDATED", "BudgetLine", line.id, `${program.name}: ${data.name}`);
    revalidatePath("/", "layout");
    return "Line updated.";
  });
}

export async function deleteLine(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role } = await requireAccess();
    const line = await prisma.budgetLine.findUnique({ where: { id: String(fd.get("lineId") ?? "") } });
    if (!line) throw new ActionError("Line not found.");
    const program = await loadEditable(line.programId, role);
    if (await prisma.transaction.count({ where: { lineId: line.id } })) throw new ActionError("Money is logged against this line, so it can't be removed.");
    await prisma.budgetLine.delete({ where: { id: line.id } });
    await audit(user.id, "LINE_DELETED", "BudgetLine", line.id, `${program.name}: ${line.name}`);
    revalidatePath("/", "layout");
    return "Line removed.";
  });
}

export async function submitProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAccess();
    const program = await prisma.program.findUnique({ where: { id: String(fd.get("programId") ?? "") }, include: { lines: true } });
    if (!program) throw new ActionError("Program not found.");
    if (program.status !== "DRAFT") throw new ActionError("Only a draft can be submitted.");
    if (!program.lines.some((l) => l.kind === "COST")) throw new ActionError("Add at least one cost line before submitting.");

    await prisma.program.update({ where: { id: program.id }, data: { status: "SUBMITTED", submittedAt: new Date(), reviewNote: null } });
    await audit(user.id, "PROGRAM_SUBMITTED", "Program", program.id, program.name);
    revalidatePath("/", "layout");
    return "Submitted for approval.";
  });
}

export async function approveProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    const program = await prisma.program.findUnique({ where: { id: String(fd.get("programId") ?? "") }, include: { lines: true, semester: true } });
    if (!program) throw new ActionError("Program not found.");
    if (program.status === "APPROVED") throw new ActionError("Already approved.");

    const cost = summarizeProgram(program.lines).upfrontCost;
    if (cost <= 0) throw new ActionError("Add at least one cost line before approving.");

    // The control point: approved programs may never add up to more than the pool.
    const others = await prisma.program.findMany({ where: { semesterId: program.semesterId, status: "APPROVED", id: { not: program.id } }, include: { lines: true } });
    const approvedOthers = others.reduce((n, p) => n + summarizeProgram(p.lines).upfrontCost, 0);
    const room = approvalHeadroom(program.semester.programsPool, approvedOthers, cost);
    if (!room.ok) {
      throw new ActionError(`Approving this would put approved programs ${formatGHS(room.overBy)} over the ${formatGHS(program.semester.programsPool)} pool. Raise the pool or trim this budget first.`);
    }

    await prisma.program.update({ where: { id: program.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id, reviewNote: null } });
    await audit(user.id, "PROGRAM_APPROVED", "Program", program.id, `${program.name} (${formatGHS(cost)})`);
    revalidatePath("/", "layout");
    return "Approved and locked.";
  });
}

export async function rejectProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    const note = String(fd.get("note") ?? "").trim();
    if (note.length < 3) throw new ActionError("Say what needs to change.");
    const program = await prisma.program.findUnique({ where: { id: String(fd.get("programId") ?? "") } });
    if (!program) throw new ActionError("Program not found.");
    if (program.status !== "SUBMITTED") throw new ActionError("Only a submitted budget can be sent back.");

    await prisma.program.update({ where: { id: program.id }, data: { status: "DRAFT", reviewNote: note.slice(0, 300) } });
    await audit(user.id, "PROGRAM_SENT_BACK", "Program", program.id, `${program.name}: ${note}`);
    revalidatePath("/", "layout");
    return "Sent back for changes.";
  });
}

export async function reopenProgram(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    const program = await prisma.program.findUnique({ where: { id: String(fd.get("programId") ?? "") } });
    if (!program) throw new ActionError("Program not found.");
    if (program.status !== "APPROVED") throw new ActionError("Only an approved budget can be reopened.");

    await prisma.program.update({ where: { id: program.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null, reviewNote: "Reopened for changes." } });
    await audit(user.id, "PROGRAM_REOPENED", "Program", program.id, program.name);
    revalidatePath("/", "layout");
    return "Reopened as a draft.";
  });
}
