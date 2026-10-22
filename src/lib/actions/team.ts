"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ActionError, requireSuperAdmin } from "@/lib/authz";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "./run";

const GRANTABLE = ["FINANCIAL_SECRETARY", "PENDING", "REVOKED"] as const;

export async function setRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    const targetId = String(fd.get("userId") ?? "");
    const role = String(fd.get("role") ?? "");
    if (!(GRANTABLE as readonly string[]).includes(role)) throw new ActionError("Choose a valid role.");

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new ActionError("Person not found.");
    if (target.id === user.id) throw new ActionError("You can't change your own access.");
    if (target.financeRole === "SUPER_ADMIN") throw new ActionError("Super admins come from the dues portal and can't be changed here.");

    await prisma.user.update({ where: { id: target.id }, data: { financeRole: role as (typeof GRANTABLE)[number] } });
    await audit(user.id, "ROLE_CHANGED", "User", target.id, `${target.email}: ${target.financeRole} -> ${role}`);
    revalidatePath("/team");
    return "Access updated.";
  });
}

const emailSchema = z.string().trim().toLowerCase().email().max(200);

/** Lets the super admin approve someone's email before they have ever signed in. */
export async function preauthorize(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    const parsed = emailSchema.safeParse(fd.get("email"));
    if (!parsed.success) throw new ActionError("Enter a valid email address.");
    const email = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.financeRole === "SUPER_ADMIN" || existing.financeRole === "FINANCIAL_SECRETARY") {
        throw new ActionError("This person already has access.");
      }
      await prisma.user.update({ where: { id: existing.id }, data: { financeRole: "FINANCIAL_SECRETARY" } });
    } else {
      await prisma.user.create({ data: { email, name: email, financeRole: "FINANCIAL_SECRETARY" } });
    }
    await audit(user.id, "PREAUTHORIZED", "User", null, email);
    revalidatePath("/team");
    return "Done. They will have access the first time they sign in through the dues portal with this email.";
  });
}
