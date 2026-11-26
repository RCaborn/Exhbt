// Shared by the check scripts that read the source: every file whose name matches `ext` (.ts and .tsx by default) under some folders, minus some paths.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function* walk(dir, skip = () => false, ext = /\.(ts|tsx)$/) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name).replaceAll("\\", "/");
    if (skip(path)) continue;
    const s = statSync(path);
    if (s.isDirectory()) yield* walk(path, skip, ext);
    else if (ext.test(name)) yield path;
  }
}

export const read = (path) => readFileSync(path, "utf8");

/** The design lab is not part of the product, and themes/ holds the theme's own source. */
export const isLab = (path) => path.startsWith("app/lab") || path.startsWith("components/lab");
