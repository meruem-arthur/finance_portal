import { describe, it, expect } from "vitest";
import { canEditProgram } from "./program-rules";

describe("canEditProgram", () => {
  it("lets anyone edit a draft", () => {
    expect(canEditProgram("DRAFT", "FINANCIAL_SECRETARY").ok).toBe(true);
    expect(canEditProgram("DRAFT", "SUPER_ADMIN").ok).toBe(true);
  });
  it("keeps a submitted budget out of the secretary's hands, but not the super admin's", () => {
    expect(canEditProgram("SUBMITTED", "FINANCIAL_SECRETARY").ok).toBe(false);
    expect(canEditProgram("SUBMITTED", "SUPER_ADMIN").ok).toBe(true);
  });
  it("locks approved budgets for everyone", () => {
    expect(canEditProgram("APPROVED", "SUPER_ADMIN")).toMatchObject({ ok: false });
    expect(canEditProgram("APPROVED", "FINANCIAL_SECRETARY")).toMatchObject({ ok: false });
  });
});
