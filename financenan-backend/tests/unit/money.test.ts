import { describe, it, expect } from "vitest";
import { splitInstallments, centsToBRL } from "../../src/domain/money.js";

describe("Rule 5 — installment amount split", () => {
  it("splits evenly when divisible", () => {
    expect(splitInstallments(30000, 3, true)).toEqual([10000, 10000, 10000]);
  });

  it("puts the remainder cents on the LAST installment", () => {
    // 100.00 / 3 = 33.33, 33.33, 33.34
    expect(splitInstallments(10000, 3, true)).toEqual([3333, 3333, 3334]);
    const parts = splitInstallments(10000, 3, true);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000); // no cents lost
  });

  it("repeats the full value when not dividing", () => {
    expect(splitInstallments(5000, 4, false)).toEqual([5000, 5000, 5000, 5000]);
  });

  it("handles a single installment", () => {
    expect(splitInstallments(1234, 1, true)).toEqual([1234]);
  });

  it("rejects non-integer cents", () => {
    expect(() => splitInstallments(10.5, 2, true)).toThrow();
  });

  it("formats cents to BRL", () => {
    expect(centsToBRL(123456)).toBe("R$ 1234.56");
    expect(centsToBRL(-500)).toBe("-R$ 5.00");
  });
});
