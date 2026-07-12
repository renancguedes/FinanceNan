import { prisma } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";
import type { z } from "zod";
import type { categoryCreateSchema, categoryUpdateSchema } from "../schemas/index.js";

type Create = z.infer<typeof categoryCreateSchema>;
type Update = z.infer<typeof categoryUpdateSchema>;

export const listCategories = (userId: string) =>
  prisma.category.findMany({ where: { userId }, orderBy: [{ tipo: "asc" }, { nome: "asc" }] });

export async function getCategory(userId: string, id: string) {
  const c = await prisma.category.findFirst({ where: { id, userId } });
  if (!c) throw NotFound("Category not found");
  return c;
}

export const createCategory = (userId: string, data: Create) =>
  prisma.category.create({ data: { ...data, userId } });

export async function updateCategory(userId: string, id: string, data: Update) {
  await getCategory(userId, id);
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(userId: string, id: string) {
  await getCategory(userId, id);
  await prisma.category.delete({ where: { id } });
}
