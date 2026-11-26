"use client";

import { useState } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { InputGroup, InputGroupText } from "@astryxdesign/core/InputGroup";
import { HStack, Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Popover } from "@astryxdesign/core/Popover";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Toast, useToast } from "@astryxdesign/core/Toast";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { APEX } from "@/lib/hosts";
import { KitBlock, KitSection, Note, Proposed } from "./parts";

const ROW_MENU = [
  { label: "See as a visitor", icon: <Icon icon="externalLink" /> },
  { label: "Move up", icon: <Icon icon="arrowUp" /> },
  { label: "Move down", icon: <Icon icon="arrowDown" /> },
  { type: "divider" as const },
  { label: "Delete", variant: "destructive" as const },
];

/**
 * What a dialog holds, laid out the way Astryx lays a dialog out (a header, the content, a footer
 * of actions), so the standing picture of it and the real one are the same thing.
 */
function AddressDialog({ onClose }: { onClose?: () => void }) {
  const [name, setName] = useState("amara");
  return (
    <Layout
      header={<DialogHeader title="Choose your address" subtitle="This is the link you put on your CV." onOpenChange={onClose ? () => onClose() : undefined} />}
      content={
        <LayoutContent>
          <InputGroup label="Your address" description="Lower-case letters, numbers and hyphens. You can change it later.">
            <TextInput label="Name in your address" isLabelHidden value={name} onChange={setName} autoComplete="off" hasSpellCheck={false} />
            <InputGroupText>.{APEX}</InputGroupText>
          </InputGroup>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label="Not now" variant="ghost" onClick={onClose} />
            <Button label="Check this name" variant="primary" onClick={onClose} />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}

function LayoutChoice() {
  const [layout, setLayout] = useState("case-study");
  return (
    <RadioList label="Layout" isLabelHidden value={layout} onChange={setLayout}>
      <RadioListItem value="case-study" label="Case study" description="The question, the method and what you found." />
      <RadioListItem value="gallery" label="Gallery" description="Pictures first, with a few words." />
      <RadioListItem value="research" label="Research" description="A poster, read figure first." />
    </RadioList>
  );
}

export function OverlaysKit() {
  const [dialog, setDialog] = useState(false);
  const [alert, setAlert] = useState(false);
  const [sheet, setSheet] = useState(false);
  const showToast = useToast();
  return (
    <KitSection
      id="overlays"
      rule="One family for everything that sits over the page: white, the same corners, and an entrance that shows where it came from."
    >
      <KitBlock title="A dialog and a confirmation">
        <Proposed>
          <div className="kit-stack">
            <div className="kit-ground kit-stage" data-ground="mist">
              <Dialog isOpen onOpenChange={() => {}} isInline width="100%">
                <AddressDialog />
              </Dialog>
              <AlertDialog
                isOpen
                isInline
                width="100%"
                onOpenChange={() => {}}
                title="Delete this exhbt?"
                description="It comes off your portfolio and can't be brought back."
                actionLabel="Delete it"
                cancelLabel="Keep it"
                onAction={() => {}}
              />
            </div>
            <div className="kit-row">
              <Button label="Open the dialog" onClick={() => setDialog(true)} />
              <Button label="Open the confirmation" onClick={() => setAlert(true)} />
            </div>
            <Note>
              Astryx Dialog and AlertDialog, drawn standing above and for real from the buttons. Today these are native dialogs laid out by hand,
              and they appear with no entrance.
            </Note>
          </div>
          <Dialog isOpen={dialog} onOpenChange={setDialog} width={480} purpose="form">
            <AddressDialog onClose={() => setDialog(false)} />
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
        </Proposed>
      </KitBlock>

      <KitBlock title="A bottom sheet, a menu, a popover and a tooltip">
        <Proposed>
          <div className="kit-stack">
            <div className="kit-row">
              <Button label="Open a bottom sheet" onClick={() => setSheet(true)} />
              <DropdownMenu button={{ label: "Layout" }} items={[{ label: "Case study" }, { label: "Gallery" }, { label: "Research" }]} />
              <MoreMenu label="More for this exhbt" items={ROW_MENU} />
              <Popover
                label="What the checks mean"
                width={320}
                padding={4}
                content={
                  <div className="kit-stack" data-gap="sm">
                    <Heading level={3}>Can you trust it?</Heading>
                    <Text as="p" display="block" type="supporting">
                      The ticks say the checks ran: the author confirmed it, and the work is attached. They don&rsquo;t say the results are true.
                    </Text>
                  </div>
                }
              >
                <Button label="What the checks mean" variant="ghost" />
              </Popover>
              <Tooltip content="Copy the link to this exhbt">
                <IconButton label="Copy link" icon={<Icon icon="copy" />} variant="secondary" />
              </Tooltip>
            </div>
            <Note>
              Astryx BottomSheet (the phone&rsquo;s form of a dialog), DropdownMenu, MoreMenu, Popover and Tooltip. Press each to see it. Delete
              lives in the More menu and is confirmed. Menus and popovers take the low shadow, a toast the medium, a dialog or sheet the high.
            </Note>
          </div>
          <BottomSheet isOpen={sheet} onOpenChange={setSheet} label="Layout" height="hug" padding={5}>
            <div className="kit-stack">
              <Heading level={2}>Layout</Heading>
              <LayoutChoice />
              <Button label="Use this layout" variant="primary" width="100%" onClick={() => setSheet(false)} />
            </div>
          </BottomSheet>
        </Proposed>
      </KitBlock>

      <KitBlock title="A toast">
        <Proposed>
          <div className="kit-stack">
            <div className="kit-stack kit-toasts" data-gap="sm">
              {/* A standing Toast wants every setting spelt out; useToast() fills them in for a real one. */}
              <Toast type="info" body="Link copied" onDismiss={() => {}} isAutoHide={false} autoHideDuration={5000} />
              <Toast
                type="info"
                body="Saved. Next: publish it."
                endContent={<Button label="Review" size="sm" variant="primary" />}
                onDismiss={() => {}}
                isAutoHide={false}
                autoHideDuration={5000}
              />
              <Toast type="error" body="We couldn't save that. Your words are still here." onDismiss={() => {}} isAutoHide={false} autoHideDuration={5000} />
            </div>
            <div className="kit-row">
              <Button label="Show a toast" onClick={() => showToast({ body: "Link copied", uniqueID: "kit-toast" })} />
            </div>
            <Note>Astryx Toast: ink, so it reads over any page. Today there is none: &ldquo;Saved&rdquo; is a quiet word in the bar and a copied link changes its button&rsquo;s label.</Note>
          </div>
        </Proposed>
      </KitBlock>
    </KitSection>
  );
}
