/**
 * Levenshtein distance between two strings.
 * Extracted from app/services/bulk-import/column-mapper.server.ts
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * American Soundex algorithm.
 * Maps a word to a 4-character code based on pronunciation.
 */
export function soundex(word: string): string {
  if (!word) return "";

  const upper = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!upper) return "";

  const map: Record<string, string> = {
    B: "1",
    F: "1",
    P: "1",
    V: "1",
    C: "2",
    G: "2",
    J: "2",
    K: "2",
    Q: "2",
    S: "2",
    X: "2",
    Z: "2",
    D: "3",
    T: "3",
    L: "4",
    M: "5",
    N: "5",
    R: "6",
  };

  let code = upper[0];
  let prevCode = map[upper[0]] ?? "0";

  for (let i = 1; i < upper.length && code.length < 4; i++) {
    const c = map[upper[i]];
    if (c && c !== prevCode) {
      code += c;
    }
    prevCode = c ?? "0";
  }

  return code.padEnd(4, "0");
}

/**
 * Normalize a phone number by stripping all non-digit characters.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
