import { describe, it, expect } from "vitest";
import { parseDateInput, pickCurrentSemester, validateSemester, windowEndExclusive, type SemesterLike } from "./semesters";

const d = (s: string) => parseDateInput(s)!;
const sem1: SemesterLike & { id: string } = { id: "a", academicSession: "2026/2027", number: 1, startDate: d("2026-09-01"), endDate: d("2027-01-31") };
const sem2: SemesterLike & { id: string } = { id: "b", academicSession: "2026/2027", number: 2, startDate: d("2027-02-01"), endDate: d("2027-06-30") };

describe("parseDateInput", () => {
  it("accepts real dates only", () => {
    expect(parseDateInput("2026-09-01")?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("01/09/2026")).toBeNull();
  });
});

describe("validateSemester", () => {
  it("accepts back-to-back semesters", () => {
    expect(validateSemester({ ...sem2, id: undefined }, [sem1])).toBeNull();
  });
  it("rejects overlap, duplicates, bad order and bad numbers", () => {
    expect(validateSemester({ academicSession: "2026/2027", number: 2, startDate: d("2027-01-15"), endDate: d("2027-06-30") }, [sem1])).toMatch(/overlap/i);
    expect(validateSemester({ academicSession: "2026/2027", number: 1, startDate: d("2030-01-01"), endDate: d("2030-02-01") }, [sem1])).toMatch(/already exists/);
    expect(validateSemester({ academicSession: "x", number: 1, startDate: d("2027-02-02"), endDate: d("2027-02-01") }, [])).toMatch(/end date/);
    expect(validateSemester({ academicSession: "x", number: 3, startDate: d("2027-02-01"), endDate: d("2027-02-02") }, [])).toMatch(/1 or 2/);
  });
  it("lets a semester be edited without clashing with itself", () => {
    expect(validateSemester({ ...sem1, endDate: d("2027-01-20") }, [sem1, sem2])).toBeNull();
  });
});

describe("pickCurrentSemester", () => {
  it("prefers the chosen semester, then the one containing today, then the latest", () => {
    expect(pickCurrentSemester([sem1, sem2], d("2026-10-01"))?.id).toBe("a");
    expect(pickCurrentSemester([sem1, sem2], d("2026-10-01"), "b")?.id).toBe("b");
    expect(pickCurrentSemester([sem1, sem2], d("2030-01-01"))?.id).toBe("b");
    expect(pickCurrentSemester([], d("2026-10-01"))).toBeNull();
  });
  it("treats the end date as inclusive", () => {
    expect(pickCurrentSemester([sem1, sem2], d("2027-01-31"))?.id).toBe("a");
    expect(windowEndExclusive(sem1.endDate).toISOString()).toBe("2027-02-01T00:00:00.000Z");
  });
});
