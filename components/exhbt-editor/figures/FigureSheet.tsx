"use client";

import "../css/figures.css";
import { useState, type ReactNode } from "react";
import { checkFile, readSize, UploadError, uploadForExhbt } from "@/components/editor/media";
import { asFile, Cropper, PagePicker, sourceBytes } from "@/components/editor/PickedFigure";
import { Button } from "@/components/ui/Button";
import type { ExhbtDoc, FigureBox } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { blockOptions, insertImage, pageItems } from "@/lib/exhbt/layouts";
import { roomFor } from "@/lib/exhbt/sections";
import { useEnv, useRuntime, useUiState } from "../context";
import { useFilesController } from "../files";
import { useDoc, useStoreInternal } from "../store";
import { Sheet } from "../ui/Sheet";

/*
 * "Take a figure from my report" (decisions 0025 and 0026), for an exhbt whose report gave no figure
 * (the pick found none, failed, or was removed): the page chooser PickedFigure already has, drawn in
 * the browser from the stored PDF, with no AI call. Choose the report if there are several, then a
 * page (its first 30, as thumbnails), which comes in whole; then crop it. On "Use this crop" the
 * picture is cut out here and uploaded, and one undo entry, "take a figure", puts it where the "+"
 * that opened the sheet was, as every item in that menu goes (decision 0026), as a figure from the
 * report, not yet ticked as shareable. It removes no graph: the person chose it by hand. The cursor
 * then goes to its description.
 */
export function FigureSheet(): ReactNode {
  return (
    <Sheet name="figure" title="Take a figure from your report">
      <TakeFigure />
    </Sheet>
  );
}

/** Why there's no room for another image ("Up to 2 images in a case study"), or null when there is. */
const noRoom = (d: ExhbtDoc): string | null => (roomFor(d.sections, "image", formatOf(d)) > 0 ? null : (blockOptions(d).find((o) => o.kind === "image")?.full ?? "There's no room for another image in this layout."));

function TakeFigure() {
  const env = useEnv();
  const store = useStoreInternal();
  const files = useFilesController();
  const { uiApi } = useRuntime();
  const open = useUiState((s) => s.sheet?.name === "figure");
  // The section the figure goes before, as the "+" that opened the sheet named it (Insert.tsx); none: the "+" at the end.
  const goesBefore = useUiState((s) => (s.sheet?.name === "figure" ? s.sheet.sectionId : undefined));
  const reports = env.reportFiles;
  const [fileId, setFileId] = useState(reports[0]?.fileId ?? "");
  const [page, setPage] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = useDoc(noRoom);
  const report = reports.find((r) => r.fileId === fileId) ?? reports[0];

  if (!report) return <p>There&apos;s no report stored with this exhbt to take a figure from.</p>;
  if (full) return <p>{full}. Remove an image first, then take a figure from your report.</p>;

  async function take(box: FigureBox) {
    if (!report || page === null || busy) return;
    setBusy(true);
    setError(null);
    // The figure's file once it is uploaded, and whether it reached the page.
    let uploaded: string | null = null;
    let onPage = false;
    try {
      const { pdfFigure } = await import("@/lib/figures/pdf");
      const blob = await pdfFigure(await sourceBytes(report.fileId, report.url), page, box, { margin: false });
      const file = asFile(blob, report.name, page);
      const problem = checkFile(file, "image", env.maxFileMb);
      if (problem) throw new UploadError(problem);
      // Room is checked again: something may have been added while the page was being cut out.
      if (noRoom(store.get())) throw new UploadError(noRoom(store.get())!);
      uploaded = await uploadForExhbt(file, "image", env.id);
      const fileIdNow = uploaded;
      // Its address for this visit, and the rule that deletes files knows of it from now on. It is held (no save
      // landing while its size is read deletes it) until it is let go below: then, if it never reached the page, it goes.
      files.addUploaded(fileIdNow, file);
      const size = await readSize(file);
      const placed = { id: "" };
      store.patchDoc((d) => {
        // Where its "+" was (decision 0026: whatever is chosen from a "+" goes there; the review's vision-7): before the section it named, or at the end.
        const items = pageItems(d);
        const before = items.findIndex((it) => it.id === goesBefore);
        const r = insertImage(d, { fileId: fileIdNow, ...size }, before >= 0 ? before : items.length);
        if (!r) return d;
        placed.id = r.id;
        const picked = { from: report.name, sourceFileId: report.fileId, page, box, shareOk: false };
        return { ...r.doc, sections: r.doc.sections.map((x) => (x.id === r.id && x.kind === "image" ? { ...x, picked } : x)) };
      }, "take a figure");
      if (!placed.id) throw new UploadError("There's no room for another image in this layout.");
      onPage = true;
      const id = placed.id;
      uiApi.close();
      uiApi.say(`The figure from page ${page} is on your exhbt. Describe it, and tick that you may share it.`);
      // The page is inert while the sheet is open: two frames after it shuts, the cursor goes to the new picture's description.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const n = store.get().sections.filter((x) => x.kind === "image").findIndex((x) => x.id === id);
          const field = document.getElementById(`image-${n}-alt`);
          field?.scrollIntoView({ block: "center" });
          field?.focus({ preventScroll: true });
        }),
      );
      setPage(null);
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "We couldn't take that page just now. Try again.");
    } finally {
      if (uploaded) {
        // On the page, or never to be: let go. Uploaded but not placed, nothing keeps it, so the rule deletes it now.
        files.release(uploaded);
        if (!onPage) files.settle();
      }
      setBusy(false);
    }
  }

  return (
    <div className="xe-fig-take" data-testid="take-figure">
      <p className="text-graphite">
        The pages are drawn here from your stored report. Choose the page with the figure, then crop it to the figure. You tick that you may share it on the page.
      </p>
      {reports.length > 1 && (
        <fieldset className="mt-4">
          <legend className="label">Which report</legend>
          <div className="grid gap-1.5">
            {reports.map((r) => (
              <label key={r.fileId} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="take-figure-report"
                  className="size-4 accent-jade"
                  checked={r.fileId === report.fileId}
                  disabled={busy}
                  onChange={() => {
                    setFileId(r.fileId);
                    setPage(null);
                  }}
                />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {open && page === null && <PagePicker key={report.fileId} fileId={report.fileId} url={report.url} name={report.name} current={0} busy={busy} onPick={setPage} />}
      {open && page !== null && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              Page {page} of {report.name}
            </p>
            <Button size="sm" disabled={busy} onClick={() => setPage(null)}>
              Choose another page
            </Button>
          </div>
          <Cropper key={`${report.fileId}-${page}`} fileId={report.fileId} url={report.url} name={report.name} page={page} busy={busy} onCrop={(b) => void take(b)} onCancel={() => setPage(null)} />
        </div>
      )}
      <p role="status" className="mt-3 text-sm text-graphite empty:hidden">
        {busy ? "Putting the figure on your exhbt…" : null}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
