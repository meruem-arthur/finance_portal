/**
 * Semesters are half an academic year. Their date ranges are inclusive,
 * never overlap, and decide which semester a dues payment or a manual
 * transaction belongs to. All dates are UTC midnight (Ghana is on GMT).
 */
export type SemesterLike = {
  id?: string;
  academicSession: string;
  number: number;
  startDate: Date;
  endDate: Date;
};

const DAY_MS = 86_400_000;

export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Exclusive upper bound for "date <= endDate" comparisons on timestamps. */
export function windowEndExclusive(endDate: Date): Date {
  return new Date(endDate.getTime() + DAY_MS);
}

export function semesterLabel(s: Pick<SemesterLike, "academicSession" | "number">): string {
  return `${s.academicSession} - Semester ${s.number}`;
}

/** Returns an error message, or null when the semester is acceptable. */
export function validateSemester(input: SemesterLike, others: SemesterLike[]): string | null {
  const session = input.academicSession.trim();
  if (!session) return "Enter the academic session, e.g. 2026/2027.";
  if (input.number !== 1 && input.number !== 2) return "Semester must be 1 or 2.";
  if (input.endDate.getTime() < input.startDate.getTime()) return "The end date must be on or after the start date.";

  const rest = others.filter((o) => !input.id || o.id !== input.id);
  if (rest.some((o) => o.academicSession.trim() === session && o.number === input.number)) {
    return `${semesterLabel({ academicSession: session, number: input.number })} already exists.`;
  }
  const clash = rest.find(
    (o) => input.startDate.getTime() <= o.endDate.getTime() && o.startDate.getTime() <= input.endDate.getTime()
  );
  if (clash) return `These dates overlap ${semesterLabel(clash)}. Semesters cannot overlap.`;
  return null;
}

/** The semester to show: the preferred one if it still exists, else the one containing today, else the latest. */
export function pickCurrentSemester<T extends SemesterLike & { id: string }>(
  semesters: T[],
  today: Date,
  preferredId?: string | null
): T | null {
  if (semesters.length === 0) return null;
  const preferred = preferredId ? semesters.find((s) => s.id === preferredId) : undefined;
  if (preferred) return preferred;
  const t = today.getTime();
  const containing = semesters.find((s) => s.startDate.getTime() <= t && t < windowEndExclusive(s.endDate).getTime());
  if (containing) return containing;
  return [...semesters].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
}
