"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Checkbox, DateInput, Field, Input, Select, Textarea } from "./field";
import { Modal } from "./modal";

export interface FormField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select" | "checkbox" | "date";
  options?: string[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Spans the two columns of the form. */
  wide?: boolean;
}

export type FormValues = Record<string, string | boolean>;

/** Small entry dialog described by its fields (lists of the quality and stability steps). */
export function FormModal({
  title,
  subtitle,
  fields,
  initial,
  submitLabel = "Enregistrer",
  note,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  fields: FormField[];
  initial?: FormValues;
  submitLabel?: string;
  note?: ReactNode;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? (f.type === "checkbox" ? false : f.type === "select" && f.required ? (f.options?.[0] ?? "") : "")])));
  const set = (key: string, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));
  const valid = fields.every((f) => !f.required || f.type === "checkbox" || String(values[f.key] ?? "").trim());
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSubmit(values);
              onClose();
            }}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `form-${f.key}`;
          const value = values[f.key];
          if (f.type === "checkbox") {
            return <Checkbox key={f.key} id={id} className={f.wide ? "sm:col-span-2" : undefined} checked={Boolean(value)} onChange={(v) => set(f.key, v)} label={f.label} description={f.hint} />;
          }
          return (
            <Field key={f.key} label={f.label} required={f.required} htmlFor={id} hint={f.hint} className={f.wide ? "sm:col-span-2" : undefined}>
              {f.type === "select" ? (
                <Select id={id} placeholder={f.required ? undefined : "—"} options={f.options ?? []} value={String(value)} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "textarea" ? (
                <Textarea id={id} value={String(value)} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} maxLength={400} />
              ) : f.type === "date" ? (
                <DateInput id={id} value={String(value)} onChange={(v) => set(f.key, v)} onClear={() => set(f.key, "")} />
              ) : (
                <Input id={id} value={String(value)} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
      {note && <div className="mt-5">{note}</div>}
    </Modal>
  );
}
