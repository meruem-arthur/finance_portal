/**
 * Money is whole pesewas (integers). GH₵42.50 === 4250. Floats never touch a
 * stored amount: parsing and formatting here work on the digits as text.
 */
export const MAX_PESEWAS = 2_000_000_000; // GH₵20,000,000 - stays inside a Postgres INTEGER

/** "1,234.50", "GH₵42", "42.5" -> pesewas. Returns null for anything that isn't a plain non-negative amount with at most 2 decimals. */
export function parseCedis(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = input.replace(/[,\s]/g, "").replace(/^GH[₵S]?/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const pesewas = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(pesewas) || pesewas > MAX_PESEWAS) return null;
  return pesewas;
}

export function formatGHS(pesewas: number): string {
  const abs = Math.abs(pesewas);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(abs % 100).padStart(2, "0");
  return `${pesewas < 0 ? "-" : ""}GH₵${whole}.${frac}`;
}

/** Value for an <input> default, e.g. 4250 -> "42.50". */
export function pesewasToInput(pesewas: number): string {
  return `${Math.floor(pesewas / 100)}.${String(pesewas % 100).padStart(2, "0")}`;
}

/** Whole-number quantity from a form field (1..1,000,000). */
export function parseQuantity(input: string | null | undefined): number | null {
  if (input == null || !/^\d+$/.test(input.trim())) return null;
  const n = Number(input.trim());
  return n >= 1 && n <= 1_000_000 ? n : null;
}

/** quantity x unit, refusing results that would overflow the stored range. */
export function lineTotal(quantity: number, unitAmount: number): number {
  return quantity * unitAmount;
}
