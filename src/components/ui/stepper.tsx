import { Check } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/cn";

export interface Step {
  title: string;
  subtitle?: string;
}

/** Horizontal stepper used by the multi-step forms. */
export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: Step[];
  /** 1-based index of the current step. */
  current: number;
  /** Called when a completed step is clicked. */
  onStepClick?: (step: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-y-3", className)}>
      {steps.map((step, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const clickable = done && onStepClick;
        const Inner = (
          <>
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold transition-colors",
                active && "bg-brand-600 text-white ring-4 ring-brand-100",
                done && "bg-brand-600 text-white",
                !active && !done && "border border-line-strong bg-white text-ink-500",
              )}
            >
              {done ? <Check className="h-5 w-5" strokeWidth={2.6} /> : n}
            </span>
            <span className="min-w-0 text-left">
              <span className={cn("block text-[16px] font-semibold", active ? "text-brand-700" : "text-ink-900")}>{step.title}</span>
              {step.subtitle && <span className="block text-[13px] text-ink-500">{step.subtitle}</span>}
            </span>
          </>
        );
        return (
          <Fragment key={step.title}>
            <li className="flex items-center" aria-current={active ? "step" : undefined}>
              {clickable ? (
                <button type="button" onClick={() => onStepClick(n)} className="flex cursor-pointer items-center gap-3 rounded-lg hover:opacity-80">
                  {Inner}
                </button>
              ) : (
                <div className="flex items-center gap-3">{Inner}</div>
              )}
            </li>
            {n < steps.length && (
              <li aria-hidden className={cn("mx-4 hidden h-0.5 min-w-8 flex-1 rounded-full sm:block", done ? "bg-brand-500" : "bg-line-strong")} />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Compact vertical stepper (drawer forms). */
export function VerticalStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="space-y-1">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  active && "bg-brand-600 text-white ring-4 ring-brand-100",
                  done && "bg-brand-600 text-white",
                  !active && !done && "border border-line-strong bg-white text-ink-500",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.6} /> : n}
              </span>
            </span>
            <span className={cn("text-[15px]", active ? "font-semibold text-brand-700" : done ? "font-medium text-ink-800" : "text-ink-600")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
