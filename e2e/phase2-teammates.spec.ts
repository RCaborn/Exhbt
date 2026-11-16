import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS } from "../lib/entitlements";
import { TEAMMATES_PER_EXHBT } from "../lib/team-rules";

// Teammates and private file matching (docs/decisions/0013): invites by email and accepting them,
// teammates on the public page and the tile, removing and leaving, a teammate's own exhbt from the
// project, and the prompt when someone else uploads the same file. In-memory store and outbox.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
const TITLE = "Cutting missed GP appointments by changing when reminders are sent";
const SLUG = "gp-reminders";
/**
 * Project notes as a file. Each test gets its own bytes (the in-memory store lasts the whole run,
 * so the same bytes would match another test's files).
 */
const notesFile = () =>
  Buffer.from(
    "Survey of 412 patients at two practices about appointment reminders. We compared a text sent three hours before " +
      `with one sent the day before, cleaned the answers in Python and wrote up which group missed fewer appointments. Ref ${unique("n")}.`,
  );

async function axe(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG);
  const { violations } = await (include ? builder.include(include) : builder).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

/** An owner on Premium with one published exhbt (the sample), signed in. Returns that exhbt's id. */
async function owner(page: Page, username: string): Promise<string> {
  const seeded = await page.request.get(`/dev/portfolio?username=${username}&plan=premium&count=1`, { maxRedirects: 0 });
  expect(seeded.status()).toBe(307);
  await signInAs(page, `${username}@example.com`);
  const href = await page.getByRole("link", { name: `Edit ${TITLE}` }).getAttribute("href");
  return href!.match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
}

