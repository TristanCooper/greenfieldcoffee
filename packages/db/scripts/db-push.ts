/**
 * Migration runner. Applies any unapplied *.sql files in migrations/ to the
 * database referenced by SUPABASE_DB_URL.
 *
 * Usage:
 *   pnpm --filter @greenfield/db push           # apply pending migrations
 *   pnpm --filter @greenfield/db push --dry    # show what would be applied
 *
 * Reads SUPABASE_DB_URL from apps/web/.env.local — the script reaches up
 * to find it because that's where Next.js loads env vars from. The password
 * is never logged or echoed back to the terminal.
 *
 * Each migration runs in its own transaction. A failed migration aborts
 * and the script exits non-zero without recording it in schema_migrations,
 * so re-running picks up where it left off.
 */

import { Client } from 'pg';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dns from 'node:dns';

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths relative to the package root.
// __dirname is packages/db/scripts/ at runtime; migrations are one level up.
const PACKAGE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const MIGRATIONS_DIR = join(PACKAGE_ROOT, 'migrations');
const ENV_FILE = join(REPO_ROOT, 'apps', 'web', '.env.local');

const DRY_RUN = process.argv.includes('--dry') || process.argv.includes('--dry-run');

// --mark <file>: record a filename as applied without running its SQL.
// Useful when a migration was applied by hand and you want the runner to
// pick up where the manual run left off.
const markArgIdx = process.argv.findIndex((a) => a === '--mark');
const MARK_FILE = markArgIdx >= 0 ? process.argv[markArgIdx + 1] : null;

/**
 * Minimal .env.local parser. Only reads KEY=VALUE lines; ignores comments,
 * blank lines, and quoted values (handles basic single/double-quote stripping).
 * Returns a plain object.
 */
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Strip the password from a connection string for safe display.
 * Handles both URI-style (postgresql://user:***@host) and key-value style.
 */
function redactUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ':***@');
}

/**
 * Build a pg.Client config from a connection string, applying the same
 * IPv4 pre-resolution as the main path. Used by both the main run and the
 * --mark short-circuit so behaviour is consistent.
 */
async function clientConfigForFamily(
  url: string,
  family: number,
): Promise<{ connectionString: string; hostaddr?: string }> {
  const config: { connectionString: string; hostaddr?: string } = { connectionString: url };
  if (family === 4) {
    const resolved = await resolveIPv4FromConnectionString(url);
    if (resolved) {
      config.hostaddr = resolved.ipv4;
      console.log(`[db:push] resolved ${resolved.host} -> ${resolved.ipv4} (forced IPv4)`);
    } else {
      console.log(`[db:push] could not pre-resolve IPv4; letting pg try`);
    }
  }
  return config;
}

/**
 * Pull the host out of a postgresql:// URL and resolve it to an IPv4 address.
 * Returns null if the URL can't be parsed or DNS doesn't return an A record.
 */
async function resolveIPv4FromConnectionString(
  url: string,
): Promise<{ host: string; ipv4: string } | null> {
  const match = url.match(/^postgresql:\/\/[^@/]+@([^:/]+)/);
  if (!match) return null;
  const host = match[1]!;
  try {
    const { address } = await dns.promises.lookup(host, { family: 4 });
    return { host, ipv4: address };
  } catch {
    return null;
  }
}

function listMigrations(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getApplied(client: Client): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    'select filename from public.schema_migrations order by filename',
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function main(): Promise<void> {
  const env = loadEnvFile(ENV_FILE);
  const url = env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      `[db:push] SUPABASE_DB_URL is not set. Add it to ${ENV_FILE}.`,
    );
    process.exit(1);
  }

  console.log(`[db:push] connecting to ${redactUrl(url)}`);
  // Force IPv4. Supabase's direct db.* hostname often resolves only to AAAA
  // (IPv6) records; some networks can't reach them. pg@8 doesn't expose a
  // `family` client option, so we resolve the hostname ourselves and pass
  // the resolved IPv4 as `hostaddr` — pg will use that for the TCP connect
  // while still doing TLS/SNI on the original hostname.
  //
  // Override by setting PG_FAMILY=6 if you're on an IPv6-only network.
  const family = process.env.PG_FAMILY === '6' ? 6 : 4;

  // In dry-run mode we don't connect — we just list what would be applied.
  if (DRY_RUN) {
    const all = listMigrations();
    console.log(`[db:push] dry run — found ${all.length} migration file(s):`);
    for (const f of all) console.log(`  - ${f}`);
    console.log('[db:push] no database connection made');
    return;
  }

  // --mark <file>: connect, record the file as applied, disconnect.
  if (MARK_FILE) {
    const client = new Client(clientConfigForFamily(url, family));
    await client.connect();
    try {
      await client.query(
        'insert into public.schema_migrations (filename) values ($1) on conflict (filename) do nothing',
        [MARK_FILE],
      );
      console.log(`[db:push] marked ${MARK_FILE} as applied`);
    } finally {
      await client.end();
    }
    return;
  }

  const clientConfig = await clientConfigForFamily(url, family);

  const client = new Client(clientConfig);
  try {
    await client.connect();
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENETUNREACH') {
      console.error('');
      console.error('[db:push] connection failed: this network cannot reach the database host.');
      console.error('[db:push] This usually means the hostname resolves only to IPv6 (AAAA records),');
      console.error('[db:push] and your network has no IPv6 route. Supabase direct hosts (db.*.supabase.co)');
      console.error('[db:push] are IPv6-only on most projects.');
      console.error('');
      console.error('[db:push] Workaround: use the Supabase connection pooler instead.');
      console.error('[db:push]   1. Dashboard -> Project Settings -> Database -> Connection string');
      console.error('[db:push]   2. Choose "Connection pooling" (port 6543) instead of "Direct connection"');
      console.error('[db:push]   3. Copy the URI and replace SUPABASE_DB_URL in apps/web/.env.local');
      console.error('[db:push]   4. Re-run this script');
      console.error('');
    }
    throw err;
  }
  console.log('[db:push] connected');

  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const all = listMigrations();
    const pending = all.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`[db:push] no pending migrations (${all.length} total applied)`);
      return;
    }

    console.log(`[db:push] ${pending.length} pending migration(s):`);
    for (const filename of pending) console.log(`  - ${filename}`);

    if (DRY_RUN) {
      console.log('[db:push] dry run — no changes applied');
      return;
    }

    for (const filename of pending) {
      const fullPath = join(MIGRATIONS_DIR, filename);
      const sql = readFileSync(fullPath, 'utf8');
      console.log(`[db:push] applying ${basename(filename)} (${sql.length} bytes)`);

      try {
        await client.query('begin');
        await client.query(sql);
        await client.query(
          'insert into public.schema_migrations (filename) values ($1)',
          [filename],
        );
        await client.query('commit');
        console.log(`[db:push]   ok`);
      } catch (err) {
        await client.query('rollback').catch(() => undefined);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[db:push]   FAILED: ${msg}`);
        console.error(`[db:push] transaction rolled back; ${filename} not recorded`);
        process.exit(1);
      }
    }

    console.log(`[db:push] done — applied ${pending.length} migration(s)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:push] unexpected error:', err);
  process.exit(1);
});