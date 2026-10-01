"use client";

import { ArrowDown, ArrowUp, Flag } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { TOTAL_SCREENS, advanceTo, findStep, guideUi, nextStepOf, screenCode, useGuideTarget, useGuideUi, type GuideStep } from "@/lib/guide";

/** Returns `go(step)`: moves the story to `step` and opens its screen. */
export function useGuideNav() {
  const router = useRouter();
  return (step: number) => {
    const target = findStep(step);
    if (!target) return;
    advanceTo(step);
    router.push(target.href);
  };
}

/** Circles currently shown on the page, used by the floating circle to scroll to them. */
const dotElements = new Set<HTMLElement>();

function scrollToFirstDot() {
  const [first] = [...dotElements].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  first?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
}

/** Hover bubble of a circle: which screen it opens (rendered in `body` so no container clips it). */
function GuideTip({ rect, step, hint, action }: { rect: DOMRect; step: GuideStep; hint?: string; action: string }) {
  const width = 280;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 8), window.innerWidth - width - 8);
  const above = rect.bottom + 150 > window.innerHeight;
  return createPortal(
    <div
      role="tooltip"
      style={above ? { left, width, bottom: window.innerHeight - rect.top + 10 } : { left, width, top: rect.bottom + 10 }}
      className="pointer-events-none fixed z-[70] rounded-xl bg-ink-900 px-3.5 py-2.5 text-left shadow-pop"
    >
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-200">
        Étape suivante · {screenCode(step.n)}
      </span>
      <span className="mt-0.5 block text-sm font-semibold text-white">{step.label}</span>
      <span className="block text-xs text-slate-400">{step.section}</span>
      {hint && <span className="mt-1.5 block text-xs text-slate-200">{hint}</span>}
      <span className="mt-1.5 block text-xs text-brand-200">{action}</span>
    </div>,
    document.body,
  );
}

const DOT_SIZE = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-7 w-7 text-xs",
  lg: "h-14 w-14 text-lg",
};

/**
 * Blue numbered circle of the guided tour. Hovering it shows the next screen, clicking it opens that
 * screen (the element it sits on keeps its own action). Registered circles are tracked so the floating
 * circle knows whether the page shows one, and whether it is inside the viewport.
 */
function Dot({
  step,
  hint,
  size,
  register = true,
  onActivate,
  action = "Cliquez sur le cercle pour ouvrir cet écran.",
  badge,
  className,
}: {
  step: number;
  hint?: string;
  size: keyof typeof DOT_SIZE;
  register?: boolean;
  /** Replaces "open the next screen" (floating circle scrolling to the page circle). */
  onActivate?: () => void;
  action?: string;
  badge?: ReactNode;
  className?: string;
}) {
  const go = useGuideNav();
  const ref = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const target = findStep(step);

  useEffect(() => {
    const el = ref.current;
    // Circles inside hidden containers (closed menu, inactive panel…) do not count.
    if (!register || !el || el.getClientRects().length === 0) return;
    dotElements.add(el);
    guideUi.addDot();
    let inView = false;
    let first = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const side = entry.boundingClientRect.top < 0 ? "up" : "down";
      if (entry.isIntersecting !== inView) {
        inView = entry.isIntersecting;
        guideUi.dotViewChange(inView ? 1 : -1, side);
      } else if (first) guideUi.dotViewChange(0, side);
      first = false;
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (inView) guideUi.dotViewChange(-1, "down");
      dotElements.delete(el);
      guideUi.removeDot();
    };
  }, [register]);

  if (!target) return null;
  // Screens outside the deck show their series code ("IA1" for IA-01).
  const code = target.ref ? target.ref.replace(/-0?/, "") : String(step);
  return (
    <span
      ref={ref}
      aria-hidden
      data-guide-dot={step}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setRect(null);
        if (onActivate) onActivate();
        else go(step);
      }}
      onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
      onMouseLeave={() => setRect(null)}
      className={cn(
        "guide-dot inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-600 font-bold tabular-nums leading-none text-white transition-transform duration-150 hover:scale-110",
        DOT_SIZE[size],
        code.length > 2 && size !== "lg" && "text-[9px] tracking-tight",
        className,
      )}
    >
      {code}
      {badge}
      {rect && <GuideTip rect={rect} step={target} hint={hint} action={action} />}
    </span>
  );
}

/** Circle placed on the element that leads to `step` (corner of a button, or inline in a tab / menu entry). */
export function GuideDot({ step, hint, inline, className }: { step: number; hint?: string; inline?: boolean; className?: string }) {
  return <Dot step={step} hint={hint} size={inline ? "sm" : "md"} className={cn(inline ? "relative ml-2" : "absolute -right-3 -top-3 z-10", className)} />;
}

/**
 * Highlights any block (field, card…) that the user has to act on to reach `step`.
 * Renders a plain wrapper when the circles are off or when `step` is not the next screen.
 */
export function GuideSpot({
  step,
  hint,
  active: activeOverride,
  className,
  children,
}: {
  step: number;
  /** What to do here (shown in the hover bubble). */
  hint?: string;
  /** Extra condition (e.g. the field is still empty). */
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const target = useGuideTarget(step);
  const active = target && activeOverride !== false;
  return (
    <div className={cn("relative", active && "guide-ring rounded-lg", className)}>
      {children}
      {active && <GuideDot step={step} hint={hint} />}
    </div>
  );
}

const FLOATING = "fixed bottom-7 right-7 z-[55]";

/**
 * Bottom-right circle of the tour:
 * - the page circle is out of view → scrolls to it;
 * - no element of the page leads to the next screen (change of project, variant of a mock-up…) → opens it;
 * - last delivered screen → "Fin des écrans livrés".
 * Appears after a short delay so it does not flash while the circles of a new page mount.
 */
export function GuideFloatingDot() {
  const { enabled, current, dots, dotsInView, dotSide } = useGuideUi();
  if (!enabled || current === null) return null;
  const next = nextStepOf(current);
  const enter = { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, transition: { delay: 0.4, type: "spring" as const, stiffness: 380, damping: 22 } };

  if (dots > 0) {
    if (dotsInView > 0 || !next) return null;
    const Arrow = dotSide === "up" ? ArrowUp : ArrowDown;
    return (
      <motion.div key={`${current}-scroll`} {...enter} className={FLOATING} data-guide-floating>
        <Dot
          step={next.n}
          size="lg"
          register={false}
          className="relative"
          onActivate={scrollToFirstDot}
          hint={`Le cercle à cliquer est plus ${dotSide === "up" ? "haut" : "bas"} dans la page.`}
          action="Cliquez pour faire défiler la page jusqu'au cercle."
          badge={
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-700 shadow-card">
              <Arrow className="h-4 w-4" strokeWidth={2.4} />
            </span>
          }
        />
      </motion.div>
    );
  }

  if (!next) {
    return (
      <motion.p
        key={current}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn(FLOATING, "flex items-center gap-2 rounded-full bg-success-50 px-4 py-2 text-sm font-semibold text-success-700 shadow-card ring-1 ring-success-500/30")}
      >
        <Flag className="h-4 w-4" aria-hidden />
        {current === TOTAL_SCREENS ? "Fin du parcours" : "Fin des écrans livrés"}
      </motion.p>
    );
  }

  return (
    <motion.div key={current} {...enter} className={FLOATING} data-guide-floating>
      <Dot step={next.n} size="lg" register={false} className="relative" hint={`Dans l'application : ${next.hint}.`} />
    </motion.div>
  );
}
