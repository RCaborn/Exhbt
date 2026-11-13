"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/portfolio/Avatar";
import { Button } from "@/components/ui/Button";
import { removePhotoAction, savePhotoAction } from "./actions";

const MB = 1024 * 1024;
/** Longest side of the stored photo. It shows at 84px at most, so 512 is plenty for sharp screens and link previews. */
const SIDE = 512;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Crops the picture to a centred square and shrinks it to 512px at most, in the browser, so only a
 * small file is uploaded. JPEG, because the link-preview renderer (next/og) can't read WebP.
 */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(side, SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  // A transparent PNG would turn black as a JPEG; paint white under it.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("no blob");
  return blob;
}

/** The profile photo: upload (cropped and resized here first), replace, or remove. */
export function PhotoField({ name, photoUrl, maxMb }: { name: string; photoUrl: string | null; maxMb: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStatus("");
    if (!TYPES.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError("Use a JPEG, PNG or WebP picture.");
      return;
    }
    if (file.size > maxMb * MB) {
      setError(`That photo is over ${maxMb} MB, the limit for each file on your plan. Choose a smaller one.`);
      return;
    }
    setBusy("upload");
    let fileId: string | undefined;
    try {
      let blob: Blob;
      try {
        blob = await squareJpeg(file);
      } catch {
        throw new Error("We couldn't read that picture. Try a different one.");
      }
      const res = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "photo.jpg", mime: "image/jpeg", bytes: blob.size, kind: "photo" }),
      });
      const data = (await res.json().catch(() => ({}))) as { fileId?: string; uploadUrl?: string; headers?: Record<string, string>; error?: string };
      if (!res.ok || !data.fileId || !data.uploadUrl) throw new Error(data.error ?? "We couldn't upload that photo.");
      fileId = data.fileId;
      const put = await fetch(data.uploadUrl, { method: "PUT", headers: data.headers, body: blob });
      if (!put.ok) throw new Error("The upload didn't finish. Try again.");
      const saved = await savePhotoAction(fileId);
      if (saved.error) throw new Error(saved.error);
      fileId = undefined;
      setStatus("Photo saved.");
      router.refresh();
    } catch (e) {
      if (fileId) await fetch(`/api/files/${fileId}`, { method: "DELETE" }).catch(() => undefined);
      setError(e instanceof Error ? e.message : "We couldn't upload that photo. Check your connection.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    setStatus("");
    setBusy("remove");
    const r = await removePhotoAction().catch(() => ({ error: "We couldn't remove it just now. Try again." }));
    setBusy(null);
    if (r.error) setError(r.error);
    else {
      setStatus("Photo removed.");
      router.refresh();
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} photoUrl={photoUrl} size={64} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy === "upload"}
            disabled={busy !== null}
            onClick={() => input.current?.click()}
            label={photoUrl ? "Change photo" : "Upload a photo"}
          >
            {photoUrl ? "Change photo" : "Upload a photo"}
          </Button>
          {photoUrl && (
            <button type="button" onClick={remove} disabled={busy !== null} className="link text-sm font-semibold text-ink disabled:opacity-60">
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          data-testid="photo-input"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </div>
      <p id="photo-hint" className="hint mt-2">
        JPEG, PNG or WebP, up to {maxMb} MB. We crop it to a square from the middle. Without one, your initials show.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
      <p role="status" className="mt-1 min-h-5 text-sm text-jade">
        {status}
      </p>
    </div>
  );
}
