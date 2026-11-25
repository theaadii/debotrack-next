import { describe, expect, it } from "vitest";
import { computeFinalFee } from "./fees";
import { keysFor, phoneKey, splitList } from "./phone";

describe("computeFinalFee", () => {
  it("returns the course fee when there is no discount", () => {
    expect(computeFinalFee(50000, null, null)).toBe(50000);
    expect(computeFinalFee(50000, "percent", 0)).toBe(50000);
  });
  it("applies a percentage discount", () => {
    expect(computeFinalFee(50000, "percent", 10)).toBe(45000);
    expect(computeFinalFee(33333, "percent", 15)).toBe(28333.05);
  });
  it("applies a fixed discount and never goes below zero", () => {
    expect(computeFinalFee(50000, "fixed", 5000)).toBe(45000);
    expect(computeFinalFee(1000, "fixed", 5000)).toBe(0);
  });
  it("caps a percentage at 100", () => {
    expect(computeFinalFee(1000, "percent", 250)).toBe(0);
  });
  it("is null without a course fee", () => {
    expect(computeFinalFee(null, "percent", 10)).toBeNull();
  });
});

describe("phone matching", () => {
  it("matches the same number written differently", () => {
    expect(phoneKey("+91 98765-43210")).toBe("9876543210");
    expect(phoneKey("9876543210")).toBe("9876543210");
    expect(phoneKey("12")).toBeNull();
  });
  it("splits lists and builds keys", () => {
    expect(splitList("98765 43210, 90000 00001; ")).toEqual(["98765 43210", "90000 00001"]);
    expect(keysFor(["+91 98765 43210"], ["A@B.com", "x"])).toEqual({ phoneKeys: ["9876543210"], emailKeys: ["a@b.com"] });
  });
});

import { parseYear } from "./year";
describe("parseYear", () => {
  it("understands the usual ways of writing a year", () => {
    expect(parseYear("3")).toBe(3);
    expect(parseYear("2nd Year")).toBe(2);
    expect(parseYear("Third")).toBe(3);
    expect(parseYear("IV")).toBe(4);
    expect(parseYear("final year")).toBe(4);
  });
  it("rejects nonsense", () => {
    expect(parseYear("")).toBeNull();
    expect(parseYear("99")).toBeNull();
    expect(parseYear("abc")).toBeNull();
  });
});

import { mapHeaders, safeCell, unsafeCell } from "./csv-schema";
describe("spreadsheet columns", () => {
  it("recognises headers by label or alias, in any order", () => {
    expect(mapHeaders(["Student Name", "Mobile No", "E-mail", "Branch", "Whatever"])).toEqual(["name", "phone", "email", "branch", null]);
    expect(mapHeaders(["Learner Name", "Phone", "School / College / Company"])).toEqual(["name", "phone", "college"]);
  });
  it("uses a header only once", () => {
    expect(mapHeaders(["Phone", "Mobile"])).toEqual(["phone", null]);
  });
  it("defuses formulas but keeps phone numbers", () => {
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(safeCell("+91 98765 43210")).toBe("+91 98765 43210");
    expect(unsafeCell("'=SUM(A1)")).toBe("=SUM(A1)");
  });
});
