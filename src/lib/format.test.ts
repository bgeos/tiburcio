import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatRange, pluralDays } from "./format";

describe("format", () => {
  it("formats calendar dates and ranges, with — for missing data", () => {
    expect(formatDate("2027-01-04")).toBe("4 Jan");
    expect(formatDate(null)).toBe("—");
    expect(formatRange({ start: "2027-01-04", end: "2027-01-04" })).toBe("4 Jan");
    expect(formatRange({ start: "2027-01-30", end: "2027-02-02" })).toBe("30 Jan – 2 Feb");
    expect(formatRange(null)).toBe("—");
  });

  it("pluralises days", () => {
    expect(pluralDays(1)).toBe("1 day");
    expect(pluralDays(-1)).toBe("-1 day");
    expect(pluralDays(3)).toBe("3 days");
  });

  it("shows moments in the organization's timezone", () => {
    expect(formatDateTime("2027-01-15T02:30:00Z", "America/Sao_Paulo")).toBe("14 Jan, 23:30");
    expect(formatDateTime("2027-01-15T02:30:00Z", "Not/AZone")).toBe("15 Jan, 02:30");
  });
});
