import type { FastifyPluginAsync } from "fastify";
import { parse } from "../lib/validate.js";
import { registerSchema, loginSchema, refreshSchema, forgotSchema, updateMeSchema } from "../schemas/index.js";
import * as auth from "../services/auth.service.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (req, reply) => {
    const data = parse(registerSchema, req.body);
    const result = await auth.register(data);
    return reply.code(201).send(result);
  });

  app.post("/auth/login", async (req) => {
    const { email, password } = parse(loginSchema, req.body);
    return auth.login(email, password);
  });

  app.post("/auth/refresh", async (req) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    return auth.refresh(refreshToken);
  });

  app.post("/auth/forgot-password", async (req) => {
    const { email } = parse(forgotSchema, req.body);
    return auth.forgotPassword(email);
  });
};

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/me", async (req) => auth.getMe(req.userId));

  app.patch("/me", async (req) => {
    const data = parse(updateMeSchema, req.body);
    return auth.updateMe(req.userId, data);
  });
};
