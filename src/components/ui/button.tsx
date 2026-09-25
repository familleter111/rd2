"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { GuideDot } from "@/components/guide/guide-mark";
import { cn } from "@/lib/cn";
import { advanceTo, useGuideTarget } from "@/lib/guide";

export type ButtonVariant = "primary" | "outline" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 disabled:shadow-none",
  outline:
    "border border-brand-300 bg-white text-brand-700 hover:border-brand-500 hover:bg-brand-50 disabled:border-line disabled:bg-white disabled:text-ink-300",
  secondary:
    "border border-line-strong bg-white text-ink-800 hover:border-ink-300 hover:bg-subtle disabled:text-ink-300",
  ghost: "text-ink-700 hover:bg-brand-50 hover:text-brand-700 disabled:text-ink-300",
  danger: "border border-danger-200 bg-white text-danger-700 hover:bg-danger-50",
  link: "h-auto px-0 text-brand-700 underline-offset-4 hover:text-brand-800 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children?: ReactNode;
  /** Screen of the guided tour this button leads to: blue, with a numbered circle, when it is the next step. */
  guide?: number;
  /** What to do before clicking (shown when hovering the circle). */
  guideHint?: string;
}

type ButtonProps = CommonProps & Omit<ComponentProps<"button">, "className" | "children">;
type LinkButtonProps = CommonProps & { href: string } & Omit<ComponentProps<typeof Link>, "className" | "children" | "href">;

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "" : sizes[size], className);
}

/** Guide highlight: blue primary style + numbered circle in the corner. */
function useGuideLook(variant: ButtonVariant, guide: number | undefined, guideHint: string | undefined, disabled?: boolean) {
  const target = useGuideTarget(guide);
  const active = target && !disabled;
  return {
    active,
    variant: active && variant !== "link" && variant !== "danger" ? ("primary" as const) : variant,
    ring: active ? "relative" : "",
    mark: active && guide !== undefined ? <GuideDot step={guide} hint={guideHint} /> : null,
  };
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  type = "button",
  guide,
  guideHint,
  ...rest
}: ButtonProps) {
  const look = useGuideLook(variant, guide, guideHint, rest.disabled);
  return (
    <button type={type} className={buttonClasses(look.variant, size, cn(look.ring, className))} {...rest}>
      {icon}
      {children}
      {iconRight}
      {look.mark}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  href,
  guide,
  guideHint,
  onClick,
  ...rest
}: LinkButtonProps) {
  const look = useGuideLook(variant, guide, guideHint);
  return (
    <Link
      href={href}
      className={buttonClasses(look.variant, size, cn(look.ring, className))}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (look.active && guide !== undefined) advanceTo(guide);
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
      {look.mark}
    </Link>
  );
}

/** Square icon-only button (kebab menus, close buttons…). */
export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...rest
}: { label: string } & Omit<ComponentProps<"button">, "aria-label">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
