import { describe, it, expect } from "vitest";
import { approvalHeadroom, biggestCostLines, checkPool, spendState, suggestCuts, summarizeProgram, type LineInput, type ProgramInput } from "./budget";

// The T-shirt example from the planning chat, in pesewas.
const shirts: LineInput[] = [
  { id: "c1", kind: "COST", name: "Shirt printing", quantity: 80, unitAmount: 4200 },
  { id: "r1", kind: "REVENUE", name: "Shirt sales", quantity: 70, unitAmount: 6500 },
];

describe("summarizeProgram", () => {
  it("reserves the upfront cost, not the net, and finds the break-even", () => {
    const s = summarizeProgram(shirts);
    expect(s.upfrontCost).toBe(336000);
    expect(s.expectedRevenue).toBe(455000);
    expect(s.expectedNet).toBe(119000);
    expect(s.breakEven[0]).toMatchObject({ unitsToCoverCost: 52, plannedQuantity: 70, covered: true });
  });
  it("flags a sales plan that cannot cover the cost", () => {
    const s = summarizeProgram([shirts[0], { ...shirts[1], quantity: 40 }]);
    expect(s.breakEven[0].covered).toBe(false);
    expect(s.expectedNet).toBe(260000 - 336000);
  });
  it("handles a program with no revenue", () => {
    const s = summarizeProgram([{ id: "x", kind: "COST", name: "Hall", quantity: 1, unitAmount: 50000 }]);
    expect(s.breakEven).toEqual([]);
    expect(s.expectedNet).toBe(-50000);
  });
});

const prog = (id: string, priority: ProgramInput["priority"], status: ProgramInput["status"], upfrontCost: number): ProgramInput => ({ id, name: id, priority, status, upfrontCost });

describe("checkPool", () => {
  it("shows what is left when everything fits", () => {
    // pool 10,000; app+website 3,200; shirts 3,360 -> 3,440 left for the rest
    const c = checkPool(1_000_000, [prog("app", "MUST", "APPROVED", 320000), prog("shirts", "SHOULD", "DRAFT", 336000)]);
    expect(c).toMatchObject({ approved: 320000, draft: 336000, planned: 656000, remaining: 344000, overBy: 0, state: "OK" });
  });
  it("flags the overrun and by how much", () => {
    const c = checkPool(600000, [prog("a", "MUST", "APPROVED", 320000), prog("b", "SHOULD", "SUBMITTED", 336000)]);
    expect(c).toMatchObject({ overBy: 56000, state: "OVER", approvedOverPool: false });
  });
  it("treats spending with no pool as a problem", () => {
    expect(checkPool(0, [prog("a", "MUST", "DRAFT", 100)]).state).toBe("NO_POOL");
    expect(checkPool(0, []).state).toBe("OK");
  });
});

describe("approvalHeadroom", () => {
  it("blocks an approval that would break the pool", () => {
    expect(approvalHeadroom(1_000_000, 700000, 336000)).toEqual({ ok: false, overBy: 36000 });
    expect(approvalHeadroom(1_000_000, 600000, 336000)).toEqual({ ok: true, overBy: 0 });
  });
});

describe("suggestCuts", () => {
  const programs = [prog("must", "MUST", "APPROVED", 500000), prog("nice-big", "NICE", "DRAFT", 200000), prog("nice-small", "NICE", "DRAFT", 50000), prog("should", "SHOULD", "DRAFT", 300000)];
  it("cuts lowest priority first, biggest first, until the gap is covered", () => {
    const r = suggestCuts(programs, 220000);
    expect(r.suggestions.map((s) => s.programId)).toEqual(["nice-big", "nice-small"]);
    expect(r.coversGap).toBe(true);
  });
  it("says so when even cutting everything cannot close the gap", () => {
    expect(suggestCuts([prog("a", "NICE", "DRAFT", 100)], 5000).coversGap).toBe(false);
  });
  it("suggests nothing when there is no overrun", () => {
    expect(suggestCuts(programs, 0).suggestions).toEqual([]);
  });
  it("lists the biggest cost lines outside must-have programs", () => {
    const lines = biggestCostLines([
      { id: "1", name: "Must", priority: "MUST", lines: [{ id: "l", kind: "COST", name: "x", quantity: 1, unitAmount: 999999 }] },
      { id: "2", name: "Games", priority: "NICE", lines: [{ id: "m", kind: "COST", name: "Prizes", quantity: 2, unitAmount: 5000 }] },
    ]);
    expect(lines).toEqual([{ programId: "2", programName: "Games", line: "Prizes", amount: 10000 }]);
  });
});

describe("spendState", () => {
  it("goes OK -> WATCH at 80% -> OVER above 100%", () => {
    expect(spendState(7900, 10000)).toBe("OK");
    expect(spendState(8000, 10000)).toBe("WATCH");
    expect(spendState(10000, 10000)).toBe("WATCH");
    expect(spendState(10001, 10000)).toBe("OVER");
    expect(spendState(1, 0)).toBe("OVER");
    expect(spendState(0, 0)).toBe("OK");
  });
});
