"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "info" | "warn" | "danger";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; href: string };
}

let items: ToastItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: ToastItem[] = [];

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Imperative toast API — call from event handlers. */
export const toast = {
  show(input: Omit<ToastItem, "id" | "tone"> & { tone?: ToastTone }) {
    const id = ++counter;
    items = [...items.slice(-3), { tone: "success", ...input, id }];
    emit();
    window.setTimeout(() => dismiss(id), input.tone === "danger" || input.tone === "warn" ? 7000 : 5000);
  },
  dismiss,
};

const TONES: Record<ToastTone, { icon: typeof Info; circle: string }> = {
  success: { icon: CircleCheck, circle: "bg-success-500" },
  info: { icon: Info, circle: "bg-brand-600" },
  warn: { icon: TriangleAlert, circle: "bg-warn-500" },
  danger: { icon: CircleAlert, circle: "bg-danger-500" },
};

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => items,
    () => EMPTY,
  );
  const reduce = useReducedMotion();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-[84px] z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3 sm:right-6"
    >
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const { icon: Icon, circle } = TONES[t.tone];
          return (
            <motion.div
              key={t.id}
              layout={!reduce}
              initial={{ opacity: 0, x: reduce ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduce ? 0 : 24 }}
              transition={{ duration: 0.22 }}
              style={{ willChange: "transform, opacity" }}
              role="status"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-pop",
                t.tone === "success" ? "border-success-100" : "border-line",
              )}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white", circle)}>
                <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-semibold text-ink-900">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm leading-snug text-ink-600">{t.description}</p>}
                {t.action && (
                  <Link
                    href={t.action.href}
                    onClick={() => dismiss(t.id)}
                    className="mt-1.5 inline-block text-sm font-semibold text-brand-700 hover:underline"
                  >
                    {t.action.label}
                  </Link>
                )}
              </div>
              <button
                type="button"
                aria-label="Fermer la notification"
                onClick={() => dismiss(t.id)}
                className="-mr-1 -mt-1 cursor-pointer rounded-md p-1 text-ink-400 hover:bg-slate-100 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
