import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { issueTokens, verifyRefresh } from "../auth/tokens.js";
import { Conflict, Unauthorized } from "../lib/errors.js";
import { DEFAULT_CATEGORIES, DEFAULT_PLAN_CATEGORIES } from "../domain/defaults.js";
import type { RegisterInput } from "../schemas/index.js";

function publicUser(u: { id: string; name: string; email: string; theme: "light" | "dark"; createdAt: Date }) {
  return { id: u.id, name: u.name, email: u.email, theme: u.theme, createdAt: u.createdAt };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict("Email already registered");
  const passwordHash = await hashPassword(input.password);

  // Create user + settings + seed catalog + plan categories atomically (Seeds requirement).
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        settings: { create: { reservaMeses: 6, reservaAccountIds: [], patrimonioExcludedAccountIds: [] } },
        categories: { create: DEFAULT_CATEGORIES.map((c) => ({ nome: c.nome, tipo: c.tipo, cor: c.cor, icone: c.icone })) },
        planCategories: { create: DEFAULT_PLAN_CATEGORIES.map((p) => ({ nome: p.nome, pct: p.pct, abs: 0 })) },
      },
    });
    return u;
  });

  const tokens = issueTokens({ id: user.id, email: user.email });
  return { user: publicUser(user), ...tokens };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw Unauthorized("Invalid credentials");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw Unauthorized("Invalid credentials");
  const tokens = issueTokens({ id: user.id, email: user.email });
  // theme is returned in the login payload so the client can apply it before render.
  return { user: publicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  let claims;
  try {
    claims = verifyRefresh(refreshToken);
  } catch {
    throw Unauthorized("Invalid or expired refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) throw Unauthorized("User no longer exists");
  return issueTokens({ id: user.id, email: user.email });
}

/** forgot-password: structure ready, e-mail sending is mocked. */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always respond the same way to avoid user enumeration.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });
    // MOCK: pretend to send an email. Replace with a real mailer.
    console.info(`[mock-mailer] Password reset for ${email}: token=${token}`);
  }
  return { message: "If the email exists, a reset link has been sent." };
}

export async function updateMe(userId: string, data: { name?: string; theme?: "light" | "dark" }) {
  const user = await prisma.user.update({ where: { id: userId }, data });
  return publicUser(user);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return publicUser(user);
}
