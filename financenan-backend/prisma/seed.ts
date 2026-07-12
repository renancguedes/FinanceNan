/**
 * Demo seed — creates a ready-to-explore user.
 * Login: demo@financenan.app / demo1234
 * All monetary values are in centavos.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES, DEFAULT_PLAN_CATEGORIES } from "../src/domain/defaults.js";
import { calcCardDueDate } from "../src/domain/dates.js";

const prisma = new PrismaClient();
const R = (reais: number) => Math.round(reais * 100); // reais -> centavos

async function main() {
  const email = "demo@financenan.app";
  await prisma.user.deleteMany({ where: { email } }); // cascade cleans everything

  const passwordHash = await bcrypt.hash("demo1234", 12);
  const user = await prisma.user.create({
    data: {
      name: "Demo FinanceNan", email, passwordHash, theme: "dark",
      settings: { create: { reservaMeses: 6, reservaAccountIds: [], patrimonioExcludedAccountIds: [] } },
      categories: { create: DEFAULT_CATEGORIES.map((c) => ({ nome: c.nome, tipo: c.tipo, cor: c.cor, icone: c.icone })) },
      planCategories: { create: DEFAULT_PLAN_CATEGORIES.map((p) => ({ nome: p.nome, pct: p.pct, abs: 0 })) },
    },
  });
  const uid = user.id;

  const cat = async (nome: string) =>
    (await prisma.category.findFirstOrThrow({ where: { userId: uid, nome } })).id;

  // Income sources
  await prisma.incomeSource.createMany({ data: [
    { userId: uid, nome: "Salário", valor: R(6500) },
    { userId: uid, nome: "Freelance", valor: R(1400) },
  ] });

  // Accounts
  const [cc, cd, dinheiro, cdb, tesouro, acoes] = await Promise.all([
    prisma.account.create({ data: { userId: uid, nome: "Conta Corrente", tipo: "conta_bancaria", saldo: R(4820), cor: "#4f6bd8" } }),
    prisma.account.create({ data: { userId: uid, nome: "Carteira Digital", tipo: "carteira_digital", saldo: R(1230), cor: "#3e9c7b" } }),
    prisma.account.create({ data: { userId: uid, nome: "Dinheiro", tipo: "dinheiro_fisico", saldo: R(350), cor: "#b8933e" } }),
    prisma.account.create({ data: { userId: uid, nome: "CDB Liquidez Diária", tipo: "investimento", saldo: R(8200), cor: "#7c5cbf" } }),
    prisma.account.create({ data: { userId: uid, nome: "Tesouro Selic", tipo: "investimento", saldo: R(6400), cor: "#5a9aa8" } }),
    prisma.account.create({ data: { userId: uid, nome: "Carteira de Ações", tipo: "investimento", saldo: R(3900), cor: "#c94f6d" } }),
  ]);

  await prisma.settings.update({ where: { userId: uid }, data: { reservaAccountIds: [cdb.id, tesouro.id] } });

  // Credit cards
  const ametista = await prisma.creditCard.create({ data: { userId: uid, nome: "Ametista", bandeira: "Mastercard", cor: "#7c5cbf", diaFechamento: 28, diaVencimento: 7 } });
  await prisma.creditCard.create({ data: { userId: uid, nome: "Safira", bandeira: "Visa", cor: "#4f6bd8", diaFechamento: 15, diaVencimento: 22 } });
  await prisma.creditCard.create({ data: { userId: uid, nome: "Antigo Gold", bandeira: "Visa", cor: "#8a8f98", diaFechamento: 10, diaVencimento: 17, ativo: false } });

  // Fixed expenses
  await prisma.fixedExpense.createMany({ data: [
    { userId: uid, descricao: "Aluguel", categoryId: await cat("Moradia"), valor: R(1800), diaVencimento: 5, contaPadraoId: cc.id },
    { userId: uid, descricao: "Energia elétrica", categoryId: await cat("Moradia"), valor: R(160), diaVencimento: 10 },
    { userId: uid, descricao: "Internet", categoryId: await cat("Moradia"), valor: R(99), diaVencimento: 15, observacoes: "Fibra 500MB" },
    { userId: uid, descricao: "Plano de saúde", categoryId: await cat("Saúde"), valor: R(420), diaVencimento: 8 },
    { userId: uid, descricao: "Academia", categoryId: await cat("Saúde"), valor: R(120), diaVencimento: 12, contaPadraoId: cd.id },
    { userId: uid, descricao: "Streaming", categoryId: await cat("Assinaturas"), valor: R(45), diaVencimento: 20, contaPadraoId: cd.id },
  ] });

  // Plan items
  const planCat = async (nome: string) =>
    (await prisma.planCategory.findFirstOrThrow({ where: { userId: uid, nome } })).id;
  await prisma.planItem.createMany({ data: [
    { userId: uid, planCategoryId: await planCat("Prazeres"), nome: "Cinema", valor: R(80) },
    { userId: uid, planCategoryId: await planCat("Prazeres"), nome: "Restaurantes", valor: R(320) },
    { userId: uid, planCategoryId: await planCat("Prazeres"), nome: "Show", valor: R(450) },
    { userId: uid, planCategoryId: await planCat("Metas"), nome: "Viagem de fim de ano", valor: R(900) },
    { userId: uid, planCategoryId: await planCat("Conhecimento"), nome: "Curso de inglês", valor: R(300) },
    { userId: uid, planCategoryId: await planCat("Liberdade Financeira"), nome: "Aporte investimentos", valor: R(1900) },
  ] });

  // A couple of transactions in the current month
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await prisma.income.create({ data: { userId: uid, descricao: "Salário", categoryId: await cat("Salário"), accountId: cc.id, data: new Date(`${ym}-05`), valor: R(6500), recebida: true, recorrente: true } });
  const venc = calcCardDueDate(ametista.diaFechamento, ametista.diaVencimento, `${ym}-10`);
  await prisma.expense.create({ data: { userId: uid, descricao: "Supermercado", categoryId: await cat("Alimentação"), creditCardId: ametista.id, dataCompra: new Date(`${ym}-10`), dataVencimento: new Date(venc), valor: R(480) } });

  console.info(`Seeded demo user ${email} (password: demo1234)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
