# FinanceNan — Backend

API REST + PostgreSQL para o FinanceNan, um sistema de controle financeiro pessoal.
Stack: **Node.js + TypeScript + Fastify + Prisma**, JWT (access + refresh), bcrypt e zod.

> **Dinheiro em centavos.** Todos os valores monetários trafegam e são armazenados como
> inteiros de centavos (ex.: `R$ 10,50` → `1050`). Nunca `float`.
>
> **Documentação interativa:** com o servidor rodando, acesse **`/docs`** (Swagger UI) e
> **`/openapi.json`** (spec para Postman/Insomnia/codegen).

## Requisitos

- Node.js ≥ 20
- PostgreSQL 14+ (ou Docker)

## Setup rápido

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env        # ajuste DATABASE_URL e os segredos JWT

# 3. Subir o Postgres (opcional, via Docker)
docker compose up -d db

# 4. Gerar o client e aplicar as migrations
npm run prisma:generate
npm run prisma:deploy       # ou: npm run prisma:migrate (ambiente de dev)

# 5. (opcional) Popular um usuário de demonstração
npm run seed:demo           # demo@financenan.app / demo1234

# 6. Rodar em desenvolvimento
npm run dev                 # http://localhost:3333  (Swagger em /docs)
```

Build de produção: `npm run build && npm start`.

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Servidor com hot-reload (tsx). |
| `npm run build` / `npm start` | Compila para `dist/` e executa. |
| `npm run typecheck` | Type-check sem emitir. |
| `npm run prisma:migrate` | Cria/aplica migrations em desenvolvimento. |
| `npm run prisma:deploy` | Aplica migrations existentes (produção/CI). |
| `npm run seed:demo` | Cria o usuário de demonstração com dados de exemplo. |
| `npm test` | Testes unitários das regras de negócio (Vitest). |
| `npm run test:integration` | Testes ponta-a-ponta contra um banco de testes. |

## Arquitetura

Separação em camadas: **rotas → serviços → Prisma (repositório)**.

```
src/
  config/env.ts          # validação das variáveis de ambiente (zod)
  db/prisma.ts           # PrismaClient
  domain/                # lógica pura e testável (sem I/O)
    dates.ts             #   competência, vencimento de cartão, parcelas
    money.ts             #   split de parcelas em centavos
    finance.ts           #   patrimônio, reserva, resumo de fatura
    defaults.ts          #   catálogo e plan_categories padrão (seed)
  auth/                  # JWT (HS256) + plugin de autenticação
  schemas/index.ts       # validação de payloads (zod)
  services/              # regras de negócio com transações
  routes/                # endpoints REST (todos escopados por user_id)
  app.ts / server.ts     # bootstrap do Fastify
prisma/
  schema.prisma          # modelo de dados (dinheiro em centavos)
  migrations/            # migrations versionadas
  seed.ts                # seed de demonstração
tests/                   # unit (regras puras) + integration (com banco)
```

Toda query é **escopada por `user_id`** — nenhum dado vaza entre usuários.

## Autenticação

`POST /auth/login` e `/auth/register` retornam `accessToken`, `refreshToken` e o objeto
`user` (incluindo `theme`) — o tema chega no payload do login para ser aplicado **antes**
da renderização. Envie `Authorization: Bearer <accessToken>` nas rotas protegidas.
Use `POST /auth/refresh` para renovar o access token.

## Endpoints

Públicos: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password` (e-mail mockado).

Protegidos (Bearer):

| Recurso | Rotas |
| --- | --- |
| Perfil | `GET /me`, `PATCH /me` (tema, nome) |
| Contas | `GET/POST /accounts`, `GET/PATCH/DELETE /accounts/:id` |
| Cartões | `GET/POST /credit-cards`, `GET/PATCH/DELETE /credit-cards/:id` |
| Categorias | `GET/POST /categories`, `GET/PATCH/DELETE /categories/:id` |
| Fontes de renda | `GET/POST /income-sources`, `.../:id` |
| Distribuição | `GET/POST /plan-categories`, `.../:id` · `GET/POST /plan-items`, `.../:id` |
| Gastos fixos | `GET/POST /fixed-expenses`, `.../:id` · `POST /fixed-expenses/:id/pay` |
| Receitas | `GET/POST /incomes`, `.../:id` · `POST /incomes/:id/toggle-received` |
| Despesas | `GET/POST /expenses`, `.../:id` · `POST /expenses/:id/toggle-paid` · `POST /expenses/bulk` |
| Fatura | `GET /credit-cards/:id/invoice?month=YYYY-MM` · `POST /credit-cards/:id/pay-invoice` |
| Dashboard | `GET /dashboard?month=YYYY-MM` |
| Configurações | `GET /settings`, `PATCH /settings` |

Listagens aceitam `?month=YYYY-MM` (competência). Ver exemplos em [`docs/API-EXAMPLES.md`](docs/API-EXAMPLES.md).

## Regras de negócio

1. **Saldo automático** — criar/editar/excluir/alternar receita recebida ou despesa paga
   (com conta) ajusta o saldo atomicamente; edição reverte o efeito antigo e aplica o novo.
2. **Pagar gasto fixo** — cria uma despesa paga na competência usando a conta padrão e debita
   o saldo. O status "pago" é **derivado**: excluir a despesa reabre o gasto fixo, e na virada
   do mês tudo volta a "em aberto" automaticamente (nada a resetar).
3. **Vencimento de cartão** — compra após o dia de fechamento cai na fatura seguinte; se o dia
   de vencimento ≤ dia de fechamento, o vencimento vai para o mês seguinte ao fechamento.
4. **Pagar fatura** — marca como pagas todas as despesas em aberto do cartão na competência e
   debita o total de uma conta, em transação única.
5. **Parcelas** — N parcelas com opção de dividir (resto de centavos na última). Sem cartão:
   uma despesa por mês; com cartão: mesma data de compra, vencimentos sequenciais.
6. **Competência** — despesas de cartão filtram por `data_vencimento`; as demais por `data`.
7. **Reserva de emergência** — meta = soma dos gastos fixos ativos × `reserva_meses`;
   alcançado = soma dos saldos das contas em `reserva_account_ids`.
8. **Patrimônio** — soma das contas ativas, excluindo investimentos em `patrimonio_excluded_account_ids`.

## Testes

```bash
npm test                 # regras puras (parcelas, vencimento, saldo, fatura, reserva, patrimônio)
```

Integração (ponta-a-ponta, exige um banco descartável):

```bash
RUN_INTEGRATION=1 DATABASE_URL="postgresql://...test" npm run test:integration
```

## Documentação da API

- **Swagger UI:** `GET /docs`
- **OpenAPI (JSON):** `GET /openapi.json`
- Exemplos de `curl`: [`docs/API-EXAMPLES.md`](docs/API-EXAMPLES.md)

## Deploy

Passo a passo para Vercel (+ Neon) e alternativas (Railway, Render, Fly) em
[`DEPLOYMENT.md`](DEPLOYMENT.md).

## Modo visitante

É 100% front-end e não persiste — o backend não precisa tratá-lo.
