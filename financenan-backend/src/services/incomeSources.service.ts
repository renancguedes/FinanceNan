import { prisma } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";
import type { z } from "zod";
import type { incomeSourceCreateSchema, incomeSourceUpdateSchema } from "../schemas/index.js";

type Create = z.infer<typeof incomeSourceCreateSchema>;
type Update = z.infer<typeof incomeSourceUpdateSchema>;

export const listIncomeSources = (userId: string) =>
  prisma.incomeSource.findMany({ where: { userId }, orderBy: { nome: "asc" } });

/** Monthly income = sum of all income sources. */
export async function incomeSourcesTotal(userId: string): Promise<number> {
  const agg = await prisma.incomeSource.aggregate({ where: { userId }, _sum: { valor: true } });
  return agg._sum.valor ?? 0;
}

export async function getIncomeSource(userId: string, id: string) {
  const s = await prisma.incomeSource.findFirst({ where: { id, userId } });
  if (!s) throw NotFound("Income source not found");
  return s;
}

export const createIncomeSource = (userId: string, data: Create) =>
  prisma.incomeSource.create({ data: { ...data, userId } });

export async function updateIncomeSource(userId: string, id: string, data: Update) {
  await getIncomeSource(userId, id);
  return prisma.incomeSource.update({ where: { id }, data });
}

export async function deleteIncomeSource(userId: string, id: string) {
  await getIncomeSource(userId, id);
  await prisma.incomeSource.delete({ where: { id } });
}
