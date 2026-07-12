import { prisma } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";
import type { z } from "zod";
import type { creditCardCreateSchema, creditCardUpdateSchema } from "../schemas/index.js";

type Create = z.infer<typeof creditCardCreateSchema>;
type Update = z.infer<typeof creditCardUpdateSchema>;

export const listCreditCards = (userId: string) =>
  prisma.creditCard.findMany({ where: { userId }, orderBy: { nome: "asc" } });

export async function getCreditCard(userId: string, id: string) {
  const card = await prisma.creditCard.findFirst({ where: { id, userId } });
  if (!card) throw NotFound("Credit card not found");
  return card;
}

export const createCreditCard = (userId: string, data: Create) =>
  prisma.creditCard.create({ data: { ...data, userId } });

export async function updateCreditCard(userId: string, id: string, data: Update) {
  await getCreditCard(userId, id);
  return prisma.creditCard.update({ where: { id }, data });
}

export async function deleteCreditCard(userId: string, id: string) {
  await getCreditCard(userId, id);
  await prisma.creditCard.delete({ where: { id } });
}
