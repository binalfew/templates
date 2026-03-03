import { hash, compare } from "bcryptjs";
import { env } from "~/lib/env.server";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}
