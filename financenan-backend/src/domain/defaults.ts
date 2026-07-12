// Default catalog + plan categories, seeded per-user on registration.
import type { CategoryType } from "@prisma/client";

export interface DefaultCategory {
  nome: string;
  tipo: CategoryType;
  cor: string;
  icone: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { nome: "Salário", tipo: "receita", cor: "#3e9c7b", icone: "trabalho" },
  { nome: "Freelance", tipo: "receita", cor: "#4f6bd8", icone: "grafico" },
  { nome: "Aluguel", tipo: "receita", cor: "#7c5cbf", icone: "casa" },
  { nome: "Dividendos", tipo: "receita", cor: "#b8933e", icone: "moeda" },
  { nome: "Outros", tipo: "receita", cor: "#8a8f98", icone: "presente" },
  { nome: "Moradia", tipo: "despesa", cor: "#7c5cbf", icone: "casa" },
  { nome: "Alimentação", tipo: "despesa", cor: "#c2703d", icone: "comida" },
  { nome: "Transporte", tipo: "despesa", cor: "#4f6bd8", icone: "carro" },
  { nome: "Saúde", tipo: "despesa", cor: "#c94f6d", icone: "saude" },
  { nome: "Lazer", tipo: "despesa", cor: "#b8933e", icone: "lazer" },
  { nome: "Educação", tipo: "despesa", cor: "#5a9aa8", icone: "educacao" },
  { nome: "Assinaturas", tipo: "despesa", cor: "#8a8f98", icone: "tv" },
  { nome: "Aportes", tipo: "investimento", cor: "#3e9c7b", icone: "moeda" },
  { nome: "Renda Fixa", tipo: "investimento", cor: "#b8933e", icone: "grafico" },
  { nome: "Ações", tipo: "investimento", cor: "#4f6bd8", icone: "grafico" },
];

export interface DefaultPlanCategory {
  nome: string;
  pct: number;
}

export const DEFAULT_PLAN_CATEGORIES: DefaultPlanCategory[] = [
  { nome: "Liberdade Financeira", pct: 25 },
  { nome: "Custos Fixos", pct: 30 },
  { nome: "Conforto", pct: 15 },
  { nome: "Metas", pct: 15 },
  { nome: "Prazeres", pct: 10 },
  { nome: "Conhecimento", pct: 5 },
];
