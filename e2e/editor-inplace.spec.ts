import { expect, test } from "@playwright/test";
import { hasMarker, pageItems } from "../lib/exhbt/layouts";
import { docNow, field, frame, freshName, openNew, pageOrder, READY, readStored, typeIn, undoLabel, waitReady, waitSaved } from "./page-editor";

/*
 * The edit-on-page editor, typed in where the words sit (decision 0026): what is typed is stored at
 * its path and is there after a reload; typing alone never writes the flowchart's marker; the first
 * structural change does, and its Undo takes it out again; pictures go on the page and are stored.
 */

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.describe("a new exhbt in the new editor", () => {
  test("opens in the new editor; the title, a box, a finding and the context line are typed in place, saved, and there after a reload", async ({ page }) => {
    const id = await openNew(page, freshName("inplace"));
    await expect(page.locator(READY)).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toBeVisible();

    await typeIn(page, "title", "Would a second till cut lunchtime queues?");
    await typeIn(page, "flow.0.step", "Timed the queue");
    await typeIn(page, "sections.0.items.0", "Waits fell from 11 to 4 minutes.");
    await typeIn(page, "gap", "Lunch queues ran past ten minutes.");
    await waitSaved(page, id);

    const stored = (await readStored(page, id)).working;
    expect(stored.title).toBe("Would a second till cut lunchtime queues?");
    expect(stored.flow[0]!.step).toBe("Timed the queue");
    expect(stored.sections[0]).toMatchObject({ kind: "findings", items: [[{ t: "Waits fell from 11 to 4 minutes." }], []] });
    expect(stored.gap).toEqual([{ t: "Lunch queues ran past ten minutes." }]);
    // Typing alone never writes the flowchart's marker (decision 0027).
    expect(hasMarker(stored)).toBe(false);
    expect(stored.flowOff).toBeUndefined();

    await page.reload();
    await waitReady(page);
    await expect(field(page, "title")).toHaveValue("Would a second till cut lunchtime queues?");
    await expect(field(page, "flow.0.step")).toHaveValue("Timed the queue");
    await expect(field(page, "sections.0.items.0")).toHaveText("Waits fell from 11 to 4 minutes.");
    await expect(field(page, "gap")).toHaveText("Lunch queues ran past ten minutes.");
  });

  test("Move down writes the marker; Undo puts the order back and takes the marker out", async ({ page }) => {
    const id = await openNew(page, freshName("undo"));
    const before = await docNow(page);
    expect(await pageOrder(page)).toEqual(["flow", "findings"]);

    await frame(page, "flow").hover();
    await frame(page, "flow").getByRole("button", { name: "Move Flowchart down" }).click();
    expect(await pageOrder(page)).toEqual(["findings", "flow"]);
    await waitSaved(page, id);
    const moved = (await readStored(page, id)).working;
    expect(hasMarker(moved)).toBe(true);
    expect(pageItems(moved).map((it) => it.id)).toEqual(["findings", "flow"]);
    expect(await undoLabel(page)).toBe("move flowchart");

    // Undo with the keyboard, the cursor not in a field.
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("ControlOrMeta+z");
    expect(await pageOrder(page)).toEqual(["flow", "findings"]);
    await waitSaved(page, id);
    const undone = (await readStored(page, id)).working;
    expect(hasMarker(undone)).toBe(false);
    expect(undone.sections).toEqual(before.sections);
    expect(await undoLabel(page)).toBeNull();
  });

  test("a picture can be added: it goes on the page and is stored", async ({ page }) => {
    const id = await openNew(page, freshName("picture"));
    await page.locator(`${READY} input[aria-label='Choose an image']`).setInputFiles({ name: "queue.png", mimeType: "image/png", buffer: PNG });
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(1);
    await expect(page.getByText("1 image added. Each one needs a description for people who can't see it.")).toBeVisible();
    await waitSaved(page, id);
    const stored = (await readStored(page, id)).working;
    const images = stored.sections.filter((s) => s.kind === "image");
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ kind: "image", alt: "" });
    // Its description field is under it, named for the picture.
    await expect(page.getByRole("textbox", { name: "Image 1: describe it for people who can't see it" })).toBeVisible();
  });
});