/** Switches the dev sign-in to this address and opens /exhbts (or `next`). */
async function signInAs(page: Page, email: string, next = "/exhbts") {
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

/** Uploads a file through the API, attached to an exhbt, and tells the server it landed. Returns the server's match answer. */
async function uploadTo(page: Page, exhbtId: string, name: string, mime: string, body: Buffer, kind = "source") {
  const ticket = await page.request.post("/api/files/upload-url", { data: { name, mime, bytes: body.length, kind, exhbtId } });
  expect(ticket.ok()).toBe(true);
  const { fileId, uploadUrl } = (await ticket.json()) as { fileId: string; uploadUrl: string };
  expect((await page.request.put(uploadUrl, { data: body, headers: { "content-type": mime } })).status()).toBe(200);
  const done = await page.request.post(`/api/files/${fileId}/complete`);
  expect(done.ok()).toBe(true);
  return ((await done.json()) as { match: { id: string } | null }).match;
}

/** Invites someone from the team page. */
async function invite(page: Page, exhbtId: string, email: string, role: string) {
  await page.goto(`/exhbts/${exhbtId}/team`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
  await page.getByLabel("Their email address").fill(email);
  await page.getByLabel(/What they did/).fill(role);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.locator("#invite-result")).toHaveText(`Invite sent to ${email}.`);
}

/** The accept link in the newest invite email to this address (the dev outbox). */
async function acceptLink(page: Page, email: string): Promise<string> {
  await page.goto("/dev/emails");
  await page.getByRole("link", { name: new RegExp(`to ${email.replace(/[+.]/g, "\\$&")}`) }).first().click();
  const href = await page.frameLocator("iframe").getByRole("link", { name: "Accept the invite" }).getAttribute("href");
  expect(href).toMatch(/\/team\/accept\?token=/);
  return new URL(href!).pathname + new URL(href!).search;
}

/** Accepts as this address: signs in, opens the link, gives a name and joins. */
async function acceptAs(page: Page, email: string, link: string, name: string) {
  await signInAs(page, email, link);
  await expect(page.getByRole("heading", { level: 1, name: "Join a team project" })).toBeVisible();
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
  await page.getByLabel("Your name, as it shows on the project").fill(name);
  await page.getByRole("button", { name: "Join the team" }).click();
  await page.waitForURL(/\/exhbts\?joined=1/);
}

test.describe("Inviting teammates", () => {
  test("invite by email, accept after signing in, and both see the teammate on the project", async ({ page }) => {
    const own = unique("own");
    const mate = `${unique("mate")}@example.com`;
    const id = await owner(page, own);

    await page.goto(`/exhbts/${id}/team`);
    await expect(page.getByRole("heading", { level: 1, name: "Teammates" })).toBeVisible();
    await axe(page);
    await invite(page, id, mate, "Built the model");
    const waiting = page.getByRole("region", { name: "Waiting to accept" });
    await expect(waiting.getByText(mate)).toBeVisible();
    await expect(waiting.getByText(/Built the model · The link works until/)).toBeVisible();

    // The email names the owner and the project; its button goes to the accept page.
    const link = await acceptLink(page, mate);
    const frame = page.frameLocator("iframe");
    await expect(frame.getByText(/is writing up “Cutting missed GP appointments/)).toBeVisible();

    // Still signed in as the owner: the page says the invite is for another address.
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: "This invite is for another address" })).toBeVisible();

    // Signing in is the usual magic link, through the dev outbox's stand-in.
    await page.getByRole("link", { name: "Sign in with that address" }).click();
    await page.getByLabel("Email address").fill(mate);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await page.getByRole("link", { name: "Open the sign-in link" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Join a team project" })).toBeVisible();
    await expect(page.getByText(/invited you to Cutting missed GP appointments/)).toBeVisible();
    await axe(page);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    // A name is needed: it's what shows on the project.
    await page.getByRole("button", { name: "Join the team" }).click();
    await expect(page.locator("#accept-error")).toHaveText(/Add your name/);
    await page.getByLabel("Your name, as it shows on the project").fill("Ben Ray");
    await page.getByRole("button", { name: "Join the team" }).click();
    await page.waitForURL(/\/exhbts\?joined=1/);
    const projects = page.getByRole("list", { name: "Team projects you're on" });
    await expect(projects.getByText(TITLE)).toBeVisible();
    await expect(projects.getByText("Your part: Built the model")).toBeVisible();

    // The link can't be used twice.
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: "You're on this project" })).toBeVisible();

    // The teammate sees themselves on the public page: photo or initials, name, role. No portfolio, so no link.
    await page.goto(`/p/${own}/${SLUG}`);
    const team = page.locator("[data-team]");
    await expect(team.getByText("Team project with")).toBeVisible();
    await expect(team.getByText("Ben Ray")).toBeVisible();
    await expect(team.getByText("Built the model")).toBeVisible();
    await expect(team.getByRole("link")).toHaveCount(0);
    await axe(page);

    // So does the owner, and the portfolio tile says it too.
    await signInAs(page, `${own}@example.com`, `/p/${own}/${SLUG}`);
    await expect(page.locator("[data-team]").getByText("Ben Ray")).toBeVisible();
    await page.goto(`/p/${own}`);
    await expect(page.locator("[data-team]")).toContainText("Team project with Ben Ray (Built the model)");
    await axe(page);

    // The owner removes them: gone from the page.
    await page.goto(`/exhbts/${id}/team`);
    await page.getByRole("button", { name: "Remove Ben Ray" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await expect(page.locator("[data-said]")).toHaveText(/Teammate removed/);
    await page.goto(`/p/${own}/${SLUG}`);
    await expect(page.locator("[data-team]")).toHaveCount(0);
  });

  test("a teammate with a public portfolio is linked to it", async ({ page }) => {
    const own = unique("lnk");
    const mateName = unique("pub");
    const id = await owner(page, own);
    await invite(page, id, `${mateName}@example.com`, "Data cleaning");
    const link = await acceptLink(page, `${mateName}@example.com`);
    // The teammate has their own live portfolio.
    expect((await page.request.get(`/dev/portfolio?username=${mateName}&plan=premium&count=1`, { maxRedirects: 0 })).status()).toBe(307);
    await acceptAs(page, `${mateName}@example.com`, link, "Cara Diaz");
    await page.goto(`/p/${own}/${SLUG}`);
    await expect(page.locator("[data-team]").getByRole("link", { name: "Cara Diaz" })).toHaveAttribute("href", `/p/${mateName}`);
  });

  test("Resend replaces the link, Cancel stops it, and the team has a cap", async ({ page }) => {
    const own = unique("cap");
    const id = await owner(page, own);
    const first = `${unique("r")}@example.com`;
    await invite(page, id, first, "");
    const oldLink = await acceptLink(page, first);
    await page.goto(`/exhbts/${id}/team`);
    await page.getByRole("button", { name: `Resend the invite to ${first}` }).click();
    await expect(page.locator("[data-said]")).toHaveText(/Invite sent again/);
    const newLink = await acceptLink(page, first);
    expect(newLink).not.toBe(oldLink);
    await page.goto(oldLink);
    await expect(page.getByRole("heading", { level: 1, name: "This invite link doesn't work" })).toBeVisible();
    await page.goto(newLink);
    await expect(page.getByRole("heading", { level: 1, name: /Join a team project|This invite is for another address/ })).toBeVisible();

    await page.goto(`/exhbts/${id}/team`);
    await page.getByRole("button", { name: `Cancel the invite to ${first}` }).click();
    await expect(page.locator("[data-said]")).toHaveText(/Invite cancelled/);
    await page.goto(newLink);
    await expect(page.getByRole("heading", { level: 1, name: "This invite link doesn't work" })).toBeVisible();

    // Every place taken (open invites count): the form gives way to a note.
    for (let i = 0; i < TEAMMATES_PER_EXHBT - 1; i++) await invite(page, id, `${unique(`c${i}`)}@example.com`, "");
    await page.goto(`/exhbts/${id}/team`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("Their email address").fill(`${unique("last")}@example.com`);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(/Every place is taken\./)).toBeVisible();
    await expect(page.getByLabel("Their email address")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Waiting to accept" }).getByRole("listitem")).toHaveCount(TEAMMATES_PER_EXHBT);
  });
});

