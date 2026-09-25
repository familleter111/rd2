import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-line bg-white shadow-card", className)} {...rest} />;
}

export function CardHeader({
  title,
  icon,
  actions,
  subtitle,
  className,
  as: Tag = "h2",
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon}
        <div className="min-w-0">
          <Tag className="text-lg font-bold text-ink-900">{title}</Tag>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small uppercase-free label + value pair used in detail panels. */
export function InfoPair({
  label,
  value,
  sub,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      {icon}
      <div className="min-w-0">
        <p className="text-[13px] text-ink-500">{label}</p>
        <div className="font-semibold text-ink-900">{value}</div>
        {sub && <p className="text-[13px] text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}
