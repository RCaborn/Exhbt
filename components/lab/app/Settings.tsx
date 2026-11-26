"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { Outline } from "@astryxdesign/core/Outline";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { Tick } from "@/components/ui/Tick";
import { FailedSave } from "./Feedback";
import { appHref } from "./screens";
import type { AppWords, PlanWords } from "./words";

const SECTIONS = [
  { id: "address", label: "Your address" },
  { id: "details", label: "Your details" },
  { id: "plan", label: "Your plan" },
  { id: "data", label: "Your data" },
  { id: "delete", label: "Delete your account" },
] as const;
const OUTLINE = SECTIONS.map((s) => ({ id: s.id, label: s.label, level: 1 as const }));

/** One section of the page: a heading on a hairline, an optional line under it, then its rows. */
function Part({ id, line, children }: { id: (typeof SECTIONS)[number]["id"]; line?: string; children: React.ReactNode }) {
  const s = SECTIONS.find((x) => x.id === id)!;
  return (
    <section className="app-part" aria-labelledby={id} data-part={id}>
      <div className="app-part-head">
        <Heading level={2} id={id}>
          {s.label}
        </Heading>
        {line && (
          <Text as="p" display="block" color="secondary">
            {line}
          </Text>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Account and billing as one settings page, on the frame of Astryx's settings-sidebar template:
 * a Layout with the sections listed down a start panel (Astryx Outline, which marks the one being
 * read) and the content beside it. The template's narrow-screen drill-down is left out: five short
 * sections read better one after another, so on a phone the panel goes and the page scrolls.
 *
 * Everything lies flat on the page: no card round a form. The one thing set large is her address,
 * in display type, with Copy link. Plans are SelectableCards. Deleting the account is last, behind
 * a plain button that asks first (an AlertDialog), so no red sits on the page at rest.
 */
export function Settings({
  words,
  address,
  failed,
  loading,
  onCopied,
  onSaved,
  toast,
}: {
  words: AppWords;
  address: React.ReactNode;
  failed: boolean;
  loading: boolean;
  onCopied: () => void;
  onSaved: () => void;
  toast: (body: string, id?: string) => void;
}) {
  const [name, setName] = useState(words.person.name);
  const [email, setEmail] = useState(words.person.email);
  const [listed, setListed] = useState(true);
  const [chosen, setChosen] = useState<PlanWords["id"]>(words.account.plan as PlanWords["id"]);
  const [asking, setAsking] = useState(false);
  const current = words.account.plan;
  const choice = words.account.plans.find((p) => p.id === chosen)!;

  const copy = () => {
    const link = words.person.host;
    navigator.clipboard
      ?.writeText(`https://${link}`)
      .then(onCopied)
      .catch(() => toast(`The link is ${link}`, "app-copied"));
    if (!navigator.clipboard) toast(`The link is ${link}`, "app-copied");
  };

  return (
    <div className="lab-content app-settings">
      <header className="app-settings-head">
        <Heading level={1}>Account and billing</Heading>
        <Text as="p" display="block" color="secondary">
          Signed in as {words.person.email}. You&rsquo;re on {words.account.planName}, {words.account.priceLine}.
        </Text>
      </header>

      <Layout
        height="auto"
        padding={0}
        start={
          <LayoutPanel padding={0} isScrollable={false} label="Account sections">
            <div className="app-settings-rail">
              <Outline items={OUTLINE} label="Account sections" density="compact" offset={96} />
            </div>
          </LayoutPanel>
        }
        content={
          <LayoutContent padding={0} isScrollable={false}>
            <div className="app-settings-body">
              <Part id="address" line="One link for your CV, your LinkedIn and your email signature. It opens on your work.">
                {loading ? (
                  <Skeleton width="80%" height={56} index={0} />
                ) : (
                  <Text as="p" display="block" type="display-2">
                    {address}
                  </Text>
                )}
                <div className="app-row">
                  <Button label="Copy link" variant="secondary" icon={<Icon icon="copy" />} onClick={copy} />
                  <Button label="See your portfolio" variant="ghost" href={appHref("work")} />
                </div>
                <Switch
                  label="Let search engines list my portfolio"
                  description="Off, it still opens for anyone with the link."
                  value={listed}
                  onChange={(on) => {
                    setListed(on);
                    onSaved();
                  }}
                />
              </Part>

              <Part id="details">
                <form
                  className="app-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSaved();
                  }}
                >
                  {loading ? (
                    <div className="app-skel-fields" role="img" aria-label="Your details, loading">
                      <Skeleton width={120} height={14} index={1} />
                      <Skeleton height={44} index={2} />
                      <Skeleton width={90} height={14} index={3} />
                      <Skeleton height={44} index={4} />
                    </div>
                  ) : (
                    <FormLayout>
                      <TextInput label="Your name" value={name} onChange={setName} autoComplete="name" description="As it appears at the top of your portfolio." />
                      <TextInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" description="Where we send your sign-in links and receipts." />
                    </FormLayout>
                  )}
                  {failed && (
                    <FailedSave
                      screen="account"
                      title="We couldn’t save your details."
                      description="What you typed is still here. Check your connection, then try again."
                      onRetry={onSaved}
                    />
                  )}
                  <div className="app-row">
                    <Button label="Save changes" variant="primary" type="submit" />
                  </div>
                </form>
              </Part>

              <Part id="plan" line={words.account.billingLine}>
                {loading ? (
                  <div className="app-plans">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} height={196} index={5 + i} />
                    ))}
                  </div>
                ) : (
                  <div role="group" aria-label="Plans" className="app-plans">
                    {words.account.plans.map((p) => (
                      <SelectableCard key={p.id} label={`${p.name}, ${p.price}`} isSelected={chosen === p.id} onChange={() => setChosen(p.id)} padding={5}>
                        <div className="app-plan">
                          <div className="app-plan-top">
                            <Heading level={3}>{p.name}</Heading>
                            {chosen === p.id ? <Tick size="lg" /> : null}
                          </div>
                          <Text as="p" display="block" color="secondary">
                            {p.price}
                          </Text>
                          {p.id === current && (
                            <span className="app-plan-yours">
                              <Token label="Your plan" color="green" size="sm" />
                            </span>
                          )}
                          <ul className="app-plan-lines">
                            {p.lines.map((l) => (
                              <li key={l}>
                                <Text>{l}</Text>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </SelectableCard>
                    ))}
                  </div>
                )}
                {chosen !== current && (
                  <div className="app-plan-move">
                    <Text as="p" display="block">
                      {choice.change}
                    </Text>
                    <Button label={`Move to ${choice.name}`} variant="secondary" onClick={() => toast("Changing plan isn’t part of the lab.", "app-plan")} />
                  </div>
                )}
              </Part>

              <Part id="data" line="Everything we hold about you, as one file you can keep.">
                <div className="app-row">
                  <Button label="Download my data" variant="secondary" icon={<Icon icon={Download} />} onClick={() => toast("In the lab nothing downloads.", "app-data")} />
                </div>
              </Part>

              <Part id="delete" line="This deletes your account, your portfolio, your exhbts and every file you uploaded, straight away. Links you have sent stop working. It can’t be undone.">
                <div className="app-row">
                  <Button label="Delete account" variant="secondary" onClick={() => setAsking(true)} />
                </div>
              </Part>
            </div>
          </LayoutContent>
        }
      />

      <AlertDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title="Delete your account?"
        description="Your portfolio goes offline, every link you have sent stops working, and everything you made is deleted straight away. It can’t be undone."
        actionLabel="Delete my account"
        cancelLabel="Keep my account"
        onAction={() => {
          setAsking(false);
          toast("Nothing was deleted: this is the lab.", "app-delete");
        }}
      />
    </div>
  );
}
