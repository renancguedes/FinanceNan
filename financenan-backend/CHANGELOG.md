# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/) e versionamento numérico `major.minor.patch`.

## 0.2.0 — 2026-07-12

- Documentação **OpenAPI 3.0** completa (`src/docs/openapi.ts`) servida como **Swagger UI em `/docs`**
  e spec bruta em `/openapi.json` (pronta para importar no Postman/Insomnia).
- Arquivos e guia de **deploy**: `api/index.ts` (entrypoint serverless), `vercel.json`,
  `binaryTargets` e `directUrl` no Prisma, scripts `postinstall`/`vercel-build`, e `DEPLOYMENT.md`
  com passo a passo para Vercel + Neon e alternativas (Railway, Render, Fly).
- Correção de tipagem: `parse`/`crudRoutes` agora retornam o tipo de saída (output) dos schemas zod.

## 0.1.0 — 2026-07-12

Primeira versão do backend do FinanceNan.

- Modelo de dados relacional completo (PostgreSQL + Prisma): users, accounts, credit_cards,
  categories, income_sources, plan_categories, plan_items, fixed_expenses, incomes, expenses,
  settings e password_resets. Valores monetários em centavos (INTEGER).
- Migration inicial versionada (`prisma/migrations/0001_init`).
- Autenticação JWT (access + refresh) com HS256, senhas com bcrypt, validação com zod.
- Seeds por usuário no registro: catálogo de categorias e plan_categories padrão.
- Seed de demonstração (`prisma/seed.ts`).
- Regras de negócio 1–8 implementadas nos serviços com transações atômicas:
  saldo automático, pagar gasto fixo (status derivado), vencimento de cartão, pagar fatura,
  lançamento em massa (parcelas), competência, reserva de emergência e patrimônio.
- Endpoints REST: /auth/*, /me, CRUD de todas as entidades, /fixed-expenses/:id/pay,
  /credit-cards/:id/pay-invoice, /credit-cards/:id/invoice, /expenses/bulk, /dashboard, /settings.
- Testes unitários das regras 1, 3, 4, 5, 7 e 8 (Vitest) e testes de integração das regras 1, 2, 4 e 5.
