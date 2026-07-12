import { prisma } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";
import type { z } from "zod";
import type { planItemCreateSchema, planItemUpdateSchema } from "../schemas/index.js";

type Create = z.infer<typeof planItemCreateSchema>;
type Update = z.infer<typeof planItemUpdateSchema>;

async function ensurePlanCategory(userId: string, planCategoryId: string) {
  const c = await prisma.planCategory.findFirst({ where: { id: planCategoryId, userId }, select: { id: true } });
  if (!c) throw NotFound("Plan category not found");
}

export const listPlanItems = (userId: string, planCategoryId?: string) =>
  prisma.planItem.findMany({
    where: { userId, ...(planCategoryId ? { planCategoryId } : {}) },
    orderBy: { nome: "asc" },
  });

export async function getPlanItem(userId: string, id: string) {
  const it = await prisma.planItem.findFirst({ where: { id, userId } });
  if (!it) throw NotFound("Plan item not found");
  return it;
}

export async function createPlanItem(userId: string, data: Create) {
  await ensurePlanCategory(userId, data.planCategoryId);
  return prisma.planItem.create({ data: { ...data, userId } });
}

export async function updatePlanItem(userId: string, id: string, data: Update) {
  await getPlanItem(userId, id);
  if (data.planCategoryId) await ensurePlanCategory(userId, data.planCategoryId);
  return prisma.planItem.update({ where: { id }, data });
}

export async function deletePlanItem(userId: string, id: string) {
  await getPlanItem(userId, id);
  await prisma.planItem.delete({ where: { id } });
}
