import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeAny, output } from "zod";
import { parse } from "../lib/validate.js";

interface CrudService<CS extends ZodTypeAny, US extends ZodTypeAny> {
  list: (userId: string) => Promise<unknown>;
  get: (userId: string, id: string) => Promise<unknown>;
  create: (userId: string, data: output<CS>) => Promise<unknown>;
  update: (userId: string, id: string, data: output<US>) => Promise<unknown>;
  remove: (userId: string, id: string) => Promise<unknown>;
}

export function crudRoutes<CS extends ZodTypeAny, US extends ZodTypeAny>(
  prefix: string,
  createSchema: CS,
  updateSchema: US,
  service: CrudService<CS, US>,
): FastifyPluginAsync {
  return async (app) => {
    app.addHook("preHandler", app.authenticate);

    app.get(prefix, async (req) => service.list(req.userId));
    app.get(`${prefix}/:id`, async (req) => service.get(req.userId, (req.params as { id: string }).id));
    app.post(prefix, async (req, reply) => {
      const data = parse(createSchema, req.body);
      return reply.code(201).send(await service.create(req.userId, data));
    });
    app.patch(`${prefix}/:id`, async (req) => {
      const data = parse(updateSchema, req.body);
      return service.update(req.userId, (req.params as { id: string }).id, data);
    });
    app.delete(`${prefix}/:id`, async (req, reply) => {
      await service.remove(req.userId, (req.params as { id: string }).id);
      return reply.code(204).send();
    });
  };
}
