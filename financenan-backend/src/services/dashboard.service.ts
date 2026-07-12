import { prisma } from "../db/prisma.js";
import { getSettings } from "./settings.service.js";
import { computePatrimonio, computeReserve } from "../domain/finance.js";
import {
  competenciaKey, competenciaRange, parseCompetencia, shiftCompetencia, type Competencia,
} from "../domain/dates.js";

function range(c: Competencia) {
  const { start, endExclusive } = competenciaRange(c);
  return { gte: new Date(start), lt: new Date(endExclusive) };
}

async function sumIncomes(userId: string, c: Competencia): Promise<number> {
  const agg = await prisma.income.aggregate({ where: { userId, data: range(c) }, _sum: { valor: true } });
  return agg._sum.valor ?? 0;
}

async function sumExpenses(userId: string, c: Competencia): Promise<number> {
  // Rule 6: card expenses by dataVencimento, others by dataCompra.
  const r = range(c);
  const agg = await prisma.expense.aggregate({
    where: {
      userId,
      OR: [
        { creditCardId: { not: null }, dataVencimento: r },
        { creditCardId: null, dataCompra: r },
      ],
    },
    _sum: { valor: true },
  });
  return agg._sum.valor ?? 0;
}

export async function getDashboard(userId: string, month?: string) {
  const comp = month ? parseCompetencia(month) : (() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  })();

  const [accounts, settings, fixedActive] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    getSettings(userId),
    prisma.fixedExpense.findMany({ where: { userId, ativo: true }, select: { valor: true } }),
  ]);

  const accViews = accounts.map((a) => ({ id: a.id, tipo: a.tipo, saldo: a.saldo, ativo: a.ativo }));
  const patrimonio = computePatrimonio(accViews, settings.patrimonioExcludedAccountIds);
  const custoFixo = fixedActive.reduce((s, f) => s + f.valor, 0);
  const reserva = computeReserve(fixedActive.map((f) => f.valor), settings.reservaMeses, accViews, settings.reservaAccountIds);

  const r = range(comp);
  const openExpenses = await prisma.expense.findMany({
    where: {
      userId, paga: false,
      OR: [
        { creditCardId: { not: null }, dataVencimento: r },
        { creditCardId: null, dataCompra: r },
      ],
    },
  });
  const aPagar = openExpenses.reduce((s, e) => s + e.valor, 0);

  // Next-month forecast: active fixed + already-scheduled unpaid non-fixed expenses next month.
  const next = shiftCompetencia(comp, 1);
  const nr = range(next);
  const nextExpenses = await prisma.expense.findMany({
    where: {
      userId, paga: false, fixedExpenseId: null,
      OR: [
        { creditCardId: { not: null }, dataVencimento: nr },
        { creditCardId: null, dataCompra: nr },
      ],
    },
    select: { valor: true },
  });
  const previsaoProximoMes = custoFixo + nextExpenses.reduce((s, e) => s + e.valor, 0);

  // 6-month cash flow ending at the selected competência.
  const fluxoCaixa: { month: string; receitas: number; despesas: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const c = shiftCompetencia(comp, -i);
    const [receitas, despesas] = await Promise.all([sumIncomes(userId, c), sumExpenses(userId, c)]);
    fluxoCaixa.push({ month: competenciaKey(c), receitas, despesas });
  }

  // Recent transactions of the competência (incomes + expenses), newest first.
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { userId, data: r }, orderBy: { data: "desc" } }),
    prisma.expense.findMany({
      where: {
        userId,
        OR: [
          { creditCardId: { not: null }, dataVencimento: r },
          { creditCardId: null, dataCompra: r },
        ],
      },
    }),
  ]);
  const lancamentos = [
    ...incomes.map((i) => ({ id: i.id, tipo: "receita" as const, descricao: i.descricao, valor: i.valor, data: i.data, paga: i.recebida })),
    ...expenses.map((e) => ({
      id: e.id, tipo: "despesa" as const, descricao: e.descricao, valor: -e.valor,
      data: e.creditCardId && e.dataVencimento ? e.dataVencimento : e.dataCompra, paga: e.paga,
    })),
  ].sort((a, b) => b.data.getTime() - a.data.getTime()).slice(0, 10);

  return {
    month: competenciaKey(comp),
    patrimonio,
    contasAtivas: accViews.filter((a) => a.ativo).length,
    aPagar,
    aPagarCount: openExpenses.length,
    previsaoProximoMes,
    custoFixo,
    reserva: {
      meses: settings.reservaMeses,
      meta: reserva.target,
      atual: reserva.current,
      percentual: reserva.pct,
    },
    fluxoCaixa,
    lancamentos,
  };
}