test.describe("A teammate's own exhbt", () => {
  test("made from the project with its files, drafted into, counted on their plan, and theirs after leaving and deletion", async ({ page }) => {
    const own = unique("src");
    const mate = `${unique("own")}@example.com`;
    const id = await owner(page, own);
    const NOTES = notesFile();
    await uploadTo(page, id, "survey-notes.txt", "text/plain", NOTES);
    await invite(page, id, mate, "Ran the survey");
    const link = await acceptLink(page, mate);
    await acceptAs(page, mate, link, "Dev Patel");

    // On Free: making their own takes one of the plan's places.
    const max = ENTITLEMENTS.free.exhbts;
    await page.goto("/exhbts");
    await expect(page.getByText(new RegExp(`0 of ${max} used on Free`))).toBeVisible();
    await page.getByRole("button", { name: `Make my own exhbt from ${TITLE}` }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    const mine = page.url().match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
    expect(mine).not.toBe(id);
    // Nothing written is copied: the editor starts empty; the strip names the team and the files.
    await expect(page.locator("#title")).toHaveValue("");
    const strip = page.locator("[data-team-strip]");
    await expect(strip).toContainText("Team project with Amara Okafor.");
    await expect(page.getByText(/project file is in your storage now: survey-notes\.txt/)).toBeVisible();

    await page.goto("/exhbts");
    await expect(page.getByText(new RegExp(`1 of ${max} used on Free`))).toBeVisible();
    if (max === 1) await expect(page.getByRole("button", { name: "Start from scratch" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: `Open your own exhbt of ${TITLE}` })).toBeVisible();

    // Drafting from the team's files fills this exhbt; it doesn't start another.
    await page.goto(`/exhbts/${mine}/edit`);
    await page.getByRole("link", { name: "Draft from these files" }).click();
    await page.waitForURL(new RegExp(`/exhbts/new\\?into=${mine}`));
    await expect(page.getByTestId("file-status")).toContainText("from the team project");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    await page.waitForURL(new RegExp(`/exhbts/${mine}/edit`));
    await expect(page.locator("#title")).not.toHaveValue("");

    // Leaving cuts the link: their exhbt stays, without the team line.
    await page.goto("/exhbts");
    await page.getByRole("button", { name: `Leave ${TITLE}` }).click();
    await page.getByRole("button", { name: "Yes, leave" }).click();
    await page.waitForURL(/\/exhbts\?left=1/);
    await expect(page.getByRole("list", { name: "Team projects you're on" })).toHaveCount(0);
    await page.goto(`/exhbts/${mine}/edit`);
    await expect(page.locator("[data-team-strip]")).toContainText("Worked on this with other people?");

    // The owner deletes the original: the teammate's copy of the file still opens.
    await signInAs(page, `${own}@example.com`);
    await page.getByRole("button", { name: `Delete ${TITLE}` }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.getByRole("link", { name: `Edit ${TITLE}` })).toHaveCount(0);
    await signInAs(page, mate);
    const exported = (await (await page.request.get("/api/account/export")).json()) as {
      exhbts: { id: string }[];
      files: { id: string; exhbtId?: string; sha256?: string }[];
      teamMemberships: unknown[];
    };
    expect(exported.exhbts.map((e) => e.id)).toContain(mine);
    const copy = exported.files.find((f) => f.exhbtId === mine && f.sha256);
    expect(copy).toBeTruthy();
    const res = await page.request.get(`/dev/files/${copy!.id}`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe(NOTES.toString());
    expect(exported.teamMemberships).toEqual([]);
  });
});

test.describe("The same file on someone else's exhbt", () => {
  test("a stranger is asked, calmly, without being told whose it is; the owner approves and they join", async ({ page }) => {
    const own = unique("orig");
    const stranger = `${unique("str")}@example.com`;
    const id = await owner(page, own);
    const NOTES = notesFile();
    await uploadTo(page, id, "report.txt", "text/plain", NOTES, "evidence");

    await signInAs(page, stranger);
    await page.getByRole("button", { name: "Start from scratch" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    const completed = page.waitForResponse((r) => /\/api\/files\/[0-9a-f-]{36}\/complete$/.test(r.url()));
    await page.locator("input[aria-label='Choose a file']").setInputFiles({ name: "my-report.txt", mimeType: "text/plain", buffer: NOTES });
    // The server's answer is an opaque id: nothing about the other account or its exhbt.
    const body = (await (await completed).json()) as { match: { id: string; name: string } };
    expect(Object.keys(body.match).sort()).toEqual(["id", "name"]);
    expect(JSON.stringify(body)).not.toContain(own);

    const prompt = page.getByTestId("match-prompt");
    await expect(prompt.getByRole("heading", { name: "This file is already on someone else's exhbt" })).toBeVisible();
    await expect(prompt).toContainText("Were you on that project together?");
    for (const secret of ["Amara", own, "GP appointments"]) await expect(prompt).not.toContainText(secret);
    await axe(page, "[data-testid=match-prompt]");

    await prompt.getByRole("button", { name: "Ask to join" }).click();
    await expect(prompt).toContainText("You won't see who they are unless they add you.");
    await prompt.getByLabel("Your name").fill("Erin Moss");
    await prompt.getByLabel(/Your part in it/).fill("Wrote the survey");
    await axe(page, "[data-testid=match-prompt]");
    await prompt.getByRole("button", { name: "Send request" }).click();
    await expect(prompt.getByRole("heading", { name: "Request sent" })).toBeVisible();
    for (const secret of ["Amara", own, "GP appointments"]) await expect(prompt).not.toContainText(secret);

    // The owner hears by email and on their exhbts page, with who is asking.
    await page.goto("/dev/emails");
    await expect(page.getByRole("link", { name: new RegExp(`Erin Moss asked to join.*to ${own}@example\\.com`) })).toBeVisible();
    await signInAs(page, `${own}@example.com`);
    await expect(page.getByRole("heading", { level: 2, name: "Someone asked to join your exhbt" })).toBeVisible();
    await page.getByRole("link", { name: "Review Erin Moss's request" }).click();
    const asked = page.getByRole("region", { name: "Asked to join" });
    await expect(asked).toContainText(stranger);
    await expect(asked).toContainText("Their part: Wrote the survey");
    await axe(page);
    await asked.getByRole("button", { name: "Add Erin Moss as a teammate" }).click();
    await expect(page.locator("[data-said]")).toHaveText(/Added as a teammate/);
    await expect(page.getByRole("list", { name: "Teammates" })).toContainText("Erin Moss");

    // Now they're told, and they show on the project.
    await page.goto("/dev/emails");
    await expect(page.getByRole("link", { name: new RegExp(`You're on .*to ${stranger.replace(/[+.]/g, "\\$&")}`) })).toBeVisible();
    await page.goto(`/p/${own}/${SLUG}`);
    await expect(page.locator("[data-team]")).toContainText("Erin Moss");
    await expect(page.locator("[data-team]")).toContainText("Wrote the survey");

    // On the team now, the same file again asks nothing.
    await signInAs(page, stranger);
    await expect(page.getByRole("list", { name: "Team projects you're on" })).toContainText(TITLE);
    const ownHref = await page.getByRole("link", { name: /^Edit / }).first().getAttribute("href");
    const theirId = ownHref!.match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
    expect(await uploadTo(page, theirId, "again.txt", "text/plain", NOTES, "evidence")).toBeNull();
  });

  test("'No, it's mine' is logged privately, shows nothing publicly, and a repeat asks nothing", async ({ page }) => {
    const own = unique("mine");
    const stranger = `${unique("solo")}@example.com`;
    const id = await owner(page, own);
    const NOTES = notesFile();
    await uploadTo(page, id, "data.txt", "text/plain", NOTES);

    // On the upload page this time.
    await signInAs(page, stranger, "/exhbts/new");
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.locator("#files").setInputFiles({ name: "data.txt", mimeType: "text/plain", buffer: NOTES });
    const prompt = page.getByTestId("match-prompt");
    await expect(prompt).toContainText("Were you on that project together?");
    await prompt.getByRole("button", { name: "No, it's mine" }).click();
    await expect(prompt.getByRole("heading", { name: "Thanks" })).toBeVisible();
    await expect(prompt).toContainText("Nothing about this shows on any exhbt.");
    await prompt.getByRole("button", { name: "Close" }).click();
    await expect(prompt).toHaveCount(0);

    // Again: logged as a repeat, and nothing asked.
    const completed = page.waitForResponse((r) => /\/api\/files\/[0-9a-f-]{36}\/complete$/.test(r.url()));
    await page.locator("#files").setInputFiles({ name: "data-again.txt", mimeType: "text/plain", buffer: NOTES });
    expect(((await (await completed).json()) as { match: unknown }).match).toBeNull();
    await expect(prompt).toHaveCount(0);

    const exported = (await (await page.request.get("/api/account/export")).json()) as {
      fileMatchesOnYourUploads: { outcome: string; sha256: string }[];
    };
    expect(exported.fileMatchesOnYourUploads.map((m) => m.outcome)).toEqual(["mine", "repeat"]);
    expect(JSON.stringify(exported.fileMatchesOnYourUploads)).not.toContain(own);

    // Nothing public: no team line on the owner's project or portfolio, and the owner isn't told.
    await page.goto(`/p/${own}/${SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.locator("[data-team]")).toHaveCount(0);
    await expect(page.getByText(/already on someone else|asked to join/i)).toHaveCount(0);
    await signInAs(page, `${own}@example.com`);
    await expect(page.getByRole("heading", { level: 2, name: /asked to join/ })).toHaveCount(0);
  });
});

test("the privacy policy says files are fingerprinted, matched privately and may be reviewed", async ({ page }) => {
  await page.goto("/legal/privacy");
  await expect(page.getByRole("heading", { level: 2, name: "Teammates and shared files" })).toBeVisible();
  await expect(page.getByText(/fingerprint \(a SHA-256 hash\) of each file you upload/)).toBeVisible();
  await expect(page.getByText(/Nothing about a match is ever shown publicly/)).toBeVisible();
  await expect(page.getByText(/we may review those records/)).toBeVisible();
});
