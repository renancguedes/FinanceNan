import type { FastifyPluginAsync } from "fastify";
import { parse } from "../lib/validate.js";
import { incomeCreateSchema, incomeUpdateSchema, monthParam } from "../schemas/index.js";
import * as incomes from "../services/incomes.service.js";

export const incomeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/incomes", async (req) => {
    const q = req.query as { month?: string };
    const month = q.month ? monthParam.parse(q.month) : undefined;
    return incomes.listIncomes(req.userId, month);
  });
  app.get("/incomes/:id", async (req) => incomes.getIncome(req.userId, (req.params as { id: string }).id));
  app.post("/incomes", async (req, reply) => {
    const data = parse(incomeCreateSchema, req.body);
    return reply.code(201).send(await incomes.createIncome(req.userId, data));
  });
  app.patch("/incomes/:id", async (req) => {
    const data = parse(incomeUpdateSchema, req.body);
    return incomes.updateIncome(req.userId, (req.params as { id: string }).id, data);
  });
  app.post("/incomes/:id/toggle-received", async (req) =>
    incomes.toggleIncomeReceived(req.userId, (req.params as { id: string }).id));
  app.delete("/incomes/:id", async (req, reply) => {
    await incomes.deleteIncome(req.userId, (req.params as { id: string }).id);
    return reply.code(204).send();
  });
};
