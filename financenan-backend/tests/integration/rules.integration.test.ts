/**
 * End-to-end business-rule tests against a real Postgres database.
 * These are SKIPPED unless RUN_INTEGRATION=1 and DATABASE_URL point to a
 * disposable test database. Run with:
 *   RUN_INTEGRATION=1 DATABASE_URL=... npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { register } from "../../src/services/auth.service.js";
import * as accounts from "../../src/services/accounts.service.js";
import * as cards from "../../src/services/creditCards.service.js";
import * as incomes from "../../src/services/incomes.service.js";
import * as expenses from "../../src/services/expenses.service.js";
import * as fixed from "../../src/services/fixedExpenses.service.js";

const enabled = process.env.RUN_INTEGRATION === "1" && !!process.env.DATABASE_URL;
const prisma = new PrismaClient();

describe.skipIf(!enabled)("business rules (integration)", () => {
  let userId = "";
  let accountId = "";
  let cardId = "";
  let despesaCatId = "";

  beforeAll(async () => {
    const email = `it_${Date.now()}@test.local`;
    const reg = await register({ name: "IT User", email, password: "secret123" });
    userId = reg.user.id;
    const acc = await accounts.createAccount(userId, { nome: "CC", tipo: "conta_bancaria", saldo: 100000, cor: "#4f6bd8", ativo: true });
    accountId = acc.id;
    const card = await cards.createCreditCard(userId, { nome: "Card", bandeira: "Visa", cor: "#7c5cbf", diaFechamento: 28, diaVencimento: 7, ativo: true });
    cardId = card.id;
    despesaCatId = (await prisma.category.findFirstOrThrow({ where: { userId, tipo: "despesa" } })).id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("Rule 1: paid expense debits the account; delete refunds", async () => {
    const e = await expenses.createExpense(userId, { descricao: "x", categoryId: despesaCatId, accountId, dataCompra: "2026-07-10", valor: 25000, paga: true });
    let acc = await accounts.getAccount(userId, accountId);
    expect(acc.saldo).toBe(75000);
    await expenses.deleteExpense(userId, e.id);
    acc = await accounts.getAccount(userId, accountId);
    expect(acc.saldo).toBe(100000);
  });

  it("Rule 2: pay fixed expense creates a paid expense and debits; delete reverts status", async () => {
    const fe = await fixed.createFixedExpense(userId, { descricao: "Aluguel", categoryId: despesaCatId, valor: 30000, diaVencimento: 5, contaPadraoId: accountId, ativo: true });
    const paid = await fixed.payFixedExpense(userId, fe.id, { month: "2026-07" });
    const acc = await accounts.getAccount(userId, accountId);
    expect(acc.saldo).toBe(70000);
    let list = await fixed.listFixedExpenses(userId, "2026-07");
    expect(list.find((f) => f.id === fe.id)?.pagoNaCompetencia).toBe(true);
    await expenses.deleteExpense(userId, paid.id);
    list = await fixed.listFixedExpenses(userId, "2026-07");
    expect(list.find((f) => f.id === fe.id)?.pagoNaCompetencia).toBe(false);
    expect((await accounts.getAccount(userId, accountId)).saldo).toBe(100000);
  });

  it("Rule 5 + 3: bulk card installments get sequential due dates", async () => {
    const rows = await expenses.bulkCreateExpenses(userId, { descricao: "Notebook", categoryId: despesaCatId, creditCardId: cardId, dataCompra: "2026-01-10", valorTotal: 30000, parcelas: 3, dividir: true });
    expect(rows.map((r) => r.valor)).toEqual([10000, 10000, 10000]);
    const vencs = rows.map((r) => r.dataVencimento?.toISOString().slice(0, 10));
    expect(vencs).toEqual(["2026-02-07", "2026-03-07", "2026-04-07"]);
  });

  it("Rule 4: pay invoice marks card expenses paid and debits total once", async () => {
    await expenses.createExpense(userId, { descricao: "Compra", categoryId: despesaCatId, creditCardId: cardId, dataCompra: "2026-05-10", valor: 20000, paga: false });
    const before = (await accounts.getAccount(userId, accountId)).saldo;
    const res = await expenses.payInvoice(userId, cardId, { month: "2026-06", accountId });
    expect(res.total).toBe(20000);
    expect((await accounts.getAccount(userId, accountId)).saldo).toBe(before - 20000);
  });
});
