"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ActionError, requireAccess } from "@/lib/authz";
import { parseCedis, formatGHS } from "@/lib/money";
import { parseDateInput } from "@/lib/semesters";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "./run";

const txSchema = z.object({
  type: z.enum(["INCOME", "EXPENDITURE"]),
  description: z.string().trim().min(2).max(200),
  category: z.string().trim().max(60).optional(),
  programId: z.string().optional(),
});

export async function addTransaction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAccess();

    const parsed = txSchema.safeParse({
      type: fd.get("type"),
      description: fd.get("description"),
      category: fd.get("category") || undefined,
      programId: fd.get("programId") || undefined,
    });
    if (!parsed.success) throw new ActionError("Choose income or expenditure and describe it (at least 2 characters).");

    const amount = parseCedis(String(fd.get("amount") ?? ""));
    if (!amount) throw new ActionError("Enter an amount greater than zero, like 250 or 250.50.");
    const date = parseDateInput(String(fd.get("date") ?? ""));
    if (!date) throw new ActionError("Pick a valid date.");

    const programId = parsed.data.programId ?? null;
    if (programId && !(await prisma.program.findUnique({ where: { id: programId }, select: { id: true } }))) {
      throw new ActionError("That program no longer exists.");
    }

    const tx = await prisma.transaction.create({
      data: {
        type: parsed.data.type,
        amount,
        date,
        description: parsed.data.description,
        category: parsed.data.category || null,
        programId,
        createdById: user.id,
      },
    });
    await audit(user.id, "TRANSACTION_ADDED", "Transaction", tx.id, `${parsed.data.type} ${formatGHS(amount)} - ${parsed.data.description}`);
    revalidatePath("/", "layout");

    const covered = await prisma.semester.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } }, select: { id: true } });
    return covered ? "Saved." : "Saved - but no semester covers that date, so it won't appear in any semester's totals.";
  });
}

export async function voidTransaction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireAccess();
    const id = String(fd.get("id") ?? "");
    const reason = String(fd.get("reason") ?? "").trim();
    if (reason.length < 3) throw new ActionError("Give a reason for voiding this entry.");

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new ActionError("Entry not found.");
    if (tx.voidedAt) throw new ActionError("This entry is already voided.");

    await prisma.transaction.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason.slice(0, 200), voidedById: user.id } });
    await audit(user.id, "TRANSACTION_VOIDED", "Transaction", id, `${formatGHS(tx.amount)} - ${reason}`);
    revalidatePath("/", "layout");
    return "Entry voided.";
  });
}
