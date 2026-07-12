import { describe, it, expect } from "vitest";
import {
  calcCardDueDate, shiftDateMonths, shiftCompetencia, parseCompetencia,
  competenciaKey, competenciaRange, monthOf,
} from "../../src/domain/dates.js";

describe("Rule 3 — credit card invoice due date", () => {
  // Card closes on day 28, due on day 7 (due <= closing → rolls one extra month).
  it("purchase before closing day → next month's due (due<=closing)", () => {
    // buy on the 10th (<=28): +1 month because due(7)<=closing(28)
    expect(calcCardDueDate(28, 7, "2026-01-10")).toBe("2026-02-07");
  });

  it("purchase after closing day → skips to the following invoice", () => {
    // buy on the 29th (>28): +1 (after closing) +1 (due<=closing) = +2 months
    expect(calcCardDueDate(28, 7, "2026-01-29")).toBe("2026-03-07");
  });

  it("due day after closing day stays in the closing month bucket", () => {
    // closing 15, due 22 (due>closing): buy on 10th (<=15) → same month due
    expect(calcCardDueDate(15, 22, "2026-05-10")).toBe("2026-05-22");
    // buy on 16th (>15) → next month
    expect(calcCardDueDate(15, 22, "2026-05-16")).toBe("2026-06-22");
  });

  it("wraps the year at december", () => {
    expect(calcCardDueDate(28, 7, "2026-12-10")).toBe("2027-01-07");
  });

  it("caps the due day at 28", () => {
    expect(calcCardDueDate(5, 31, "2026-03-02")).toBe("2026-03-28");
  });
});

describe("Rule 5 — installment date shifting", () => {
  it("adds months and clamps day to 28", () => {
    expect(shiftDateMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftDateMonths("2026-01-15", 2)).toBe("2026-03-15");
    expect(shiftDateMonths("2026-11-10", 3)).toBe("2027-02-10");
  });
});

describe("competência helpers (Rule 6)", () => {
  it("parses and keys", () => {
    expect(competenciaKey(parseCompetencia("2026-07"))).toBe("2026-07");
  });
  it("shifts across year boundaries", () => {
    expect(competenciaKey(shiftCompetencia({ year: 2026, month: 12 }, 1))).toBe("2027-01");
    expect(competenciaKey(shiftCompetencia({ year: 2026, month: 1 }, -1))).toBe("2025-12");
  });
  it("builds a half-open date range", () => {
    expect(competenciaRange({ year: 2026, month: 2 })).toEqual({ start: "2026-02-01", endExclusive: "2026-03-01" });
  });
  it("extracts month of a date", () => {
    expect(monthOf("2026-07-12")).toBe("2026-07");
  });
});
