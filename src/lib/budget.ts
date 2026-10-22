/**
 * Budget maths for a semester's programs pool. Pure functions - no database.
 *
 * Money rule: what a program ties up is its UPFRONT COST (every COST line),
 * because the department pays before it earns. Expected revenue (e.g. shirt
 * sales) is shown beside it but never reduces what is reserved from the pool.
 */
export type LineInput = { id: string; kind: "COST" | "REVENUE"; name: string; quantity: number; unitAmount: number };

export type ProgramInput = {
  id: string;
  name: string;
  priority: "MUST" | "SHOULD" | "NICE";
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  upfrontCost: number;
};

export function lineAmount(l: Pick<LineInput, "quantity" | "unitAmount">): number {
  return l.quantity * l.unitAmount;
}

export type BreakEven = { lineId: string; name: string; unitAmount: number; plannedQuantity: number; unitsToCoverCost: number; covered: boolean };

export function summarizeProgram(lines: LineInput[]) {
  const upfrontCost = lines.filter((l) => l.kind === "COST").reduce((n, l) => n + lineAmount(l), 0);
  const expectedRevenue = lines.filter((l) => l.kind === "REVENUE").reduce((n, l) => n + lineAmount(l), 0);
  const breakEven: BreakEven[] = lines
    .filter((l) => l.kind === "REVENUE" && l.unitAmount > 0 && upfrontCost > 0)
    .map((l) => {
      const unitsToCoverCost = Math.ceil(upfrontCost / l.unitAmount);
      return {
        lineId: l.id,
        name: l.name,
        unitAmount: l.unitAmount,
        plannedQuantity: l.quantity,
        unitsToCoverCost,
        covered: l.quantity >= unitsToCoverCost,
      };
    });
  return { upfrontCost, expectedRevenue, expectedNet: expectedRevenue - upfrontCost, breakEven };
}

export type PoolCheck = {
  pool: number;
  approved: number;
  submitted: number;
  draft: number;
  planned: number; // everything not yet rejected = approved + submitted + draft
  remaining: number; // pool - planned (negative when over)
  overBy: number;
  state: "NO_POOL" | "OK" | "OVER";
  approvedOverPool: boolean;
};

export function checkPool(pool: number, programs: Pick<ProgramInput, "status" | "upfrontCost">[]): PoolCheck {
  const sum = (s: ProgramInput["status"]) => programs.filter((p) => p.status === s).reduce((n, p) => n + p.upfrontCost, 0);
  const approved = sum("APPROVED");
  const submitted = sum("SUBMITTED");
  const draft = sum("DRAFT");
  const planned = approved + submitted + draft;
  const overBy = Math.max(0, planned - pool);
  return {
    pool,
    approved,
    submitted,
    draft,
    planned,
    remaining: pool - planned,
    overBy,
    state: pool <= 0 && planned > 0 ? "NO_POOL" : overBy > 0 ? "OVER" : "OK",
    approvedOverPool: approved > pool,
  };
}

/** Would approving this program push the approved total above the pool? */
export function approvalHeadroom(pool: number, approvedOthers: number, programCost: number) {
  const afterApproval = approvedOthers + programCost;
  return { ok: afterApproval <= pool, overBy: Math.max(0, afterApproval - pool) };
}

const PRIORITY_RANK: Record<ProgramInput["priority"], number> = { NICE: 0, SHOULD: 1, MUST: 2 };

export type CutSuggestion = { programId: string; name: string; priority: ProgramInput["priority"]; upfrontCost: number };

/**
 * Simple, explainable "where to cut": lowest-priority programs first, biggest
 * first within a priority, until the gap is covered. (The full optimizer that
 * trims individual line items arrives in a later phase.)
 */
export function suggestCuts(programs: ProgramInput[], overBy: number) {
  if (overBy <= 0) return { suggestions: [] as CutSuggestion[], coversGap: true, freed: 0 };
  const ordered = programs
    .filter((p) => p.upfrontCost > 0)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.upfrontCost - a.upfrontCost);
  const suggestions: CutSuggestion[] = [];
  let freed = 0;
  for (const p of ordered) {
    if (freed >= overBy) break;
    suggestions.push({ programId: p.id, name: p.name, priority: p.priority, upfrontCost: p.upfrontCost });
    freed += p.upfrontCost;
  }
  return { suggestions, coversGap: freed >= overBy, freed };
}

/** Largest individual cost lines outside MUST programs - the first places to look for savings. */
export function biggestCostLines(
  programs: (Pick<ProgramInput, "id" | "name" | "priority"> & { lines: LineInput[] })[],
  limit = 5
) {
  return programs
    .filter((p) => p.priority !== "MUST")
    .flatMap((p) =>
      p.lines.filter((l) => l.kind === "COST").map((l) => ({ programId: p.id, programName: p.name, line: l.name, amount: lineAmount(l) }))
    )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export type SpendState = "OK" | "WATCH" | "OVER";

/** Budget vs actual: OK under 80%, WATCH from 80%, OVER above 100%. */
export function spendState(spent: number, budget: number): SpendState {
  if (budget <= 0) return spent > 0 ? "OVER" : "OK";
  if (spent > budget) return "OVER";
  if (spent * 100 >= budget * 80) return "WATCH";
  return "OK";
}
