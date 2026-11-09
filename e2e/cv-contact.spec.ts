import { expect, test } from "@playwright/test";
import { extractContact, normaliseLinkedin } from "../lib/cv-contact";

// Pure checks of the CV contact lifting (lib/cv-contact.ts). No browser needed.

test.describe("CV contact details", () => {
  test("a typical CV top: name line, then contact line", () => {
    const cv = "Amara Okafor\namara.okafor@example.com | 07700 900123 | linkedin.com/in/amara-okafor\nBSc Data Science";
    expect(extractContact(cv)).toEqual({
      name: "Amara Okafor",
      email: "amara.okafor@example.com",
      linkedin: "https://www.linkedin.com/in/amara-okafor",
    });
  });

  test("a one-line CV, a capitalised name, and a heading line", () => {
    expect(extractContact("Amara Okafor. BSc Data Science, University of Example, 2026.").name).toBe("Amara Okafor");
    expect(extractContact("CURRICULUM VITAE\nAMARA OKAFOR\nLondon").name).toBe("Amara Okafor");
    expect(extractContact("Ludwig van Beethoven | Composer").name).toBe("Ludwig van Beethoven");
  });

  test("returns nothing rather than a guess", () => {
    expect(extractContact("I am a final-year student at Leeds studying economics and data.")).toEqual({
      name: null,
      email: null,
      linkedin: null,
    });
    // A job title on its own isn't a name: lower-case words.
    expect(extractContact("Data analyst with three years of SQL").name).toBeNull();
  });

  test("LinkedIn addresses are normalised, and anything else is refused", () => {
    expect(normaliseLinkedin("linkedin.com/in/amara-okafor")).toBe("https://www.linkedin.com/in/amara-okafor");
    expect(normaliseLinkedin("https://uk.linkedin.com/in/amara-okafor/?trk=x")).toBe("https://www.linkedin.com/in/amara-okafor");
    expect(normaliseLinkedin("https://example.com/in/amara")).toBeNull();
    expect(normaliseLinkedin("amara")).toBeNull();
  });
});
