import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccess } from "./tokens.js";
import { Unauthorized } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

/** Decorates `request.userId` and an `authenticate` preHandler that validates the
 *  Bearer access token. Every protected route uses this so queries are user-scoped. */
export const authPlugin = fp(async (app) => {
  app.decorateRequest("userId", "");

  app.decorate("authenticate", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) throw Unauthorized("Missing Bearer token");
    const token = header.slice("Bearer ".length).trim();
    try {
      const claims = verifyAccess(token);
      if (claims.type !== "access") throw new Error("wrong type");
      req.userId = claims.sub;
    } catch {
      throw Unauthorized("Invalid or expired access token");
    }
  });
});
