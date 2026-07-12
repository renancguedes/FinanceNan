import { z } from "zod";

// ---- primitives ----
export const cents = z.number().int(); // integer centavos
export const centsPositive = z.number().int().positive();
export const centsNonNeg = z.number().int().min(0);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export const monthParam = z.string().regex(/^\d{4}-\d{2}$/, "expected YYYY-MM");
export const dayOfMonth = z.number().int().min(1).max(31);
export const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/, "expected #rrggbb");

export const accountType = z.enum([
  "conta_bancaria", "carteira_digital", "dinheiro_fisico", "investimento", "outro",
]);
export const categoryType = z.enum(["receita", "despesa", "investimento"]);
export const theme = z.enum(["light", "dark"]);

// ---- auth ----
export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(200),
});
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(10) });
export const forgotSchema = z.object({ email: z.string().email() });

// ---- me ----
export const updateMeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  theme: theme.optional(),
}).refine((v) => v.name !== undefined || v.theme !== undefined, { message: "nothing to update" });

// ---- accounts ----
export const accountCreateSchema = z.object({
  nome: z.string().min(1).max(120),
  tipo: accountType,
  saldo: cents.default(0),
  cor: hexColor.default("#4f6bd8"),
  ativo: z.boolean().default(true),
});
export const accountUpdateSchema = accountCreateSchema.partial();

// ---- credit cards ----
export const creditCardCreateSchema = z.object({
  nome: z.string().min(1).max(120),
  bandeira: z.string().min(1).max(60),
  cor: hexColor.default("#7c5cbf"),
  diaFechamento: dayOfMonth,
  diaVencimento: dayOfMonth,
  ativo: z.boolean().default(true),
});
export const creditCardUpdateSchema = creditCardCreateSchema.partial();

// ---- categories ----
export const categoryCreateSchema = z.object({
  nome: z.string().min(1).max(120),
  tipo: categoryType,
  icone: z.string().min(1).max(40).default("tag"),
  cor: hexColor.default("#8a8f98"),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

// ---- income sources ----
export const incomeSourceCreateSchema = z.object({
  nome: z.string().min(1).max(120),
  valor: centsNonNeg.default(0),
});
export const incomeSourceUpdateSchema = incomeSourceCreateSchema.partial();

// ---- plan categories ----
export const planCategoryCreateSchema = z.object({
  nome: z.string().min(1).max(120),
  pct: z.number().int().min(0).max(100).default(0),
  abs: centsNonNeg.default(0),
});
export const planCategoryUpdateSchema = planCategoryCreateSchema.partial();

// ---- plan items ----
export const planItemCreateSchema = z.object({
  planCategoryId: z.string().min(1),
  nome: z.string().min(1).max(120),
  valor: centsNonNeg.default(0),
});
export const planItemUpdateSchema = planItemCreateSchema.partial();

// ---- fixed expenses ----
export const fixedExpenseCreateSchema = z.object({
  descricao: z.string().min(1).max(160),
  categoryId: z.string().min(1),
  valor: centsPositive,
  diaVencimento: dayOfMonth,
  contaPadraoId: z.string().min(1).nullable().optional(),
  observacoes: z.string().max(500).nullable().optional(),
  ativo: z.boolean().default(true),
});
export const fixedExpenseUpdateSchema = fixedExpenseCreateSchema.partial();

// ---- incomes ----
export const incomeCreateSchema = z.object({
  descricao: z.string().min(1).max(160),
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  data: isoDate,
  valor: centsPositive,
  observacoes: z.string().max(500).nullable().optional(),
  recorrente: z.boolean().default(false),
  recebida: z.boolean().default(false),
});
export const incomeUpdateSchema = incomeCreateSchema.partial();

// ---- expenses ----
const expenseBase = z.object({
  descricao: z.string().min(1).max(160),
  categoryId: z.string().min(1),
  accountId: z.string().min(1).nullable().optional(),
  creditCardId: z.string().min(1).nullable().optional(),
  dataCompra: isoDate,
  valor: centsPositive,
  observacoes: z.string().max(500).nullable().optional(),
  paga: z.boolean().default(false),
});
// exactly one of accountId / creditCardId
const oneTarget = (v: { accountId?: string | null; creditCardId?: string | null }) =>
  Boolean(v.accountId) !== Boolean(v.creditCardId);

export const expenseCreateSchema = expenseBase.refine(oneTarget, {
  message: "provide exactly one of accountId or creditCardId",
  path: ["accountId"],
});
export const expenseUpdateSchema = expenseBase.partial();

// ---- bulk installments ----
export const bulkExpenseSchema = z.object({
  descricao: z.string().min(1).max(160),
  categoryId: z.string().min(1),
  accountId: z.string().min(1).nullable().optional(),
  creditCardId: z.string().min(1).nullable().optional(),
  dataCompra: isoDate,
  valorTotal: centsPositive,
  parcelas: z.number().int().min(1).max(360),
  dividir: z.boolean().default(true), // true: split total; false: repeat full value
  observacoes: z.string().max(500).nullable().optional(),
}).refine(oneTarget, {
  message: "provide exactly one of accountId or creditCardId",
  path: ["accountId"],
});

// ---- actions ----
export const payFixedSchema = z.object({
  month: monthParam.optional(),            // defaults to current competência
  accountId: z.string().min(1).optional(), // overrides contaPadrao
  data: isoDate.optional(),                // payment date; defaults to today
});
export const payInvoiceSchema = z.object({
  month: monthParam,        // invoice competência (by due date)
  accountId: z.string().min(1),
});

// ---- settings ----
export const settingsUpdateSchema = z.object({
  reservaMeses: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]).optional(),
  reservaAccountIds: z.array(z.string().min(1)).optional(),
  patrimonioExcludedAccountIds: z.array(z.string().min(1)).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "nothing to update" });

export type RegisterInput = z.infer<typeof registerSchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type BulkExpenseInput = z.infer<typeof bulkExpenseSchema>;
