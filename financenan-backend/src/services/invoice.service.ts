import { prisma } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";
import { competenciaRange, parseCompetencia } from "../domain/dates.js";

/** GET credit-card invoice for a competência (grouped by dataVencimento). */
export async function getInvoice(userId: string, cardId: string, month: string) {
  const card = await prisma.creditCard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw NotFound("Credit card not found");

  const { start, endExclusive } = competenciaRange(parseCompetencia(month));
  const items = await prisma.expense.findMany({
    where: { userId, creditCardId: cardId, dataVencimento: { gte: new Date(start), lt: new Date(endExclusive) } },
    orderBy: { dataCompra: "asc" },
  });

  const fatura = items.reduce((s, e) => s + e.valor, 0);
  const pago = items.filter((e) => e.paga).reduce((s, e) => s + e.valor, 0);
  const aberto = fatura - pago;

  // Everything still unpaid on this card across all months (future invoices included).
  const comprometidoAgg = await prisma.expense.aggregate({
    where: { userId, creditCardId: cardId, paga: false },
    _sum: { valor: true },
  });

  return {
    card: { id: card.id, nome: card.nome, bandeira: card.bandeira, diaFechamento: card.diaFechamento, diaVencimento: card.diaVencimento },
    month,
    fatura, pago, aberto,
    comprometido: comprometidoAgg._sum.valor ?? 0,
    items,
  };
}
