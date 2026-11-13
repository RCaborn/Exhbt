import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS } from "../lib/entitlements";
import { type ExhbtDoc } from "../lib/exhbt/blocks";
import { headlineFor } from "../lib/exhbt/headline";
import { sampleDocs } from "../lib/exhbt/sample";

// Phase 2 portfolio media: the profile photo (cropped in the browser, uploaded with the signed-URL
// helper), link-preview images, print / Save as PDF, and the headline number on a project page.
// Portfolios are seeded with fictional work by app/dev/portfolio; files live in the dev stand-in.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const MB = 1024 * 1024;
const [GP, LIBRARY] = sampleDocs as [ExhbtDoc, ExhbtDoc];
const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
const on = (baseURL: string | undefined, name: string) => (baseURL ?? "").replace("//localhost", `//${name}.localhost`);

/** A Premium portfolio for `<username>@example.com`, then signed in as them on the settings page. */
async function seedAndSignIn(page: Page, username: string) {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=premium`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/account/portfolio`);
  await expect(page.getByRole("heading", { level: 1, name: "Portfolio settings" })).toBeVisible();
}

/** A real PNG, drawn in the page: wider than tall, so the crop has something to do. */
async function pngOf(page: Page, w: number, h: number): Promise<Buffer> {
  const b64 = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#4fe9b4";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#0e0f12";
      ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
      return c.toDataURL("image/png").split(",")[1]!;
    },
    [w, h] as const,
  );
  return Buffer.from(b64, "base64");
}

async function uploadPhoto(page: Page, name = "me.png") {
  await page.getByTestId("photo-input").setInputFiles({ name, mimeType: "image/png", buffer: await pngOf(page, 900, 600) });
  await expect(page.getByRole("status").filter({ hasText: "Photo saved." })).toBeVisible();
}

const glancePhoto = (page: Page) => page.locator("header").first().locator('[data-avatar="photo"]');
const glanceInitials = (page: Page) => page.locator("header").first().locator('[data-avatar="initials"]');

