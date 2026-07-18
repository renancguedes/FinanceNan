-- ============================================================================
-- FinanceNan — Schema para acesso DIRETO do front (supabase-js) com RLS.
-- Tabelas com prefixo fn_ espelham as coleções do app (estado local `db`).
-- Dinheiro em CENTAVOS (integer). Ids são os gerados pelo próprio app (text).
-- user_id = auth.uid() por padrão; RLS garante que cada usuário só vê o seu.
-- Rode isto no Supabase → SQL Editor. Pode rodar novamente sem problema.
-- ============================================================================

-- Helper: cria a tabela padrão dona-do-usuário + RLS ------------------------
-- (feito manualmente por tabela abaixo para deixar explícito)

-- ---- Contas ----------------------------------------------------------------
create table if not exists public.fn_contas (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome     text not null,
  tipo     text,
  saldo    integer not null default 0,
  cor      text,
  ativo    boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---- Catálogo de categorias ------------------------------------------------
create table if not exists public.fn_catalogo (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome     text not null,
  tipo     text,
  cor      text,
  icone    text,
  updated_at timestamptz not null default now()
);

-- ---- Cartões ---------------------------------------------------------------
create table if not exists public.fn_cartoes (
  id        text primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome      text not null,
  bandeira  text,
  fecha     integer,
  vence     integer,
  cor       text,
  ativo     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---- Categorias de planejamento (distribuição da renda) --------------------
create table if not exists public.fn_categorias (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome     text not null,
  pct      integer not null default 0,
  abs      integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---- Fontes de renda -------------------------------------------------------
create table if not exists public.fn_fontes (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome     text not null,
  valor    integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---- Itens de planejamento -------------------------------------------------
create table if not exists public.fn_planejamentos (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "catId"  text,
  nome     text not null,
  valor    integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---- Gastos fixos ----------------------------------------------------------
create table if not exists public.fn_fixos (
  id        text primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "desc"    text,
  cat       text,
  "contaId" text,
  valor     integer not null default 0,
  venc      integer,
  obs       text,
  ativo     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---- Receitas --------------------------------------------------------------
create table if not exists public.fn_receitas (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "desc"     text,
  cat        text,
  "contaId"  text,
  data       text,
  valor      integer not null default 0,
  recorrente boolean not null default false,
  recebida   boolean not null default false,
  obs        text,
  updated_at timestamptz not null default now()
);

-- ---- Despesas --------------------------------------------------------------
create table if not exists public.fn_despesas (
  id        text primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "desc"    text,
  cat       text,
  "contaId" text,
  "cartaoId" text,
  data      text,
  venc      text,
  valor     integer not null default 0,
  paga      boolean not null default false,
  obs       text,
  "fixoId"  text,
  updated_at timestamptz not null default now()
);

-- ---- Configurações (1 linha por usuário) -----------------------------------
create table if not exists public.fn_settings (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  "patrimonioExcl" text[] not null default '{}',
  "reservaIds"     text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---- RLS + políticas (cada usuário só enxerga/edita as próprias linhas) -----
do $$
declare t text;
begin
  foreach t in array array[
    'fn_contas','fn_catalogo','fn_cartoes','fn_categorias','fn_fontes',
    'fn_planejamentos','fn_fixos','fn_receitas','fn_despesas','fn_settings'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "own_select" on public.%I;', t);
    execute format('drop policy if exists "own_insert" on public.%I;', t);
    execute format('drop policy if exists "own_update" on public.%I;', t);
    execute format('drop policy if exists "own_delete" on public.%I;', t);
    execute format('create policy "own_select" on public.%I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy "own_delete" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;
