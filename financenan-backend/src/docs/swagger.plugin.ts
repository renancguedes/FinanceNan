import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { OpenAPIV3 } from "openapi-types";
import { openapiDocument } from "./openapi.js";

/** Serves the OpenAPI document at /openapi.json and Swagger UI at /docs. */
export const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    mode: "static",
    specification: { document: openapiDocument as unknown as OpenAPIV3.Document },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true, persistAuthorization: true },
  });

  // Raw spec for tooling (Postman/Insomnia import, codegen, etc.).
  app.get("/openapi.json", async () => app.swagger());
});
