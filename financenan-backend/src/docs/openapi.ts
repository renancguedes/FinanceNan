// OpenAPI 3.0 document for the FinanceNan API.
// Money fields are integer cents (centavos). Served as Swagger UI at /docs.

type Obj = Record<string, unknown>;

const bearer = [{ bearerAuth: [] as string[] }];
const idParam = {
  name: "id", in: "path", required: true, schema: { type: "string" },
};
const monthQuery = {
  name: "month", in: "query", required: false,
  schema: { type: "string", pattern: "^\\d{4}-\\d{2}$", example: "2026-07" },
  description: "Competência (YYYY-MM).",
};
const jsonBody = (ref: string) => ({
  required: true,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});
const jsonRes = (ref: string, description = "OK") => ({
  description,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});
const arrRes = (ref: string, description = "OK") => ({
  description,
  content: { "application/json": { schema: { type: "array", items: { $ref: `#/components/schemas/${ref}` } } } },
});
const errRes = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const commonErrors = {
  "401": errRes("Não autenticado"),
  "404": errRes("Não encontrado"),
  "422": errRes("Falha de validação"),
};

/** Standard CRUD paths for a resource. */
function crud(tag: string, base: string, entity: string, createBody: string, updateBody: string): Obj {
  return {
    [`/${base}`]: {
      get: { tags: [tag], summary: `Listar ${base}`, security: bearer, responses: { "200": arrRes(entity), "401": commonErrors["401"] } },
      post: {
        tags: [tag], summary: `Criar em ${base}`, security: bearer, requestBody: jsonBody(createBody),
        responses: { "201": jsonRes(entity, "Criado"), ...commonErrors },
      },
    },
    [`/${base}/{id}`]: {
      get: { tags: [tag], summary: `Obter ${base}/:id`, security: bearer, parameters: [idParam], responses: { "200": jsonRes(entity), "401": commonErrors["401"], "404": commonErrors["404"] } },
      patch: { tags: [tag], summary: `Atualizar ${base}/:id`, security: bearer, parameters: [idParam], requestBody: jsonBody(updateBody), responses: { "200": jsonRes(entity), ...commonErrors } },
      delete: { tags: [tag], summary: `Excluir ${base}/:id`, security: bearer, parameters: [idParam], responses: { "204": { description: "Sem conteúdo" }, "401": commonErrors["401"], "404": commonErrors["404"] } },
    },
  };
}

const S = { type: "string" } as const;
const INT = { type: "integer", description: "centavos" } as const;
const BOOL = { type: "boolean" } as const;

