import type { FastifyPluginAsync } from "fastify";
import { monthParam, settingsUpdateSchema } from "../schemas/index.js";
import { parse } from "../lib/validate.js";
import { getDashboard } from "../services/dashboard.service.js";
import { getSettings, updateSettings } from "../services/settings.service.js";
import { incomeSourcesTotal } from "../services/incomeSources.service.js";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/dashboard", async (req) => {
    const q = req.query as { month?: string };
    const month = q.month ? monthParam.parse(q.month) : undefined;
    return getDashboard(req.userId, month);
  });

  app.get("/settings", async (req) => getSettings(req.userId));
  app.patch("/settings", async (req) => {
    const data = parse(settingsUpdateSchema, req.body);
    return updateSettings(req.userId, data);
  });

  // Convenience: monthly income = sum of income sources.
  app.get("/income-sources-total", async (req) => ({ total: await incomeSourcesTotal(req.userId) }));
};
