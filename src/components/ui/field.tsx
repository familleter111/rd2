"use client";

import { Check, ChevronDown, CircleAlert, Info, Search, X, type LucideIcon } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDismissable } from "./overlay";

export const controlClass =
  "w-full rounded-lg border border-line-strong bg-white text-[15px] text-ink-900 outline-none transition-[border-color,box-shadow] placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-ink-500";
const invalidClass = "border-danger-500 hover:border-danger-500 focus:border-danger-500 focus:ring-danger-100";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  info?: string;
  optional?: boolean;
  /** Shown at the end of the label row (e.g. where the value comes from). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, hint, error, info, optional, aside, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className={cn("mb-1.5 flex items-center gap-1 text-[15px] font-semibold text-ink-800", aside && "flex-wrap gap-y-1 whitespace-nowrap")}
      >
        {label}
        {required && (
          <span className="text-danger-600" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="font-normal text-ink-500">(optionnel)</span>}
        {info && (
          <span title={info} className="ml-0.5 inline-flex cursor-help text-ink-400">
            <Info className="h-4 w-4" aria-label={info} />
          </span>
        )}
        {aside && <span className="ml-auto pl-2 font-normal">{aside}</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-danger-600" role="alert">
          <CircleAlert className="h-4 w-4 shrink-0 fill-danger-600 text-white" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(controlClass, "h-11 px-3.5", invalid && invalidClass, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({
  className,
  invalid,
  maxLength,
  value,
  ...rest
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  const length = typeof value === "string" ? value.length : 0;
  return (
    <div>
      <textarea
        className={cn(controlClass, "min-h-24 resize-y px-3.5 py-2.5 leading-relaxed", invalid && invalidClass, className)}
        aria-invalid={invalid || undefined}
        maxLength={maxLength}
        value={value}
        {...rest}
      />
      {maxLength && (
        <p className="mt-1 text-right text-xs text-ink-500">
          {length} / {maxLength}
        </p>
      )}
    </div>
  );
}

type Option = string | { value: string; label: string };
const optValue = (o: Option) => (typeof o === "string" ? o : o.value);
const optLabel = (o: Option) => (typeof o === "string" ? o : o.label);

export function Select({
  options,
  placeholder,
  className,
  invalid,
  icon: Icon,
  size = "md",
  ...rest
}: Omit<ComponentProps<"select">, "size"> & {
  options: Option[];
  placeholder?: string;
  invalid?: boolean;
  icon?: LucideIcon;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("relative", className)}>
      {Icon && (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-500" aria-hidden />
      )}
      <select
        className={cn(
          controlClass,
          "cursor-pointer appearance-none pr-10",
          size === "md" ? "h-11 pl-3.5" : "h-9 pl-3 text-sm",
          Icon && (size === "md" ? "pl-11" : "pl-9"),
          invalid && invalidClass,
          rest.value === "" && "text-ink-400",
        )}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={optValue(o)} value={optValue(o)} className="text-ink-900">
            {optLabel(o)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-500" aria-hidden />
    </div>
  );
}

export function DateInput({
  value,
  onChange,
  onClear,
  invalid,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  invalid?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(controlClass, "h-11 px-3.5", onClear && value && "pr-16", invalid && invalidClass)}
        aria-invalid={invalid || undefined}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer la date"
          className="absolute right-9 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-ink-500 hover:text-ink-900"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-500" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className={cn(controlClass, "h-11 bg-subtle pl-11 pr-3.5")}
      />
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  className,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label className={cn("relative inline-flex items-start gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer", className)}>
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cn(
          "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-brand-200",
          checked ? "border-brand-600 bg-brand-600" : "border-line-strong bg-white",
        )}
        aria-hidden
      >
        {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[15px] text-ink-800">{label}</span>}
          {description && <span className="mt-0.5 block text-[13px] text-ink-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Radio({
  checked,
  onChange,
  name,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("relative flex cursor-pointer items-start gap-3", className)}>
      <input type="radio" name={name} className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-brand-200",
          checked ? "border-brand-600" : "border-line-strong",
        )}
        aria-hidden
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink-900">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

/** Joined toggle buttons ("Sèche | Liquide | Semi-solide"). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-lg border border-line-strong bg-white p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-[15px] font-medium transition-colors",
              active ? "bg-brand-500 text-white shadow-sm" : "text-ink-700 hover:bg-brand-50",
            )}
          >
            {Icon && <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select rendered as removable chips inside a select-like box. */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  invalid,
  id,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  label: string;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(
          controlClass,
          "flex min-h-11 cursor-pointer items-center gap-2 py-1.5 pl-2 pr-10",
          open && "border-brand-500 ring-3 ring-brand-100",
          invalid && invalidClass,
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex flex-1 flex-wrap gap-1.5">
          {value.length === 0 && <span className="px-1.5 text-ink-400">{placeholder}</span>}
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-md bg-brand-100 py-1 pl-2.5 pr-1.5 text-sm font-medium text-brand-700">
              {v}
              <button
                type="button"
                aria-label={`Retirer ${v}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v);
                }}
                className="cursor-pointer rounded p-0.5 hover:bg-brand-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-ink-500"
        >
          <ChevronDown className={cn("h-[18px] w-[18px] transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div role="listbox" aria-multiselectable className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-xl border border-line bg-white p-1.5 shadow-pop">
          {options.map((option) => {
            const selected = value.includes(option);
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(option)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] text-ink-800 hover:bg-brand-50"
              >
                <span
                  className={cn(
                    "flex h-[18px] w-[18px] items-center justify-center rounded border-2",
                    selected ? "border-brand-600 bg-brand-600" : "border-line-strong",
                  )}
                >
                  {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** On / off switch (permissions, notification channels). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name (the visible label is usually rendered next to it). */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-brand-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-slate-300",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-6" : "translate-x-1")}
      />
    </button>
  );
}
