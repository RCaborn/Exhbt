/**
 * Comparing data by what it holds, not by how its JSON text happens to read.
 *
 * Two copies of the same data don't always have their keys in the same order. Postgres hands a jsonb
 * column back with each object's keys shortest first and then in the order of their bytes; a file in
 * storage keeps them as written; code builds them in its own order; a browser keeps what it was sent.
 * JSON.stringify keeps whatever order it is given, so comparing its text says "different" for the
 * same data. The in-memory store keeps keys as written, so such a comparison passes every test and
 * fails on the live site (release 2 review, figure-fresh-key-order).
 *
 * Use these wherever one side was read from the database and the other was built, or kept, another
 * way. Pure and with no imports, so the browser and the server share it.
 */

/**
 * JSON text with every object's keys sorted, at every depth. Lists keep their order, which is part
 * of the data. Everything else is as JSON.stringify writes it: a key whose value is undefined is left
 * out, so a field that is absent and one set to undefined read the same.
 */
export function stableJson(value: unknown): string {
  const text = JSON.stringify(value, (_key, v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(v).sort()) sorted[key] = (v as Record<string, unknown>)[key];
    return sorted;
  }) as string | undefined;
  return text ?? "";
}

/** The same data: equal as JSON, whatever order the keys are in. */
export const sameJson = (a: unknown, b: unknown): boolean => stableJson(a) === stableJson(b);
