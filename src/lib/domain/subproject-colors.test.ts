import { describe, expect, it } from "vitest";
import { nextSubprojectColor } from "./subproject-colors";

describe("nextSubprojectColor", () => {
  it("starts with blue and goes through the palette in order", () => {
    expect(nextSubprojectColor([])).toBe("blue");
    expect(nextSubprojectColor(["blue"])).toBe("aqua");
    expect(nextSubprojectColor(["blue", "aqua", "yellow"])).toBe("magenta");
  });

  it("fills gaps first, then starts a second round", () => {
    expect(nextSubprojectColor(["blue", "yellow"])).toBe("aqua");
    expect(nextSubprojectColor(["blue", "aqua", "yellow", "magenta", "green", "violet"])).toBe("blue");
    expect(nextSubprojectColor(["blue", "blue", "aqua", "yellow", "magenta", "green", "violet"])).toBe("aqua");
  });
});
