import { describe, expect, it } from "vitest";
import { normalizeIntentFromModel } from "./intent-payload";

describe("normalizeIntentFromModel", () => {
  it("defaults invalid input to text capability", () => {
    expect(normalizeIntentFromModel(null).capability).toBe("text");
    expect(normalizeIntentFromModel(undefined).capability).toBe("text");
    expect(normalizeIntentFromModel([]).capability).toBe("text");
  });

  it("preserves demand_forecast and entity fields", () => {
    const n = normalizeIntentFromModel({
      capability: "demand_forecast",
      itemId: null,
      userId: null,
      category: "Sportswear",
      timeframeDays: 60,
      confidence: 0.82,
      clarifying_question: null,
    });
    expect(n.capability).toBe("demand_forecast");
    expect(n.category).toBe("Sportswear");
    expect(n.timeframeDays).toBe(60);
    expect(n.confidence).toBe(0.82);
  });

  it("clamps confidence to [0, 1]", () => {
    expect(normalizeIntentFromModel({ capability: "text", confidence: 2 }).confidence).toBe(1);
    expect(normalizeIntentFromModel({ capability: "text", confidence: -1 }).confidence).toBe(0);
  });

  it("rejects unknown capability strings", () => {
    expect(normalizeIntentFromModel({ capability: "unknown_xyz" }).capability).toBe("text");
  });

  it("truncates long clarifying_question", () => {
    const long = "x".repeat(600);
    const n = normalizeIntentFromModel({
      capability: "churn_list",
      clarifying_question: long,
    });
    expect(n.clarifying_question?.length).toBe(500);
  });
});
