// Pure finance aggregations (net worth, reserve). All values in cents.
import type { AccountType } from "@prisma/client";

export interface AccountView {
  id: string;
  tipo: AccountType;
  saldo: number;
  ativo: boolean;
}

/** Rule 8 — Patrimônio: sum of active accounts, excluding investment accounts
 *  listed in patrimonioExcludedAccountIds. */
export function computePatrimonio(accounts: AccountView[], excludedIds: string[]): number {
  const excl = new Set(excludedIds);
  return accounts
    .filter((a) => a.ativo && !(a.tipo === "investimento" && excl.has(a.id)))
    .reduce((sum, a) => sum + a.saldo, 0);
}

/** Rule 7 — Emergency reserve.
 *  target  = sum of active fixed-expense values * reservaMeses
 *  current = sum of balances of accounts flagged in reservaAccountIds */
export function computeReserve(
  activeFixedExpenseValues: number[],
  reservaMeses: number,
  accounts: AccountView[],
  reservaAccountIds: string[],
): { target: number; current: number; pct: number } {
  const monthlyFixed = activeFixedExpenseValues.reduce((s, v) => s + v, 0);
  const target = monthlyFixed * reservaMeses;
  const reserveSet = new Set(reservaAccountIds);
  const current = accounts
    .filter((a) => a.ativo && reserveSet.has(a.id))
    .reduce((s, a) => s + a.saldo, 0);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return { target, current, pct };
}

/** Rule 1 — signed balance delta applied to an account.
 *  A received income (+valor) credits; a paid expense (-valor) debits. */
export function balanceDelta(kind: "income" | "expense", valor: number, effective: boolean): number {
  if (!effective) return 0;
  return kind === "income" ? valor : -valor;
}

/** Rule 4 (pure part) - invoice totals from a set of card expenses in a competência.
 *  `aberto` is exactly what gets debited from the chosen account when paying the invoice. */
export function summarizeInvoice(items: { valor: number; paga: boolean }[]): {
  fatura: number; pago: number; aberto: number;
} {
  const fatura = items.reduce((s, e) => s + e.valor, 0);
  const pago = items.filter((e) => e.paga).reduce((s, e) => s + e.valor, 0);
  return { fatura, pago, aberto: fatura - pago };
}
