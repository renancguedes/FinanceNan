import { describe, it, expect } from "vitest";
import { computePatrimonio, computeReserve, summarizeInvoice } from "../../src/domain/finance.js";
import type { AccountView } from "../../src/domain/finance.js";

const accounts: AccountView[] = [
  { id: "cc", tipo: "conta_bancaria", saldo: 482000, ativo: true },
  { id: "cd", tipo: "carteira_digital", saldo: 123000, ativo: true },
  { id: "cdb", tipo: "investimento", saldo: 820000, ativo: true },
  { id: "tes", tipo: "investimento", saldo: 640000, ativo: true },
  { id: "old", tipo: "conta_bancaria", saldo: 999999, ativo: false },
];

describe("Rule 8 — patrimônio", () => {
  it("sums active accounts", () => {
    expect(computePatrimonio(accounts, [])).toBe(482000 + 123000 + 820000 + 640000);
  });
  it("excludes only investment accounts listed as excluded", () => {
    expect(computePatrimonio(accounts, ["cdb"])).toBe(482000 + 123000 + 640000);
  });
  it("ignores inactive accounts entirely", () => {
    const only = [{ id: "old", tipo: "conta_bancaria" as const, saldo: 1, ativo: false }];
    expect(computePatrimonio(only, [])).toBe(0);
  });
});

describe("Rule 7 — emergency reserve", () => {
  it("target = sum(active fixed) * months; current = balances of reserve accounts", () => {
    const fixed = [180000, 16000, 9900, 42000]; // active fixed expense values (cents)
    const r = computeReserve(fixed, 6, accounts, ["cdb", "tes"]);
    const monthly = 180000 + 16000 + 9900 + 42000;
    expect(r.target).toBe(monthly * 6);
    expect(r.current).toBe(820000 + 640000);
    expect(r.pct).toBe(Math.min(100, Math.round((r.current / r.target) * 100)));
  });
  it("pct is 0 when there is no target", () => {
    expect(computeReserve([], 6, accounts, ["cdb"]).pct).toBe(0);
  });
});

describe("Rule 4 — invoice summary (pure)", () => {
  it("computes fatura/pago/aberto; aberto is the amount to debit", () => {
    const items = [
      { valor: 48000, paga: false },
      { valor: 12000, paga: false },
      { valor: 30000, paga: true },
    ];
    expect(summarizeInvoice(items)).toEqual({ fatura: 90000, pago: 30000, aberto: 60000 });
  });
});
