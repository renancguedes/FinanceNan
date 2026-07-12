# FinanceNan API — Exemplos de request/response

Base URL: `http://localhost:3333`. Valores monetários em **centavos**.
Rotas protegidas exigem o header `Authorization: Bearer <accessToken>`.

---

## Auth

### POST /auth/register

```bash
curl -X POST http://localhost:3333/auth/register \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Renan", "email": "renan@ex.com", "password": "segredo123" }'
```

`201 Created`
```json
{
  "user": { "id": "clx...", "name": "Renan", "email": "renan@ex.com", "theme": "light", "createdAt": "2026-07-12T12:00:00.000Z" },
  "accessToken": "eyJhbGciOiJIUzI1Ni...",
  "refreshToken": "eyJhbGciOiJIUzI1Ni...",
  "tokenType": "Bearer"
}
```
No registro já são criados: as categorias padrão, as 6 plan_categories padrão e as settings.

### POST /auth/login
```bash
curl -X POST http://localhost:3333/auth/login \
  -H 'Content-Type: application/json' \
  -d '{ "email": "renan@ex.com", "password": "segredo123" }'
```
`200 OK` — mesmo formato acima. O campo `user.theme` chega aqui para o front aplicar o tema antes de renderizar.

### POST /auth/refresh
```bash
curl -X POST http://localhost:3333/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{ "refreshToken": "eyJ..." }'
```
`200 OK` → `{ "accessToken": "...", "refreshToken": "...", "tokenType": "Bearer" }`

### POST /auth/forgot-password
`200 OK` → `{ "message": "If the email exists, a reset link has been sent." }` (envio de e-mail mockado).

### PATCH /me
```bash
curl -X PATCH http://localhost:3333/me \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "theme": "dark" }'
```
`200 OK` → objeto `user` atualizado.

---

## Contas

### POST /accounts
```bash
curl -X POST http://localhost:3333/accounts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "nome": "Conta Corrente", "tipo": "conta_bancaria", "saldo": 482000, "cor": "#4f6bd8" }'
```
`201 Created`
```json
{ "id": "clx...", "userId": "clx...", "nome": "Conta Corrente", "tipo": "conta_bancaria", "saldo": 482000, "cor": "#4f6bd8", "ativo": true }
```
`tipo`: `conta_bancaria | carteira_digital | dinheiro_fisico | investimento | outro`.

---

## Cartões de crédito

### POST /credit-cards
```bash
curl -X POST http://localhost:3333/credit-cards \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "nome": "Ametista", "bandeira": "Mastercard", "diaFechamento": 28, "diaVencimento": 7 }'
```
Cartões inativos (`ativo:false`) permanecem cadastrados mas **não aceitam** novos lançamentos.

---

## Despesas

### POST /expenses (na conta)
```bash
curl -X POST http://localhost:3333/expenses \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "descricao": "Mercado", "categoryId": "<catId>", "accountId": "<accId>", "dataCompra": "2026-07-10", "valor": 25000, "paga": true }'
```
`201` — como `paga:true` e tem `accountId`, o saldo da conta é debitado em `25000` (Regra 1).

### POST /expenses (no cartão) — vencimento calculado (Regra 3)
```bash
curl -X POST http://localhost:3333/expenses \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "descricao": "Notebook", "categoryId": "<catId>", "creditCardId": "<cardId>", "dataCompra": "2026-01-10", "valor": 300000 }'
```
`201` — `dataVencimento` é calculada pela regra de fechamento (ex.: fecha 28 / vence 7 → `2026-02-07`).
Informe exatamente **um** de `accountId` ou `creditCardId`.

### POST /expenses/bulk — parcelas (Regra 5)
```bash
curl -X POST http://localhost:3333/expenses/bulk \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "descricao": "Geladeira", "categoryId": "<catId>", "creditCardId": "<cardId>", "dataCompra": "2026-01-10", "valorTotal": 100000, "parcelas": 3, "dividir": true }'
```
`201` — três despesas vinculadas por `installmentGroupId`, com valores `[33333, 33333, 33334]`
(resto na última) e vencimentos `2026-02-07`, `2026-03-07`, `2026-04-07`.

### GET /expenses?month=YYYY-MM
Lista da competência. Despesas de cartão são filtradas por `dataVencimento`; as demais por `dataCompra` (Regra 6).

---

## Gastos fixos

### POST /fixed-expenses/:id/pay (Regra 2)
```bash
curl -X POST http://localhost:3333/fixed-expenses/<id>/pay \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "month": "2026-07" }'
```
`201` — cria uma despesa paga na competência usando a conta padrão (ou `accountId` do payload)
e debita o saldo. Excluir essa despesa reabre o gasto fixo automaticamente.

### GET /fixed-expenses?month=YYYY-MM
Cada item traz o status derivado: `"pagoNaCompetencia": true|false` e `"expenseId"`.

---

## Fatura do cartão

### GET /credit-cards/:id/invoice?month=YYYY-MM
`200 OK`
```json
{
  "card": { "id": "...", "nome": "Ametista", "bandeira": "Mastercard", "diaFechamento": 28, "diaVencimento": 7 },
  "month": "2026-02",
  "fatura": 90000, "pago": 30000, "aberto": 60000, "comprometido": 150000,
  "items": [ { "id": "...", "descricao": "Notebook (1/3)", "valor": 33334, "paga": false } ]
}
```

### POST /credit-cards/:id/pay-invoice (Regra 4)
```bash
curl -X POST http://localhost:3333/credit-cards/<id>/pay-invoice \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "month": "2026-02", "accountId": "<accId>" }'
```
`200 OK` → `{ "cardId": "...", "month": "2026-02", "accountId": "...", "total": 60000, "paidCount": 2 }`
Marca as despesas em aberto do cartão na competência como pagas e debita o total da conta, em transação única.

---

## Dashboard

### GET /dashboard?month=YYYY-MM
`200 OK`
```json
{
  "month": "2026-07",
  "patrimonio": 1925000,
  "contasAtivas": 6,
  "aPagar": 42000, "aPagarCount": 3,
  "previsaoProximoMes": 264400,
  "custoFixo": 264400,
  "reserva": { "meses": 6, "meta": 1586400, "atual": 1460000, "percentual": 92 },
  "fluxoCaixa": [ { "month": "2026-02", "receitas": 650000, "despesas": 410000 } ],
  "lancamentos": [ { "id": "...", "tipo": "despesa", "descricao": "Mercado", "valor": -25000, "data": "2026-07-10", "paga": true } ]
}
```

---

## Configurações

### PATCH /settings
```bash
curl -X PATCH http://localhost:3333/settings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "reservaMeses": 6, "reservaAccountIds": ["<accId1>","<accId2>"], "patrimonioExcludedAccountIds": [] }'
```

---

## Erros

Formato padrão:
```json
{ "error": { "code": "UNPROCESSABLE", "message": "Validation failed", "details": { } } }
```
Códigos: `400` (bad request), `401` (sem/token inválido), `404` (não encontrado),
`409` (conflito, ex.: e-mail duplicado ou fatura já paga), `422` (validação).
