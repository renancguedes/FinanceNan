import type { Tx } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";

/** Atomically apply a signed cents delta to an account owned by the user. */
export async function applyAccountDelta(
  tx: Tx, userId: string, accountId: string, deltaCents: number,
): Promise<void> {
  if (deltaCents === 0) return;
  const acc = await tx.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
  if (!acc) throw NotFound(`Account ${accountId} not found`);
  await tx.account.update({ where: { id: accountId }, data: { saldo: { increment: deltaCents } } });
}

/** Effect of an income on its account balance. */
export function incomeEffect(i: { recebida: boolean; valor: number }): number {
  return i.recebida ? i.valor : 0;
}

/** Effect of an expense on its account balance (card expenses have no accountId → 0 here). */
export function expenseEffect(e: { paga: boolean; accountId: string | null; valor: number }): number {
  return e.paga && e.accountId ? -e.valor : 0;
}
