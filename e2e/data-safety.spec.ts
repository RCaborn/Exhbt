import { expect, test } from "@playwright/test";
import { SCHEMA_VERSION } from "../lib/exhbt/blocks";

// The server keeps every file an exhbt still uses (decision 0026, "Saving, and what may delete a
// file"): DELETE /api/files/[id] deletes nothing while any of the person's exhbts points at the file
// in its working copy or its published copy, and answers as if it had. Seeded through /dev/parity;
// signed in with /auth/dev directly, because signInAs and /dev/portfolio clear the user's exhbts.

const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

const core = {
  schemaVersion: SCHEMA_VERSION,
  title: "Would a second till help?",
  context: "Year 2 module",
  skills: [],
  gap: [{ t: "Queues ran long at lunch." }],
  flow: [{ step: "Timed the queue" }, { step: "Added a till" }, { step: "Timed it again" }],
};
const findings = { id: "findings", kind: "findings", items: [[{ t: "Waits fell from 11 to 4 minutes." }], [{ t: "Sales held." }]] };
const picture = (id: string) => ({ id, kind: "image", fileId: "seeded", alt: "The queue at the till", caption: [] });

test("the server keeps a file either copy of an exhbt uses, and deletes one neither uses", async ({ page }) => {
  const username = unique("safety");
  // The published copy shows picture X; the working copy no longer does.
  const live = await page.request.post("/dev/parity", {
    data: { username, slug: "queue", doc: { ...core, sections: [findings, picture("image-1")] }, working: { ...core, sections: [findings] }, extraFiles: ["spare"] },
  });
  expect(live.status(), await live.text()).toBe(200);
  const { files } = (await live.json()) as { files: Record<string, string> };
  const x = files["image-1"]!;
  const spare = files.spare!;
  // A draft the other way round: the working copy uses picture Y, the published copy doesn't.
  const draft = await page.request.post("/dev/parity", {
    data: { username, slug: "draft", doc: { ...core, sections: [findings] }, working: { ...core, sections: [findings, picture("image-2")] } },
  });
  expect(draft.status(), await draft.text()).toBe(200);
  const y = ((await draft.json()) as { files: Record<string, string> }).files["image-2"]!;
  expect(new Set([x, y, spare]).size).toBe(3);

  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  for (const id of [x, y, spare]) expect((await page.request.get(`/dev/files/${id}`)).status(), id).toBe(200);

  // Used by a copy: 204, as if deleted, and the file is still there.
  for (const id of [x, y]) {
    expect((await page.request.delete(`/api/files/${id}`)).status()).toBe(204);
    expect((await page.request.get(`/dev/files/${id}`)).status()).toBe(200);
  }
  await page.goto(`/p/${username}/queue`);
  await expect(page.locator(`article[data-exhbt-page] img[src="/dev/files/${x}"]`)).toBeVisible();
  expect(await page.locator(`article[data-exhbt-page] img[src="/dev/files/${x}"]`).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Used by neither: deleted.
  expect((await page.request.delete(`/api/files/${spare}`)).status()).toBe(204);
  expect((await page.request.get(`/dev/files/${spare}`)).status()).toBe(404);
  expect((await page.request.delete(`/api/files/${spare}`)).status()).toBe(404);
});

test("the AI version keeps its graphs through the real save and load", async ({ request }) => {
  // The graphs a figure from the work replaced (decision 0025), kept with the AI version for release 3 to offer back.
  const graphs = [{ kind: "bar", title: "Queue time (min)", unit: "min", rows: [{ label: "Before", value: 11 }, { label: "After", value: 4 }] }];
  const aiVersion = { blocks: { gap: [{ t: "Queues ran long at lunch." }] }, unverified: { gap: [] }, graphs };
  const seeded = await request.post("/dev/parity", { data: { username: unique("aiver"), slug: "queue", doc: { ...core, sections: [findings] }, aiVersion } });
  expect(seeded.status(), await seeded.text()).toBe(200);
  const { id } = (await seeded.json()) as { id: string };
  const read = (await (await request.get(`/dev/parity?id=${id}`)).json()) as { aiVersion: typeof aiVersion; working: { title: string } };
  expect(read.aiVersion.graphs).toEqual(graphs);
  expect(read.aiVersion.blocks).toEqual(aiVersion.blocks);
  expect(read.working.title).toBe(core.title);
});
