/**
 * Who may change a program's budget, and when.
 *  - DRAFT: the financial secretary or super admin can edit freely.
 *  - SUBMITTED: waiting for review - only the super admin can edit.
 *  - APPROVED: locked. The super admin must reopen it first.
 */
export type Role = "SUPER_ADMIN" | "FINANCIAL_SECRETARY";
export type Status = "DRAFT" | "SUBMITTED" | "APPROVED";

export function canEditProgram(status: Status, role: Role): { ok: true } | { ok: false; reason: string } {
  if (status === "DRAFT") return { ok: true };
  if (status === "SUBMITTED") {
    return role === "SUPER_ADMIN"
      ? { ok: true }
      : { ok: false, reason: "This budget has been submitted and is waiting for review. Ask the super admin to send it back to edit it." };
  }
  return { ok: false, reason: "Approved budgets are locked. The super admin can reopen it if it needs to change." };
}
