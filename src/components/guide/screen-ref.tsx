"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { TOTAL_SCREENS, guideUi, nextStepOf, prevStepOf } from "@/lib/guide";
import { useGuideNav } from "./guide-mark";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Mock-up reference ("23 / 56 — Méthode — référence · Maquette • Données de démonstration").
 * Also registers the current screen for the guided tour and links the previous / next screens.
 */
export function ScreenRef({ n, label }: { n?: number; label: string }) {
  const go = useGuideNav();
  const current = n ?? null;

  useEffect(() => {
    guideUi.setCurrent(current);
    return () => guideUi.clearCurrent(current);
  }, [current]);

  const prev = prevStepOf(current);
  const next = nextStepOf(current);

  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line/70 pt-3 text-xs text-ink-500">
      <nav aria-label="Écrans de la maquette" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {prev && (
          <button
            type="button"
            onClick={() => go(prev.n)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-ink-600 hover:bg-brand-50 hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {pad(prev.n)} — {prev.label}
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => go(next.n)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 font-semibold text-brand-700 hover:bg-brand-50"
          >
            {pad(next.n)} — {next.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </nav>
      <p className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <span>
          {n !== undefined && `${pad(n)} / ${TOTAL_SCREENS} — `}
          {label}
        </span>
        <span aria-hidden className="text-ink-300">
          |
        </span>
        <span>Maquette • Données de démonstration</span>
      </p>
    </footer>
  );
}
