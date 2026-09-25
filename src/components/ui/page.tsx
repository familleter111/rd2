import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-ink-600 sm:text-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[15px] font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-4">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="flex flex-wrap items-center gap-2 text-[15px]">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-ink-400" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="text-ink-600 hover:text-brand-700 hover:underline underline-offset-4">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-ink-900" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export { ScreenRef } from "@/components/guide/screen-ref";
