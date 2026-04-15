import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendBadge } from "./result-widgets";

describe("TrendBadge", () => {
  it("renders rising label", () => {
    render(<TrendBadge trend="rising" />);
    expect(screen.getByText(/Rising/)).toBeTruthy();
  });
});
