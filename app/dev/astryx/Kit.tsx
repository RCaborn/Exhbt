"use client";

import { useState } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Banner } from "@astryxdesign/core/Banner";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Drawer } from "@astryxdesign/core/Drawer";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Popover } from "@astryxdesign/core/Popover";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Switch } from "@astryxdesign/core/Switch";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Toast, useToast } from "@astryxdesign/core/Toast";
import { Token } from "@astryxdesign/core/Token";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Button } from "@/components/ui/Button";
import { Block, Compare, Group, Row, Stack } from "./parts";

/* Buttons, fields and choosing. */
export function Controls() {
  const [name, setName] = useState("Amara Okafor");
  const [email, setEmail] = useState("amara@");
  const [notes, setNotes] = useState("");
  const [own, setOwn] = useState(true);
  const [on, setOn] = useState(false);
  const [layout, setLayout] = useState("case-study");
  const [shown, setShown] = useState("now");
  const [file, setFile] = useState<File | File[] | null>(null);
  return (
    <>
      <Group id="buttons" title="Buttons" purpose="The site's one button, through components/ui/Button.tsx, in each variant and size.">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Row>
        <div className="rounded-[var(--radius)] bg-mint p-4">
          <Button variant="ink">Ink, for mint bands</Button>
        </div>
        <Row>
          <Button size="sm" variant="primary">
            Small
          </Button>
          <Button size="md" variant="primary">
            Medium
          </Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
          <Button size="xl" variant="primary">
            Largest
          </Button>
        </Row>
      </Group>

      <Group id="fields" title="Fields" purpose="Text, choices and files. A field is a white box on the page, flat.">
        <Block title="Text fields, in each state">
          <Compare
            astryx={
              <Stack>
                <TextInput label="Your name" value={name} onChange={setName} autoComplete="off" />
                <TextInput label="Email" type="email" value={email} onChange={setEmail} status={{ type: "error", message: "Enter a full email address." }} autoComplete="off" />
                <TextInput label="Nickname" isDisabled value="" onChange={() => {}} />
                <TextArea label="Notes" isOptional description="What was the question, what did you do, what came of it?" value={notes} onChange={setNotes} rows={3} />
                <CheckboxInput label="This is accurate and my own work." value={own} onChange={setOwn} />
                <Switch label="Let search engines list my portfolio" value={on} onChange={setOn} />
              </Stack>
            }
            today={
              <Stack>
                <div>
                  <label htmlFor="today-name" className="label">
                    Your name
                  </label>
                  <input id="today-name" className="field" defaultValue="Amara Okafor" />
                </div>
                <div>
                  <label htmlFor="today-email" className="label">
                    Email
                  </label>
                  <input id="today-email" className="field" defaultValue="amara@" aria-invalid aria-describedby="today-email-error" />
                  <p id="today-email-error" className="mt-1.5 text-sm text-error">
                    Enter a full email address.
                  </p>
                </div>
                <div>
                  <label htmlFor="today-nick" className="label">
                    Nickname
                  </label>
                  <input id="today-nick" className="field" disabled />
                </div>
                <div>
                  <label htmlFor="today-notes" className="label">
                    Notes <span className="font-normal text-slate">(optional)</span>
                  </label>
                  <p className="hint mb-2">What was the question, what did you do, what came of it?</p>
                  <textarea id="today-notes" className="field" rows={3} />
                </div>
                <label className="flex items-start gap-2 text-[0.95rem]">
                  <input type="checkbox" defaultChecked className="mt-1" />
                  This is accurate and my own work.
                </label>
              </Stack>
            }
          />
        </Block>
        <Block title="A choice of a few, and a switch between two">
          <Compare
            astryx={
              <Stack>
                <RadioList label="Layout" value={layout} onChange={setLayout}>
                  <RadioListItem value="case-study" label="Case study" description="The question, the method and what you found." />
                  <RadioListItem value="gallery" label="Gallery" description="Pictures first, with a few words." />
                </RadioList>
                <SegmentedControl label="Show you" value={shown} onChange={setShown}>
                  <SegmentedControlItem value="now" label="Now" />
                  <SegmentedControlItem value="after" label="After the projects" />
                </SegmentedControl>
              </Stack>
            }
            today={
              <Stack>
                {["Case study", "Gallery"].map((l) => (
                  <label key={l} className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-line p-3">
                    <input type="radio" name="today-layout" defaultChecked={l === "Case study"} className="mt-1" />
                    <span className="font-semibold">{l}</span>
                  </label>
                ))}
                <span className="chip">A chip</span>
              </Stack>
            }
          />
        </Block>
        <Block title="A file">
          <FileInput label="Add a file" value={file} onChange={setFile} accept="image/*" />
        </Block>
      </Group>
    </>
  );
}

