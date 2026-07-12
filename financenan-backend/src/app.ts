import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { authPlugin } from "./auth/auth.plugin.js";
import { swaggerPlugin } from "./docs/swagger.plugin.js";
import { authRoutes, meRoutes } from "./routes/auth.routes.js";
import {
  accountRoutes, categoryRoutes, incomeSourceRoutes,
  planCategoryRoutes, planItemRoutes, creditCardRoutes,
} from "./routes/simple.routes.js";
import { incomeRoutes } from "./routes/incomes.routes.js";
import { expenseRoutes } from "./routes/expenses.routes.js";
import { fixedExpenseRoutes } from "./routes/fixedExpenses.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
  });
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(accountRoutes);
  await app.register(creditCardRoutes);
  await app.register(categoryRoutes);
  await app.register(incomeSourceRoutes);
  await app.register(planCategoryRoutes);
  await app.register(planItemRoutes);
  await app.register(fixedExpenseRoutes);
  await app.register(incomeRoutes);
  await app.register(expenseRoutes);
  await app.register(dashboardRoutes);

  app.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number }, req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    if (error instanceof ZodError) {
      return reply.code(422).send({ error: { code: "UNPROCESSABLE", message: "Validation failed", details: error.flatten() } });
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: error.message } });
    }
    req.log.error(error);
    return reply.code(500).send({ error: { code: "INTERNAL", message: "Internal server error" } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  return app;
}
