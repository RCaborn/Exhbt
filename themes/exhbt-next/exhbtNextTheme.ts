import { defineTheme } from "@astryxdesign/core/theme";
import { exhbtTheme, INK, JADE, MINT, MINT_PRESS } from "../exhbt/exhbtTheme";

/**
 * The proposed Exhbt theme ("the voice"), used only inside the design lab (/lab/design).
 * It extends today's theme (themes/exhbt/exhbtTheme.ts), so the brand's colours and the pill
 * button still have one owner, and adds what today's theme leaves to Astryx's neutral defaults:
 * display type, motion, shadows, the focus and selection rings, radius, the status colours and a
 * style for every component the lab's screens use.
 *
 * Build after any change (the built files beside this one are committed):
 *   npm run astryx -- theme build themes/exhbt-next/exhbtNextTheme.ts
 * Check they are current:
 *   npm run astryx -- theme build themes/exhbt-next/exhbtNextTheme.ts --check
 *
 * The lab's three levels (restrained, confident, maximal) re-set a few of these tokens on the
 * lab's root in components/lab/lab.css; the values here are the confident level.
 */
const WHITE = "#FFFFFF";
const GRAPHITE = "#3E4044";
const SLATE = "#6F7278";
const FIELD = "#85888E";
const LINE = "#E5E6E8";
const MIST = "#F6F7F8";
const WASH = "#E3FCF0";
const ON_INK = "#C9CBCF";
const ERROR = "#C92324";
/** Error's pale ground: the error red mixed into white (ink text on it is 15:1, the red 5.0:1). */
const ERROR_WASH = "#FBEBEB";

const both = (v: string): [string, string] => [v, v];

/** Text colours as tokens, for a component's own rule: Astryx flips them on an ink ground. */
const TEXT = "var(--color-text-primary)";
const TEXT_2 = "var(--color-text-secondary)";

/** One hue, so a Token or Badge asked for a colour the brand doesn't have comes out grey. */
const GREYED = ["blue", "cyan", "orange", "pink", "purple", "teal", "yellow", "gray"] as const;
const greyed = Object.fromEntries(
  GREYED.flatMap((c) => [
    [`--color-background-${c}`, both(MIST)],
    [`--color-border-${c}`, both(FIELD)],
    [`--color-icon-${c}`, both(GRAPHITE)],
    [`--color-text-${c}`, both(INK)],
  ]),
);

/**
 * The edge of a field or a choice: 1.5px, grey at rest (3.5:1), ink under the pointer, jade with a
 * mint halo when it has focus. The width is set through Astryx's --border-width on the control
 * itself, so the parts of an input group still join edge to edge.
 */
const EDGE = "1.5px";
const HALO = `0 0 0 3px color-mix(in srgb, ${MINT} 38%, ${WHITE})`;
const field = {
  "--border-width": EDGE,
  borderColor: FIELD,
  backgroundColor: WHITE,
  ":hover": { borderColor: INK, boxShadow: "none" },
  ":focus-within": { borderColor: JADE, boxShadow: HALO },
};
const fieldStatus = (colour: string) => ({ borderColor: colour, ":hover": { borderColor: colour }, ":focus-within": { borderColor: colour } });
const fieldStates = {
  base: field,
  "status:error": fieldStatus(ERROR),
  "status:success": fieldStatus(JADE),
  "status:warning": fieldStatus(INK),
  disabled: { borderColor: FIELD, ":hover": { borderColor: FIELD } },
};

/**
 * What the type scale can't say: display steps are semibold and set tight, headings a little
 * tighter than Astryx's 4px grid gives, and the lead paragraph is regular weight. A scale given
 * again for phones (adaptations, below) regenerates these, so each rule repeats them.
 */
const VOICE = {
  "--text-display-1-weight": "var(--font-weight-semibold)",
  "--text-display-2-weight": "var(--font-weight-semibold)",
  "--text-display-3-weight": "var(--font-weight-semibold)",
  "--text-display-1-leading": "1",
  "--text-display-2-leading": "1.04",
  "--text-display-3-leading": "1.08",
  "--text-heading-1-leading": "1.12",
  "--text-heading-2-leading": "1.16",
  "--text-heading-3-leading": "1.25",
  "--text-large-weight": "var(--font-weight-normal)",
  "--text-large-leading": "1.5",
  "--text-label-weight": "var(--font-weight-semibold)",
};

