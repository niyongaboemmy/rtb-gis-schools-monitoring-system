import { describe, expect, it } from "vitest";
import { evaluatePassword, isPasswordAcceptable, passwordScore } from "./password-policy";

describe("client password policy (mirrors the server)", () => {
  it("accepts a password meeting every rule", () => {
    expect(isPasswordAcceptable("Kigali-Rwanda2026")).toBe(true);
  });

  it.each([
    ["Sh0rt!pw", "length"],
    ["alllowercase-2026", "upper"],
    ["ALLUPPERCASE-2026", "lower"],
    ["No-Digits-Here!!", "digit"],
    ["NoSymbolsHere2026", "symbol"],
  ])("flags %s for %s", (pw, rule) => {
    const failed = evaluatePassword(pw).filter((r) => !r.met).map((r) => r.id);
    expect(failed).toContain(rule);
  });

  it("rejects the email or its name part, case-insensitively", () => {
    expect(isPasswordAcceptable("ALICE-strong-2026", "alice@rtb.gov.rw")).toBe(false);
    expect(isPasswordAcceptable("Strong-Pass-2026", "jo@rtb.gov.rw")).toBe(true);
  });

  it("only shows the email rule when an email is known", () => {
    expect(evaluatePassword("x").map((r) => r.id)).not.toContain("email");
    expect(evaluatePassword("x", "a@b.c").map((r) => r.id)).toContain("email");
  });

  it("scores 0 for empty, ≤2 when failing, 3–4 when passing", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abc")).toBeLessThanOrEqual(2);
    expect(passwordScore("Kigali-2026!")).toBe(3);
    expect(passwordScore("Kigali-Rwanda-2026!")).toBe(4);
  });
});
