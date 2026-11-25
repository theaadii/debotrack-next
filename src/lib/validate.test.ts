import { describe, expect, it } from "vitest";
import { dateProblem, emailProblem, learnerErrors, phoneProblem } from "./validate";
import { parseId } from "./utils";

describe("phoneProblem", () => {
  it("accepts normal numbers", () => {
    for (const p of ["9876543210", "+91 98765 43210", "(022) 2345-6789"]) expect(phoneProblem(p)).toBeNull();
  });
  it("rejects letters, short and 25-digit numbers", () => {
    for (const p of ["abc", "123", "1".repeat(25), "98765x43210"]) expect(phoneProblem(p)).not.toBeNull();
  });
});

describe("emailProblem", () => {
  it("checks the format", () => {
    expect(emailProblem("a@b.co")).toBeNull();
    for (const e of ["not-an-email", "a@b", "a b@c.com", "@x.com"]) expect(emailProblem(e)).not.toBeNull();
  });
});

describe("learnerErrors", () => {
  const base = { name: "Asha", phones: ["9876543210"], emails: [], college: "", branch: null, city: null, qualification: null };
  it("passes a good learner", () => expect(learnerErrors(base)).toEqual({}));
  it("flags a 300-character name", () => expect(learnerErrors({ ...base, name: "x".repeat(300) }).name).toBeDefined());
});

describe("dateProblem", () => {
  it("rejects year 9999 and unparseable text", () => {
    expect(dateProblem("9999-01-01")).not.toBeNull();
    expect(dateProblem("nope")).not.toBeNull();
  });
  it("accepts a near date; rejects the past when asked", () => {
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    expect(dateProblem(tomorrow, { allowPast: false })).toBeNull();
    expect(dateProblem("2020-01-01", { allowPast: false })).not.toBeNull();
  });
});

describe("parseId", () => {
  it("only accepts ids that fit the database", () => {
    expect(parseId("42")).toBe(42);
    for (const v of ["99999999999999999999", "0", "-1", "1.5", "abc", "007"]) expect(parseId(v)).toBeNaN();
  });
});
