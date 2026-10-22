import { describe, it, expect } from "vitest";
import { csvCell, csvRow } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("neutralises spreadsheet formulas in text but leaves numbers alone", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell(-12.5)).toBe("-12.5");
  });
  it("joins a row", () => {
    expect(csvRow(["x", 2, null])).toBe("x,2,");
  });
});