/** A surface that floats over the page (a menu, a popover): white, a hairline and the low shadow. */
const floating = {
  backgroundColor: WHITE,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: LINE,
};

export const exhbtNextTheme = defineTheme({
  name: "exhbt-next",
  extends: exhbtTheme,

  // Type with a voice. Ratio 1.25 from 16px: text 16, large 20, headings 31/25/20, display 61/49/39.
  // The display steps are semibold and set tight (below); Home keeps a larger step, `type="hero"`.
  typography: {
    scale: { base: 16, ratio: 1.25 },
    body: { family: "Inter", fallbacks: "system-ui, sans-serif" },
    heading: { family: "Bricolage Grotesque Variable", fallbacks: "Inter, system-ui, sans-serif", weight: "semibold" },
    code: { family: "Inter", fallbacks: "system-ui, sans-serif" },
  },

  // Motion: three tempos and one character. Fast is feedback (hover, press, a field's edge), medium is
  // something arriving (a sheet, a menu, a toast), slow is a moment that is watched (ticks filling, a
  // stroke being drawn). Expressive: entrances and moves overshoot a little; exits and fades never do.
  motion: { fast: 140, medium: 320, slow: 720, ratio: 0.75, character: "expressive" },

  // The theme's own tokens, beside Astryx's. Home's opening line is fluid: 48px on a phone, 96px on a wide screen.
  localTokens: {
    "--exhbt-hero-size": "clamp(3rem, 8.4vw, 6rem)",
  },

  tokens: {
    // Radius, one owner: 8 inside a control, 14 for a control or small panel, 20 for a card or
    // sheet, 28 for a page-sized panel. Buttons, tokens and the segmented control are pills.
    "--radius-inner": "8px",
    "--radius-element": "14px",
    "--radius-container": "20px",
    "--radius-page": "28px",
    "--radius-chat": "28px",

    // Display type: semibold, set tight. Headings a little tighter than Astryx's 4px grid gives.
    ...VOICE,

    // Shadows. Nothing in the flow of a page is raised except the work (a person's page in its
    // frame), which takes --shadow-high, the site's shadow-pack. Low and medium are for what floats
    // over the page for a moment: menus and popovers (low), toasts (medium). Dialogs and sheets take high.
    "--shadow-low": "0 1px 2px rgb(14 15 18 / 0.06), 0 6px 16px rgb(14 15 18 / 0.08)",
    "--shadow-med": "0 1px 2px rgb(14 15 18 / 0.06), 0 10px 28px rgb(14 15 18 / 0.12)",
    "--shadow-high": "0 1px 2px rgb(14 15 18 / 0.06), 0 20px 48px -12px rgb(14 15 18 / 0.2)",
    // The rings Astryx documents for inputs, in the brand (its own defaults are blue).
    "--shadow-inset-hover": `inset 0 0 0 2px color-mix(in srgb, ${INK} 16%, transparent)`,
    "--shadow-inset-selected": `inset 0 0 0 2px ${INK}`,
    "--shadow-inset-success": `inset 0 0 0 2px color-mix(in srgb, ${JADE} 35%, transparent)`,
    "--shadow-inset-warning": `inset 0 0 0 2px color-mix(in srgb, ${INK} 35%, transparent)`,
    "--shadow-inset-error": `inset 0 0 0 2px color-mix(in srgb, ${ERROR} 35%, transparent)`,

    // Focus: one jade ring on every control (5.6:1 on white, 3.4:1 on ink, 3.6:1 on mint).
    "--focus-outline-width": "3px",
    "--focus-outline-color": JADE,
    "--focus-outline-offset": "2px",

    // Status, in the brand. Go, live and checked are mint and jade; information is ink on mist;
    // a warning is ink too, told apart by its icon and its edge (the brand has no amber); an error
    // is the one red.
    "--color-info": both(INK),
    "--color-on-info": both(WHITE),
    "--color-info-muted": both(MIST),
    "--color-on-info-muted": both(INK),
    "--color-text-info": both(INK),
    "--color-icon-info": both(INK),
    "--color-border-info": both(INK),
    "--color-success": both(MINT),
    "--color-on-success": both(INK),
    "--color-success-muted": both(WASH),
    "--color-on-success-muted": both(INK),
    "--color-text-success": both(JADE),
    "--color-icon-success": both(JADE),
    "--color-border-success": both(JADE),
    "--color-warning": both(INK),
    "--color-on-warning": both(WHITE),
    "--color-warning-muted": both(WHITE),
    "--color-on-warning-muted": both(INK),
    "--color-text-warning": both(INK),
    "--color-icon-warning": both(INK),
    "--color-border-warning": both(INK),
    "--color-error-muted": both(ERROR_WASH),
    "--color-on-error": both(WHITE),
    "--color-background-error-inverted": both(ERROR),
    "--color-on-error-muted": both(ERROR),
    "--color-icon-error": both(ERROR),
    // The categorical colours: green is the brand's own pair, red is the error pair, the rest are grey.
    ...greyed,
    "--color-background-green": both(WASH),
    "--color-border-green": both(JADE),
    "--color-icon-green": both(JADE),
    "--color-text-green": both(JADE),
    "--color-background-red": both(ERROR_WASH),
    "--color-border-red": both(ERROR),
    "--color-icon-red": both(ERROR),
    "--color-text-red": both(ERROR),

    // Grounds and lines the neutral theme leaves tinted. The stronger edge (a field's, a switch's
    // track) is the site's field grey, 3.5:1 on white; today's theme makes it ink.
    "--color-border-emphasized": both(FIELD),
    "--color-background-popover": both(WHITE),
    "--color-background-inverted": both(INK),
    "--color-neutral": both(MIST),
    "--color-overlay": both("rgb(14 15 18 / 0.5)"),
    "--color-overlay-hover": both("rgb(14 15 18 / 0.05)"),
    "--color-overlay-pressed": both("rgb(14 15 18 / 0.1)"),
    "--color-skeleton": both("#ECEDEF"),
    "--color-track": both(LINE),
    "--color-shadow": both("rgb(14 15 18 / 0.08)"),
    "--color-tint-hover": both(INK),
    "--color-icon-disabled": both(SLATE),
    "--color-on-dark": WHITE,
    "--color-on-light": INK,
  },

  components: {
    // ── Type ────────────────────────────────────────────────────────────────
    heading: {
      base: { letterSpacing: "-0.02em", textWrap: "balance" },
      "type:display-1": { letterSpacing: "-0.04em" },
      "type:display-2": { letterSpacing: "-0.035em" },
      "type:display-3": { letterSpacing: "-0.03em" },
      // Home's own step: the one line a visitor reads first. Fluid, so it is as deliberate on a phone.
      "type:hero": {
        fontSize: "var(--exhbt-hero-size)",
        fontWeight: "var(--font-weight-semibold)",
        lineHeight: "0.98",
        letterSpacing: "-0.045em",
      },
    },
    text: {
      base: { textWrap: "pretty" },
      "type:display-1": { fontFamily: "var(--font-family-heading)", letterSpacing: "-0.04em" },
      "type:display-2": { fontFamily: "var(--font-family-heading)", letterSpacing: "-0.035em" },
      "type:display-3": { fontFamily: "var(--font-family-heading)", letterSpacing: "-0.03em" },
    },

    // ── Buttons: today's pill and its variants (inherited), with a press that answers ──────
    button: {
      "variant:primary": { ":hover": { backgroundColor: MINT_PRESS } },
      "variant:destructive": { backgroundColor: ERROR_WASH, color: ERROR },
    },

    // ── Surfaces: flat, a hairline, one radius ───────────────────────────────
    card: {
      base: { borderRadius: "var(--radius-container)", padding: "var(--spacing-6)", borderColor: LINE },
      "variant:muted": { backgroundColor: MIST, borderColor: "transparent" },
    },
    section: { base: { padding: "var(--spacing-6)" } },
    "selectable-card": {
      base: { borderRadius: "var(--radius-container)", borderWidth: EDGE, borderColor: LINE, ":hover": { borderColor: INK } },
      // Chosen: an ink edge and ring (Astryx's own is the accent, which is mint here and 1.5:1 on white).
      // Mint is kept for the tick inside it. `selected` is a prop with a value on this component, not a state.
      "selected:true": { borderColor: INK, boxShadow: `inset 0 0 0 1.5px ${INK}` },
    },
    "clickable-card": {
      base: { borderRadius: "var(--radius-container)", borderColor: LINE, ":hover": { borderColor: INK } },
    },

    // ── Fields: they lie flat ────────────────────────────────────────────────
    "field-label": { base: { fontWeight: "var(--font-weight-semibold)" } },
    "text-input": fieldStates,
    "text-area": fieldStates,
    selector: fieldStates,
    "number-input": fieldStates,
    // A field with a fixed part beside it (name + .exhbt.co.uk): one box, the fixed part on mist.
    "input-group": { base: { "--border-width": EDGE } },
    "input-group-text": { base: { backgroundColor: MIST, color: GRAPHITE, borderColor: FIELD } },
    "checkbox-indicator": {
      base: { borderWidth: EDGE, borderColor: FIELD, borderRadius: "6px" },
      checked: { backgroundColor: MINT, borderColor: INK, color: INK },
    },
    "radio-indicator": {
      base: { borderWidth: EDGE, borderColor: FIELD },
      checked: { backgroundColor: MINT, borderColor: INK, color: INK },
    },
    // Off is grey; on is mint with an ink edge and an ink thumb (a white thumb is lost on mint).
    switch: {
      base: { "--color-background-gray": FIELD },
      checked: { backgroundColor: MINT, boxShadow: `inset 0 0 0 ${EDGE} ${INK}` },
    },
    "switch-thumb": { checked: { backgroundColor: INK } },
    // The label is part of the press target, so it is as tall as a control (44px).
    "switch-label": { base: { paddingBlock: "calc((var(--size-element-md) - 1lh) / 2)" } },

    // ── Choosing a view: tabs underline in ink; the segmented control is a pill with an ink choice ──
    tab: {
      base: { color: TEXT_2, fontWeight: "var(--font-weight-medium)", ":hover": { color: TEXT } },
      selected: { color: TEXT, fontWeight: "var(--font-weight-semibold)" },
    },
    "tab-indicator": { selected: { backgroundColor: TEXT } },
    // The track is the control's height and each choice 4px less, so at the large size a choice is a 44px press target.
    "segmented-control": {
      base: { borderRadius: "var(--radius-full)", backgroundColor: MIST, padding: "var(--spacing-0-5)" },
    },
    "segmented-control-item": {
      base: { borderRadius: "var(--radius-full)", color: TEXT_2, fontWeight: "var(--font-weight-medium)" },
      "size:sm": { height: "calc(var(--size-element-sm) - 4px)" },
      "size:md": { height: "calc(var(--size-element-md) - 4px)" },
      "size:lg": { height: "calc(var(--size-element-lg) - 4px)" },
      selected: { backgroundColor: INK, color: WHITE, boxShadow: "none" },
    },

    // ── What floats: one family ──────────────────────────────────────────────
    dialog: { base: { borderRadius: "var(--radius-page)", backgroundColor: WHITE } },
    "alert-dialog": { base: { borderRadius: "var(--radius-page)" } },
    "bottom-sheet": { base: { borderRadius: "var(--radius-page) var(--radius-page) 0 0", backgroundColor: WHITE } },
    drawer: { base: { backgroundColor: WHITE } },
    popover: { base: { ...floating, borderRadius: "var(--radius-container)" } },
    "hover-card": { base: { ...floating, borderRadius: "var(--radius-container)" } },
    "dropdown-menu": { base: { ...floating, borderRadius: "var(--radius-element)", padding: "var(--spacing-1-5)" } },
    "dropdown-menu-item": {
      base: { borderRadius: "var(--radius-inner)" },
      "variant:destructive": { color: ERROR },
    },
    "context-menu": { base: { ...floating, borderRadius: "var(--radius-element)" } },
    // A tooltip and a toast are ink already (the text and inverted-ground tokens), and Astryx
    // switches what is inside them to its on-dark colours by measuring the ground. So only their
    // shape is set here. An error toast is the one red: white reads on it at 5.6:1, but ink would
    // read at 3.4:1 too, which stops Astryx switching, so its text and icons are set to white here.
    tooltip: { base: { borderRadius: "var(--radius-inner)", fontWeight: "var(--font-weight-medium)" } },
    toast: {
      base: { borderRadius: "var(--radius-element)" },
      "type:error": {
        color: WHITE,
        "--color-text-primary": WHITE,
        "--color-text-secondary": WHITE,
        "--color-icon-primary": WHITE,
        "--color-icon-secondary": WHITE,
        "--color-overlay-hover": "rgb(255 255 255 / 0.14)",
        "--color-overlay-pressed": "rgb(255 255 255 / 0.22)",
        "--focus-outline-color": WHITE,
      },
    },

    // ── Status and progress ──────────────────────────────────────────────────
    "banner-icon": {
      "status:success": { color: JADE },
      "status:error": { color: ERROR },
    },
    banner: {
      base: { borderRadius: "var(--radius-element)" },
      "status:info": { backgroundColor: MIST, color: INK },
      "status:success": { backgroundColor: WASH, color: INK },
      "status:warning": { backgroundColor: WHITE, color: INK, boxShadow: `inset 0 0 0 ${EDGE} ${INK}` },
      "status:error": { backgroundColor: ERROR_WASH, color: INK },
    },
    token: {
      base: { borderRadius: "var(--radius-full)", fontWeight: "var(--font-weight-semibold)", paddingInline: "var(--spacing-3)", gap: "var(--spacing-1-5)" },
    },
    // Live is a mint dot with a jade edge (mint alone is 1.5:1 on white); a draft is grey.
    "status-dot": {
      "variant:success": { backgroundColor: MINT, boxShadow: `inset 0 0 0 1.5px ${JADE}` },
      "variant:accent": { backgroundColor: MINT, boxShadow: `inset 0 0 0 1.5px ${JADE}` },
      "variant:neutral": { backgroundColor: FIELD },
      "variant:warning": { backgroundColor: INK },
    },
    // Steps: the track and the step you are on are ink (Astryx draws both in the accent, and mint
    // can't be read as a line). A finished step is given the site's own tick where it is used.
    stepper: { base: { "--color-accent": INK, "--color-on-accent": WHITE } },
    "step-indicator": {
      base: { fontWeight: "var(--font-weight-semibold)" },
    },
    // Progress is a line that has to be read, so its fill is jade, on a hairline-grey track.
    "progress-bar": { base: { "--color-background-muted": LINE } },
    "progress-bar-fill": { base: { backgroundColor: JADE } },
    skeleton: { base: { borderRadius: "var(--radius-inner)" } },

    // ── Empty states: a display-face title, never a grey icon alone ──────────
    "empty-state-title": {
      base: { fontFamily: "var(--font-family-heading)", letterSpacing: "-0.02em" },
    },
    "empty-state-description": { base: { color: TEXT_2 } },

    // ── The frame of the app ─────────────────────────────────────────────────
    "top-nav": { base: { backgroundColor: WHITE, borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: LINE } },
    "top-nav-item": {
      base: { color: TEXT_2, fontWeight: "var(--font-weight-medium)", borderRadius: "var(--radius-full)", ":hover": { color: TEXT } },
      selected: { color: TEXT, fontWeight: "var(--font-weight-semibold)" },
    },
    "app-shell": { base: { backgroundColor: WHITE } },
    // Links as the site draws them now: jade, a 2px underline that darkens under the pointer.
    link: {
      base: {
        textDecorationLine: "underline",
        textDecorationThickness: "2px",
        textUnderlineOffset: "4px",
        textDecorationColor: `color-mix(in srgb, ${JADE} 40%, transparent)`,
        ":hover": { textDecorationColor: JADE },
      },
    },
    divider: { base: { borderColor: LINE } },
  },

  // On ink (a toast, a tooltip, an ink band): the ring and the accent are mint, which reads there.
  onDark: {
    tokens: {
      "--focus-outline-color": MINT,
      "--color-text-accent": MINT,
      "--color-icon-accent": MINT,
      "--color-text-secondary": ON_INK,
      "--color-border": "rgb(255 255 255 / 0.16)",
    },
  },

  adaptations: {
    rules: [
      // The neutral base theme re-derives the scale for a touch screen below 1024px (ratio 1.17),
      // which would flatten the display steps. These come after it and set the scale on purpose:
      // a tablet keeps the desktop scale, and anything narrower than 640px, at any pointer, steps
      // display down to 48/40/33px with text still 16px.
      { when: { width: { below: "lg" }, pointer: "coarse" }, value: { typography: { scale: { base: 16, ratio: 1.25 } }, tokens: VOICE } },
      { when: { width: { below: "sm" } }, value: { typography: { scale: { base: 16, ratio: 1.2 } }, tokens: VOICE } },
    ],
  },
});
