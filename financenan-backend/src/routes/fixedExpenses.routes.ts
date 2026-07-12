import type { FastifyPluginAsync } from "fastify";
import { parse } from "../lib/validate.js";
import { fixedExpenseCreateSchema, fixedExpenseUpdateSchema, payFixedSchema, monthParam } from "../schemas/index.js";
import * as fixed from "../services/fixedExpenses.service.js";

export const fixedExpenseRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/fixed-expenses", async (req) => {
    const q = req.query as { month?: string };
    const month = q.month ? monthParam.parse(q.month) : undefined;
    return fixed.listFixedExpenses(req.userId, month);
  });
  app.get("/fixed-expenses/:id", async (req) => fixed.getFixedExpense(req.userId, (req.params as { id: string }).id));
  app.post("/fixed-expenses", async (req, reply) => {
    const data = parse(fixedExpenseCreateSchema, req.body);
    return reply.code(201).send(await fixed.createFixedExpense(req.userId, data));
  });
  app.patch("/fixed-expenses/:id", async (req) => {
    const data = parse(fixedExpenseUpdateSchema, req.body);
    return fixed.updateFixedExpense(req.userId, (req.params as { id: string }).id, data);
  });
  app.post("/fixed-expenses/:id/pay", async (req, reply) => {
    const data = parse(payFixedSchema, req.body ?? {});
    return reply.code(201).send(await fixed.payFixedExpense(req.userId, (req.params as { id: string }).id, data));
  });
  app.delete("/fixed-expenses/:id", async (req, reply) => {
    await fixed.deleteFixedExpense(req.userId, (req.params as { id: string }).id);
    return reply.code(204).send();
  });
};
