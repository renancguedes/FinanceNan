import type { FastifyPluginAsync } from "fastify";
import { parse } from "../lib/validate.js";
import { expenseCreateSchema, expenseUpdateSchema, bulkExpenseSchema, monthParam } from "../schemas/index.js";
import * as expenses from "../services/expenses.service.js";

export const expenseRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/expenses", async (req) => {
    const q = req.query as { month?: string };
    const month = q.month ? monthParam.parse(q.month) : undefined;
    return expenses.listExpenses(req.userId, month);
  });
  app.get("/expenses/:id", async (req) => expenses.getExpense(req.userId, (req.params as { id: string }).id));
  app.post("/expenses", async (req, reply) => {
    const data = parse(expenseCreateSchema, req.body);
    return reply.code(201).send(await expenses.createExpense(req.userId, data));
  });
  app.post("/expenses/bulk", async (req, reply) => {
    const data = parse(bulkExpenseSchema, req.body);
    return reply.code(201).send(await expenses.bulkCreateExpenses(req.userId, data));
  });
  app.patch("/expenses/:id", async (req) => {
    const data = parse(expenseUpdateSchema, req.body);
    return expenses.updateExpense(req.userId, (req.params as { id: string }).id, data);
  });
  app.post("/expenses/:id/toggle-paid", async (req) =>
    expenses.toggleExpensePaid(req.userId, (req.params as { id: string }).id));
  app.delete("/expenses/:id", async (req, reply) => {
    await expenses.deleteExpense(req.userId, (req.params as { id: string }).id);
    return reply.code(204).send();
  });
};
