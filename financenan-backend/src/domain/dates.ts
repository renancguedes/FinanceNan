// Pure date/competência helpers. Dates are handled as "YYYY-MM-DD" strings.

export interface Competencia {
  year: number;
  month: number; // 1-12
}

const RE_YM = /^(\d{4})-(\d{2})$/;
const RE_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCompetencia(ym: string): Competencia {
  const m = RE_YM.exec(ym);
  if (!m) throw new Error(`Invalid competência (expected YYYY-MM): ${ym}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function competenciaKey(c: Competencia): string {
  return `${c.year}-${String(c.month).padStart(2, "0")}`;
}

/** Month key (YYYY-MM) of a YYYY-MM-DD date string. */
export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function shiftCompetencia(c: Competencia, months: number): Competencia {
  const zero = c.year * 12 + (c.month - 1) + months;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

/** First and last day (YYYY-MM-DD) of a competência — used for DB range queries. */
export function competenciaRange(c: Competencia): { start: string; endExclusive: string } {
  const start = `${competenciaKey(c)}-01`;
  const next = shiftCompetencia(c, 1);
  const endExclusive = `${competenciaKey(next)}-01`;
  return { start, endExclusive };
}

/** Add `months` to a YYYY-MM-DD, clamping the day to 28 (matches card-invoice rules). */
export function shiftDateMonths(dateStr: string, months: number): string {
  const m = RE_YMD.exec(dateStr);
  if (!m) throw new Error(`Invalid date (expected YYYY-MM-DD): ${dateStr}`);
  let year = Number(m[1]);
  let month = Number(m[2]) + months;
  const day = Math.min(Number(m[3]), 28);
  year += Math.floor((month - 1) / 12);
  month = ((month - 1) % 12 + 12) % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Credit-card invoice due date (Rule 3).
 * - Purchase day > closing day  => belongs to the NEXT invoice (month + 1).
 * - If due day <= closing day    => the due date falls in the month AFTER closing.
 * Day is capped at 28 for safety.
 */
export function calcCardDueDate(
  diaFechamento: number,
  diaVencimento: number,
  dataCompra: string,
): string {
  const m = RE_YMD.exec(dataCompra);
  if (!m) throw new Error(`Invalid dataCompra: ${dataCompra}`);
  let year = Number(m[1]);
  let month = Number(m[2]);
  const day = Number(m[3]);

  if (day > diaFechamento) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  if (diaVencimento <= diaFechamento) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  const dueDay = Math.min(diaVencimento, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
}
