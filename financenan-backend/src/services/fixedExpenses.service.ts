import { prisma } from "../db/prisma.js";
import type { Tx } from "../db/prisma.js";
import { BadRequest, Conflict, NotFound } from "../lib/errors.js";
import { applyAccountDelta } from "./balance.js";
import { competenciaRange, parseCompetencia } from "../domain/dates.js";
import type { z } from "zod";
import type { fixedExpenseCreateSchema, fixedExpenseUpdateSchema, payFixedSchema } from "../schemas/index.js";

type Create = z.infer<typeof fixedExpenseCreateSchema>;
type Update = z.infer<typeof fixedExpenseUpdateSchema>;
type Pay = z.infer<typeof payFixedSchema>;

async function ensureCategory(tx: Tx, userId: string, id: string) {
  const c = await tx.category.findFirst({ where: { id, userId }, select: { id: true } });
  if (!c) throw NotFound("Category not found");
}
async function ensureAccount(tx: Tx, userId: string, id: string) {
  const a = await tx.account.findFirst({ where: { id, userId }, select: { id: true } });
  if (!a) throw NotFound("Account not found");
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** List fixed expenses; when `month` is given, attach the DERIVED paid status:
 *  paid in competência X iff an expense with fixedExpenseId points here within X. */
export async function listFixedExpenses(userId: string, month?: string) {
  const fixed = await prisma.fixedExpense.findMany({ where: { userId }, orderBy: { diaVencimento: "asc" } });
  if (!month) return fixed.map((f) => ({ ...f, pagoNaCompetencia: null, expenseId: null as string | null }));

  const { start, endExclusive } = competenciaRange(parseCompetencia(month));
  const paidExpenses = await prisma.expense.findMany({
    where: {
      userId,
      fixedExpenseId: { in: fixed.map((f) => f.id) },
      dataCompra: { gte: new Date(start), lt: new Date(endExclusive) },
    },
    select: { id: true, fixedExpenseId: true },
  });
  const paidMap = new Map(paidExpenses.map((e) => [e.fixedExpenseId as string, e.id]));
  return fixed.map((f) => ({
    ...f,
    pagoNaCompetencia: paidMap.has(f.id),
    expenseId: paidMap.get(f.id) ?? null,
  }));
}

export async function getFixedExpense(userId: string, id: string) {
  const f = await prisma.fixedExpense.findFirst({ where: { id, userId } });
  if (!f) throw NotFound("Fixed expense not found");
  return f;
}

export function createFixedExpense(userId: string, data: Create) {
  return prisma.$transaction(async (tx) => {
    await ensureCategory(tx, userId, data.categoryId);
    if (data.contaPadraoId) await ensureAccount(tx, userId, data.contaPadraoId);
    return tx.fixedExpense.create({
      data: {
        userId,
        descricao: data.descricao,
        categoryId: data.categoryId,
        valor: data.valor,
        diaVencimento: data.diaVencimento,
        contaPadraoId: data.contaPadraoId ?? null,
        observacoes: data.observacoes ?? null,
        ativo: data.ativo,
      },
    });
  });
}

export function updateFixedExpense(userId: string, id: string, data: Update) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.fixedExpense.findFirst({ where: { id, userId } });
    if (!old) throw NotFound("Fixed expense not found");
    if (data.categoryId) await ensureCategory(tx, userId, data.categoryId);
    if (data.contaPadraoId) await ensureAccount(tx, userId, data.contaPadraoId);
    return tx.fixedExpense.update({
      where: { id },
      data: {
        descricao: data.descricao ?? old.descricao,
        categoryId: data.categoryId ?? old.categoryId,
        valor: data.valor ?? old.valor,
        diaVencimento: data.diaVencimento ?? old.diaVencimento,
        contaPadraoId: data.contaPadraoId === undefined ? old.contaPadraoId : data.contaPadraoId,
        observacoes: data.observacoes === undefined ? old.observacoes : data.observacoes,
        ativo: data.ativo ?? old.ativo,
      },
    });
  });
}

export async function deleteFixedExpense(userId: string, id: string) {
  await getFixedExpense(userId, id);
  await prisma.fixedExpense.delete({ where: { id } });
}

/** Rule 2 — pay a fixed expense: create a paid expense in the competência using the
 *  default (or overridden) account and debit its balance, in one transaction.
 *  Deleting that expense makes the fixed expense return to "open" automatically. */
export function payFixedExpense(userId: string, id: string, input: Pay) {
  return prisma.$transaction(async (tx) => {
    const fixed = await tx.fixedExpense.findFirst({ where: { id, userId } });
    if (!fixed) throw NotFound("Fixed expense not found");

    const month = input.month ?? currentMonth();
    const accountId = input.accountId ?? fixed.contaPadraoId;
    if (!accountId) throw BadRequest("No account: provide accountId or set a default account (contaPadrao)");
    await ensureAccount(tx, userId, accountId);

    const { start, endExclusive } = competenciaRange(parseCompetencia(month));
    const already = await tx.expense.findFirst({
      where: { userId, fixedExpenseId: id, dataCompra: { gte: new Date(start), lt: new Date(endExclusive) } },
      select: { id: true },
    });
    if (already) throw Conflict("Fixed expense already paid in this competência");

    const day = Math.min(fixed.diaVencimento, 28);
    const dataCompra = input.data ?? `${month}-${String(day).padStart(2, "0")}`;

    const expense = await tx.expense.create({
      data: {
        userId,
        descricao: fixed.descricao,
        categoryId: fixed.categoryId,
        accountId,
        creditCardId: null,
        dataCompra: new Date(dataCompra),
        dataVencimento: null,
        valor: fixed.valor,
        observacoes: fixed.observacoes,
        paga: true,
        fixedExpenseId: fixed.id,
      },
    });
    await applyAccountDelta(tx, userId, accountId, -fixed.valor);
    return expense;
  });
}

export async function activeFixedExpenseValues(userId: string): Promise<number[]> {
  const rows = await prisma.fixedExpense.findMany({ where: { userId, ativo: true }, select: { valor: true } });
  return rows.map((r) => r.valor);
}
