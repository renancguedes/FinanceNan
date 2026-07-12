import { prisma } from "../db/prisma.js";
import { NotFound } from "../lib/errors.js";
import type { z } from "zod";
import type { accountCreateSchema, accountUpdateSchema } from "../schemas/index.js";

type Create = z.infer<typeof accountCreateSchema>;
type Update = z.infer<typeof accountUpdateSchema>;

export const listAccounts = (userId: string) =>
  prisma.account.findMany({ where: { userId }, orderBy: { nome: "asc" } });

export async function getAccount(userId: string, id: string) {
  const acc = await prisma.account.findFirst({ where: { id, userId } });
  if (!acc) throw NotFound("Account not found");
  return acc;
}

export const createAccount = (userId: string, data: Create) =>
  prisma.account.create({ data: { ...data, userId } });

export async function updateAccount(userId: string, id: string, data: Update) {
  await getAccount(userId, id);
  return prisma.account.update({ where: { id }, data });
}

export async function deleteAccount(userId: string, id: string) {
  await getAccount(userId, id);
  await prisma.account.delete({ where: { id } });
}
