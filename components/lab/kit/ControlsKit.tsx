"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { InputGroup, InputGroupText } from "@astryxdesign/core/InputGroup";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { Switch } from "@astryxdesign/core/Switch";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button as TodayButton } from "@/components/ui/Button";
import { Tick } from "@/components/ui/Tick";
import { APEX } from "@/lib/hosts";
import { Compare, KitBlock, KitSection, Note } from "./parts";

const VIEWS = ["Overview", "Gaps", "Already strong", "Projects", "What next"];
const LAYOUTS = [
  { id: "case-study", name: "Case study", note: "The question, the method and what you found." },
  { id: "gallery", name: "Gallery", note: "Pictures first, with a few words." },
  { id: "research", name: "Research", note: "A poster, read figure first." },
];

export function ButtonsKit() {
  return (
    <KitSection id="buttons" rule="Today's pill stays. One mint button a screen, for the thing to do next; everything else is ink, white or quiet.">
      <KitBlock>
        <Compare
          today={
            <div className="kit-stack">
              <div className="kit-row">
                <TodayButton variant="primary">Add an exhbt</TodayButton>
                <TodayButton variant="secondary">See as a visitor</TodayButton>
                <TodayButton variant="danger">Delete</TodayButton>
              </div>
              <div className="kit-ground" data-ground="mint">
                <TodayButton variant="ink">Build my roadmap</TodayButton>
              </div>
              <div className="kit-row">
                <TodayButton variant="primary" size="sm">
                  Small
                </TodayButton>
                <TodayButton variant="primary" size="lg">
                  Large
                </TodayButton>
                <TodayButton variant="primary" size="xl">
                  Largest
                </TodayButton>
              </div>
              <Note>Four rows of a list carry 24 of these today, and four pink Delete pills beat the one mint button.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <div className="kit-row">
                <Button label="Add an exhbt" variant="primary" />
                <Button label="See as a visitor" variant="secondary" />
                <Button label="Skip for now" variant="ghost" />
              </div>
              <div className="kit-ground" data-ground="mint">
                <Button label="Build my roadmap" variant="ink" />
              </div>
              <div className="kit-row">
                <Button label="Small" variant="primary" size="sm" />
                <Button label="Large" variant="primary" size="lg" />
                <Button label="Copy link" variant="secondary" icon={<Icon icon="copy" />} />
                <Button label="Publishing" variant="primary" isLoading />
                <Button label="Not yet" variant="primary" isDisabled />
              </div>
              <Note>
                The same Astryx button as today. New: a quiet one (ghost) for a third choice, and Delete moves into a menu and a
                confirmation, so red is never a resting pill (see What floats).
              </Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}

export function FieldsKit() {
  const [name, setName] = useState("Amara Okafor");
  const [address, setAddress] = useState("amara");
  const [email, setEmail] = useState("amara@");
  const [notes, setNotes] = useState("");
  const [own, setOwn] = useState(true);
  const [search, setSearch] = useState(false);
  return (
    <KitSection id="fields" rule="Forms lie flat. A field is a white box with a grey edge on the page itself, never inside a floating, shadowed card.">
      <KitBlock>
        <Compare
          today={
            <div className="rounded-[24px] border border-line bg-surface p-6 shadow-pack">
              <div className="kit-stack">
                <div>
                  <label htmlFor="kit-today-name" className="label">
                    Your name
                  </label>
                  <input id="kit-today-name" className="field" defaultValue="Amara Okafor" />
                </div>
                <div>
                  <label htmlFor="kit-today-email" className="label">
                    Email
                  </label>
                  <input id="kit-today-email" className="field" defaultValue="amara@" aria-invalid aria-describedby="kit-today-email-error" />
                  <p id="kit-today-email-error" className="mt-1.5 text-sm text-error">
                    Enter a full email address.
                  </p>
                </div>
                <div>
                  <label htmlFor="kit-today-notes" className="label">
                    Notes <span className="font-normal text-slate">(optional)</span>
                  </label>
                  <p className="hint mb-2">What was the question, what did you do, what came of it?</p>
                  <textarea id="kit-today-notes" className="field" rows={3} />
                </div>
                <label className="flex items-start gap-2 text-[0.95rem]">
                  <input type="checkbox" defaultChecked className="mt-1" />
                  This is accurate and my own work.
                </label>
              </div>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <TextInput label="Your name" value={name} onChange={setName} autoComplete="off" />
              <InputGroup label="Your address" description="Lower-case letters, numbers and hyphens.">
                <TextInput label="Name in your address" isLabelHidden value={address} onChange={setAddress} autoComplete="off" hasSpellCheck={false} />
                <InputGroupText>.{APEX}</InputGroupText>
              </InputGroup>
              <TextInput label="Email" type="email" value={email} onChange={setEmail} status={{ type: "error", message: "Enter a full email address." }} statusVariant="detached" autoComplete="off" />
              <TextArea label="Notes" isOptional description="What was the question, what did you do, what came of it?" value={notes} onChange={setNotes} rows={3} />
              <CheckboxInput label="This is accurate and my own work." value={own} onChange={setOwn} />
              <Switch label="Let search engines list my portfolio" value={search} onChange={setSearch} />
              <Note>
                Astryx Field, TextInput, TextArea, InputGroup, CheckboxInput and Switch. The edge is grey at rest, ink under the
                pointer and jade with a mint halo when it has focus. A ticked box is mint with an ink tick, as the site&rsquo;s ticks are.
              </Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}

export function ChoosingKit() {
  const [view, setView] = useState("Gaps");
  const [shown, setShown] = useState("now");
  const [layout, setLayout] = useState("case-study");
  return (
    <KitSection id="choosing" rule="Chosen is ink. Tabs underline in ink and a choice takes an ink edge, so mint is left for go, live and checked.">
      <KitBlock title="Tabs and the segmented control">
        <Compare
          today={
            <div className="kit-stack">
              <ol className="flex gap-1 rounded-full border border-line bg-surface p-1">
                {VIEWS.slice(0, 4).map((v) => (
                  <li key={v} className="flex-1">
                    <a href="#choosing" aria-current={v === "Gaps" ? "page" : undefined} className={`block rounded-full px-3 py-2 text-center text-sm font-semibold ${v === "Gaps" ? "bg-mint text-ink" : "text-graphite hover:bg-mist hover:text-ink"}`}>
                      {v}
                    </a>
                  </li>
                ))}
              </ol>
              <div className="kit-row">
                <span className="text-sm font-semibold text-graphite">Show you</span>
                <TodayButton size="sm" variant="ink" aria-pressed>
                  Now
                </TodayButton>
                <TodayButton size="sm" variant="secondary" aria-pressed={false}>
                  After the projects
                </TodayButton>
              </div>
              <Note>The roadmap&rsquo;s views are a hand-made pill bar with the chosen one in mint; the radar&rsquo;s switch is two buttons.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <TabList value={view} onChange={setView} hasDivider>
                {VIEWS.map((v) => (
                  <Tab key={v} value={v} label={v} />
                ))}
              </TabList>
              <div className="kit-row">
                <SegmentedControl label="Show you" value={shown} onChange={setShown}>
                  <SegmentedControlItem value="now" label="Now" />
                  <SegmentedControlItem value="after" label="After the projects" />
                </SegmentedControl>
              </div>
              <Note>Astryx TabList (it scrolls on a phone instead of shrinking to a counter) and SegmentedControl.</Note>
            </div>
          }
        />
      </KitBlock>

      <KitBlock title="A choice between a few things">
        <Compare
          today={
            <div className="kit-stack" data-gap="sm">
              {LAYOUTS.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-line p-3">
                  <input type="radio" name="kit-today-layout" defaultChecked={l.id === "case-study"} className="mt-1" />
                  <span>
                    <span className="block font-semibold">{l.name}</span>
                    <span className="block text-sm text-graphite">{l.note}</span>
                  </span>
                </label>
              ))}
            </div>
          }
          proposed={
            <div className="kit-stack" data-gap="sm">
              <div role="group" aria-label="Layout" className="kit-stack" data-gap="sm">
                {LAYOUTS.map((l) => (
                  <SelectableCard key={l.id} label={l.name} isSelected={layout === l.id} onChange={() => setLayout(l.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Text as="p" display="block" type="label">
                          {l.name}
                        </Text>
                        <Text as="p" display="block" type="supporting">
                          {l.note}
                        </Text>
                      </div>
                      {layout === l.id && <Tick size="lg" />}
                    </div>
                  </SelectableCard>
                ))}
              </div>
              <Note>Astryx SelectableCard. The chosen one has an ink edge and the site&rsquo;s own tick.</Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}

export function CardsKit() {
  return (
    <KitSection id="cards" rule="A card is one thing you could move or remove: flat, a hairline, one radius. A section of a page is not a card.">
      <KitBlock>
        <Compare
          today={
            <div className="kit-stack">
              <div className="rounded-[20px] border border-line bg-surface p-7">
                <p className="text-[1.375rem] font-bold">Premium</p>
                <p className="mt-2 text-graphite">Your portfolio at your own address.</p>
              </div>
              <div className="rounded-[16px] border border-line bg-surface p-4">
                <p className="font-semibold">Refer a friend</p>
                <p className="mt-1 text-sm text-graphite">A 16px corner here, 20 above, 24 on a form.</p>
              </div>
              <div className="bg-mist p-4">
                <div className="rounded-[24px] border border-line bg-surface p-6 shadow-pack">
                  <h3>Draft an exhbt</h3>
                  <p className="mt-2 text-graphite">A form floating on mist, with the shadow the work should have.</p>
                </div>
              </div>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <Card>
                <div className="kit-stack" data-gap="sm">
                  <Heading level={3}>Premium</Heading>
                  <Text as="p" display="block" color="secondary">
                    Your portfolio at your own address.
                  </Text>
                </div>
              </Card>
              <Card variant="muted">
                <div className="kit-stack" data-gap="sm">
                  <Heading level={3}>Refer a friend</Heading>
                  <Text as="p" display="block" color="secondary">
                    The quiet card: mist, with no edge.
                  </Text>
                </div>
              </Card>
              <ClickableCard label="Open your first exhbt" href="#cards">
                <div className="flex items-center justify-between gap-4">
                  <div className="kit-stack" data-gap="sm">
                    <Heading level={3}>A card that is a link</Heading>
                    <Text as="p" display="block" color="secondary">
                      Its edge turns ink under the pointer. It doesn&rsquo;t lift.
                    </Text>
                  </div>
                  <Icon icon="chevronRight" />
                </div>
              </ClickableCard>
              <Note>Astryx Card and ClickableCard: 20px corners everywhere, 24px of padding, no shadow. A form sits on the page, not in a card.</Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}