/* Cards, banners, toast, status and waiting. */
export function Feedback() {
  const showToast = useToast();
  return (
    <>
      <Group id="messages" title="Messages" purpose="A banner holds a message on the page. It is not a live region by itself; components/ui/Notice.tsx adds that.">
        <Block title="A banner in each status, as a card and as a section">
          <Stack>
            {(["info", "success", "warning", "error"] as const).map((s) => (
              <Banner key={s} status={s} title={`A ${s} message`} description="What happened, and what to do next." isDismissable />
            ))}
            <Banner status="info" container="section" title="A section banner runs the full width" />
          </Stack>
        </Block>
        <Block title="A toast">
          <Stack>
            <Toast type="info" body="Link copied" onDismiss={() => {}} isAutoHide={false} autoHideDuration={5000} />
            <Row>
              <AstryxButton label="Show a toast" onClick={() => showToast({ body: "Link copied", uniqueID: "dev-toast" })} />
            </Row>
          </Stack>
        </Block>
      </Group>

      <Group id="status" title="Status and waiting" purpose="Small signs of state, progress and an empty page.">
        <Row>
          <StatusDot variant="success" label="Live" />
          <StatusDot variant="warning" label="Needs a look" />
          <StatusDot variant="error" label="Failed" />
          <StatusDot variant="neutral" label="Draft" />
          <Token label="Case study" />
          <Token label="Removable" onRemove={() => {}} />
        </Row>
        <Stack>
          <ProgressBar label="Checks done" value={60} hasValueLabel />
          <ProgressBar label="Working" isIndeterminate />
          <Skeleton width="100%" height={20} />
          <Skeleton width="60%" height={20} />
        </Stack>
        <Compare
          astryx={<EmptyState title="No exhbts yet" description="Add one to start your portfolio." actions={<Button variant="primary">Add an exhbt</Button>} />}
          today={
            <div className="rounded-[var(--radius)] border border-dashed border-line p-8 text-center">
              <p className="font-semibold">No exhbts yet</p>
              <p className="mt-1 text-graphite">Add one to start your portfolio.</p>
            </div>
          }
        />
      </Group>
    </>
  );
}

/* What sits over the page. */
export function Overlays() {
  const [dialog, setDialog] = useState(false);
  const [alert, setAlert] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <Group id="overlays" title="Over the page" purpose="Dialogs, panels, menus and tips. Each opens from a button.">
      <Row>
        <AstryxButton label="Open a dialog" onClick={() => setDialog(true)} />
        <AstryxButton label="Open a confirmation" onClick={() => setAlert(true)} />
        <AstryxButton label="Open a drawer" onClick={() => setDrawer(true)} />
        <AstryxButton label="Open a bottom sheet" onClick={() => setSheet(true)} />
        <DropdownMenu button={{ label: "Layout" }} items={[{ label: "Case study" }, { label: "Gallery" }]} />
        <MoreMenu label="More for this exhbt" items={[{ label: "See as a visitor" }, { type: "divider" as const }, { label: "Delete", variant: "destructive" as const }]} />
        <Popover label="What the checks mean" width={320} padding={4} content={<Text as="p">The ticks say the checks ran.</Text>}>
          <AstryxButton label="What the checks mean" variant="ghost" />
        </Popover>
        <Tooltip content="Copy the link">
          <IconButton label="Copy link" icon={<Icon icon="copy" />} variant="secondary" />
        </Tooltip>
      </Row>
      <Block title="A dialog, standing open">
        <Compare
          astryx={
            <Dialog isOpen isInline onOpenChange={() => {}} width="100%">
              <Stack>
                <Heading level={3}>Choose your address</Heading>
                <Text as="p">This is the link you put on your CV.</Text>
              </Stack>
            </Dialog>
          }
          today={
            <dialog open className="relative w-full rounded-[var(--radius)] border border-line bg-surface p-6">
              <p className="font-semibold">Choose your address</p>
              <p className="mt-1 text-graphite">This is the link you put on your CV.</p>
            </dialog>
          }
        />
      </Block>
      <Dialog isOpen={dialog} onOpenChange={setDialog} width={480}>
        <Stack>
          <Heading level={3}>Choose your address</Heading>
          <AstryxButton label="Done" variant="primary" onClick={() => setDialog(false)} />
        </Stack>
      </Dialog>
      <AlertDialog
        isOpen={alert}
        onOpenChange={setAlert}
        title="Delete this exhbt?"
        description="It comes off your portfolio and can't be brought back."
        actionLabel="Delete it"
        cancelLabel="Keep it"
        onAction={() => setAlert(false)}
      />
      <Drawer isOpen={drawer} onOpenChange={setDrawer} label="A drawer">
        <div className="p-6">
          <Heading level={2}>A drawer</Heading>
        </div>
      </Drawer>
      <BottomSheet isOpen={sheet} onOpenChange={setSheet} label="A bottom sheet" height="hug" padding={5}>
        <Heading level={2}>A bottom sheet</Heading>
      </BottomSheet>
    </Group>
  );
}

/* Tabs, steps, toolbar and lists. */
export function Structure() {
  const [tab, setTab] = useState("Gaps");
  return (
    <Group id="structure" title="Navigation and lists" purpose="Tabs, steps, a toolbar, rows and a link.">
      <TabList value={tab} onChange={setTab} hasDivider>
        {["Overview", "Gaps", "Already strong", "Projects"].map((v) => (
          <Tab key={v} value={v} label={v} />
        ))}
      </TabList>
      <Stack>
        <Stepper activeStep={1} label="Three steps">
          {["Job", "CV", "Skills"].map((l, i) => (
            <Step key={l} step={i} label={l} />
          ))}
        </Stepper>
        <Stepper activeStep={2} label="Five steps">
          {["Job", "CV", "Skills", "Radar", "Projects"].map((l, i) => (
            <Step key={l} step={i} label={l} />
          ))}
        </Stepper>
      </Stack>
      <Toolbar
        label="Editor tools"
        startContent={<IconButton label="Undo" icon={<Icon icon="arrowUp" />} variant="ghost" />}
        endContent={<IconButton label="Copy link" icon={<Icon icon="copy" />} variant="ghost" />}
      />
      <Card>
        <List hasDividers>
          <ListItem label="Gap year in Spain" description="Case study" />
          <ListItem label="Bakery rota" description="Gallery" />
        </List>
      </Card>
      <Text as="p">
        A <Link href="#type">link</Link> in running text.
      </Text>
    </Group>
  );
}
