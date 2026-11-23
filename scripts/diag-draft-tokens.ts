/**
 * TEMPORARY (hotfix-draft-schema only): where a draft's output tokens go. Sends the app's own
 * draft request (draftRequest) for some fixtures with a few max_tokens and reports the stop
 * reason, output tokens, the answer's length and its last characters. Removed before merge.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { draftRequest, type DraftInput } from "@/lib/ai/exhbt-draft";
import { anthropicApiKey } from "@/lib/ai/model";
import { extractTextInBrowser } from "@/lib/doc-readers";

const FIXTURES = join(process.cwd(), "evals/exhbt-draft/fixtures");
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
};

async function loadInput(name: string): Promise<DraftInput> {
  const f = JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as { files: string[]; notesFile: string | null; link: string | null };
  const parts: string[] = [];
  for (const file of f.files) {
    const bytes = readFileSync(join(FIXTURES, file));
    const ext = file.split(".").pop() ?? "";
    parts.push(`File: ${file}\n${await extractTextInBrowser(new File([new Uint8Array(bytes)], file, { type: MIME[ext] ?? "" }))}`);
  }
  const notes = f.notesFile ? readFileSync(join(FIXTURES, f.notesFile), "utf8").trim() : undefined;
  return { text: parts.join("\n\n"), notes, link: f.link ?? undefined };
}

async function main() {
  const client = new Anthropic({ apiKey: anthropicApiKey() });
  const names = readdirSync(FIXTURES).filter((n) => n.endsWith(".facts.json")).sort();
  for (const name of names) {
    const input = await loadInput(name);
    for (const max of [4000, 16000]) {
      const req = { ...draftRequest(input), max_tokens: max };
      const r = await client.messages.create({ ...req, thinking: { type: "adaptive", display: "summarized" } });
      const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const thinking = r.content.filter((b) => b.type === "thinking").map((b) => b.thinking).join("");
      console.log(`${name.replace(".facts.json", "")} max ${max}: stop ${r.stop_reason}, in ${r.usage.input_tokens}, out ${r.usage.output_tokens}, answer ${text.length} chars, thinking summary ${thinking.length} chars`);
      console.log(`   answer tail: ${JSON.stringify(text.slice(-240))}`);
    }
  }
}

void main();
