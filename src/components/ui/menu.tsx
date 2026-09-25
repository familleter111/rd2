"use client";

import { EllipsisVertical, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDismissable } from "./overlay";

export interface MenuItem {
  label: string;
  description?: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  tone?: "danger";
  disabled?: boolean;
  separatorBefore?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  /** Accessible name of the trigger. */
  label: string;
  /** Custom trigger content; defaults to a vertical kebab icon. */
  trigger?: ReactNode;
  triggerClassName?: string;
  align?: "left" | "right";
  widthClass?: string;
  className?: string;
}

export function Menu({
  items,
  label,
  trigger,
  triggerClassName,
  align = "right",
  widthClass = "w-64",
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    if (!nodes.length) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (index + 1) % nodes.length : (index - 1 + nodes.length) % nodes.length;
    nodes[next].focus();
  };

  const itemClass = (item: MenuItem) =>
    cn(
      "flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:bg-brand-50",
      item.disabled && "cursor-not-allowed opacity-50",
      item.tone === "danger" ? "text-danger-600 hover:bg-danger-50" : "text-ink-800 hover:bg-brand-50",
    );

  const content = (item: MenuItem) => {
    const Icon = item.icon;
    return (
      <>
        {Icon && (
          <Icon
            className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", item.tone === "danger" ? "text-danger-600" : "text-ink-500")}
            strokeWidth={1.8}
            aria-hidden
          />
        )}
        <span className="min-w-0">
          <span className="block font-medium">{item.label}</span>
          {item.description && <span className="mt-0.5 block text-xs leading-snug text-ink-500">{item.description}</span>}
        </span>
      </>
    );
  };

  return (
    <div ref={ref} className={cn("relative inline-flex", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          trigger
            ? "cursor-pointer"
            : "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700",
          open && !trigger && "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
          triggerClassName,
        )}
      >
        {trigger ?? <EllipsisVertical className="h-5 w-5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{ willChange: "transform, opacity" }}
            className={cn(
              "absolute top-full z-40 mt-2 rounded-xl border border-line bg-white p-1.5 shadow-pop",
              align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
              widthClass,
            )}
          >
            {items.map((item) => (
              <div key={item.label}>
                {item.separatorBefore && <div className="my-1.5 border-t border-line" role="separator" />}
                {item.href && !item.disabled ? (
                  <Link role="menuitem" href={item.href} className={itemClass(item)} onClick={() => setOpen(false)}>
                    {content(item)}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled={item.disabled || undefined}
                    className={itemClass(item)}
                    onClick={() => {
                      if (item.disabled) return;
                      setOpen(false);
                      item.onSelect?.();
                    }}
                  >
                    {content(item)}
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
