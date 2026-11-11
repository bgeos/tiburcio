import { describe, expect, it } from "vitest";
import { slugFromName } from "@/lib/domain/organizations";
import { organizationSchema } from "./organizations";

describe("slugFromName", () => {
  it("drops accents, spaces and symbols", () => {
    expect(slugFromName("Jupi Produções")).toBe("jupi-producoes");
    expect(slugFromName("  Summer Fest — 2027! ")).toBe("summer-fest-2027");
  });

  it("keeps the address within 50 characters, without a trailing hyphen", () => {
    const slug = slugFromName(`${"a".repeat(49)} b`);
    expect(slug).toBe("a".repeat(49));
  });

  it("is empty when nothing usable is left", () => {
    expect(slugFromName("!!!")).toBe("");
  });
});

describe("organizationSchema", () => {
  it("accepts a name and an address, lowercasing the address", () => {
    expect(organizationSchema.parse({ name: " Summer Fest ", slug: "Summer-Fest" })).toEqual({ name: "Summer Fest", slug: "summer-fest" });
  });

  it("refuses a badly formed address", () => {
    for (const slug of ["a", "summer fest", "summer--fest", "-fest", "fest-", "festa_2027"]) {
      expect(organizationSchema.safeParse({ name: "Fest", slug }).success, slug).toBe(false);
    }
  });

  it("refuses an address that is an app page", () => {
    const result = organizationSchema.safeParse({ name: "Fest", slug: "login" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("This address is used by the app. Choose another.");
  });

  it("needs a name", () => {
    expect(organizationSchema.safeParse({ name: "  ", slug: "fest" }).success).toBe(false);
  });
});
