#!/usr/bin/env node
/**
 * Loads the UK jobs dataset (~3,000 roles with required skills) into Supabase's
 * `job_profiles` table. Safe to re-run: rows are upserted by id.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-jobs.mjs path/to/jobs.csv [source-name]
 *
 * Expected CSV header (extra columns are ignored; adjust COLUMN_MAP if the dataset differs):
 *   id,title,alt_titles,skills,summary
 * `alt_titles` and `skills` are lists separated by semicolons.
 * A .json file is also accepted: an array of { id, title, alt_titles, skills, summary }.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Map the dataset's column names onto ours here if they differ.
const COLUMN_MAP = { id: "id", title: "title", alt_titles: "alt_titles", skills: "skills", summary: "summary" };

const [file, source = "uk-jobs-dataset"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node scripts/import-jobs.mjs path/to/jobs.csv [source-name]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const raw = fs.readFileSync(file, "utf8");
const records = path.extname(file).toLowerCase() === ".json" ? JSON.parse(raw) : parseCsv(raw);
const list = (v) => (Array.isArray(v) ? v : String(v ?? "").split(";")).map((s) => String(s).trim()).filter(Boolean);

const rows = records
  .map((r) => ({
    id: String(r[COLUMN_MAP.id] ?? "").trim(),
    title: String(r[COLUMN_MAP.title] ?? "").trim(),
    alt_titles: list(r[COLUMN_MAP.alt_titles]),
    skills: list(r[COLUMN_MAP.skills]),
    summary: r[COLUMN_MAP.summary] ? String(r[COLUMN_MAP.summary]).trim() : null,
    source,
  }))
  .filter((r) => r.id && r.title);

console.log(`Parsed ${rows.length} roles (${records.length - rows.length} skipped without id/title).`);

const db = createClient(url, key, { auth: { persistSession: false } });
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500);
  const { error } = await db.from("job_profiles").upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`Failed at rows ${i}-${i + batch.length}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Upserted ${Math.min(i + batch.length, rows.length)} / ${rows.length}`);
}
console.log("Done.");

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, commas and newlines in quotes). */
function parseCsv(text) {
  const out = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) out.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); out.push(row); }
  const [header, ...data] = out;
  return data.map((r) => Object.fromEntries(header.map((h, j) => [h.trim(), r[j] ?? ""])));
}
