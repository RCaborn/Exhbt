import { expect, test, type APIRequestContext } from "@playwright/test";
import { openBankingDoc } from "../lib/exhbt/sample";

/*
 * An exhbt with no graph, no picture and its flowchart taken off the page (decision 0027; only the
 * new editor can make one, from release 3) has no key figure: keyFigureOf gives a flowchart with no
 * steps. Its card on the portfolio home leaves the figure's well out rather than draw an empty grey
 * box, and still lines up with the card beside it; as the best piece of work, the band draws no
 * empty figure panel either.
 */

/** As published: an essay with its flowchart off (publicDoc empties the boxes), findings and nothing to picture. */
const bare = {
  schemaVersion: 2,
  format: "essay",
  flowOff: true,
  title: "Did the 1832 Reform Act widen the vote?",
  context: "BA History essay",
  skills: ["Argument"],
  gap: [{ t: "The Act is often called the start of democracy." }],
  flow: [],
  sections: [{ id: "findings", kind: "findings", items: [[{ t: "The electorate grew by about half." }], [{ t: "Some working men lost the vote." }]] }],
};

async function seed(request: APIRequestContext, username: string, slug: string, doc: unknown): Promise<string> {
  const res = await request.post("/dev/parity", { data: { username, slug, doc } });
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

test("a card with no key figure has no empty well, and lines up with the card beside it", async ({ page, request }) => {
  // Each new exhbt goes first: the last seeded is the best piece of work, the other two are cards side by side.
  const graphCard = await seed(request, "cardcheck", "with-graph", { ...openBankingDoc, title: "A card with a graph" });
  const bareCard = await seed(request, "cardcheck", "no-figure", bare);
  await seed(request, "cardcheck", "featured", openBankingDoc);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/p/cardcheck");

  const plain = page.locator(`[data-card="${bareCard}"]`);
  const other = page.locator(`[data-card="${graphCard}"]`);
  await expect(plain.getByRole("heading", { name: bare.title })).toBeVisible();
  await expect(other.locator("[data-key-figure=chart]")).toHaveCount(1);
  await expect(plain.locator("[data-key-figure]")).toHaveCount(0);
  await expect(plain.locator(".min-h-48")).toHaveCount(0);

  const [a, b] = [await plain.boundingBox(), await other.boundingBox()];
  expect(a && b, "both cards drawn").toBeTruthy();
  expect(Math.abs(a!.y - b!.y), "the two cards start on the same line").toBeLessThanOrEqual(0.5);
  expect(Math.abs(a!.height - b!.height), "and are the same height").toBeLessThanOrEqual(0.5);
  // The card fills its place in the grid, so its edge lines up with its neighbour's.
  const card = await plain.locator(":scope > *").first().boundingBox();
  expect(Math.abs(card!.height - a!.height), "the card fills its cell").toBeLessThanOrEqual(0.5);
});

test("as the best piece of work, an exhbt with no key figure draws no empty figure panel", async ({ page, request }) => {
  await seed(request, "bandcheck", "with-graph", openBankingDoc);
  await seed(request, "bandcheck", "no-figure", bare);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/p/bandcheck");

  const band = page.locator("[data-section=featured]");
  await expect(band.getByRole("heading", { name: bare.title })).toBeVisible();
  await expect(band.locator("[data-key-figure]")).toHaveCount(0);
  await expect(band.locator(".bg-\\[var\\(--pf-figure\\)\\]")).toHaveCount(0);
  // With nothing beside it, the words take the band's whole width rather than half of it.
  const words = await band.getByRole("heading", { name: bare.title }).locator("..").boundingBox();
  const grid = await band.locator(".grid").first().boundingBox();
  expect(words!.width).toBeGreaterThan(grid!.width * 0.8);
});
