/**
 * Post-install setup script.
 *
 * Runs automatically after `npm install` (via the "postinstall" hook).
 * Fully automates project bootstrap in 10 phases (0–9).
 * Idempotent — skips steps that are already done.
 * No phase failure aborts the script; each catches errors and warns.
 *
 * Phases:
 *  0. Marker check     — `.setup-done` exists → skip all, only re-init Husky
 *  1. Copy .env        — `.env.example` → `.env`
 *  2. SESSION_SECRET   — Generate random 32-char secret
 *  3. Detect ports     — Probe free ports, update .env + derived vars
 *  4. Package name     — Replace template name with folder name
 *  5. Husky            — Init git hooks
 *  6. Prisma generate  — Generate Prisma client
 *  7. Cleanup          — Remove template docs (CLAUDE.md, docs/)
 *  8. Docker           — Start containers if Docker is available
 *  9. DB push + seed   — Wait for DB, then push schema and seed
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
import { createServer } from "node:net";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ENV_EXAMPLE = resolve(ROOT, ".env.example");
const ENV_FILE = resolve(ROOT, ".env");
const MARKER = resolve(ROOT, ".setup-done");

// ─── Default ports from .env.example ────────────────────
const DEFAULT_PORTS = {
  DB_PORT: 5432,
  DB_TEST_PORT: 5433,
  MAILPIT_UI_PORT: 8025,
  MAILPIT_SMTP_PORT: 1025,
  PORT: 3000,
};

const PORT_RANGES = {
  DB_PORT: [5432, 5499],
  DB_TEST_PORT: [5432, 5499],
  MAILPIT_UI_PORT: [8025, 8099],
  MAILPIT_SMTP_PORT: [1025, 1099],
  PORT: [3000, 3099],
};

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

/**
 * Check if a port is free by attempting to listen on it.
 * Returns a promise that resolves to true if free, false if in use.
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Find a free port in [rangeStart, rangeEnd], starting with preferred.
 * Returns the free port, or preferred if none found (best-effort).
 */
