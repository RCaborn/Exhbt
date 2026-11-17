import { expect, test, type Browser, type Page } from "@playwright/test";
import { SCHEMA_VERSION } from "../lib/exhbt/blocks";

// A file can only be shown as part of its owner's exhbt. Someone who learns another person's file id
// can't put it in their own exhbt and get a link to it: the save strips it, and no page signs it.

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

async function signInAs(page: Page, username: string) {
  await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
}

async function startFromScratch(page: Page) {
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  await expect(page.locator("[data-ready=true]")).toBeAttached();
  await expect(page.getByRole("textbox", { name: "Context", exact: true })).toBeVisible();
}

const waitForSaved = (page: Page) => expect(page.getByText("Saved", { exact: true })).toBeVisible();

async function fillValid(page: Page, title: string) {
  await page.locator("#title").fill(title);
  await page.getByRole("textbox", { name: "Context", exact: true }).fill("Queues ran long at lunch. Would a second till help?");
  await page.getByLabel("Box 1", { exact: true }).fill("Timed the queue");
  await page.getByLabel("Box 2", { exact: true }).fill("Added a second till");
  await page.getByLabel("Box 3", { exact: true }).fill("Waits fell");
  await page.getByRole("textbox", { name: "Finding 1" }).fill("Waits fell from 11 to 4 minutes.");
  await page.getByRole("textbox", { name: "Finding 2" }).fill("Sales held steady.");
}

async function publish(page: Page) {
  await page.getByLabel("This is my work, and the numbers are true").check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("It's live.")).toBeVisible();
}

async function asSecondPerson(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  return { context, page: await context.newPage() };
}

test("someone else's file id in a draft is stripped on save, and A's own image still shows", async ({ browser, baseURL, page }) => {
  test.setTimeout(240_000);
  const a = unique("owner");
  const b = unique("copier");

  // A uploads an image, adds it to an exhbt and publishes.
  await signInAs(page, a);
  await startFromScratch(page);
  await fillValid(page, "Queue study with a picture");
  await page.locator("input[aria-label='Choose an image']").setInputFiles({ name: "queue.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel(/Image 1: describe it/).fill("A queue at the cafe till");
  await waitForSaved(page);
  await publish(page);
  await page.reload();
  await expect(page.locator("[data-ready=true]")).toBeAttached();
  const src = await page.getByRole("region", { name: "Preview" }).locator("img[alt='A queue at the cafe till']").getAttribute("src");
  const fileId = src?.match(/^\/dev\/files\/([0-9a-f-]{36})$/)?.[1];
  expect(fileId).toBeTruthy();

  // B learns the id and writes it into their own draft, as an image and as the work. The editor keeps a
  // copy of unsaved changes in the browser and offers it back, which is a way to get a doc of B's choosing saved.
  const second = await asSecondPerson(browser, baseURL);
  const pb = second.page;
  try {
    await signInAs(pb, b);
    await startFromScratch(pb);
    const exhbtId = pb.url().match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
    const smuggled = {
      schemaVersion: SCHEMA_VERSION,
      title: "Smuggled",
      context: "Queues ran long at lunch. Would a second till help?",
      skills: [],
      gap: [],
      flow: [{ step: "Timed the queue" }, { step: "Added a second till" }, { step: "Waits fell" }],
      sections: [
        { id: "findings", kind: "findings", items: [[{ t: "Waits fell from 11 to 4 minutes." }], [{ t: "Sales held steady." }]] },
        { id: "image-1", kind: "image", fileId, alt: "Someone else's picture", caption: [] },
      ],
      evidence: { kind: "file", fileId, label: "Someone else's report" },
    };
    await pb.evaluate(
      ([id, doc]) => localStorage.setItem(`exhbt-backup:${id}`, JSON.stringify({ doc, at: Date.now() + 60_000 })),
      [exhbtId, smuggled] as const,
    );
    await pb.reload();
    await expect(pb.locator("[data-ready=true]")).toBeAttached();
    await pb.getByRole("button", { name: "Restore them" }).click();
    await expect(pb.locator("#title")).toHaveValue("Smuggled");
    await waitForSaved(pb);

    // The server dropped both references: nothing of A's is in B's editor after a reload.
    await pb.reload();
    await expect(pb.locator("[data-ready=true]")).toBeAttached();
    await expect(pb.locator("#title")).toHaveValue("Smuggled");
    await expect(pb.getByLabel(/Image 1: describe it/)).toHaveCount(0);
    await expect(pb.getByText("File attached:")).toHaveCount(0);
    expect(await pb.content()).not.toContain(fileId!);

    // And B's published page never carries a link to it.
    await fillValid(pb, "Smuggled");
    await waitForSaved(pb);
    await publish(pb);
    await pb.goto(`/p/${b}/smuggled`);
    await expect(pb.getByRole("heading", { level: 1, name: "Smuggled" })).toBeVisible();
    expect(await pb.content()).not.toContain(fileId!);
    await expect(pb.locator("img[alt=\"Someone else's picture\"]")).toHaveCount(0);
    await expect(pb.getByRole("link", { name: /Someone else's report/ })).toHaveCount(0);
  } finally {
    await second.context.close();
  }

  // A's own exhbt still shows the image.
  await page.goto(`/p/${a}/queue-study-with-a-picture`);
  const shown = page.locator(`img[src="/dev/files/${fileId}"]`);
  await expect(shown.first()).toBeVisible();
  expect((await page.request.get(`/dev/files/${fileId}`)).status()).toBe(200);
});
