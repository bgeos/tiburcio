import { describe, expect, it } from "vitest";
import { todayIn } from "./dates";

describe("todayIn", () => {
  // 02:30 UTC on 15 Jan is still 14 Jan (23:30) in São Paulo.
  const lateEveningInBrazil = new Date("2027-01-15T02:30:00Z");

  it("uses the organization's timezone, not UTC", () => {
    expect(todayIn("America/Sao_Paulo", lateEveningInBrazil)).toBe("2027-01-14");
    expect(todayIn("UTC", lateEveningInBrazil)).toBe("2027-01-15");
  });

  it("falls back to UTC for an unknown timezone", () => {
    expect(todayIn("Not/AZone", lateEveningInBrazil)).toBe("2027-01-15");
  });
});
