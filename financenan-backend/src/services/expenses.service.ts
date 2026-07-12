import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import type { Tx } from "../db/prisma.js";
import { BadRequest, Conflict, NotFound } from "../lib/errors.js";
import { applyAccountDelta, expenseEffect } from "./balance.js";
import { calcCardDueDate, competenciaRange, parseCompetencia, shiftDateMonths } from "../domain/dates.js";
import { splitInstallments } from "../domain/money.js";
import type { z } from "zod";
import type { expenseCreateSchema, expenseUpdateSchema, bulkExpenseSchema, payInvoiceSchema } from "../schemas/index.js";

type Create = z.infer<typeof expenseCreateSchema>;
type Update = z.infer<typeof expenseUpdateSchema>;
type Bulk = z.infer<typeof bulkExpenseSchema>;
type PayInvoice = z.infer<typeof payInvoiceSchema>;

function toISO(d: Date): string { return d.toISOString().slice(0, 10); }

async function ensureCategory(tx: Tx, userId: string, id: string) {
  const c = await tx.category.findFirst({ where: { id, userId }, select: { id: true } });
  if (!c) throw NotFound("Category not found");
}
async function ensureAccount(tx: Tx, userId: string, id: string) {
  const a = await tx.account.findFirst({ where: { id, userId }, select: { id: true } });
  if (!a) throw NotFound("Account not found");
}
async function getActiveCard(tx: Tx, userId: string, id: string) {
  const card = await tx.creditCard.findFirst({ where: { id, userId } });
  if (!card) throw NotFound("Credit card not found");
  if (!card.ativo) throw BadRequest("Inactive credit cards cannot receive new expenses");
  return card;
}

/** Rule 6: card expenses are filed by dataVencimento; all others by dataCompra. */
export function listExpenses(userId: string, month?: string) {
  if (!month) return prisma.expense.findMany({ where: { userId }, orderBy: { dataCompra: "desc" } });
  const { start, endExclusive } = competenciaRange(parseCompetencia(month));
  const range = { gte: new Date(start), lt: new Date(endExclusive) };
  return prisma.expense.findMany({
    where: {
      userId,
      OR: [
        { creditCardId: { not: null }, dataVencimento: range },
        { creditCardId: null, dataCompra: range },
      ],
    },
    orderBy: { dataCompra: "desc" },
  });
}

export async function getExpense(userId: string, id: string) {
  const e = await prisma.expense.findFirst({ where: { id, userId } });
  if (!e) throw NotFound("Expense not found");
  return e;
}

export function createExpense(userId: string, data: Create) {
  return prisma.$transaction(async (tx) => {
    await ensureCategory(tx, userId, data.categoryId);
    let dataVencimento: Date | null = null;
    if (data.creditCardId) {
      const card = await getActiveCard(tx, userId, data.creditCardId);
      dataVencimento = new Date(calcCardDueDate(card.diaFechamento, card.diaVencimento, data.dataCompra));
    } else if (data.accountId) {
      await ensureAccount(tx, userId, data.accountId);
    }
    const expense = await tx.expense.create({
      data: {
        userId,
        descricao: data.descricao,
        categoryId: data.categoryId,
        accountId: data.accountId ?? null,
        creditCardId: data.creditCardId ?? null,
        dataCompra: new Date(data.dataCompra),
        dataVencimento,
        valor: data.valor,
        observacoes: data.observacoes ?? null,
        paga: data.paga,
      },
    });
    if (expense.accountId) await applyAccountDelta(tx, userId, expense.accountId, expenseEffect(expense));
    return expense;
  });
}

export function updateExpense(userId: string, id: string, data: Update) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.expense.findFirst({ where: { id, userId } });
    if (!old) throw NotFound("Expense not found");
    if (data.categoryId) await ensureCategory(tx, userId, data.categoryId);

    const nextAccountId = data.accountId !== undefined ? data.accountId : old.accountId;
    const nextCardId = data.creditCardId !== undefined ? data.creditCardId : old.creditCardId;
    if (Boolean(nextAccountId) === Boolean(nextCardId)) {
      throw BadRequest("Expense must target exactly one of account or credit card");
    }

    const nextCompra = data.dataCompra ?? toISO(old.dataCompra);
    let nextVenc: Date | null = old.dataVencimento;
    if (nextCardId) {
      const card = await getActiveCard(tx, userId, nextCardId);
      nextVenc = new Date(calcCardDueDate(card.diaFechamento, card.diaVencimento, nextCompra));
    } else {
      if (nextAccountId) await ensureAccount(tx, userId, nextAccountId);
      nextVenc = null;
    }

    // Reverse old effect on the OLD account.
    if (old.accountId) await applyAccountDelta(tx, userId, old.accountId, -expenseEffect(old));

    const updated = await tx.expense.update({
      where: { id },
      data: {
        descricao: data.descricao ?? old.descricao,
        categoryId: data.categoryId ?? old.categoryId,
        accountId: nextAccountId ?? null,
        creditCardId: nextCardId ?? null,
        dataCompra: new Date(nextCompra),
        dataVencimento: nextVenc,
        valor: data.valor ?? old.valor,
        observacoes: data.observacoes === undefined ? old.observacoes : data.observacoes,
        paga: data.paga ?? old.paga,
      },
    });
    if (updated.accountId) await applyAccountDelta(tx, userId, updated.accountId, expenseEffect(updated));
    return updated;
  });
}

