import { describe, expect, it } from "vitest";
import { parseYear } from "./year";

describe("parseYear", () => {
  it("reads every common way of writing the same year", () => {
    for (const v of ["3", "3rd", "3rd year", "Third", "Third Year", "THIRD YEAR", "III", "TE", "T.E.", "te", "Third Year (TE)", "Year 3", "TY", "T.Y."]) expect(parseYear(v), v).toBe(3);
    for (const v of ["1", "FE", "First Year", "1st yr", "FY"]) expect(parseYear(v), v).toBe(1);
    for (const v of ["2", "SE", "S.E.", "Second year", "II", "SY"]) expect(parseYear(v), v).toBe(2);
    for (const v of ["4", "BE", "B.E.", "Final year", "Fourth", "IV"]) expect(parseYear(v), v).toBe(4);
  });
  it("gives null for anything else", () => {
    for (const v of ["", "  ", "abc", "7", "0", null, undefined]) expect(parseYear(v as string), String(v)).toBeNull();
  });
});
