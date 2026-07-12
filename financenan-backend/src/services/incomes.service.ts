import { prisma } from "../db/prisma.js";
import type { Tx } from "../db/prisma.js";
import { BadRequest, NotFound } from "../lib/errors.js";
import { applyAccountDelta, incomeEffect } from "./balance.js";
import { competenciaRange, parseCompetencia } from "../domain/dates.js";
import type { z } from "zod";
import type { incomeCreateSchema, incomeUpdateSchema } from "../schemas/index.js";

type Create = z.infer<typeof incomeCreateSchema>;
type Update = z.infer<typeof incomeUpdateSchema>;

async function ensureCategory(tx: Tx, userId: string, id: string) {
  const c = await tx.category.findFirst({ where: { id, userId }, select: { id: true } });
  if (!c) throw NotFound("Category not found");
}
async function ensureAccount(tx: Tx, userId: string, id: string) {
  const a = await tx.account.findFirst({ where: { id, userId }, select: { id: true } });
  if (!a) throw NotFound("Account not found");
}

export function listIncomes(userId: string, month?: string) {
  const where: Record<string, unknown> = { userId };
  if (month) {
    const { start, endExclusive } = competenciaRange(parseCompetencia(month));
    where["data"] = { gte: new Date(start), lt: new Date(endExclusive) };
  }
  return prisma.income.findMany({ where, orderBy: { data: "desc" } });
}

export async function getIncome(userId: string, id: string) {
  const i = await prisma.income.findFirst({ where: { id, userId } });
  if (!i) throw NotFound("Income not found");
  return i;
}

export function createIncome(userId: string, data: Create) {
  return prisma.$transaction(async (tx) => {
    await ensureCategory(tx, userId, data.categoryId);
    await ensureAccount(tx, userId, data.accountId);
    const income = await tx.income.create({
      data: {
        userId,
        descricao: data.descricao,
        categoryId: data.categoryId,
        accountId: data.accountId,
        data: new Date(data.data),
        valor: data.valor,
        observacoes: data.observacoes ?? null,
        recorrente: data.recorrente,
        recebida: data.recebida,
      },
    });
    // Rule 1: received income credits the destination account.
    await applyAccountDelta(tx, userId, income.accountId, incomeEffect(income));
    return income;
  });
}

export function updateIncome(userId: string, id: string, data: Update) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.income.findFirst({ where: { id, userId } });
    if (!old) throw NotFound("Income not found");
    if (data.categoryId) await ensureCategory(tx, userId, data.categoryId);
    if (data.accountId) await ensureAccount(tx, userId, data.accountId);

    // Reverse old effect on the OLD account.
    await applyAccountDelta(tx, userId, old.accountId, -incomeEffect(old));

    const updated = await tx.income.update({
      where: { id },
      data: {
        descricao: data.descricao ?? old.descricao,
        categoryId: data.categoryId ?? old.categoryId,
        accountId: data.accountId ?? old.accountId,
        data: data.data ? new Date(data.data) : old.data,
        valor: data.valor ?? old.valor,
        observacoes: data.observacoes === undefined ? old.observacoes : data.observacoes,
        recorrente: data.recorrente ?? old.recorrente,
        recebida: data.recebida ?? old.recebida,
      },
    });
    // Apply new effect on the NEW account.
    await applyAccountDelta(tx, userId, updated.accountId, incomeEffect(updated));
    return updated;
  });
}

export function toggleIncomeReceived(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.income.findFirst({ where: { id, userId } });
    if (!old) throw NotFound("Income not found");
    const updated = await tx.income.update({ where: { id }, data: { recebida: !old.recebida } });
    const delta = incomeEffect(updated) - incomeEffect(old);
    await applyAccountDelta(tx, userId, updated.accountId, delta);
    return updated;
  });
}

export function deleteIncome(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.income.findFirst({ where: { id, userId } });
    if (!old) throw NotFound("Income not found");
    await applyAccountDelta(tx, userId, old.accountId, -incomeEffect(old));
    await tx.income.delete({ where: { id } });
  });
}
