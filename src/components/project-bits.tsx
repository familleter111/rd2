import {
  ChartNoAxesColumn,
  ChevronRight,
  Compass,
  FileText,
  FlaskConical,
  Network,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge, TONE_DOT } from "@/components/ui/badge";
import { JOURNEY_STEPS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import type { BadgeIcon } from "@/lib/selectors";
import type { Labelled, Tone } from "@/lib/types";

const BADGE_ICONS: Record<BadgeIcon, LucideIcon> = {
  flask: FlaskConical,
  chart: ChartNoAxesColumn,
  compass: Compass,
  warning: TriangleAlert,
};

export function StageBadge({ badge, size = "md" }: { badge: Labelled & { icon: BadgeIcon }; size?: "sm" | "md" }) {
  return (
    <Badge tone={badge.tone} icon={BADGE_ICONS[badge.icon]} size={size}>
      {badge.label}
    </Badge>
  );
}

/** Org-chart style icon with a coloured status dot (phase indicator of the mock-ups). */
export function PhaseIcon({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-8 w-8 shrink-0 items-center justify-center text-ink-700", className)} aria-hidden>
      <Network className="h-6 w-6" strokeWidth={1.7} />
      <span className={cn("absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full ring-2 ring-white", TONE_DOT[tone])} />
    </span>
  );
}

const STEP_ICONS: Record<(typeof JOURNEY_STEPS)[number]["icon"], LucideIcon> = {
  doc: FileText,
  flask: FlaskConical,
  settings: Settings,
};

/**
 * The 4-step R&D pathway. Without `current`, steps are informational;
 * with `current`, each step shows its status: "Terminé", "En cours" or "À venir" (project view).
 */
export function JourneyStrip({ current, className }: { current?: number; className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-2 xl:flex xl:items-stretch xl:gap-0", className)}>
      {JOURNEY_STEPS.map((step, i) => {
        const n = i + 1;
        const Icon = STEP_ICONS[step.icon];
        const done = current !== undefined && n < current;
        const active = current !== undefined && n === current;
        return (
          <li key={step.n} className="flex items-center xl:flex-1">
            <div
              className={cn(
                "flex h-full w-full items-center gap-3 rounded-xl border px-4 py-3.5",
                current === undefined && "border-line bg-white",
                done && "border-success-100 bg-success-50/70",
                active && "border-brand-300 bg-brand-50/60 ring-1 ring-brand-200",
                current !== undefined && !done && !active && "border-line bg-subtle",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[15px] font-semibold text-brand-700 ring-1 ring-brand-100">
                {step.n}
              </span>
              <Icon className="h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.6} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900">{step.title}</span>
                <span className="block text-[13px] leading-snug text-ink-500">{step.detail}</span>
              </span>
              {current !== undefined && (
                <Badge tone={done ? "success" : active ? "info" : "neutral"}>{done ? "Terminé" : active ? "En cours" : "À venir"}</Badge>
              )}
            </div>
            {n < JOURNEY_STEPS.length && (
              <ChevronRight className="mx-1.5 hidden h-5 w-5 shrink-0 text-ink-400 xl:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
