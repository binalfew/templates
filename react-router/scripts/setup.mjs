/**
 * Post-install setup script.
 *
 * Run via `npm run setup` after scaffolding a new project.
 * Idempotent — skips steps that are already done.
 * No phase failure aborts the script; each catches errors and warns.
 *
 * Phases:
 *  0. Marker check     — `.setup-done` exists → skip all
 *  1. Copy .env        — `.env.example` → `.env`, remove `.env.example`
 *  2. SESSION_SECRET   — Generate random 32-char secret
 *  3. Package + DB name — Replace template name with folder name
 *  4. Husky            — Init git hooks
 *  5. Prisma generate  — Generate Prisma client
 *  6. Docker           — Start containers if Docker is available
 *  7. DB push + seed   — Wait for DB, then push schema and seed
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ENV_EXAMPLE = resolve(ROOT, ".env.example");
const ENV_FILE = resolve(ROOT, ".env");
const MARKER = resolve(ROOT, ".setup-done");

// ─── Helpers ─────────────────────────────────────────────

function log(msg) {
  console.log(`\x1b[36m[setup]\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m[setup]\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m[setup]\x1b[0m ${msg}`);
}

function generateSecret(length = 32) {
  return randomBytes(length).toString("base64url").slice(0, length);
}

function isGitRepo() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isDockerRunning() {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function sanitizePackageName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9@/._-]/g, "-")
    .replace(/^[._-]+/, "");
}

function sanitizeDbName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/g, "");
}

// ─── Phase 0: Marker check ─────────────────────────────

if (existsSync(MARKER)) {
  log("Phase 0: .setup-done found — skipping. Delete .setup-done to re-run setup.");
  process.exit(0);
}

log("Starting project setup…\n");

// ─── Phase 1: Copy .env ─────────────────────────────────

try {
  if (existsSync(ENV_FILE)) {
    log("Phase 1: .env already exists — skipping copy.");
  } else if (!existsSync(ENV_EXAMPLE)) {
    warn("Phase 1: .env.example not found — skipping .env creation.");
  } else {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    rmSync(ENV_EXAMPLE);
    log("Phase 1: Copied .env.example → .env and removed .env.example");
  }
} catch (err) {
  warn(`Phase 1: Failed to copy .env — ${err.message}`);
}

// ─── Phase 2: Generate SESSION_SECRET ───────────────────

try {
  if (existsSync(ENV_FILE)) {
    let env = readFileSync(ENV_FILE, "utf-8");
    const placeholder = "generate-a-random-32-char-string";

    if (env.includes(placeholder)) {
      const secret = generateSecret();
      env = env.replace(placeholder, secret);
      writeFileSync(ENV_FILE, env);
      log("Phase 2: Generated random SESSION_SECRET.");
    } else {
      log("Phase 2: SESSION_SECRET already set — skipping.");
    }
  }
} catch (err) {
  warn(`Phase 2: Failed to generate SESSION_SECRET — ${err.message}`);
}

// ─── Phase 3: Package name + DB name ────────────────────

try {
  const folderName = basename(ROOT);
  const newName = sanitizePackageName(folderName);
  const dbName = sanitizeDbName(folderName);

  // 3a: Update package.json name
  const pkgPath = resolve(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  if (pkg.name !== "react-router-template") {
    log("Phase 3a: Package name already changed — skipping.");
  } else if (newName && newName !== "react-router-template") {
    pkg.name = newName;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    log(`Phase 3a: Updated package name to "${newName}".`);
  } else {
    log("Phase 3a: Folder name matches template — skipping.");
  }

  // 3b: Update DB names in .env (independent of package name check)
  if (existsSync(ENV_FILE) && dbName && dbName !== "app") {
    let env = readFileSync(ENV_FILE, "utf-8");
    const hasDefault = env.match(/^DB_NAME=app$/m);

    if (hasDefault) {
      env = env.replace(/^DB_NAME=app$/m, `DB_NAME=${dbName}`);
      env = env.replace(/^DB_TEST_NAME=app_test$/m, `DB_TEST_NAME=${dbName}_test`);
      env = env.replace(
        /^(DATABASE_URL="postgresql:\/\/[^/]+\/)app(")/m,
        `$1${dbName}$2`,
      );
      env = env.replace(
        /^(SMTP_FROM="noreply@)app(\.local")/m,
        `$1${dbName}$2`,
      );
      writeFileSync(ENV_FILE, env);
      log(`Phase 3b: Updated DB name to "${dbName}".`);
    } else {
      log("Phase 3b: DB name already customized — skipping.");
    }
  } else {
    log("Phase 3b: DB name unchanged — skipping.");
  }
} catch (err) {
  warn(`Phase 3: Failed to update package/DB name — ${err.message}`);
}

// ─── Phase 4: Husky ─────────────────────────────────────

if (isGitRepo()) {
  try {
    execSync("npx husky", { cwd: ROOT, stdio: "ignore" });
    log("Phase 4: Initialized Husky git hooks.");
  } catch {
    warn("Phase 4: Could not initialize Husky — run `npm run prepare` manually.");
  }
} else {
  log("Phase 4: Not a git repository — skipping Husky.");
}

// ─── Phase 5: Prisma generate ───────────────────────────

try {
  const prismaOutput = resolve(ROOT, "app", "generated", "prisma");
  if (existsSync(prismaOutput) && readdirSync(prismaOutput).length > 0) {
    log("Phase 5: Prisma client already generated — skipping.");
  } else {
    log("Phase 5: Generating Prisma client…");
    execSync("npx prisma generate", { cwd: ROOT, stdio: "inherit" });
    log("Phase 5: Prisma client generated.");
  }
} catch (err) {
  warn(`Phase 5: Prisma generate failed — ${err.message}`);
}

// ─── Phase 6: Docker ────────────────────────────────────

let dockerStarted = false;

try {
  if (isDockerRunning()) {
    log("Phase 6: Starting Docker containers…");
    execSync("docker compose up -d", { cwd: ROOT, stdio: "inherit" });
    dockerStarted = true;
    log("Phase 6: Docker containers started.");
  } else {
    warn("Phase 6: Docker not running — skipping. Start Docker and run:");
    console.log("  npm run docker:up && npm run db:push && npm run db:seed");
  }
} catch (err) {
  warn(`Phase 6: Docker start failed — ${err.message}`);
  console.log("  Run manually: npm run docker:up && npm run db:push && npm run db:seed");
}

// ─── Phase 7: DB push + seed ────────────────────────────

if (dockerStarted) {
  try {
    // Read the DB port from .env for pg_isready
    let dbPort = 5432;
    if (existsSync(ENV_FILE)) {
      const env = readFileSync(ENV_FILE, "utf-8");
      const match = env.match(/^DB_PORT=(\d+)/m);
      if (match) dbPort = parseInt(match[1], 10);
    }

    log("Phase 7: Waiting for database to be ready…");
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        execSync(`pg_isready -h localhost -p ${dbPort}`, { stdio: "ignore" });
        ready = true;
        break;
      } catch {
        execSync("sleep 1", { stdio: "ignore" });
      }
    }

    if (ready) {
      log("Phase 7: Database is ready. Pushing schema…");
      execSync("npx prisma db push", { cwd: ROOT, stdio: "inherit" });
      log("Phase 7: Schema pushed. Seeding database…");
      execSync("npx prisma db seed", { cwd: ROOT, stdio: "inherit" });
      log("Phase 7: Database seeded.");
    } else {
      warn("Phase 7: Database not ready after 30s — run manually:");
      console.log("  npm run db:push && npm run db:seed");
    }
  } catch (err) {
    warn(`Phase 7: DB setup failed — ${err.message}`);
    console.log("  Run manually: npm run db:push && npm run db:seed");
  }
} else {
  log("Phase 7: Skipped (Docker not started).");
}

// ─── Write marker & finish ──────────────────────────────

try {
  writeFileSync(MARKER, new Date().toISOString() + "\n");
} catch {
  // Non-critical
}

console.log("");
success("Setup complete! Run `npm run dev` to start developing.");

if (existsSync(ENV_FILE)) {
  const env = readFileSync(ENV_FILE, "utf-8");
  const portMatch = env.match(/^PORT=(\d+)/m);
  const port = portMatch ? portMatch[1] : "3000";
  console.log(`\n  Open http://localhost:${port} in your browser.\n`);
}

if (!dockerStarted) {
  console.log("  Docker was not running. To finish setup:");
  console.log("  1. Start Docker Desktop");
  console.log("  2. npm run docker:up");
  console.log("  3. npm run db:push");
  console.log("  4. npm run db:seed\n");
}
