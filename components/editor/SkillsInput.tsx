"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LIMITS, type Issue } from "@/lib/exhbt/blocks";
import { FieldIssues } from "./FieldIssues";
import { issuesAt } from "./model";

/** Skill boxes as tags: type one and press Enter (or Add). Up to LIMITS.skills.max, a few words each. */
export function SkillsInput({ skills, onChange, issues }: { skills: string[]; onChange: (s: string[]) => void; issues: Issue[] }) {
  const [draft, setDraft] = useState("");
  const full = skills.length >= LIMITS.skills.max;
  const add = () => {
    const s = draft.trim().replace(/\s+/g, " ");
    if (!s || full || skills.some((k) => k.toLowerCase() === s.toLowerCase())) return;
    onChange([...skills, s]);
    setDraft("");
  };
  const all = [...issuesAt(issues, "skills"), ...skills.flatMap((_, i) => issuesAt(issues, `skills.${i}`).map((x) => ({ ...x, message: `${skills[i]}: ${x.message}` })))];

  return (
    <div>
      <label htmlFor="skill-new" className="label">
        Skills <span className="font-normal text-graphite">(up to {LIMITS.skills.max}, {LIMITS.skills.wordsEach} words each)</span>
      </label>
      {skills.length > 0 && (
        <ul aria-label="Skills" className="mb-2 flex flex-wrap gap-1.5">
          {skills.map((s, i) => (
            <li key={`${i}-${s}`} className="chip pr-1">
              {s}
              <Button size="sm" label={`Remove ${s}`} onClick={() => onChange(skills.filter((_, j) => j !== i))}>
                <X aria-hidden size={12} strokeWidth={2.5} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id="skill-new"
          className="field min-w-0"
          value={draft}
          disabled={full}
          maxLength={LIMITS.skills.charsEach}
          placeholder={full ? "That's the most skills" : "e.g. Python"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          aria-describedby="skills-issues"
        />
        <Button disabled={full || !draft.trim()} onClick={add} label="Add skill" className="shrink-0">
          Add
        </Button>
      </div>
      <FieldIssues id="skills-issues" issues={all} />
    </div>
  );
}
