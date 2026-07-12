# Deploy do FinanceNan

Guia para colocar a API no ar. Vou detalhar a **Vercel** (que você pediu) e, no fim,
alternativas mais simples para um backend com banco.

> **Leitura honesta antes de começar.** A Vercel é ótima para front-ends e funções curtas,
> mas roda em **serverless** — cada requisição pode subir uma instância nova. Um servidor
> Fastify com Postgres/Prisma funciona lá, porém exige cuidado com **pooling de conexões**
> (senão o banco esgota conexões) e sofre com **cold starts**. Se você quer o caminho mais
> curto e um servidor "sempre ligado", **Railway** ou **Render** (seção B) são mais naturais
> para este projeto. A Vercel vale a pena se você já vai hospedar o front lá e quer tudo junto.

---

## Pré-requisitos (qualquer opção)

1. Código versionado no **GitHub/GitLab** (a raiz do deploy é a pasta `financenan-backend`).
2. Um **PostgreSQL gerenciado**. Para serverless, use um com pooler embutido:
   [Neon](https://neon.tech) (recomendado), [Supabase](https://supabase.com) ou Vercel Postgres.
3. Segredos JWT definitivos (gere com `openssl rand -hex 32`).

---

## A) Deploy na Vercel

Os arquivos necessários já estão no projeto:

- `api/index.ts` — entrypoint serverless que reaproveita a app Fastify entre invocações.
- `vercel.json` — reescreve todas as rotas para a função e define `maxDuration`.
- `prisma/schema.prisma` — `binaryTargets` inclui `rhel-openssl-3.0.x` (runtime da Vercel) e
  `directUrl` para as migrations.
- `package.json` — `postinstall` e `vercel-build` rodam `prisma generate` no build.

### 1. Criar o banco (Neon)

Crie um projeto no Neon e copie **duas** connection strings:

- **Pooled** (com `-pooler` no host) → vai em `DATABASE_URL`. Acrescente
  `?pgbouncer=true&connection_limit=1` ao final.
- **Direct** (sem `-pooler`) → vai em `DIRECT_URL` (usada só pelas migrations).

Exemplo:
```
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 2. Aplicar as migrations (uma vez, a partir da sua máquina)

A Vercel não deve rodar migration a cada build. Rode você mesmo apontando para o banco de produção:

```bash
cd financenan-backend
npm install
DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npx prisma migrate deploy
# (opcional) popular dados de demonstração:
DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npm run seed:demo
```

Repita `migrate deploy` sempre que criar novas migrations.

### 3. Importar o projeto na Vercel

1. **Add New → Project** e selecione o repositório.
2. Em **Root Directory**, aponte para `financenan-backend`.
3. **Framework Preset:** *Other*. O `vercel-build` (`prisma generate`) roda automaticamente.
4. Em **Environment Variables**, adicione (Production e Preview):

   | Variável | Valor |
   | --- | --- |
   | `DATABASE_URL` | connection string **pooled** |
   | `DIRECT_URL` | connection string **direct** |
   | `JWT_ACCESS_SECRET` | string aleatória longa |
   | `JWT_REFRESH_SECRET` | outra string aleatória |
   | `JWT_ACCESS_TTL` | `15m` |
   | `JWT_REFRESH_TTL` | `30d` |
   | `CORS_ORIGIN` | domínio do seu front (ex.: `https://financenan.vercel.app`) |
   | `NODE_ENV` | `production` |

5. **Deploy.**

### 4. Testar

- `https://SEU-APP.vercel.app/health` → `{ "status": "ok" }`
- `https://SEU-APP.vercel.app/docs` → Swagger UI
- `POST https://SEU-APP.vercel.app/auth/register`

### Observações da Vercel

- **Pooling:** sempre a URL *pooled* em `DATABASE_URL`. Sem isso, sob carga o Postgres
  recusa conexões. `connection_limit=1` é o recomendado para funções serverless.
- **Cold start:** a primeira requisição após ociosidade é mais lenta (sobe a função + conecta).
- **`maxDuration`:** ajustado para 15s em `vercel.json` (o plano Hobby limita a 10s — reduza se necessário).
- Se aparecer erro de engine do Prisma no runtime, troque o binaryTarget para
  `rhel-openssl-1.0.x` e faça deploy de novo.

---

## B) Alternativas (servidor sempre ligado — mais simples para este backend)

### Railway

1. **New Project → Deploy from GitHub repo**, root = `financenan-backend`.
2. **Add → Database → PostgreSQL** (o Railway injeta `DATABASE_URL`). Defina também
   `DIRECT_URL` com o mesmo valor.
3. Em **Variables**, adicione os segredos JWT e `CORS_ORIGIN`.
4. **Deploy/Start Command:**
   ```bash
   npm run build && npm run prisma:deploy && npm start
   ```
5. Exponha a porta (o Railway define `PORT` automaticamente — a app já lê `process.env.PORT`).

### Render

1. **New → Web Service**, conecte o repo, root = `financenan-backend`.
2. **Build Command:** `npm install && npm run build && npm run prisma:deploy`
3. **Start Command:** `npm start`
4. Crie um **Render PostgreSQL** e copie a *Internal Database URL* para `DATABASE_URL`
   (e `DIRECT_URL`). Adicione os segredos JWT e `CORS_ORIGIN`.

### Fly.io / VPS com Docker

Rode Node + Postgres em containers de longa duração. Use `npm run build`,
`npm run prisma:deploy` no release, e `npm start`. O `docker-compose.yml` incluso serve
de base para o Postgres.

---

## Variáveis de ambiente (resumo)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão de runtime (pooled em serverless). |
| `DIRECT_URL` | sim | Conexão direta para migrations. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | sim | Segredos dos tokens. |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | não | Default `15m` / `30d`. |
| `CORS_ORIGIN` | não | Origens permitidas (default `*`; restrinja em produção). |
| `PORT` / `HOST` | não | Default `3333` / `0.0.0.0` (ignorados na Vercel). |
| `NODE_ENV` | não | `production` em produção. |

## Checklist pós-deploy

- [ ] `GET /health` responde `ok`.
- [ ] `/docs` abre o Swagger.
- [ ] Segredos JWT são aleatórios e diferentes entre si (não os valores de exemplo).
- [ ] `CORS_ORIGIN` restrito ao domínio do front.
- [ ] Migrations aplicadas (`prisma migrate deploy`).
- [ ] Conexão do banco é a **pooled** em ambiente serverless.
