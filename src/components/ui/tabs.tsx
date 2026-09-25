"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { GuideDot, useGuideNav } from "@/components/guide/guide-mark";
import { cn } from "@/lib/cn";
import { advanceTo, useGuideTarget } from "@/lib/guide";

const tabBase =
  "relative inline-flex items-center gap-2 whitespace-nowrap pb-3 pt-1 font-medium transition-colors cursor-pointer";
const tabIdle = "text-ink-600 hover:text-ink-900";
const tabActive =
  "font-semibold text-brand-700 after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full after:bg-brand-600";

export interface LinkTabItem {
  href: string;
  label: string;
  /** "exact" (default) or "prefix" matching of the current pathname. */
  match?: "exact" | "prefix";
  /** Screen of the guided tour opened by this tab. */
  guide?: number;
  /** Forces the active state (when the URL alone cannot tell). */
  active?: boolean;
}

function TabLink({ item, active }: { item: LinkTabItem; active: boolean }) {
  const target = useGuideTarget(item.guide) && !active;
  const go = useGuideNav();
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        // Next step of the tour: open the exact screen of the mock-up (e.g. the portfolio with its filters open).
        if (target && item.guide !== undefined) {
          e.preventDefault();
          go(item.guide);
        }
      }}
      className={cn(tabBase, active ? tabActive : tabIdle, "px-1", target && "rounded-md bg-brand-50 px-2 text-brand-700")}
    >
      {item.label}
      {target && item.guide !== undefined && <GuideDot step={item.guide} inline />}
    </Link>
  );
}

/** Underlined navigation tabs driven by the URL. */
export function LinkTabs({
  items,
  size = "md",
  actions,
  className,
}: {
  items: LinkTabItem[];
  size?: "md" | "sm";
  actions?: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = (item: LinkTabItem) =>
    item.active ?? (item.match === "prefix" ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href);

  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line", className)}>
      <nav className={cn("relative -mb-px flex gap-x-8 overflow-x-auto", size === "md" ? "text-[17px]" : "text-[15px] gap-x-7")}>
        {items.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(item)} />
        ))}
      </nav>
      {actions && <div className="flex flex-wrap items-center gap-3 pb-3">{actions}</div>}
    </div>
  );
}

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Screen of the guided tour shown by this tab. */
  guide?: number;
}

function TabButton<T extends string>({ item, active, onSelect }: { item: TabItem<T>; active: boolean; onSelect: () => void }) {
  const target = useGuideTarget(item.guide) && !active;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => {
        if (target && item.guide !== undefined) advanceTo(item.guide);
        onSelect();
      }}
      className={cn(tabBase, active ? tabActive : tabIdle, "px-1", target && "rounded-md bg-brand-50 px-2 text-brand-700")}
    >
      {item.label}
      {item.count !== undefined && (
        <span className="rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-ink-600">{item.count}</span>
      )}
      {target && item.guide !== undefined && <GuideDot step={item.guide} inline />}
    </button>
  );
}

/** Underlined tabs driven by local state. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  size = "md",
  className,
  actions,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "sm";
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line", className)}>
      <div role="tablist" className={cn("relative -mb-px flex gap-x-7 overflow-x-auto", size === "md" ? "text-[17px]" : "text-[15px]")}>
        {items.map((item) => (
          <TabButton key={item.value} item={item} active={item.value === value} onSelect={() => onChange(item.value)} />
        ))}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 pb-3">{actions}</div>}
    </div>
  );
}

export interface SegmentItem<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

/** Boxed segment tabs ("À préparer 2 · En cours 1 · Clôturées 5", lot types…). */
export function SegmentTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-4 text-[15px] font-medium transition-colors",
              active
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-line bg-white text-ink-700 hover:border-line-strong hover:bg-subtle",
            )}
          >
            {Icon && <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-ink-600",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pill filters ("Aujourd'hui · Cette semaine · En attente"). */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "h-11 cursor-pointer rounded-lg border px-5 text-[15px] font-medium transition-colors",
              active
                ? "border-brand-100 bg-brand-100 font-semibold text-brand-700"
                : "border-line bg-white text-ink-700 hover:bg-subtle",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
