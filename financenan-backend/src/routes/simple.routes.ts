import type { FastifyPluginAsync } from "fastify";
import { crudRoutes } from "./crud.factory.js";
import { parse } from "../lib/validate.js";
import {
  accountCreateSchema, accountUpdateSchema,
  creditCardCreateSchema, creditCardUpdateSchema,
  categoryCreateSchema, categoryUpdateSchema,
  incomeSourceCreateSchema, incomeSourceUpdateSchema,
  planCategoryCreateSchema, planCategoryUpdateSchema,
  planItemCreateSchema, planItemUpdateSchema,
  payInvoiceSchema, monthParam,
} from "../schemas/index.js";
import * as accounts from "../services/accounts.service.js";
import * as cards from "../services/creditCards.service.js";
import * as categories from "../services/categories.service.js";
import * as sources from "../services/incomeSources.service.js";
import * as planCats from "../services/planCategories.service.js";
import * as planItems from "../services/planItems.service.js";
import { getInvoice } from "../services/invoice.service.js";
import { payInvoice } from "../services/expenses.service.js";

export const accountRoutes = crudRoutes("/accounts", accountCreateSchema, accountUpdateSchema, {
  list: accounts.listAccounts, get: accounts.getAccount, create: accounts.createAccount,
  update: accounts.updateAccount, remove: accounts.deleteAccount,
});

export const categoryRoutes = crudRoutes("/categories", categoryCreateSchema, categoryUpdateSchema, {
  list: categories.listCategories, get: categories.getCategory, create: categories.createCategory,
  update: categories.updateCategory, remove: categories.deleteCategory,
});

export const incomeSourceRoutes = crudRoutes("/income-sources", incomeSourceCreateSchema, incomeSourceUpdateSchema, {
  list: sources.listIncomeSources, get: sources.getIncomeSource, create: sources.createIncomeSource,
  update: sources.updateIncomeSource, remove: sources.deleteIncomeSource,
});

export const planCategoryRoutes = crudRoutes("/plan-categories", planCategoryCreateSchema, planCategoryUpdateSchema, {
  list: planCats.listPlanCategories, get: planCats.getPlanCategory, create: planCats.createPlanCategory,
  update: planCats.updatePlanCategory, remove: planCats.deletePlanCategory,
});

export const planItemRoutes = crudRoutes("/plan-items", planItemCreateSchema, planItemUpdateSchema, {
  list: (userId: string) => planItems.listPlanItems(userId), get: planItems.getPlanItem, create: planItems.createPlanItem,
  update: planItems.updatePlanItem, remove: planItems.deletePlanItem,
});

// Credit cards need extra endpoints (pay-invoice, invoice) so they get a dedicated plugin.
export const creditCardRoutes: FastifyPluginAsync = async (app) => {
  await app.register(crudRoutes("/credit-cards", creditCardCreateSchema, creditCardUpdateSchema, {
    list: cards.listCreditCards, get: cards.getCreditCard, create: cards.createCreditCard,
    update: cards.updateCreditCard, remove: cards.deleteCreditCard,
  }));

  app.addHook("preHandler", app.authenticate);

  app.get("/credit-cards/:id/invoice", async (req) => {
    const { id } = req.params as { id: string };
    const { month } = req.query as { month?: string };
    return getInvoice(req.userId, id, monthParam.parse(month));
  });

  app.post("/credit-cards/:id/pay-invoice", async (req) => {
    const { id } = req.params as { id: string };
    const data = parse(payInvoiceSchema, req.body);
    return payInvoice(req.userId, id, data);
  });
};