async function findFreePort(preferred, rangeStart, rangeEnd) {
  // Try preferred first
  if (await isPortFree(preferred)) return preferred;

  // Scan the range
  for (let port = rangeStart; port <= rangeEnd; port++) {
    if (port === preferred) continue;
    if (await isPortFree(port)) return port;
  }

  // Fallback to preferred — Docker will report the conflict clearly
  warn(`No free port found in ${rangeStart}–${rangeEnd}, using ${preferred}`);
  return preferred;
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

function initHusky() {
  if (isGitRepo()) {
    try {
      execSync("npx husky", { cwd: ROOT, stdio: "ignore" });
      log("Phase 5: Initialized Husky git hooks.");
    } catch {
      warn("Phase 5: Could not initialize Husky — run `npm run prepare` manually.");
    }
  } else {
    log("Phase 5: Not a git repository — skipping Husky.");
  }
}

// ─── Phase 0: Marker check ─────────────────────────────

if (existsSync(MARKER)) {
  log("Phase 0: .setup-done found — skipping bootstrap phases.");
  initHusky();
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

// ─── Phase 3: Detect & assign ports ─────────────────────

let portsChanged = false;

try {
  if (existsSync(ENV_FILE)) {
    let env = readFileSync(ENV_FILE, "utf-8");

    // Parse current port values from .env
    const currentPorts = {};
    for (const key of Object.keys(DEFAULT_PORTS)) {
      const match = env.match(new RegExp(`^${key}=(\\d+)`, "m"));
      currentPorts[key] = match ? parseInt(match[1], 10) : DEFAULT_PORTS[key];
    }

    // Check if any port has already been changed from default
    const alreadyCustomized = Object.keys(DEFAULT_PORTS).some(
      (key) => currentPorts[key] !== DEFAULT_PORTS[key],
    );

    if (alreadyCustomized) {
      log("Phase 3: Ports already customized — skipping.");
    } else {
      const assignedPorts = {};
      const usedPorts = new Set();

      // Assign ports sequentially to avoid conflicts between our own services
      for (const key of Object.keys(DEFAULT_PORTS)) {
        const preferred = DEFAULT_PORTS[key];
        const [rangeStart, rangeEnd] = PORT_RANGES[key];

        let port = preferred;
        if (!(await isPortFree(preferred)) || usedPorts.has(preferred)) {
          // Find an alternative
          for (let p = rangeStart; p <= rangeEnd; p++) {
            if (p === preferred || usedPorts.has(p)) continue;
            if (await isPortFree(p)) {
              port = p;
              break;
            }
          }
        }

        assignedPorts[key] = port;
        usedPorts.add(port);
      }

      // Check if any port actually changed
      const anyChanged = Object.keys(DEFAULT_PORTS).some(
        (key) => assignedPorts[key] !== DEFAULT_PORTS[key],
      );

      if (anyChanged) {
        // Update individual port variables
        for (const [key, port] of Object.entries(assignedPorts)) {
          env = env.replace(new RegExp(`^${key}=\\d+`, "m"), `${key}=${port}`);
        }

        // Update derived variables
        const dbPort = assignedPorts.DB_PORT;
        const appPort = assignedPorts.PORT;

        env = env.replace(
          /^DATABASE_URL="postgresql:\/\/postgres:postgres@localhost:\d+\/app"/m,
          `DATABASE_URL="postgresql://postgres:postgres@localhost:${dbPort}/app"`,
        );
        env = env.replace(
          /^BASE_URL="http:\/\/localhost:\d+"/m,
          `BASE_URL="http://localhost:${appPort}"`,
        );
        env = env.replace(
          /^CORS_ORIGINS="http:\/\/localhost:\d+"/m,
          `CORS_ORIGINS="http://localhost:${appPort}"`,
        );

        writeFileSync(ENV_FILE, env);
        portsChanged = true;

        const changed = Object.entries(assignedPorts)
          .filter(([key, port]) => port !== DEFAULT_PORTS[key])
          .map(([key, port]) => `${key}=${port}`)
          .join(", ");
        log(`Phase 3: Assigned free ports — ${changed}`);
      } else {
        log("Phase 3: All default ports are free — no changes needed.");
      }
    }
  }
} catch (err) {
  warn(`Phase 3: Port detection failed — ${err.message}`);
}

// ─── Phase 4: Package name ──────────────────────────────

try {
  const pkgPath = resolve(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  if (pkg.name !== "react-router-template") {
    log("Phase 4: Package name already changed — skipping.");
  } else {
    const folderName = basename(ROOT);
    const newName = sanitizePackageName(folderName);

    if (newName && newName !== "react-router-template") {
      pkg.name = newName;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
      log(`Phase 4: Updated package name to "${newName}".`);
    } else {
      log("Phase 4: Folder name matches template — skipping.");
    }
  }
} catch (err) {
  warn(`Phase 4: Failed to update package name — ${err.message}`);
}

// ─── Phase 5: Husky ─────────────────────────────────────

initHusky();

// ─── Phase 6: Prisma generate ───────────────────────────

try {
  const prismaOutput = resolve(ROOT, "app", "generated", "prisma");
  if (existsSync(prismaOutput) && readdirSync(prismaOutput).length > 0) {
    log("Phase 6: Prisma client already generated — skipping.");
  } else {
    log("Phase 6: Generating Prisma client…");
    execSync("npx prisma generate", { cwd: ROOT, stdio: "inherit" });
    log("Phase 6: Prisma client generated.");
  }
} catch (err) {
  warn(`Phase 6: Prisma generate failed — ${err.message}`);
}

// ─── Phase 7: Cleanup template docs ─────────────────────

try {
  let cleaned = false;
  const claudeMd = resolve(ROOT, "CLAUDE.md");
  const docsDir = resolve(ROOT, "docs");

  if (existsSync(claudeMd)) {
    rmSync(claudeMd);
    cleaned = true;
  }
  if (existsSync(docsDir)) {
    rmSync(docsDir, { recursive: true, force: true });
    cleaned = true;
  }

  if (cleaned) {
    log("Phase 7: Removed template docs (CLAUDE.md, docs/).");
  } else {
    log("Phase 7: Template docs already removed — skipping.");
  }
} catch (err) {
  warn(`Phase 7: Cleanup failed — ${err.message}`);
}

// ─── Phase 8: Docker ────────────────────────────────────

let dockerStarted = false;

try {
  if (isDockerRunning()) {
    log("Phase 8: Starting Docker containers…");
    execSync("docker compose up -d", { cwd: ROOT, stdio: "inherit" });
    dockerStarted = true;
    log("Phase 8: Docker containers started.");
  } else {
    warn("Phase 8: Docker not running — skipping. Start Docker and run:");
    console.log("  npm run docker:up && npm run db:push && npm run db:seed");
  }
} catch (err) {
  warn(`Phase 8: Docker start failed — ${err.message}`);
  console.log("  Run manually: npm run docker:up && npm run db:push && npm run db:seed");
}

// ─── Phase 9: DB push + seed ────────────────────────────

if (dockerStarted) {
  try {
    // Read the DB port from .env for pg_isready
    let dbPort = DEFAULT_PORTS.DB_PORT;
    if (existsSync(ENV_FILE)) {
      const env = readFileSync(ENV_FILE, "utf-8");
      const match = env.match(/^DB_PORT=(\d+)/m);
      if (match) dbPort = parseInt(match[1], 10);
    }

    log("Phase 9: Waiting for database to be ready…");
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        execSync(`pg_isready -h localhost -p ${dbPort}`, { stdio: "ignore" });
        ready = true;
        break;
      } catch {
        // Wait 1 second before retrying
        execSync("sleep 1", { stdio: "ignore" });
      }
    }

    if (ready) {
      log("Phase 9: Database is ready. Pushing schema…");
      execSync("npx prisma db push", { cwd: ROOT, stdio: "inherit" });
      log("Phase 9: Schema pushed. Seeding database…");
      execSync("npx prisma db seed", { cwd: ROOT, stdio: "inherit" });
      log("Phase 9: Database seeded.");
    } else {
      warn("Phase 9: Database not ready after 30s — run manually:");
      console.log("  npm run db:push && npm run db:seed");
    }
  } catch (err) {
    warn(`Phase 9: DB setup failed — ${err.message}`);
    console.log("  Run manually: npm run db:push && npm run db:seed");
  }
} else {
  log("Phase 9: Skipped (Docker not started).");
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
