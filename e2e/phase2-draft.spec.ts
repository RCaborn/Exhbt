import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { ENTITLEMENTS } from "../lib/entitlements";
import { DocError, extractTextInBrowser, parseCsv, readXlsxRows, tableToText, TABLE_LIMITS } from "../lib/doc-readers";
import { emptyDoc, text } from "../lib/exhbt/blocks";
import { unverifiedNumbers } from "../lib/exhbt/verify";
import { makeDocx, makePdf } from "./doc-fixtures";
import { uniqueEmail } from "./helpers";

// Upload → AI draft (docs/phase-2.md section 6): the readers, the number check, and /exhbts/new
// end to end with the placeholder AI (no API key in tests) and the in-memory Storage stand-in.

const PROJECT = [
  "Final-year project on GP appointment reminders.",
  "The question was whether sending the reminder 3 hours before an appointment cut missed appointments compared with 24 hours before.",
  "I cleaned 14,200 appointment records from two practices in Python with pandas and fitted a logistic regression.",
  "Missed appointments fell from 7.9% to 6.5% across all patients, and from 11.2% to 8.4% for patients under 30.",
];

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

test.describe("Number check", () => {
  const doc = (findings: string[]) => ({ ...emptyDoc(), title: "Reminders", findings: findings.map(text) });

  test("finds a figure missing from the source", () => {
    const d = doc(["Missed appointments fell 18% after the change.", "Cleaned 14,200 records."]);
    expect(unverifiedNumbers(d, PROJECT.join(" "))).toEqual(["18%"]);
  });

  test("matches numbers however they're written", () => {
    expect(unverifiedNumbers(doc(["Used 14,200 rows."]), "a table of 14200 rows")).toEqual([]);
    expect(unverifiedNumbers(doc(["Up 18%."]), "rose by 18 % overall")).toEqual([]);
    expect(unverifiedNumbers(doc(["Saved £1,250.50 a month."]), "saving 1250.5 pounds")).toEqual([]);
    expect(unverifiedNumbers(doc(["From 7.9% to 6.5%."]), "7.90 then 6.5")).toEqual([]);
    // Each missing number once, as written in the exhbt; chart values count too.
    const d = { ...doc(["Cut 3 steps, then 3 more."]), charts: [{ title: "x", beforeLabel: "a", afterLabel: "b", lowerIsBetter: true, rows: [{ label: "All", before: 7.9, after: 5.1 }] }] };
    expect(unverifiedNumbers(d, "from 7.9")).toEqual(["3", "5.1"]);
  });
});

