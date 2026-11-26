"use client";

import { useState, type ReactNode } from "react";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";

/*
 * The app's fields. Astryx's TextInput and TextArea are controlled and draw their own label; most of the site's
 * forms post uncontrolled inputs to server actions, so these keep the value when none is passed, and give the
 * native `name` through `htmlName` so a plain <form> still posts it. The label passes through unchanged: a label
 * that says "(optional)" stays as written, because the tests find fields by their labels.
 */
type FieldBase = {
  label: string;
  /** The native name, so a form posts it to a server action. */
  name?: string;
  /** Under the label. */
  hint?: string;
  /** An error from the server or the page: marks the field invalid and is tied to it. */
  error?: string;
  /** Uncontrolled use: the wrapper keeps the value. */
  defaultValue?: string;
  /** Controlled use. */
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
};

/** Holds the value for uncontrolled use; passes a controlled one straight through. */
function useValue({ value, defaultValue, onChange }: Pick<FieldBase, "value" | "defaultValue" | "onChange">) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const controlled = value !== undefined;
  return {
    value: controlled ? value : own,
    onChange: (next: string) => {
      if (!controlled) setOwn(next);
      onChange?.(next);
    },
  };
}

export function TextField(
  props: FieldBase & { type?: "text" | "email" | "password" | "url" | "tel" | "search"; inputMode?: "text" | "email" | "url" | "tel" | "numeric" },
): ReactNode {
  const v = useValue(props);
  return (
    <TextInput
      label={props.label}
      htmlName={props.name}
      description={props.hint}
      status={props.error ? { type: "error", message: props.error } : undefined}
      statusVariant="detached"
      value={v.value}
      onChange={v.onChange}
      isRequired={props.required}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete}
      isDisabled={props.disabled}
      type={props.type}
      inputMode={props.inputMode}
    />
  );
}

export function TextAreaField(props: FieldBase & { rows?: number }): ReactNode {
  const v = useValue(props);
  return (
    <TextArea
      label={props.label}
      htmlName={props.name}
      description={props.hint}
      status={props.error ? { type: "error", message: props.error } : undefined}
      value={v.value}
      onChange={v.onChange}
      isRequired={props.required}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete}
      isDisabled={props.disabled}
      rows={props.rows}
    />
  );
}

export function CheckboxField(props: {
  label: string;
  name?: string;
  hint?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  required?: boolean;
}): ReactNode {
  const [own, setOwn] = useState(props.defaultChecked ?? false);
  const controlled = props.checked !== undefined;
  return (
    <CheckboxInput
      label={props.label}
      htmlName={props.name}
      description={props.hint}
      value={controlled ? props.checked! : own}
      onChange={(next) => {
        if (!controlled) setOwn(next);
        props.onChange?.(next);
      }}
      isRequired={props.required}
    />
  );
}
