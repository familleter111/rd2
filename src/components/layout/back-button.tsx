"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Pages opened inside the application since it was loaded (so "Retour" never leaves it). */
let depth = 0;
let tracking = false;

function track() {
  if (tracking) return;
  tracking = true;
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    depth += 1;
    push(...args);
  };
  window.addEventListener("popstate", () => {
    depth = Math.max(0, depth - 1);
  });
}

/** "Retour", shown on every page: goes back to the page visited just before. */
export function BackButton() {
  const router = useRouter();
  useEffect(track, []);

  return (
    <button
      type="button"
      onClick={() => (depth > 0 ? router.back() : router.push("/vue-ensemble"))}
      className="flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-white/90 px-4 text-[15px] font-semibold text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden />
      Retour
    </button>
  );
}