export const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "FinanceNan API",
    version: "0.2.0",
    description:
      "API de controle financeiro pessoal. Valores monetários em **centavos** (inteiros). " +
      "Autenticação via Bearer JWT. Listagens aceitam ?month=YYYY-MM (competência).",
  },
  servers: [{ url: "/", description: "Host atual" }],
  tags: [
    { name: "Auth" }, { name: "Perfil" }, { name: "Contas" }, { name: "Cartões" },
    { name: "Categorias" }, { name: "Fontes de renda" }, { name: "Distribuição" },
    { name: "Gastos fixos" }, { name: "Receitas" }, { name: "Despesas" },
    { name: "Dashboard" }, { name: "Configurações" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "object", properties: { code: S, message: S, details: { type: "object", nullable: true } } } },
      },
      Tokens: {
        type: "object",
        properties: { accessToken: S, refreshToken: S, tokenType: { type: "string", example: "Bearer" } },
      },
      User: {
        type: "object",
        properties: { id: S, name: S, email: { type: "string", format: "email" }, theme: { type: "string", enum: ["light", "dark"] }, createdAt: { type: "string", format: "date-time" } },
      },
      AuthResult: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          accessToken: S, refreshToken: S, tokenType: { type: "string", example: "Bearer" },
        },
      },
      RegisterInput: { type: "object", required: ["name", "email", "password"], properties: { name: S, email: { type: "string", format: "email" }, password: { type: "string", minLength: 6 } } },
      LoginInput: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: S } },
      RefreshInput: { type: "object", required: ["refreshToken"], properties: { refreshToken: S } },
      ForgotInput: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } },
      UpdateMeInput: { type: "object", properties: { name: S, theme: { type: "string", enum: ["light", "dark"] } } },

      Account: { type: "object", properties: { id: S, userId: S, nome: S, tipo: { type: "string", enum: ["conta_bancaria", "carteira_digital", "dinheiro_fisico", "investimento", "outro"] }, saldo: INT, cor: S, ativo: BOOL } },
      AccountCreate: { type: "object", required: ["nome", "tipo"], properties: { nome: S, tipo: { type: "string", enum: ["conta_bancaria", "carteira_digital", "dinheiro_fisico", "investimento", "outro"] }, saldo: INT, cor: S, ativo: BOOL } },
      AccountUpdate: { type: "object", properties: { nome: S, tipo: { type: "string", enum: ["conta_bancaria", "carteira_digital", "dinheiro_fisico", "investimento", "outro"] }, saldo: INT, cor: S, ativo: BOOL } },

      CreditCard: { type: "object", properties: { id: S, userId: S, nome: S, bandeira: S, cor: S, diaFechamento: { type: "integer" }, diaVencimento: { type: "integer" }, ativo: BOOL } },
      CreditCardCreate: { type: "object", required: ["nome", "bandeira", "diaFechamento", "diaVencimento"], properties: { nome: S, bandeira: S, cor: S, diaFechamento: { type: "integer", minimum: 1, maximum: 31 }, diaVencimento: { type: "integer", minimum: 1, maximum: 31 }, ativo: BOOL } },
      CreditCardUpdate: { type: "object", properties: { nome: S, bandeira: S, cor: S, diaFechamento: { type: "integer" }, diaVencimento: { type: "integer" }, ativo: BOOL } },

      Category: { type: "object", properties: { id: S, userId: S, nome: S, tipo: { type: "string", enum: ["receita", "despesa", "investimento"] }, icone: S, cor: S } },
      CategoryCreate: { type: "object", required: ["nome", "tipo"], properties: { nome: S, tipo: { type: "string", enum: ["receita", "despesa", "investimento"] }, icone: S, cor: S } },
      CategoryUpdate: { type: "object", properties: { nome: S, tipo: { type: "string", enum: ["receita", "despesa", "investimento"] }, icone: S, cor: S } },

      IncomeSource: { type: "object", properties: { id: S, userId: S, nome: S, valor: INT } },
      IncomeSourceCreate: { type: "object", required: ["nome"], properties: { nome: S, valor: INT } },
      IncomeSourceUpdate: { type: "object", properties: { nome: S, valor: INT } },

      PlanCategory: { type: "object", properties: { id: S, userId: S, nome: S, pct: { type: "integer" }, abs: INT, items: { type: "array", items: { $ref: "#/components/schemas/PlanItem" } } } },
      PlanCategoryCreate: { type: "object", required: ["nome"], properties: { nome: S, pct: { type: "integer", minimum: 0, maximum: 100 }, abs: INT } },
      PlanCategoryUpdate: { type: "object", properties: { nome: S, pct: { type: "integer" }, abs: INT } },

      PlanItem: { type: "object", properties: { id: S, userId: S, planCategoryId: S, nome: S, valor: INT } },
      PlanItemCreate: { type: "object", required: ["planCategoryId", "nome"], properties: { planCategoryId: S, nome: S, valor: INT } },
      PlanItemUpdate: { type: "object", properties: { planCategoryId: S, nome: S, valor: INT } },

      FixedExpense: { type: "object", properties: { id: S, userId: S, descricao: S, categoryId: S, valor: INT, diaVencimento: { type: "integer" }, contaPadraoId: { type: "string", nullable: true }, observacoes: { type: "string", nullable: true }, ativo: BOOL, pagoNaCompetencia: { type: "boolean", nullable: true }, expenseId: { type: "string", nullable: true } } },
      FixedExpenseCreate: { type: "object", required: ["descricao", "categoryId", "valor", "diaVencimento"], properties: { descricao: S, categoryId: S, valor: INT, diaVencimento: { type: "integer", minimum: 1, maximum: 31 }, contaPadraoId: { type: "string", nullable: true }, observacoes: { type: "string", nullable: true }, ativo: BOOL } },
      FixedExpenseUpdate: { type: "object", properties: { descricao: S, categoryId: S, valor: INT, diaVencimento: { type: "integer" }, contaPadraoId: { type: "string", nullable: true }, observacoes: { type: "string", nullable: true }, ativo: BOOL } },
      PayFixedInput: { type: "object", properties: { month: { type: "string", pattern: "^\\d{4}-\\d{2}$" }, accountId: S, data: { type: "string", format: "date" } } },

      Income: { type: "object", properties: { id: S, userId: S, descricao: S, categoryId: S, accountId: S, data: { type: "string", format: "date" }, valor: INT, observacoes: { type: "string", nullable: true }, recorrente: BOOL, recebida: BOOL } },
      IncomeCreate: { type: "object", required: ["descricao", "categoryId", "accountId", "data", "valor"], properties: { descricao: S, categoryId: S, accountId: S, data: { type: "string", format: "date" }, valor: INT, observacoes: { type: "string", nullable: true }, recorrente: BOOL, recebida: BOOL } },
      IncomeUpdate: { type: "object", properties: { descricao: S, categoryId: S, accountId: S, data: { type: "string", format: "date" }, valor: INT, observacoes: { type: "string", nullable: true }, recorrente: BOOL, recebida: BOOL } },

      Expense: { type: "object", properties: { id: S, userId: S, descricao: S, categoryId: S, accountId: { type: "string", nullable: true }, creditCardId: { type: "string", nullable: true }, dataCompra: { type: "string", format: "date" }, dataVencimento: { type: "string", format: "date", nullable: true }, valor: INT, observacoes: { type: "string", nullable: true }, paga: BOOL, fixedExpenseId: { type: "string", nullable: true }, installmentGroupId: { type: "string", nullable: true }, installmentN: { type: "integer", nullable: true }, installmentTotal: { type: "integer", nullable: true } } },
      ExpenseCreate: { type: "object", required: ["descricao", "categoryId", "dataCompra", "valor"], description: "Informe exatamente um de accountId ou creditCardId. Com cartão, dataVencimento é calculada.", properties: { descricao: S, categoryId: S, accountId: { type: "string", nullable: true }, creditCardId: { type: "string", nullable: true }, dataCompra: { type: "string", format: "date" }, valor: INT, observacoes: { type: "string", nullable: true }, paga: BOOL } },
      ExpenseUpdate: { type: "object", properties: { descricao: S, categoryId: S, accountId: { type: "string", nullable: true }, creditCardId: { type: "string", nullable: true }, dataCompra: { type: "string", format: "date" }, valor: INT, observacoes: { type: "string", nullable: true }, paga: BOOL } },
      BulkExpenseInput: { type: "object", required: ["descricao", "categoryId", "dataCompra", "valorTotal", "parcelas"], properties: { descricao: S, categoryId: S, accountId: { type: "string", nullable: true }, creditCardId: { type: "string", nullable: true }, dataCompra: { type: "string", format: "date" }, valorTotal: INT, parcelas: { type: "integer", minimum: 1, maximum: 360 }, dividir: { type: "boolean", description: "true: divide o total (resto na última); false: repete o valor" }, observacoes: { type: "string", nullable: true } } },
      PayInvoiceInput: { type: "object", required: ["month", "accountId"], properties: { month: { type: "string", pattern: "^\\d{4}-\\d{2}$" }, accountId: S } },
      PayInvoiceResult: { type: "object", properties: { cardId: S, month: S, accountId: S, total: INT, paidCount: { type: "integer" } } },
      Invoice: { type: "object", properties: { card: { type: "object" }, month: S, fatura: INT, pago: INT, aberto: INT, comprometido: INT, items: { type: "array", items: { $ref: "#/components/schemas/Expense" } } } },

      Settings: { type: "object", properties: { userId: S, reservaMeses: { type: "integer", enum: [3, 6, 9, 12] }, reservaAccountIds: { type: "array", items: S }, patrimonioExcludedAccountIds: { type: "array", items: S } } },
      SettingsUpdate: { type: "object", properties: { reservaMeses: { type: "integer", enum: [3, 6, 9, 12] }, reservaAccountIds: { type: "array", items: S }, patrimonioExcludedAccountIds: { type: "array", items: S } } },

      Dashboard: {
        type: "object",
        properties: {
          month: S, patrimonio: INT, contasAtivas: { type: "integer" },
          aPagar: INT, aPagarCount: { type: "integer" }, previsaoProximoMes: INT, custoFixo: INT,
          reserva: { type: "object", properties: { meses: { type: "integer" }, meta: INT, atual: INT, percentual: { type: "integer" } } },
          fluxoCaixa: { type: "array", items: { type: "object", properties: { month: S, receitas: INT, despesas: INT } } },
          lancamentos: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
  security: bearer,
  paths: {
    "/health": { get: { tags: ["Dashboard"], summary: "Health check", security: [], responses: { "200": { description: "OK" } } } },

    "/auth/register": { post: { tags: ["Auth"], summary: "Registrar (cria seeds do usuário)", security: [], requestBody: jsonBody("RegisterInput"), responses: { "201": jsonRes("AuthResult", "Criado"), "409": errRes("E-mail já cadastrado"), "422": commonErrors["422"] } } },
    "/auth/login": { post: { tags: ["Auth"], summary: "Login (retorna tema no payload)", security: [], requestBody: jsonBody("LoginInput"), responses: { "200": jsonRes("AuthResult"), "401": errRes("Credenciais inválidas") } } },
    "/auth/refresh": { post: { tags: ["Auth"], summary: "Renovar tokens", security: [], requestBody: jsonBody("RefreshInput"), responses: { "200": jsonRes("Tokens"), "401": errRes("Refresh inválido") } } },
    "/auth/forgot-password": { post: { tags: ["Auth"], summary: "Recuperar senha (e-mail mockado)", security: [], requestBody: jsonBody("ForgotInput"), responses: { "200": { description: "Mensagem neutra" } } } },

    "/me": {
      get: { tags: ["Perfil"], summary: "Meu perfil", security: bearer, responses: { "200": jsonRes("User"), "401": commonErrors["401"] } },
      patch: { tags: ["Perfil"], summary: "Atualizar tema/nome", security: bearer, requestBody: jsonBody("UpdateMeInput"), responses: { "200": jsonRes("User"), ...commonErrors } },
    },

    ...crud("Contas", "accounts", "Account", "AccountCreate", "AccountUpdate"),
    ...crud("Categorias", "categories", "Category", "CategoryCreate", "CategoryUpdate"),
    ...crud("Fontes de renda", "income-sources", "IncomeSource", "IncomeSourceCreate", "IncomeSourceUpdate"),
    ...crud("Distribuição", "plan-categories", "PlanCategory", "PlanCategoryCreate", "PlanCategoryUpdate"),
    ...crud("Distribuição", "plan-items", "PlanItem", "PlanItemCreate", "PlanItemUpdate"),

    "/credit-cards": {
      get: { tags: ["Cartões"], summary: "Listar cartões", security: bearer, responses: { "200": arrRes("CreditCard"), "401": commonErrors["401"] } },
      post: { tags: ["Cartões"], summary: "Criar cartão", security: bearer, requestBody: jsonBody("CreditCardCreate"), responses: { "201": jsonRes("CreditCard", "Criado"), ...commonErrors } },
    },
    "/credit-cards/{id}": {
      get: { tags: ["Cartões"], summary: "Obter cartão", security: bearer, parameters: [idParam], responses: { "200": jsonRes("CreditCard"), "404": commonErrors["404"] } },
      patch: { tags: ["Cartões"], summary: "Atualizar cartão", security: bearer, parameters: [idParam], requestBody: jsonBody("CreditCardUpdate"), responses: { "200": jsonRes("CreditCard"), ...commonErrors } },
      delete: { tags: ["Cartões"], summary: "Excluir cartão", security: bearer, parameters: [idParam], responses: { "204": { description: "Sem conteúdo" }, "404": commonErrors["404"] } },
    },
    "/credit-cards/{id}/invoice": { get: { tags: ["Cartões"], summary: "Fatura da competência", security: bearer, parameters: [idParam, monthQuery], responses: { "200": jsonRes("Invoice"), "404": commonErrors["404"] } } },
    "/credit-cards/{id}/pay-invoice": { post: { tags: ["Cartões"], summary: "Pagar fatura (Regra 4)", security: bearer, parameters: [idParam], requestBody: jsonBody("PayInvoiceInput"), responses: { "200": jsonRes("PayInvoiceResult"), "409": errRes("Sem fatura em aberto"), ...commonErrors } } },

    "/fixed-expenses": {
      get: { tags: ["Gastos fixos"], summary: "Listar (status derivado por competência)", security: bearer, parameters: [monthQuery], responses: { "200": arrRes("FixedExpense"), "401": commonErrors["401"] } },
      post: { tags: ["Gastos fixos"], summary: "Criar gasto fixo", security: bearer, requestBody: jsonBody("FixedExpenseCreate"), responses: { "201": jsonRes("FixedExpense", "Criado"), ...commonErrors } },
    },
    "/fixed-expenses/{id}": {
      get: { tags: ["Gastos fixos"], summary: "Obter gasto fixo", security: bearer, parameters: [idParam], responses: { "200": jsonRes("FixedExpense"), "404": commonErrors["404"] } },
      patch: { tags: ["Gastos fixos"], summary: "Atualizar gasto fixo", security: bearer, parameters: [idParam], requestBody: jsonBody("FixedExpenseUpdate"), responses: { "200": jsonRes("FixedExpense"), ...commonErrors } },
      delete: { tags: ["Gastos fixos"], summary: "Excluir gasto fixo", security: bearer, parameters: [idParam], responses: { "204": { description: "Sem conteúdo" }, "404": commonErrors["404"] } },
    },
    "/fixed-expenses/{id}/pay": { post: { tags: ["Gastos fixos"], summary: "Pagar gasto fixo (Regra 2)", security: bearer, parameters: [idParam], requestBody: { required: false, content: { "application/json": { schema: { $ref: "#/components/schemas/PayFixedInput" } } } }, responses: { "201": jsonRes("Expense", "Despesa gerada"), "409": errRes("Já pago na competência"), ...commonErrors } } },

    "/incomes": {
      get: { tags: ["Receitas"], summary: "Listar receitas", security: bearer, parameters: [monthQuery], responses: { "200": arrRes("Income"), "401": commonErrors["401"] } },
      post: { tags: ["Receitas"], summary: "Criar receita", security: bearer, requestBody: jsonBody("IncomeCreate"), responses: { "201": jsonRes("Income", "Criado"), ...commonErrors } },
    },
    "/incomes/{id}": {
      get: { tags: ["Receitas"], summary: "Obter receita", security: bearer, parameters: [idParam], responses: { "200": jsonRes("Income"), "404": commonErrors["404"] } },
      patch: { tags: ["Receitas"], summary: "Atualizar receita", security: bearer, parameters: [idParam], requestBody: jsonBody("IncomeUpdate"), responses: { "200": jsonRes("Income"), ...commonErrors } },
      delete: { tags: ["Receitas"], summary: "Excluir receita", security: bearer, parameters: [idParam], responses: { "204": { description: "Sem conteúdo" }, "404": commonErrors["404"] } },
    },
    "/incomes/{id}/toggle-received": { post: { tags: ["Receitas"], summary: "Alternar recebida (ajusta saldo)", security: bearer, parameters: [idParam], responses: { "200": jsonRes("Income"), "404": commonErrors["404"] } } },

    "/expenses": {
      get: { tags: ["Despesas"], summary: "Listar despesas (Regra 6)", security: bearer, parameters: [monthQuery], responses: { "200": arrRes("Expense"), "401": commonErrors["401"] } },
      post: { tags: ["Despesas"], summary: "Criar despesa (Regra 3 p/ cartão)", security: bearer, requestBody: jsonBody("ExpenseCreate"), responses: { "201": jsonRes("Expense", "Criado"), ...commonErrors } },
    },
    "/expenses/bulk": { post: { tags: ["Despesas"], summary: "Lançar parcelas (Regra 5)", security: bearer, requestBody: jsonBody("BulkExpenseInput"), responses: { "201": arrRes("Expense", "Parcelas criadas"), ...commonErrors } } },
    "/expenses/{id}": {
      get: { tags: ["Despesas"], summary: "Obter despesa", security: bearer, parameters: [idParam], responses: { "200": jsonRes("Expense"), "404": commonErrors["404"] } },
      patch: { tags: ["Despesas"], summary: "Atualizar despesa", security: bearer, parameters: [idParam], requestBody: jsonBody("ExpenseUpdate"), responses: { "200": jsonRes("Expense"), ...commonErrors } },
      delete: { tags: ["Despesas"], summary: "Excluir despesa", security: bearer, parameters: [idParam], responses: { "204": { description: "Sem conteúdo" }, "404": commonErrors["404"] } },
    },
    "/expenses/{id}/toggle-paid": { post: { tags: ["Despesas"], summary: "Alternar paga (ajusta saldo)", security: bearer, parameters: [idParam], responses: { "200": jsonRes("Expense"), "404": commonErrors["404"] } } },

    "/dashboard": { get: { tags: ["Dashboard"], summary: "Resumo da competência", security: bearer, parameters: [monthQuery], responses: { "200": jsonRes("Dashboard"), "401": commonErrors["401"] } } },

    "/settings": {
      get: { tags: ["Configurações"], summary: "Obter configurações", security: bearer, responses: { "200": jsonRes("Settings"), "401": commonErrors["401"] } },
      patch: { tags: ["Configurações"], summary: "Atualizar configurações", security: bearer, requestBody: jsonBody("SettingsUpdate"), responses: { "200": jsonRes("Settings"), ...commonErrors } },
    },
  },
} as const;
