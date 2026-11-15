"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS } from "@/lib/entitlements";
import { canUseTheme, customisableExhbts, getPlan } from "@/lib/plan";
import { CustomiseSchema, MAX_REQUEST_CHARS, type SaveResult } from "@/lib/portfolio-customise";
import { isTileKind, layoutFromOrder } from "@/lib/portfolio-layout";
import { themeById, themeFor } from "@/lib/portfolio-themes";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Saves the portfolio customiser (decision 0014). The page sends its whole arrangement after every
 * change (debounced); this checks all of it again, because the page only shows the rules:
 *   - who they are, and that Phase 2 is on;
 *   - the shape and size of the request, every word limit and every https link (lib/portfolio-layout.ts);
 *   - every id is one of their own exhbts the customiser lists (plan rules decide which);
 *   - extra tiles only on a plan that has them (lib/entitlements.ts `extraTiles`); on a plan that
 *     doesn't, tiles they saved earlier are kept and left where they were;
 *   - the look only if the plan has it. A look already stored but held after a downgrade stays stored.
 * Anything that doesn't belong is dropped quietly (an exhbt deleted in another tab), never trusted.
 */

const SIGNED_OUT = "Your session has ended. Sign in again to save.";

export async function saveCustomisationAction(raw: unknown): Promise<SaveResult> {
  if (!isPhase2Enabled()) return { ok: false, error: "This isn't available yet." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  if (JSON.stringify(raw ?? null).length > MAX_REQUEST_CHARS) return { ok: false, error: "That's too much to save at once." };
  const parsed = CustomiseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "We couldn't read that." };
  const input = parsed.data;

  const store = getStore();
  const [plan, exhbts, profile] = await Promise.all([getPlan(user.id), store.listExhbts(user.id), store.getPortfolioProfile(user.id)]);
  const candidates = customisableExhbts(plan, exhbts);
  const candidateIds = new Set(candidates.map((e) => e.id));
  const extrasOk = ENTITLEMENTS[plan].extraTiles;

  // The order: only their exhbts and the tiles they may have, each once; any exhbt the page missed goes on the end.
  const seen = new Set<string>();
  let order = input.order.filter((k) => {
    const ok = (candidateIds.has(k) || (extrasOk && isTileKind(k))) && !seen.has(k);
    if (ok) seen.add(k);
    return ok;
  });
  for (const e of candidates) if (!seen.has(e.id)) order.push(e.id);
  let tiles = input.tiles;
  if (!extrasOk) {
    // No extra tiles on this plan: keep what they saved before, where it was, untouched.
    const held = profile.layout.slots.filter(isTileKind);
    order = [...order, ...held];
    tiles = profile.layout.tiles;
  }

  const hidden = input.hidden.filter((id) => candidateIds.has(id));
  // Exhbts the page doesn't list (over the plan's count after a downgrade) keep whatever they had.
  const keptHidden = exhbts.filter((e) => e.hiddenOnPortfolio && !candidateIds.has(e.id)).map((e) => e.id);
  const featured = input.featured && candidateIds.has(input.featured) && !hidden.includes(input.featured) ? input.featured : null;

  // The look: only a change is checked. Sending back the look already showing (the default, while a
  // better one is held after a downgrade) never overwrites the stored choice.
  let themeId: string | undefined;
  if (input.themeId !== themeFor(profile, plan).id) {
    const theme = themeById(input.themeId);
    if (!theme) return { ok: false, error: "Choose one of the looks in the list." };
    const verdict = canUseTheme(plan, theme);
    if (!verdict.ok) return { ok: false, error: verdict.reason, upgradeTo: verdict.upgradeTo };
    themeId = theme.id;
  }

  // The portfolio order: their exhbts take the places the customised ones had, so drafts and anything else stay put.
  const projectOrder = order.filter((k) => candidateIds.has(k));
  const queue = [...projectOrder];
  const sorted = [...exhbts].sort((a, b) => a.position - b.position).map((e) => e.id);
  const positions = sorted.map((id) => (candidateIds.has(id) ? queue.shift()! : id));

  const layout = layoutFromOrder(order, tiles, input.header);

  if (themeId) await store.updatePortfolioProfile(user.id, { themeId });
  await store.savePortfolioLayout(user.id, { layout, featuredExhbtId: featured, hiddenIds: [...hidden, ...keptHidden], order: positions });
  revalidatePath("/exhbts");
  revalidatePath("/portfolio/customise");
  return { ok: true, savedAt: new Date().toISOString() };
}
