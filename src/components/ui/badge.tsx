import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/types";

export const TONE_BADGE: Record<Tone, string> = {
  info: "bg-brand-50 text-brand-700 ring-brand-100",
  warn: "bg-warn-50 text-warn-700 ring-warn-100",
  danger: "bg-danger-50 text-danger-700 ring-danger-100",
  success: "bg-success-50 text-success-700 ring-success-100",
  neutral: "bg-slate-100 text-ink-600 ring-slate-200/70",
};

export const TONE_TEXT: Record<Tone, string> = {
  info: "text-brand-700",
  warn: "text-warn-700",
  danger: "text-danger-700",
  success: "text-success-700",
  neutral: "text-ink-600",
};

export const TONE_ICON: Record<Tone, string> = {
  info: "text-brand-600",
  warn: "text-warn-600",
  danger: "text-danger-600",
  success: "text-success-600",
  neutral: "text-ink-400",
};

export const TONE_DOT: Record<Tone, string> = {
  info: "bg-brand-500",
  warn: "bg-warn-500",
  danger: "bg-danger-500",
  success: "bg-success-500",
  neutral: "bg-ink-300",
};

export const TONE_TILE: Record<Tone, string> = {
  info: "bg-brand-50 text-brand-600",
  warn: "bg-warn-50 text-warn-600",
  danger: "bg-danger-50 text-danger-600",
  success: "bg-success-50 text-success-600",
  neutral: "bg-slate-100 text-ink-500",
};

export const TONE_STATUS_ICON: Record<Tone, LucideIcon> = {
  info: Info,
  warn: TriangleAlert,
  danger: CircleAlert,
  success: CircleCheck,
  neutral: Info,
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  icon?: LucideIcon | boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Pill used for statuses ("Formulation", "À examiner", "Brouillon"…). */
export function Badge({ tone = "neutral", children, dot, icon, size = "sm", className }: BadgeProps) {
  const Icon = icon === true ? TONE_STATUS_ICON[tone] : icon || null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]",
        TONE_BADGE[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-2 w-2 rounded-full", TONE_DOT[tone])} aria-hidden />}
      {Icon && <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", TONE_ICON[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", TONE_DOT[tone], className)} aria-hidden />;
}

/** Rounded square holding an icon, tinted by tone. */
export function IconTile({
  icon: Icon,
  tone = "info",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "sm" ? "h-9 w-9 rounded-lg" : size === "md" ? "h-11 w-11 rounded-xl" : "h-14 w-14 rounded-xl";
  const glyph = size === "sm" ? "h-[18px] w-[18px]" : size === "md" ? "h-5 w-5" : "h-7 w-7";
  return (
    <span className={cn("flex shrink-0 items-center justify-center", box, TONE_TILE[tone], className)} aria-hidden>
      <Icon className={glyph} strokeWidth={1.8} />
    </span>
  );
}
