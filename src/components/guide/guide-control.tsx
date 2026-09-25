"use client";

import { Check, ListOrdered, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { GUIDE_STEPS, TOTAL_SCREENS, findStep, guideUi, replayTo, useGuideUi } from "@/lib/guide";

const pad = (n: number) => String(n).padStart(2, "0");

/** Numbers of the deck that were not delivered yet. */
function missingScreens() {
  const delivered = new Set(GUIDE_STEPS.map((s) => s.n));
  const missing: number[] = [];
  for (let n = 1; n <= TOTAL_SCREENS; n++) if (!delivered.has(n)) missing.push(n);
  return missing;
}

function GuidePanel() {
  const { panelOpen, enabled, current } = useGuideUi();
  const router = useRouter();
  const sections = [...new Set(GUIDE_STEPS.map((s) => s.section))];
  const missing = missingScreens();

  return (
    <Modal
      open={panelOpen}
      onClose={guideUi.closePanel}
      size="lg"
      title="Parcours des écrans"
      subtitle="Suivez les maquettes dans l'ordre ou ouvrez directement un écran."
    >
      <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-4">
        <Checkbox
          checked={enabled}
          onChange={guideUi.setEnabled}
          label={<span className="font-semibold text-ink-900">Afficher les cercles bleus de l&apos;étape suivante</span>}
          description="Un cercle bleu numéroté est posé sur l'élément à cliquer : survolez-le pour voir l'étape suivante, cliquez-le pour l'ouvrir."
        />
      </div>
      <p className="mt-4 flex items-start gap-2 text-sm text-ink-600">
        <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden />
        Ouvrir un écran depuis cette liste remet les données de démonstration dans l&apos;état de la maquette correspondante.
      </p>
      <div className="mt-4 max-h-[52vh] space-y-5 overflow-y-auto pr-1">
        {sections.map((section) => (
          <section key={section}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{section}</h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {GUIDE_STEPS.filter((s) => s.section === section).map((step) => {
                const here = step.n === current;
                return (
                  <li key={step.n}>
                    <button
                      type="button"
                      onClick={() => {
                        replayTo(step.n);
                        guideUi.closePanel();
                        router.push(step.href);
                        toast.show({ title: `Écran ${pad(step.n)} — ${step.label}`, description: "Données remises dans l'état de la maquette.", tone: "info" });
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        here ? "border-brand-300 bg-brand-50" : "border-line bg-white hover:border-brand-200 hover:bg-subtle",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                          here ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-700",
                        )}
                      >
                        {pad(step.n)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-900">{step.label}</span>
                        <span className="block text-xs text-ink-500">{step.hint}</span>
                      </span>
                      {here && <Check className="ml-auto mt-1 h-4 w-4 shrink-0 text-brand-600" aria-label="Écran actuel" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Maquettes non fournies</h3>
          <p className="text-sm text-ink-600">{missing.map(pad).join(", ")}</p>
        </section>
      </div>
    </Modal>
  );
}

/** Top bar control: current screen ("Écran 23 / 56") opening the list of screens. */
export function GuideControl() {
  const { current } = useGuideUi();
  const here = current !== null ? findStep(current) : undefined;

  return (
    <>
      <button
        type="button"
        onClick={guideUi.openPanel}
        aria-label="Parcours des écrans"
        title="Parcours des écrans"
        className="flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-white px-3 text-sm font-semibold text-ink-700 shadow-card transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        <ListOrdered className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        <span className="hidden tabular-nums sm:inline">{here ? `Écran ${pad(here.n)} / ${TOTAL_SCREENS}` : "Parcours"}</span>
      </button>
      <GuidePanel />
    </>
  );
}
