"use client";

import { useEffect, useRef } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { useAnnounce } from "@astryxdesign/core/hooks";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { portfolioHost } from "@/lib/hosts";
import { LAB_PATH } from "../lab";
import { useLab } from "../LabFrame";
import { Address } from "../samples";
import { HeroPage } from "./HeroPage";
import { useHomeName } from "./HomeName";

/** The highlighted half of the opening line, a word at a time, so the stroke can be drawn across it in reading order. */
const STROKE = "built from your projects.";

/**
 * The highlighter stroke under the line's second half. At rest it is the site's flat mint stroke
 * (`.highlight`); on load it is drawn once, left to right across the words in reading order, each
 * word taking its share of the time by its length (home.css, `.hl-stroke`).
 */
function Stroke() {
  const words = STROKE.split(" ");
  const total = STROKE.length;
  let at = 0;
  return (
    <span className="hl-stroke-line">
      {words.map((w, i) => {
        const text = i < words.length - 1 ? `${w} ` : w;
        const style = { "--hl-at": (at / total).toFixed(3), "--hl-len": (text.length / total).toFixed(3) } as React.CSSProperties;
        at += text.length;
        return (
          <span key={i} className="highlight hl-stroke" style={style}>
            {text}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Home's first screen (the lab's Home, decision 0033's story, beat one): the promise, the one way
 * in, and a real portfolio page in the first screen at every width.
 *
 * At confident and maximal it also has one field, "Your name". As it is typed, the address set in
 * display type and the page in the frame take the name (lib/hosts.ts's rule, address.ts). Nothing
 * is sent anywhere and nothing says the address is free; the frame is marked as a preview. A polite
 * live region (Astryx's useAnnounce) reads the address once typing pauses. At restrained there is
 * no field, and the page is the made-up person's.
 */
export function Hero() {
  const { level, moves } = useLab();
  const me = useHomeName();
  const field = level !== "restrained";
  const { setTyped } = me;

  // The field goes at restrained, so the name does too: no picture keeps a name nobody can see typed.
  useEffect(() => {
    if (!field) setTyped("");
  }, [field, setTyped]);

  // Read the address once the typing pauses, and only an address the rule accepts.
  const announce = useAnnounce({ hasReplace: true });
  const said = useRef<string | null>(null);
  useEffect(() => {
    if (!me.address || me.address === said.current) return;
    const t = setTimeout(() => {
      said.current = me.address;
      announce(`Your name in the preview. Its address would be ${portfolioHost(me.address!)}.`);
    }, 700);
    return () => clearTimeout(t);
  }, [me.address, announce]);

  return (
    <section aria-labelledby="hl-hero-title" className="hl-hero" data-field={field || undefined}>
      <div className="lab-content hl-hero-grid">
        <div className="hl-hero-title">
          <Heading level={1} type="hero" id="hl-hero-title">
            A website of your own, <Stroke />
          </Heading>
        </div>

        <div className="hl-hero-lead">
          <Text as="p" display="block" type="large" color="secondary">
            For students and graduates. Each project becomes an exhbt: a short page an employer reads in a minute and can check.
          </Text>
        </div>

        {field && (
          <div className="hl-hero-name">
            <TextInput
              label="Your name"
              description="Type it and the address and the page take it. Nothing you type here is saved or sent."
              value={me.typed}
              onChange={(v) => setTyped(v)}
              status={me.why ? { type: "warning", message: me.why } : undefined}
              statusVariant="detached"
              size="lg"
              autoComplete="name"
              autoCapitalize="words"
              hasAutoCorrect={false}
              hasSpellCheck={false}
              enterKeyHint="done"
            />
            <p className="hl-hero-address" data-yours={me.yours || undefined}>
              <Text type="display-3">
                <Address name={me.username} />
              </Text>
            </p>
          </div>
        )}

        <div className="hl-hero-act">
          <Button label="Start your portfolio" href={`${LAB_PATH}/app`} variant="primary" size="lg" />
          <Text as="p" display="block" type="supporting">
            Next: a free account, then your page. You pay only to put it online.
          </Text>
        </div>

        {/* The way in for someone with nothing to show yet: free, and no account (clarity review, finding 1). */}
        <p className="hl-hero-roadmap">
          <Link href="#roadmap" className="hl-hit">
            Not sure what to show yet? Build your free roadmap first
          </Link>
        </p>

        <div className="hl-hero-work">
          <HeroPage live={level === "maximal"} moves={moves} />
          {level === "maximal" && (
            <Text as="p" display="block" type="supporting">
              This page works: open the best project on it.
            </Text>
          )}
          <span className="hl-frame-tag">
            <Token label={me.yours ? "Preview" : "Made-up example"} size="sm" />
          </span>
        </div>
      </div>
    </section>
  );
}
