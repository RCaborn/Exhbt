import { expect, test } from "@playwright/test";
import { joinYear, splitYear } from "../lib/portfolio-layout";

/*
 * The portfolio page's editing slots (decision 0031, "The adapter"; brief D of docs/briefs/portfolio-first).
 *
 * joinYear, with no browser: the portfolio editor types a line of education or experience as two
 * fields, the words and the year, and writes them back as one line that splitYear reads.
 */

test.describe("joinYear", () => {
  const YEARS = ["2024", "2021–2024", "2021-2024", "2023 to now", "2023 to present"];
  const LABELS = ["BSc Business Analytics, University of Sheffield", "Shift supervisor", "A levels: Maths, Economics, Geography", "Summer analyst intern — Sheffield City Council"];

  test("splitYear reads back the words and the year it was given", () => {
    for (const label of LABELS) for (const year of YEARS) expect(splitYear(joinYear(label, year)), `${label} + ${year}`).toEqual({ label, year });
  });

  test("with no year, the words alone, and splitYear reads no year", () => {
    for (const label of LABELS) {
      expect(joinYear(label, null)).toBe(label);
      expect(joinYear(label, "")).toBe(label);
      expect(joinYear(`  ${label}  `, "   ")).toBe(label);
      expect(splitYear(joinYear(label, null))).toEqual({ label, year: null });
    }
  });

  test("the words and the year are trimmed", () => {
    expect(joinYear("  Shift supervisor ", " 2024 ")).toBe("Shift supervisor, 2024");
  });

  test("a stored line written as label, year comes back as it was", () => {
    for (const line of ["BSc Business Analytics, University of Sheffield, 2023 to now", "Foundation year, Sheffield College, 2022–2023", "Weekend retail assistant, 2021–2023"]) {
      const { label, year } = splitYear(line);
      expect(joinYear(label, year)).toBe(line);
    }
  });

  test("a year with no words is the year alone, which splitYear reads as words", () => {
    // splitYear needs words before a year to read it as one; the editor's year field never stands alone on a stored line.
    expect(joinYear("", "2024")).toBe("2024");
    expect(splitYear("2024")).toEqual({ label: "2024", year: null });
  });
});
