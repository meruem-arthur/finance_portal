import { describe, it, expect } from "vitest";
import { parseCedis, formatGHS, pesewasToInput, parseQuantity } from "./money";

describe("parseCedis", () => {
  it("parses plain amounts into whole pesewas without float error", () => {
    expect(parseCedis("42")).toBe(4200);
    expect(parseCedis("42.5")).toBe(4250);
    expect(parseCedis("1,234.50")).toBe(123450);
    expect(parseCedis("GH₵65")).toBe(6500);
    expect(parseCedis("0.1")).toBe(10);
    expect(parseCedis("19.99")).toBe(1999);
  });
  it("rejects negatives, junk, extra decimals and absurd sizes", () => {
    for (const bad of ["", "-5", "abc", "1.234", "1e3", "12.", ".5", "99999999999"]) expect(parseCedis(bad)).toBeNull();
    expect(parseCedis(null)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats with grouping and two decimals", () => {
    expect(formatGHS(0)).toBe("GH₵0.00");
    expect(formatGHS(336000)).toBe("GH₵3,360.00");
    expect(formatGHS(-1050)).toBe("-GH₵10.50");
    expect(pesewasToInput(4205)).toBe("42.05");
  });
  it("parses quantities as whole numbers only", () => {
    expect(parseQuantity("80")).toBe(80);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("2.5")).toBeNull();
  });
});
