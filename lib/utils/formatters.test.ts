import { describe, expect, it } from "vitest";
import { clampPercent, formatCompactNumber } from "./formatters";

describe("clampPercent", () => {
  it("clamps to 0–100", () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42)).toBe(42);
  });
});

describe("formatCompactNumber", () => {
  it("formats thousands", () => {
    expect(formatCompactNumber(1500)).toBe("2K");
  });
});
