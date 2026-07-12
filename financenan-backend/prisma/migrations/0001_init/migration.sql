-- FinanceNan initial schema
-- All monetary columns are INTEGER cents (centavos).

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark');
CREATE TYPE "AccountType" AS ENUM ('conta_bancaria', 'carteira_digital', 'dinheiro_fisico', 'investimento', 'outro');
CREATE TYPE "CategoryType" AS ENUM ('receita', 'despesa', 'investimento');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'light',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "AccountType" NOT NULL,
    "saldo" INTEGER NOT NULL DEFAULT 0,
    "cor" TEXT NOT NULL DEFAULT '#4f6bd8',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "bandeira" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#7c5cbf',
    "dia_fechamento" INTEGER NOT NULL,
    "dia_vencimento" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "credit_cards_user_id_idx" ON "credit_cards"("user_id");

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "CategoryType" NOT NULL,
    "icone" TEXT NOT NULL DEFAULT 'tag',
    "cor" TEXT NOT NULL DEFAULT '#8a8f98',
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");

CREATE TABLE "income_sources" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "income_sources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "income_sources_user_id_idx" ON "income_sources"("user_id");

CREATE TABLE "plan_categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pct" INTEGER NOT NULL DEFAULT 0,
    "abs" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "plan_categories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "plan_categories_user_id_idx" ON "plan_categories"("user_id");

CREATE TABLE "plan_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_category_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "plan_items_user_id_idx" ON "plan_items"("user_id");
CREATE INDEX "plan_items_plan_category_id_idx" ON "plan_items"("plan_category_id");

CREATE TABLE "fixed_expenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "dia_vencimento" INTEGER NOT NULL,
    "conta_padrao_id" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "fixed_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fixed_expenses_user_id_idx" ON "fixed_expenses"("user_id");

CREATE TABLE "incomes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valor" INTEGER NOT NULL,
    "observacoes" TEXT,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "recebida" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "incomes_user_id_idx" ON "incomes"("user_id");
CREATE INDEX "incomes_data_idx" ON "incomes"("data");

CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "account_id" TEXT,
    "credit_card_id" TEXT,
    "data_compra" DATE NOT NULL,
    "data_vencimento" DATE,
    "valor" INTEGER NOT NULL,
    "observacoes" TEXT,
    "paga" BOOLEAN NOT NULL DEFAULT false,
    "fixed_expense_id" TEXT,
    "installment_group_id" TEXT,
    "installment_n" INTEGER,
    "installment_total" INTEGER,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expenses_user_id_idx" ON "expenses"("user_id");
CREATE INDEX "expenses_data_compra_idx" ON "expenses"("data_compra");
CREATE INDEX "expenses_data_vencimento_idx" ON "expenses"("data_vencimento");
CREATE INDEX "expenses_installment_group_id_idx" ON "expenses"("installment_group_id");
CREATE INDEX "expenses_fixed_expense_id_idx" ON "expenses"("fixed_expense_id");

CREATE TABLE "settings" (
    "user_id" TEXT NOT NULL,
    "reserva_meses" INTEGER NOT NULL DEFAULT 6,
    "reserva_account_ids" TEXT[],
    "patrimonio_excluded_account_ids" TEXT[],
    CONSTRAINT "settings_pkey" PRIMARY KEY ("user_id")
);

-- Foreign Keys
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_categories" ADD CONSTRAINT "plan_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_category_id_fkey" FOREIGN KEY ("plan_category_id") REFERENCES "plan_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_conta_padrao_id_fkey" FOREIGN KEY ("conta_padrao_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fixed_expense_id_fkey" FOREIGN KEY ("fixed_expense_id") REFERENCES "fixed_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
