import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** A problem the person should see, as opposed to a bug. */
export class ActionError extends Error {}

export type Access = { user: User; role: "SUPER_ADMIN" | "FINANCIAL_SECRETARY" };

/**
 * The role is read from the database on every request - never from the session
 * token - so revoking someone takes effect immediately.
 */
export async function getSessionUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export async function requireAccess(): Promise<Access> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.financeRole !== "SUPER_ADMIN" && user.financeRole !== "FINANCIAL_SECRETARY") redirect("/awaiting-access");
  return { user, role: user.financeRole };
}

export async function requireSuperAdmin(): Promise<Access> {
  const access = await requireAccess();
  if (access.role !== "SUPER_ADMIN") throw new ActionError("Only the super admin can do this.");
  return access;
}
