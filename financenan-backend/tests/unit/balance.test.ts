import { describe, it, expect } from "vitest";
import { incomeEffect, expenseEffect } from "../../src/services/balance.js";

/** Simulate the reverse-old / apply-new algorithm used by the services on a single account. */
function simulate(initial: number, ops: Array<{ oldE: number; newE: number }>): number {
  let saldo = initial;
  for (const { oldE, newE } of ops) saldo += newE - oldE;
  return saldo;
}

describe("Rule 1 — automatic balance side-effects", () => {
  it("received income credits the account", () => {
    expect(incomeEffect({ recebida: true, valor: 5000 })).toBe(5000);
    expect(incomeEffect({ recebida: false, valor: 5000 })).toBe(0);
  });

  it("paid expense with an account debits it; card expense does not touch the account", () => {
    expect(expenseEffect({ paga: true, accountId: "a1", valor: 3000 })).toBe(-3000);
    expect(expenseEffect({ paga: false, accountId: "a1", valor: 3000 })).toBe(0);
    expect(expenseEffect({ paga: true, accountId: null, valor: 3000 })).toBe(0); // card
  });

  it("editing reverses the old effect and applies the new one", () => {
    // start 1000; create paid income +500; then edit valor to 800
    const afterCreate = simulate(1000, [{ oldE: 0, newE: incomeEffect({ recebida: true, valor: 500 }) }]);
    expect(afterCreate).toBe(1500);
    const afterEdit = simulate(afterCreate, [{
      oldE: incomeEffect({ recebida: true, valor: 500 }),
      newE: incomeEffect({ recebida: true, valor: 800 }),
    }]);
    expect(afterEdit).toBe(1800);
  });

  it("toggling paid off reverses the debit; deleting reverses too", () => {
    let saldo = 1000;
    const paid = { paga: true, accountId: "a1", valor: 200 };
    saldo += expenseEffect(paid); // create paid → 800
    expect(saldo).toBe(800);
    // toggle to unpaid: delta = new - old
    const unpaid = { paga: false, accountId: "a1", valor: 200 };
    saldo += expenseEffect(unpaid) - expenseEffect(paid); // +200 → 1000
    expect(saldo).toBe(1000);
    // recreate paid then delete
    saldo += expenseEffect(paid); // 800
    saldo -= expenseEffect(paid); // delete reverses → 1000
    expect(saldo).toBe(1000);
  });
});

describe("Rule 2 — paying a fixed expense (arithmetic)", () => {
  it("debits exactly the fixed value and reverting cancels it", () => {
    let saldo = 5000;
    const valor = 1800;
    // pay creates a paid expense on the account → debit
    saldo += expenseEffect({ paga: true, accountId: "cc", valor });
    expect(saldo).toBe(3200);
    // deleting the generated expense reverts the fixed expense to "open" and refunds
    saldo -= expenseEffect({ paga: true, accountId: "cc", valor });
    expect(saldo).toBe(5000);
  });
});