export function toggleExpensePaid(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.expense.findFirst({ where: { id, userId } });
    if (!old) throw NotFound("Expense not found");
    const updated = await tx.expense.update({ where: { id }, data: { paga: !old.paga } });
    if (updated.accountId) {
      await applyAccountDelta(tx, userId, updated.accountId, expenseEffect(updated) - expenseEffect(old));
    }
    return updated;
  });
}

export function deleteExpense(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.expense.findFirst({ where: { id, userId } });
    if (!old) throw NotFound("Expense not found");
    if (old.accountId) await applyAccountDelta(tx, userId, old.accountId, -expenseEffect(old));
    // Deleting an expense linked to a fixed expense auto-reverts its "paid" status (derived).
    await tx.expense.delete({ where: { id } });
  });
}

/** Rule 5 — bulk installments. */
export function bulkCreateExpenses(userId: string, data: Bulk) {
  return prisma.$transaction(async (tx) => {
    await ensureCategory(tx, userId, data.categoryId);
    const groupId = crypto.randomUUID();
    const amounts = splitInstallments(data.valorTotal, data.parcelas, data.dividir);
    const n = data.parcelas;

    let card = null as Awaited<ReturnType<typeof getActiveCard>> | null;
    let venc0: string | null = null;
    if (data.creditCardId) {
      card = await getActiveCard(tx, userId, data.creditCardId);
      venc0 = calcCardDueDate(card.diaFechamento, card.diaVencimento, data.dataCompra);
    } else if (data.accountId) {
      await ensureAccount(tx, userId, data.accountId);
    }

    const rows = amounts.map((valor, i) => {
      const suffix = n > 1 ? ` (${i + 1}/${n})` : "";
      // Card: same purchase date, due date +i months. Cash/account: purchase date +i months.
      const dataCompra = card ? data.dataCompra : shiftDateMonths(data.dataCompra, i);
      const dataVencimento = card && venc0 ? shiftDateMonths(venc0, i) : null;
      return {
        userId,
        descricao: data.descricao + suffix,
        categoryId: data.categoryId,
        accountId: data.accountId ?? null,
        creditCardId: data.creditCardId ?? null,
        dataCompra: new Date(dataCompra),
        dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
        valor,
        observacoes: data.observacoes ?? null,
        paga: false,
        installmentGroupId: groupId,
        installmentN: i + 1,
        installmentTotal: n,
      };
    });
    await tx.expense.createMany({ data: rows });
    // Installments start unpaid → no balance effect yet.
    return prisma.expense.findMany({ where: { userId, installmentGroupId: groupId }, orderBy: { installmentN: "asc" } });
  });
}

/** Rule 4 — pay a card invoice: mark all open card expenses in the competência paid,
 *  and debit the total from a chosen account, in a single transaction. */
export function payInvoice(userId: string, cardId: string, input: PayInvoice) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.creditCard.findFirst({ where: { id: cardId, userId } });
    if (!card) throw NotFound("Credit card not found");
    const account = await tx.account.findFirst({ where: { id: input.accountId, userId }, select: { id: true } });
    if (!account) throw NotFound("Account not found");

    const { start, endExclusive } = competenciaRange(parseCompetencia(input.month));
    const open = await tx.expense.findMany({
      where: {
        userId, creditCardId: cardId, paga: false,
        dataVencimento: { gte: new Date(start), lt: new Date(endExclusive) },
      },
    });
    if (open.length === 0) throw Conflict("No open invoice for this card in the given competência");

    const total = open.reduce((s, e) => s + e.valor, 0);
    await tx.expense.updateMany({
      where: { id: { in: open.map((e) => e.id) } },
      data: { paga: true },
    });
    await applyAccountDelta(tx, userId, input.accountId, -total);
    return { cardId, month: input.month, accountId: input.accountId, total, paidCount: open.length };
  });
}
