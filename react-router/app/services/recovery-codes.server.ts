import crypto from "node:crypto";
import { hash, compare } from "bcryptjs";
import { prisma } from "~/lib/db/db.server";
import { env } from "~/lib/config/env.server";

const CODE_COUNT = 10;
const CODE_LENGTH = 8;
const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
}

export async function generateRecoveryCodes(userId: string): Promise<string[]> {
  // Delete existing codes
  await prisma.recoveryCode.deleteMany({ where: { userId } });

  const codes: string[] = [];
  for (let i = 0; i < CODE_COUNT; i++) {
    const code = generateCode();
    codes.push(code);
    const codeHash = await hash(code, env.BCRYPT_ROUNDS);
    await prisma.recoveryCode.create({
      data: { userId, codeHash },
    });
  }

  return codes;
}

export async function validateRecoveryCode(userId: string, code: string): Promise<boolean> {
  const recoveryCodes = await prisma.recoveryCode.findMany({
    where: { userId, usedAt: null },
  });

  for (const rc of recoveryCodes) {
    const matches = await compare(code.toLowerCase().trim(), rc.codeHash);
    if (matches) {
      await prisma.recoveryCode.update({
        where: { id: rc.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }

  return false;
}

export async function getRemainingCodeCount(userId: string): Promise<number> {
  return prisma.recoveryCode.count({
    where: { userId, usedAt: null },
  });
}