test.describe("Profile photo", () => {
  test("upload shows it on the portfolio, cropped square; replacing deletes the old file; remove brings the initials back", async ({ page }) => {
    const name = unique("photo");
    await seedAndSignIn(page, name);
    await expect(page.getByRole("button", { name: "Upload a photo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(0);

    await uploadPhoto(page);
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();

    await page.goto(`/p/${name}`);
    await expect(glancePhoto(page)).toBeVisible();
    await expect(glanceInitials(page)).toHaveCount(0);
    await expect(glancePhoto(page)).toHaveAttribute("alt", "");
    // Cropped to a square in the browser and kept small.
    const size = await glancePhoto(page).evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    });
    expect(size[0]).toBe(size[1]);
    expect(size[0]).toBeLessThanOrEqual(512);
    const first = await glancePhoto(page).getAttribute("src");
    // And beside the name on a project.
    await page.goto(`/p/${name}/gp-reminders`);
    await expect(page.locator('article [data-avatar="photo"]')).toBeVisible();

    // Replace: the new photo shows and the old file is gone.
    await page.goto("/account/portfolio");
    await uploadPhoto(page, "second.png");
    await page.goto(`/p/${name}`);
    const second = await glancePhoto(page).getAttribute("src");
    expect(second).not.toBe(first);
    expect((await page.request.get(first!)).status()).toBe(404);

    // Remove: initials again, and the file is deleted.
    await page.goto("/account/portfolio");
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Photo removed." })).toBeVisible();
    await page.goto(`/p/${name}`);
    await expect(glanceInitials(page)).toBeVisible();
    await expect(glancePhoto(page)).toHaveCount(0);
    expect((await page.request.get(second!)).status()).toBe(404);
  });

  test("a photo over the plan's file cap is refused with the cap, before anything uploads", async ({ page }) => {
    await seedAndSignIn(page, unique("bigphoto"));
    let asked = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/files/upload-url")) asked = true;
    });
    const cap = ENTITLEMENTS.premium.uploadMbPerFile;
    await page.getByTestId("photo-input").setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(cap * MB + 1) });
    await expect(page.getByRole("alert").filter({ hasText: "photo" })).toContainText(`over ${cap} MB`);
    expect(asked).toBe(false);
  });

  test("no accessibility violations on portfolio settings with a photo", async ({ page }) => {
    await seedAndSignIn(page, unique("axephoto"));
    await uploadPhoto(page);
    await expect(page.getByRole("button", { name: "Remove photo" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("Link previews", () => {
  test("the glance page and each project have a 1200×630 PNG preview, linked from their metadata", async ({ page }) => {
    await seedAndSignIn(page, "amara");
    for (const path of ["/p/amara", "/p/amara/gp-reminders"]) {
      await page.goto(path);
      const og = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(og).toBe(`${new URL(page.url()).origin}${path}/preview.png`);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
      const res = await page.request.get(og!);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
      const png = await res.body();
      // PNG header: width and height at bytes 16-23.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    }
  });

  test("on a person's own host the preview address is on that host too", async ({ page, baseURL }) => {
    await seedAndSignIn(page, "amara");
    const host = on(baseURL, "amara");
    await page.goto(`${host}/gp-reminders`);
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBe(`${host}/gp-reminders/preview.png`);
    // Through the browser: Chromium resolves *.localhost, the test runner's request client doesn't.
    const res = await page.goto(og!);
    expect(res?.status()).toBe(200);
    expect(res?.headers()["content-type"]).toBe("image/png");
  });

  test("a missing project has no preview", async ({ page }) => {
    await seedAndSignIn(page, "amara");
    expect((await page.request.get("/p/amara/not-a-project/preview.png")).status()).toBe(404);
  });
});

test.describe("Project page", () => {
  test("shows the headline number under the title, the catalogue number and the seal", async ({ page }) => {
    await seedAndSignIn(page, "amara");
    await page.goto("/p/amara/gp-reminders");
    const headline = page.locator("article [data-headline]");
    await expect(headline).toContainText(GP.headline!.value);
    await expect(headline).toContainText(GP.headline!.label);
    await expect(page.locator("article [data-catalogue]")).toHaveText("EX·01");
    await expect(page.getByRole("link", { name: /Checked by exhbt/ })).toBeVisible();
  });

  test("prints as the exhbt alone, with its address", async ({ page }) => {
    await seedAndSignIn(page, "amara");
    await page.goto("/p/amara/gp-reminders");
    await expect(page.getByRole("button", { name: "Save as PDF" })).toBeVisible();
    await expect(page.locator("[data-print-address]")).toBeHidden();

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "Portfolio" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Other projects" })).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Made with exhbt" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Save as PDF" })).toBeHidden();
    await expect(page.getByRole("list", { name: "Methodology" })).toBeVisible();
    await expect(page.getByRole("region", { name: "findings" })).toBeVisible();
    await expect(page.getByRole("table", { name: GP.charts[0]!.title })).toBeAttached();
    await expect(page.getByRole("list", { name: "Checks passed" })).toBeVisible();
    await expect(page.locator("[data-print-address]")).toBeVisible();
    await expect(page.locator("[data-print-address]")).toHaveText("amara.exhbt.co.uk/gp-reminders");
    // One A4 page.
    const pdf = (await page.pdf({ format: "A4" })).toString("latin1");
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
  });
});

test.describe("Headline numbers", () => {
  test("the one the person wrote, or else their first graph's change, or none", () => {
    expect(headlineFor(GP)).toEqual(GP.headline);
    expect(headlineFor({ headline: undefined, charts: GP.charts })).toEqual({ value: "−18%", label: "Missed appointments (%), All patients" });
    expect(headlineFor({ headline: { value: " ", label: "" }, charts: [] })).toBeNull();
    expect(headlineFor({ headline: undefined, charts: LIBRARY.charts })).toBeNull();
  });
});