test.describe("Document readers", () => {
  const file = (bytes: Buffer | string, name: string, type: string) => new File([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], name, { type });

  test("CSV becomes a small aligned table, capped", async () => {
    expect(parseCsv('name,score\n"Smith, J",71\n"Said ""hi""",64\n')).toEqual([["name", "score"], ["Smith, J", "71"], ['Said "hi"', "64"]]);
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(tableToText([["Group", "Before", "After"], ["All patients", "7.9", "6.5"], ["Under 30", "11.2", "8.4"]])).toBe(
      "Group        | Before | After\nAll patients | 7.9    | 6.5\nUnder 30     | 11.2   | 8.4",
    );
    const rows = Array.from({ length: 40 }, (_, i) => [`row ${i}`, String(i * 10)]);
    const out = await extractTextInBrowser(file(rows.map((r) => r.join(",")).join("\n"), "data.csv", "text/csv"));
    expect(out.split("\n")).toHaveLength(TABLE_LIMITS.rows + 1);
    expect(out).toContain(`(${40 - TABLE_LIMITS.rows} more rows not shown)`);
  });

  test("the first sheet of an Excel file is read without a spreadsheet library", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", `<workbook xmlns:r="r"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
    zip.file("xl/sharedStrings.xml", `<sst><si><t>Group</t></si><si><t>Missed %</t></si><si><r><t>Under </t></r><r><t>30</t></r></si></sst>`);
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>8.4</v></c></row></sheetData></worksheet>`,
    );
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    expect(await readXlsxRows(new Uint8Array(buf).buffer)).toEqual([["Group", "", "Missed %"], ["Under 30", "", "8.4"]]);
    expect(await extractTextInBrowser(file(buf, "results.xlsx", ""))).toContain("Under 30 |  | 8.4");
  });

  test("Word, PDF and text files still give their text", async () => {
    const expected = /14,200 appointment records/;
    expect(await extractTextInBrowser(file(await makeDocx(PROJECT), "report.docx", DOCX))).toMatch(expected);
    expect(await extractTextInBrowser(file(makePdf(PROJECT), "report.pdf", "application/pdf"))).toMatch(expected);
    expect(await extractTextInBrowser(file(PROJECT.join("\n"), "notes.txt", "text/plain"))).toMatch(expected);
    await expect(extractTextInBrowser(file("hi", "notes.txt", "text/plain"))).rejects.toBeInstanceOf(DocError);
  });
});

async function signIn(page: Page, tag: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(tag))}&next=/exhbts/new`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft an exhbt" })).toBeVisible();
}

const ready = (page: Page) => expect(page.locator("form[data-ready=true]")).toBeAttached();

test.describe("Draft an exhbt", () => {
  test("a Word file is read, uploaded and drafted, then the editor opens", async ({ page }) => {
    await signIn(page, "draft");
    await ready(page);
    const free = ENTITLEMENTS.free;
    await expect(page.locator("#allowance")).toContainText(`${free.draftsPer30Days} of ${free.draftsPer30Days} AI`);
    await expect(page.locator("#allowance")).toContainText(`${free.uploadMbPerFile} MB each`);

    const docx = await makeDocx(PROJECT);
    const uploaded = page.waitForResponse((r) => r.url().includes("/api/files/upload-url") && r.ok());
    await page.locator("#files").setInputFiles({ name: "report.docx", mimeType: DOCX, buffer: docx });
    const words = PROJECT.join(" ").split(/\s+/).length;
    await expect(page.getByTestId("file-status")).toContainText(`${words} words`);
    await expect(page.getByTestId("file-status")).toContainText("uploaded");

    // The dev Storage stand-in serves back exactly what was uploaded.
    const { fileId } = (await (await uploaded).json()) as { fileId: string };
    const served = await page.request.get(`/dev/files/${fileId}`);
    expect(served.status()).toBe(200);
    expect(Buffer.compare(await served.body(), docx)).toBe(0);

    await page.locator("#notes").fill("Done with two GP practices over six weeks.");
    const drafted = page.waitForResponse((r) => r.url().includes("/api/exhbts/draft"));
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    const res = await drafted;
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { id: string; unverified: string[] };
    expect(Array.isArray(body.unverified)).toBe(true);
    await page.waitForURL(new RegExp(`/exhbts/${body.id}/edit$`));
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("once the plan's drafts are used, the next is refused with the reason", async ({ page }) => {
    await signIn(page, "limit");
    const draft = () => page.request.post("/api/exhbts/draft", { data: { text: PROJECT.join(" ") } });
    for (let i = 0; i < ENTITLEMENTS.free.draftsPer30Days; i++) expect((await draft()).status()).toBe(200);
    const refused = await draft();
    expect(refused.status()).toBe(429);
    expect(((await refused.json()) as { error: string }).error).toContain("AI draft");

    await page.reload();
    await expect(page.locator("#allowance")).toContainText(`0 of ${ENTITLEMENTS.free.draftsPer30Days} AI`);
    const alert = page.getByRole("alert").filter({ hasText: "AI draft" });
    await expect(alert).toContainText("You've used your");
    await expect(alert.getByRole("link", { name: /^Upgrade to Premium/ })).toHaveAttribute("href", "/account/billing");
    await expect(alert.getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/pricing");
    await expect(page.getByRole("button", { name: "Draft my exhbt" })).toHaveCount(0);
  });

  test("a file over the plan's cap is refused on the device", async ({ page }) => {
    let asked = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/files/upload-url")) asked = true;
    });
    await signIn(page, "big");
    await ready(page);
    const cap = ENTITLEMENTS.free.uploadMbPerFile;
    await page.locator("#files").setInputFiles({ name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(cap * 1024 * 1024 + 1, 0x20) });
    await expect(page.locator("#file-list")).toContainText(`Over the ${cap} MB limit`);
    await expect(page.getByRole("button", { name: "Draft my exhbt" })).toBeDisabled();
    expect(asked).toBe(false);
  });

  test("a photo asks before it's read by the AI", async ({ page }) => {
    await signIn(page, "photo");
    await ready(page);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    await page.locator("#files").setInputFiles({ name: "whiteboard.png", mimeType: "image/png", buffer: png });
    await expect(page.getByText("That's a photo")).toBeVisible();
    await page.getByRole("button", { name: "Read it for me" }).click();
    // Without an API key the reader returns a labelled placeholder.
    await expect(page.getByTestId("file-status")).toContainText("words");
  });

  test("no accessibility violations on /exhbts/new", async ({ page }) => {
    await signIn(page, "a11y");
    await ready(page);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("signed out, the page asks you to sign in", async ({ page }) => {
    await page.goto("/exhbts/new");
    await expect(page).toHaveURL(/\/login\?next=%2Fexhbts%2Fnew|\/login\?next=\/exhbts\/new/);
    expect((await page.request.post("/api/exhbts/draft", { data: { text: "x" } })).status()).toBe(401);
  });
});
