"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { ActionError, requireAccess, requireSuperAdmin } from "@/lib/authz";
import { checkDrift, syncFromDues } from "@/lib/dues-sync";
import { formatGHS } from "@/lib/money";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "./run";

function describe(s: { fetched: number; created: number; updated: number }) {
  return `Checked ${s.fetched} payment${s.fetched === 1 ? "" : "s"}: ${s.created} new, ${s.updated} corrected.`;
}

export async function syncNow(): Promise<ActionState> {
  return runAction(async () => {
    await requireAccess();
    try {
      const stats = await syncFromDues();
      revalidatePath("/", "layout");
      return describe(stats);
    } catch {
      throw new ActionError("Couldn't reach the dues portal. Check the connection settings and try again.");
    }
  });
}

/** Starts over from the beginning of the dues portal's history. Safe: every payment is matched by id. */
export async function resyncEverything(): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await requireSuperAdmin();
    try {
      const stats = await syncFromDues({ full: true, maxPages: 200 });
      await audit(user.id, "DUES_FULL_RESYNC", "DuesPayment", null, describe(stats));
      revalidatePath("/", "layout");
      return describe(stats);
    } catch {
      throw new ActionError("Couldn't reach the dues portal. Check the connection settings and try again.");
    }
  });
}

/** Compares our copy against the dues portal's own totals. */
export async function verifyDrift(): Promise<ActionState> {
  return runAction(async () => {
    await requireAccess();
    let d: Awaited<ReturnType<typeof checkDrift>>;
    try {
      d = await checkDrift();
    } catch {
      throw new ActionError("Couldn't reach the dues portal to compare totals.");
    }
    if (d.inSync) return `In sync with the dues portal: ${d.local.count} payments, ${formatGHS(d.local.total)}.`;
    throw new ActionError(
      `Not in sync. Dues portal: ${d.remote.count} payments, ${formatGHS(d.remote.total)}. Here: ${d.local.count} payments, ${formatGHS(d.local.total)}. Press "Sync now"; if it persists, a super admin can use "Re-sync everything".`
    );
  });
}
