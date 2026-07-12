import { prisma } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";
import type { z } from "zod";
import type { planCategoryCreateSchema, planCategoryUpdateSchema } from "../schemas/index.js";

type Create = z.infer<typeof planCategoryCreateSchema>;
type Update = z.infer<typeof planCategoryUpdateSchema>;

export const listPlanCategories = (userId: string) =>
  prisma.planCategory.findMany({ where: { userId }, orderBy: { nome: "asc" }, include: { items: true } });

export async function getPlanCategory(userId: string, id: string) {
  const c = await prisma.planCategory.findFirst({ where: { id, userId }, include: { items: true } });
  if (!c) throw NotFound("Plan category not found");
  return c;
}

export const createPlanCategory = (userId: string, data: Create) =>
  prisma.planCategory.create({ data: { ...data, userId } });

export async function updatePlanCategory(userId: string, id: string, data: Update) {
  await getPlanCategory(userId, id);
  return prisma.planCategory.update({ where: { id }, data });
}

export async function deletePlanCategory(userId: string, id: string) {
  await getPlanCategory(userId, id);
  await prisma.planCategory.delete({ where: { id } });
}
