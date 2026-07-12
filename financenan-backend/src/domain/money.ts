// All monetary values are integer cents (centavos). Never float.

/** Split a total (in cents) into `n` installments.
 *  If `divide` is true, distribute the total; the remainder cents go to the LAST installment.
 *  If false, every installment equals the full total (repeat mode). */
export function splitInstallments(totalCents: number, n: number, divide: boolean): number[] {
  if (!Number.isInteger(totalCents)) throw new Error("totalCents must be integer");
  if (n < 1) throw new Error("n must be >= 1");
  if (!divide) return Array.from({ length: n }, () => totalCents);
  const base = Math.floor(totalCents / n);
  const parts: number[] = [];
  for (let i = 0; i < n; i++) {
    // Last installment absorbs the rounding remainder so cents are never lost.
    parts.push(i === n - 1 ? totalCents - base * (n - 1) : base);
  }
  return parts;
}

/** Format cents to "R$ x.yz" for display/logging only. */
export function centsToBRL(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}R$ ${(abs / 100).toFixed(2)}`;
}
