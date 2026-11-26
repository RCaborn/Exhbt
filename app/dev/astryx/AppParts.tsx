"use client";

import { useState } from "react";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { AddressLine } from "@/components/brand/AddressLine";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { Empty } from "@/components/ui/Empty";
import { CheckboxField, TextAreaField, TextField } from "@/components/ui/Field";
import { Menu, More } from "@/components/ui/Menu";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { Steps } from "@/components/ui/Steps";
import { useSay } from "@/components/ui/toast";
import { Block, Group, Row, Stack } from "./parts";

/** The app's own wrappers (components/ui), each with one live example. Nothing on a real page uses them yet. */
export function AppParts() {
  const { say, sayWith, fail } = useSay();
  const [posted, setPosted] = useState<string>("");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState(false);
  const [actions, setActions] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [two, setTwo] = useState(false);
  return (
    <Group id="app-parts" title="The app's own parts" purpose="The wrappers in components/ui. A screen imports these, never a raw Astryx input.">
      <Block title="Fields (TextField, TextAreaField, CheckboxField) in a plain form">
        <form
          data-testid="field-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setPosted(JSON.stringify(Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v)]))));
          }}
        >
          <Stack>
            <TextField label="Your name" name="plain" />
            <TextField label="Your city" name="seeded" defaultValue="Leeds" hint="Where you are based." />
            <TextField label="Email" name="email" type="email" error="Enter a full email address." />
            <TextAreaField label="Notes (optional)" name="notes" rows={3} />
            <CheckboxField label="This is my own work." name="own" />
            <Row>
              <Button type="submit" variant="primary">
                Post the form
              </Button>
            </Row>
            <Text as="p" display="block" type="code" data-testid="posted">
              {posted}
            </Text>
          </Stack>
        </form>
      </Block>

      <Block title="Notice">
        <Stack>
          <Notice status="info" title="A passing note" live="polite">
            Saved to your drafts.
          </Notice>
          <Notice status="error" title="We could not save that" action={<AstryxButton label="Try again" size="sm" variant="secondary" />}>
            Your words are still here.
          </Notice>
        </Stack>
      </Block>

      <Block title="Toast (useSay)">
        <Row>
          <Button onClick={() => say("Link copied")}>Say</Button>
          <Button onClick={() => sayWith("Saved. Next: publish it.", <AstryxButton label="Review" size="sm" variant="primary" />)}>Say with an action</Button>
          <Button onClick={() => fail("We couldn't save that.")}>Fail</Button>
        </Row>
      </Block>

      <Block title="Sheet and Confirm">
        <Row>
          <Button onClick={() => setDrawer(true)}>Open an info sheet</Button>
          <Button onClick={() => setForm(true)}>Open a form sheet</Button>
          <Button onClick={() => setActions(true)}>Open an actions sheet</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Delete
          </Button>
        </Row>
        <Sheet name="info" title="About this exhbt" open={drawer} onOpenChange={setDrawer}>
          <Text as="p">An info sheet: Escape or a press outside closes it.</Text>
        </Sheet>
        <Sheet name="form" kind="form" title="Choose your address" open={form} onOpenChange={setForm} footer={<Button variant="primary" onClick={() => setForm(false)}>Save</Button>}>
          <TextField label="Name in your address" name="address" />
        </Sheet>
        <Sheet name="actions" kind="actions" title="Layout" open={actions} onOpenChange={setActions}>
          <Stack>
            <Button onClick={() => setActions(false)}>Case study</Button>
            <Button onClick={() => setActions(false)}>Gallery</Button>
          </Stack>
        </Sheet>
        <Confirm open={confirm} onOpenChange={setConfirm} title="Delete this exhbt?" body="It comes off your portfolio and can't be brought back." confirmLabel="Delete it" onConfirm={() => {}} />
      </Block>

      <Block title="Menu and More">
        <Row>
          <Menu trigger="Choose a layout" label="Layouts" items={[{ label: "Case study" }, { label: "Gallery" }, { label: "Research", off: "Needs a figure first" }]} />
          <More label="More for this exhbt" items={[{ label: "See as a visitor", href: "#app-parts" }, { label: "Delete", danger: true }]} />
        </Row>
      </Block>

      <Block title="Empty">
        <Empty title="No exhbts yet" body="Add one to start your portfolio." action={<Button variant="primary">Add an exhbt</Button>} />
      </Block>

      <Block title="Steps">
        <Stack>
          <Steps label="Three steps" active={1} steps={[{ label: "Job" }, { label: "CV", note: "Skippable" }, { label: "Skills" }]} />
          <Button onClick={() => setTwo(true)}>Draw two steps (throws in development)</Button>
          {two && <Steps label="Two steps" active={0} steps={[{ label: "One" }, { label: "Two" }]} />}
        </Stack>
      </Block>

      <Block title="AddressLine">
        <div className="flex flex-col gap-3">
          <div className="rounded-[var(--radius)] bg-ink p-6">
            <AddressLine username="priya-shah" tone="on-ink" size={1} />
          </div>
          <div className="rounded-[var(--radius)] border border-line p-6">
            <AddressLine username="priya-shah" tone="on-white" size={2} />
          </div>
        </div>
      </Block>
    </Group>
  );
}
