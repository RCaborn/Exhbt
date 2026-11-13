import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { sampleDocs } from "../lib/exhbt/sample";
import { acceptedPicks, jobLinkSlug, orderedPicks } from "../lib/job-links";
import { PLAN_NAMES } from "../lib/entitlements";

// Per-job links (docs/phase-2.md section 8, decision 0008). The dev seed publishes two
// exhbts, so the page shows both. The cap of four is EXHBTS_PER_JOB_LINK, not a minimum.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const [GP, LIBRARY] = sampleDocs;
const on = (baseURL: string | undefined, name: string) => (baseURL ?? "").replace("//localhost", `//${name}.localhost`);

test.describe("job link addresses and ranking", () => {
  test("suffix by default, clean when asked, and neither collides", () => {
    const taken = ["northfield-health", "gp-reminders"];
    expect(jobLinkSlug("Northfield Health", "suffix", taken, ["k3m9"])).toBe("northfield-health-k3m9");
    expect(jobLinkSlug("Northfield Health", "suffix", [...taken, "northfield-health-k3m9"], ["k3m9", "p7qx"])).toBe("northfield-health-p7qx");
    expect(jobLinkSlug("Northfield Health", "clean", taken, [])).toBe("northfield-health-2");
    expect(jobLinkSlug("Northfield Health", "clean", [], [])).toBe("northfield-health");
  });

  test("a match may only name this person's exhbts, in the order given", () => {
    const allowed = ["a", "b", "c"];
    expect(acceptedPicks([{ exhbtId: "nope", reason: "x" }, { exhbtId: "b", reason: "Fits the brief." }, { exhbtId: "b", reason: "again" }, { exhbtId: "a", reason: "Also fits." }], allowed, 4)).toEqual([
      { exhbtId: "b", reason: "Fits the brief." },
      { exhbtId: "a", reason: "Also fits." },
    ]);
    expect(orderedPicks(allowed, 2)).toEqual([
      { exhbtId: "a", reason: "" },
      { exhbtId: "b", reason: "" },
    ]);
  });
});

test("www sign-in is sent to the app host, and localhost is not", async ({ request }) => {
  const moved = await request.get("/login?next=%2Froadmap", {
    headers: { host: "www.exhbt.co.uk" },
    maxRedirects: 0,
  });
  expect(moved.status()).toBe(301);
  expect(moved.headers().location).toBe("https://app.exhbt.co.uk/login?next=%2Froadmap");

  const stayed = await request.get("/login", { maxRedirects: 0 });
  expect(stayed.status()).not.toBe(301);
});

async function signIn(page: Page, username: string, plan: string) {
  const seeded = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}`, { maxRedirects: 0 });
  expect(seeded.status(), await seeded.text()).toBe(307);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/job-links/new`);
}

test.describe("Making a job link", () => {
  test("Max pastes a description and gets a noindex page of their published exhbts", async ({ page, baseURL }) => {
    const username = `jl${Date.now().toString(36)}`;
    await signIn(page, username, "max");
    await expect(page.getByRole("heading", { level: 1, name: "New job link" })).toBeVisible();

    await page.getByRole("textbox", { name: "Company", exact: true }).fill("Northfield Health");
    await page.getByRole("textbox", { name: "Role", exact: true }).fill("Junior data analyst");
    await page.getByRole("textbox", { name: "Job description" }).fill("We need someone who has worked with appointment data and can explain a result in plain English.");
    await page.getByRole("button", { name: "Make the link" }).click();
    await page.waitForURL(/\/job-links\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Northfield Health · Junior data analyst" })).toBeVisible();
    await expect(page.getByText("not opened yet")).toBeVisible();
    await expect(page.getByText("because a match wasn't run")).toBeVisible();

    const address = page.locator("a.font-mono");
    await expect(address).toHaveAttribute("href", new RegExp(`/p/${username}/northfield-health-[a-z0-9]{4}$`));
    const path = (await address.getAttribute("href")) ?? "";
    const slug = path.split("/").pop() ?? "";
    await page.goto(`${on(baseURL, username)}/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "For Northfield Health · Junior data analyst" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(GP.title) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(LIBRARY.title) })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    await page.getByRole("link", { name: new RegExp(GP.title) }).click();
    await expect(page.getByRole("link", { name: "Back to Northfield Health" })).toBeVisible();
    await expect(page.getByRole("link", { name: "All projects" })).toHaveCount(0);

    await page.goto(`/job-links`);
    await expect(page.getByText("Opened 1 time")).toBeVisible();
    await page.getByRole("link", { name: "Northfield Health · Junior data analyst" }).click();
    await page.getByRole("button", { name: "Turn off" }).click();
    await expect(page.getByText(/^Off ·/)).toBeVisible();
    expect((await page.goto(`${on(baseURL, username)}/${slug}`))?.status()).toBe(404);
  });

  test("Premium is told job links come with Max", async ({ page }) => {
    const username = `jp${Date.now().toString(36)}`;
    await signIn(page, username, "premium");
    await expect(page.getByTestId("upgrade-prompt")).toContainText(`Links for each job come with ${PLAN_NAMES.max}.`);
    await expect(page.getByRole("button", { name: "Make the link" })).toHaveCount(0);
  });
});
