import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * How the live database hands a stored doc back. Each exhbt is kept in a jsonb column, and jsonb
 * does not keep the order keys were written in: it keeps each object's keys shortest first, and keys
 * of the same length in the order of their bytes. The in-memory store the tests run on keeps keys as
 * written, so a comparison that only works while both sides have the same key order passes here and
 * fails on the live site (release 2 review, figure-fresh-key-order). A test that compares a stored
 * doc with one built another way puts the stored one through `jsonbOrder` first; `throughRealJsonb`
 * checks that against a real Postgres where one is installed.
 */

/** Postgres's order for the keys of a jsonb object: by length in bytes, then by the bytes themselves. */
const byJsonb = (a: string, b: string): number => {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length - y.length || Buffer.compare(x, y);
};

/** The value with every object's keys in jsonb's order, at every depth. Lists keep their order, as they do in jsonb. */
export function jsonbOrder<T>(value: T): T {
  if (Array.isArray(value)) return value.map(jsonbOrder) as T;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(byJsonb)) out[key] = jsonbOrder((value as Record<string, unknown>)[key]);
  return out as T;
}

export type RealJsonb = { values: unknown[]; server: string } | { skipped: string };

/** The folder holding a Postgres server's own programs (initdb, postgres), newest version first, or null when there is none. */
function serverPrograms(): string | null {
  const has = (dir: string) => existsSync(join(dir, "initdb")) && existsSync(join(dir, "postgres"));
  // Debian and Ubuntu, GitHub's runners included, keep them out of the PATH, one folder per version.
  const base = "/usr/lib/postgresql";
  if (existsSync(base)) {
    const versions = readdirSync(base).sort((a, b) => Number(b) - Number(a));
    const found = versions.map((v) => join(base, v, "bin")).find(has);
    if (found) return found;
  }
  // Anywhere else: ask pg_config, when it is on the PATH.
  try {
    const dir = execFileSync("pg_config", ["--bindir"], { stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 }).toString().trim();
    return dir && has(dir) ? dir : null;
  } catch {
    return null;
  }
}

/**
 * Each value written to a real jsonb column and read back, in the order given. It makes a throwaway
 * Postgres cluster in a temporary folder, runs it in single-user mode (no port, no process left
 * behind) and deletes it. Where that can't be done (no Postgres on the machine, or it won't start)
 * the answer is `skipped` with the reason, never an error, so a machine without Postgres still
 * passes. Postgres refuses to run as root, so as root it runs as the `postgres` user.
 */
export function throughRealJsonb(values: unknown[]): RealJsonb {
  const bin = serverPrograms();
  if (!bin) return { skipped: "no PostgreSQL server programs (initdb, postgres) on this machine" };
  const root = typeof process.getuid === "function" && process.getuid() === 0;
  const run = (program: string, args: string[], input?: string): string => {
    const [cmd, all] = root ? ["runuser", ["-u", "postgres", "--", join(bin, program), ...args]] : [join(bin, program), args];
    return execFileSync(cmd, all, { input, stdio: ["pipe", "pipe", "pipe"], timeout: 60_000, maxBuffer: 64 * 1024 * 1024 }).toString();
  };
  let dir: string | null = null;
  try {
    dir = mkdtempSync(join(tmpdir(), "exhbt-jsonb-"));
    if (root) execFileSync("chown", ["postgres", dir], { stdio: "ignore", timeout: 10_000 });
    const data = join(dir, "data");
    run("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C", "--no-sync"]);
    // One statement a line: single-user mode reads a statement up to the end of the line. JSON text has no line breaks.
    const literal = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    const sql = [
      "create table stored (id int primary key, blocks jsonb not null);",
      ...values.map((v, i) => `insert into stored (id, blocks) values (${i}, ${literal(v)});`),
      "select blocks from stored order by id;",
      "",
    ].join("\n");
    const out = run("postgres", ["--single", "-D", data, "-F", "postgres"], sql);
    // A row prints as:  <tab> 1: blocks = "<the jsonb as text>"<tab>(typeid = 3802, len = -1, typmod = -1, byval = f)
    const rows = [...out.matchAll(/^\t 1: blocks = "(.*)"\t\(typeid = \d+, len = -?\d+, typmod = -?\d+, byval = [tf]\)$/gm)].map((m) => JSON.parse(m[1]!) as unknown);
    if (rows.length !== values.length) return { skipped: `PostgreSQL answered ${rows.length} rows for ${values.length} values, so its output couldn't be read` };
    const server = /PostgreSQL stand-alone backend ([^\n]+)/.exec(out)?.[1]?.trim() ?? "PostgreSQL";
    return { values: rows, server };
  } catch (e) {
    const why = (e as Error).message.split("\n").find((line) => line.trim()) ?? "unknown error";
    return { skipped: `PostgreSQL couldn't be run here: ${why.slice(0, 300)}` };
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}
