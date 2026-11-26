import { FileText } from "lucide-react";
import { Text } from "@astryxdesign/core/Text";
import { PLAN_NAMES } from "@/lib/entitlements";

/** The words of each step, shared by the still steps and the film, so the two never say different things. */
export const STEPS = {
  file: {
    title: "Upload the file you already have",
    body: "A report, slides, notes or a spreadsheet. Most files are read in your browser.",
  },
  draft: {
    title: "We write a first draft",
    body: "From your files and nothing else. Any number we can't find in them is flagged for you to check.",
  },
  live: {
    title: "You check it, then publish",
    body: `On ${PLAN_NAMES.premium} and ${PLAN_NAMES.max} it goes on your portfolio, at your address. On ${PLAN_NAMES.free} it stays a draft only you can see.`,
  },
} as const;

/** The draft's one line, as the editor would give it once a draft arrives (the clarity review's sixth finding). */
export const DRAFT_NOTE = {
  title: "Here's your first draft.",
  description: "We wrote it from your files and nothing else. Check each number, then publish.",
};

/** The file, as the upload shows it once it's in. */
export function FileChip({ name }: { name: string }) {
  return (
    <span className="hl-file">
      <span className="hl-file-icon" aria-hidden>
        <FileText size={20} strokeWidth={2} />
      </span>
      <span className="hl-file-words">
        <Text type="label">{name}</Text>
        <Text type="supporting">Read in your browser</Text>
      </span>
    </span>
  );
}
