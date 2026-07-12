import { prisma } from "../db/prisma.js";
import type { z } from "zod";
import type { settingsUpdateSchema } from "../schemas/index.js";

type Update = z.infer<typeof settingsUpdateSchema>;

export async function getSettings(userId: string) {
  return prisma.settings.upsert({
    where: { userId },
    create: { userId, reservaMeses: 6, reservaAccountIds: [], patrimonioExcludedAccountIds: [] },
    update: {},
  });
}

export async function updateSettings(userId: string, data: Update) {
  await getSettings(userId);
  return prisma.settings.update({ where: { userId }, data });
}
