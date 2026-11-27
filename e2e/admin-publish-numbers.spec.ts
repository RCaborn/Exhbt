import { expect, test, type Page } from "@playwright/test";
import { slugify } from "../lib/exhbt/slug";
import { uniqueEmail } from "./helpers";
import { fillValid, openPublishSheet, publish, publishSheet, signInAs, startFromScratch, waitForSave } from "./editor";

// N1 and N2 on the admin page, the exhbt_published event and the one email at a first publish (M1 and M2 of the appeal plan).
// The in-memory store is shared by the whole run, so the admin numbers are read before and after seeding and compared as differences.
// /dev/measure (development only) seeds publishers and reads a person's events back; the email is read from the dev outbox.

const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const enc = encodeURIComponent;
const SUBJECT = "Your first exhbt is live";

async function adminSignIn(page: Page) {
  const dest = "/admin?range=all";
  await page.goto(`/auth/dev?email=${enc(uniqueEmail("pubnums"))}&next=${enc(`/dev/admin?role=admin&next=${enc(dest)}`)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
}

/** "12 of 40 accounts (30%)" read off a stat. */
async function readStat(page: Page, id: "n1" | "n2") {
  const text = (await page.locator(`[data-stat="${id}"]`).innerText()).replace(/,/g, "");
  const m = text.match(/^(\d+) of (\d+) accounts \((\d+%|-)\)$/);
  expect(m, `"${text}" is "<count> of <base> accounts (<share>)"`).not.toBeNull();
  return { count: Number(m![1]), accounts: Number(m![2]), share: m![3]!, text };
}

const eventsOf = async (page: Page, name: string): Promise<{ props: Record<string, unknown> }[]> =>
  ((await (await page.request.get(`/dev/measure?events=${name}`)).json()) as { events: { props: Record<string, unknown> }[] }).events;

/** Emails in the dev outbox sent to this address with the first-publish subject. */
async function firstEmails(page: Page, to: string) {
  await page.goto("/dev/emails");
  return page.getByRole("link", { name: new RegExp(`${SUBJECT}.*to ${to.replace(/[+.]/g, "\\$&")}`) });
}

/** A new exhbt, filled in and published; returns its slug. */
async function publishNew(page: Page, title: string) {
  await startFromScratch(page);
  await fillValid(page, title);
  await waitForSave(page);
  await publish(page);
  return slugify(title);
}

test.describe("N1 and N2 on the admin page", () => {
  test("count right on seeded data: a first and a second exhbt, an unpublished one, an account with none", async ({ page }) => {
    await adminSignIn(page);
    await expect(page.getByRole("heading", { name: "First and second exhbt" })).toBeVisible();
    await expect(page.getByText(/deleting the exhbt does, and a draft never published does not count/)).toBeVisible();
    const before = { n1: await readStat(page, "n1"), n2: await readStat(page, "n2") };

    const seeded = await page.request.get(`/dev/measure?seed=${stamp()}`);
    expect(seeded.ok()).toBe(true);
    await page.reload();
    const after = { n1: await readStat(page, "n1"), n2: await readStat(page, "n2") };

    // Four new accounts: a draft only (in the base, not counted), one published, two published, and one published then
    // taken down beside a draft (still counted once: unpublishing does not undo a publish).
    expect(after.n1.accounts - before.n1.accounts).toBe(4);
    expect(after.n1.count - before.n1.count).toBe(3);
    expect(after.n2.count - before.n2.count).toBe(1);
    expect(after.n1.share).toBe(`${Math.round((after.n1.count / after.n1.accounts) * 100)}%`);
    expect(after.n2.share).toBe(`${Math.round((after.n2.count / after.n2.accounts) * 100)}%`);
  });

  test("anyone who is not an admin still gets a 404", async ({ page }) => {
    await page.goto(`/auth/dev?email=${enc(uniqueEmail("pubnums-user"))}&next=${enc("/account")}`);
    expect((await page.goto("/admin"))?.status()).toBe(404);
  });
});

test.describe("a publish: the event and the first email", () => {
  test("a first publish logs one event with n and republish only, and sends one email with the exhbt's link", async ({ page }) => {
    const user = `pubfirst${stamp()}`.toLowerCase();
    const title = "Cutting queue times at the cafe";
    await signInAs(page, user, "premium");
    const slug = await publishNew(page, title);

    await expect.poll(async () => (await eventsOf(page, "exhbt_published")).length).toBe(1);
    const [event] = await eventsOf(page, "exhbt_published");
    // No title, no words, no file names, and no from_idea: the exhbt does not record where it began.
    expect(event!.props).toEqual({ n: 1, republish: false });

    const mail = await firstEmails(page, `${user}@example.com`);
    await expect(mail).toHaveCount(1);
    await mail.click();
    const frame = page.frameLocator("iframe");
    await expect(frame.getByText(SUBJECT, { exact: true })).toBeVisible();
    // The link is the one the publish sheet shows: on this development server, /p/<username>/<slug> (an exhbt.co.uk host gives the subdomain).
    const origin = new URL(page.url()).origin;
    await expect(frame.getByRole("link", { name: "Open my exhbt" })).toHaveAttribute("href", `${origin}/p/${user}/${slug}`);
    await expect(frame.getByRole("link", { name: `${origin}/p/${user}`, exact: true })).toBeVisible();
    await expect(frame.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", `${origin}/legal/privacy`);
    await expect(frame.locator("body")).not.toContainText(title);
    await expect((await eventsOf(page, "first_publish_emailed")).length).toBe(1);
  });

  test("an unpublish then publish again, and a second exhbt, log their own events and send no second email", async ({ page }) => {
    const user = `pubmore${stamp()}`.toLowerCase();
    await signInAs(page, user, "premium");
    await publishNew(page, "First of mine");
    await expect.poll(async () => (await eventsOf(page, "exhbt_published")).length).toBe(1);

    // Unpublish, publish again: a republish, and still one published.
    await openPublishSheet(page);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await page.getByRole("button", { name: "Yes, unpublish" }).click();
    await expect(publishSheet(page).getByRole("button", { name: "Publish", exact: true })).toBeVisible();
    await publish(page);
    await expect.poll(async () => (await eventsOf(page, "exhbt_published")).length).toBe(2);
    expect((await eventsOf(page, "exhbt_published"))[1]!.props).toEqual({ n: 1, republish: true });

    // A second exhbt: n is 2, and it is not a republish.
    await page.goto("/exhbts");
    await publishNew(page, "Second of mine");
    await expect.poll(async () => (await eventsOf(page, "exhbt_published")).length).toBe(3);
    expect((await eventsOf(page, "exhbt_published"))[2]!.props).toEqual({ n: 2, republish: false });

    // The email decision is made right after the event, so by now there is still only the first one.
    await page.waitForTimeout(500);
    await expect(await firstEmails(page, `${user}@example.com`)).toHaveCount(1);
    expect((await eventsOf(page, "first_publish_emailed")).length).toBe(1);
  });

  test("Free cannot publish, so nothing is logged and nothing is sent", async ({ page }) => {
    const user = `pubfree${stamp()}`.toLowerCase();
    await signInAs(page, user, "free");
    await startFromScratch(page);
    await fillValid(page, "Free tries to publish");
    await waitForSave(page);
    await openPublishSheet(page);
    await expect(publishSheet(page).getByText(/comes with Premium/)).toBeVisible();
    await expect(publishSheet(page).getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
    await page.waitForTimeout(500);
    expect((await eventsOf(page, "exhbt_published")).length).toBe(0);
    await expect(await firstEmails(page, `${user}@example.com`)).toHaveCount(0);
  });

  test("a plan with no public page gets the event but no email, and one with a public page gets both", async ({ page }) => {
    const tag = stamp();
    // Free's publish is refused before this step, so it is reached here on its own: the gate is what holds the email back.
    expect(await (await page.request.get(`/dev/measure?gate=free&tag=${tag}`)).json()).toEqual({ published: 1, claims: 0, emails: 0 });
    expect(await (await page.request.get(`/dev/measure?gate=premium&tag=${tag}`)).json()).toEqual({ published: 1, claims: 1, emails: 1 });
  });

  test("two presses at the same moment send one email", async ({ page, context }) => {
    const user = `pubrace${stamp()}`.toLowerCase();
    await signInAs(page, user, "premium");
    await startFromScratch(page);
    await fillValid(page, "Race one");
    await waitForSave(page);
    // A second tab, signed in as the same person, with a second exhbt ready to publish.
    const other = await context.newPage();
    await other.goto("/exhbts");
    await startFromScratch(other);
    await fillValid(other, "Race two");
    await waitForSave(other);
    await Promise.all([publish(page), publish(other)]);
    await expect.poll(async () => (await eventsOf(page, "exhbt_published")).length).toBe(2);
    await page.waitForTimeout(500);
    await expect(await firstEmails(page, `${user}@example.com`)).toHaveCount(1);
    expect((await eventsOf(page, "first_publish_emailed")).length).toBe(1);
  });

  test("ten claims at once for one person: exactly one wins", async ({ page }) => {
    const res = await page.request.get(`/dev/measure?claim=${stamp()}`);
    expect(await res.json()).toEqual({ winners: 1 });
  });
});
