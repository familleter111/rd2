"use client";

import { ChevronRight, CircleCheck, Pencil } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { COUNTRIES, NO_REFERENCE_PRODUCT, SCOPE_STRATEGIES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumeric } from "@/lib/format";
import { workSteps } from "@/lib/lab-selectors";
import { actions, useDemo } from "@/lib/store";
import type { Activity, Project } from "@/lib/types";

/** Starting text of a scoping sheet, written from what is known of the project (to be adapted). */
function scopeDefaults(project: Project) {
  const reference = project.referenceProduct && project.referenceProduct !== NO_REFERENCE_PRODUCT ? project.referenceProduct : "";
  return {
    objective: `Développer ${project.name} (${project.form.toLowerCase()} ${project.dosage}${project.dci ? `, ${project.dci}` : ""})${
      reference ? `, équivalent au produit de référence ${reference},` : ""
    } et constituer le dossier d'enregistrement.`,
    strategy: reference ? SCOPE_STRATEGIES[0] : SCOPE_STRATEGIES[SCOPE_STRATEGIES.length - 1],
    markets: project.countries,
    included: "Développement galénique et analytique, lot pilote, études de stabilité (conditions ICH), rédaction du module 3 du dossier CTD.",
    excluded: "Validation industrielle du procédé et fabrication des lots commerciaux (après le transfert en production).",
    risks: "Disponibilité de la matière active (DMF / CEP du fournisseur), profil de dissolution par rapport à la référence, stabilité en zone climatique IVa.",
  };
}

/** Scoping sheet of a project: the work of the activity « Lancer le cadrage ». */
export function ScopeDrawer({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const initial = project.scope ?? scopeDefaults(project);
  const [objective, setObjective] = useState(initial.objective);
  const [strategy, setStrategy] = useState(initial.strategy);
  const [markets, setMarkets] = useState<string[]>(initial.markets);
  const [included, setIncluded] = useState(initial.included);
  const [excluded, setExcluded] = useState(initial.excluded);
  const [risks, setRisks] = useState(initial.risks);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    objective: objective.trim().length < 20 ? "Décrivez l'objectif du projet (20 caractères minimum)." : null,
    markets: !markets.length ? "Sélectionnez au moins un marché visé." : null,
    included: !included.trim() ? "Précisez ce que couvre le projet." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    actions.saveProjectScope(project.code, {
      objective: objective.trim(),
      strategy,
      markets: COUNTRIES.filter((c) => markets.includes(c)),
      included: included.trim(),
      excluded: excluded.trim(),
      risks: risks.trim(),
    });
    toast.show({ title: "Fiche de cadrage enregistrée", description: `${project.code} • ${project.name} — tracée dans l'historique du projet.` });
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Fiche de cadrage"
      subtitle={`${project.code} • ${project.name} — ${project.formLabel}, ${project.dosage}`}
      widthClass="max-w-[560px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" onClick={save}>
            Enregistrer la fiche
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {!project.scope && (
          <p className="rounded-xl bg-brand-50/70 p-3 text-sm text-ink-700">
            La fiche est préremplie à partir des informations du projet : relisez-la et adaptez-la avant de l&apos;enregistrer.
          </p>
        )}
        <Field label="Objectif du projet" required htmlFor="scope-objective" error={show(errors.objective)}>
          <Textarea id="scope-objective" rows={3} maxLength={600} value={objective} invalid={Boolean(show(errors.objective))} onChange={(e) => setObjective(e.target.value)} />
        </Field>
        <Field label="Stratégie réglementaire" required htmlFor="scope-strategy">
          <Select id="scope-strategy" options={[...new Set([strategy, ...SCOPE_STRATEGIES])]} value={strategy} onChange={(e) => setStrategy(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold text-ink-800">
            Marchés visés <span className="text-danger-600">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {COUNTRIES.map((c) => (
              <Checkbox key={c} checked={markets.includes(c)} onChange={(on) => setMarkets((l) => (on ? [...l, c] : l.filter((x) => x !== c)))} label={c} />
            ))}
          </div>
          {show(errors.markets) && <p className="mt-2 text-sm text-danger-600">{errors.markets}</p>}
        </fieldset>
        <Field label="Inclus dans le périmètre" required htmlFor="scope-included" error={show(errors.included)}>
          <Textarea id="scope-included" rows={3} maxLength={600} value={included} invalid={Boolean(show(errors.included))} onChange={(e) => setIncluded(e.target.value)} />
        </Field>
        <Field label="Hors périmètre" htmlFor="scope-excluded" optional>
          <Textarea id="scope-excluded" rows={2} maxLength={600} value={excluded} onChange={(e) => setExcluded(e.target.value)} />
        </Field>
        <Field label="Risques et hypothèses" htmlFor="scope-risks" optional>
          <Textarea id="scope-risks" rows={3} maxLength={600} value={risks} onChange={(e) => setRisks(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}

/** Content of the saved scoping sheet. */
export function ScopeSummary({ project }: { project: Project }) {
  const scope = project.scope;
  if (!scope) return null;
  const rows = [
    ["Objectif", scope.objective],
    ["Stratégie réglementaire", scope.strategy],
    ["Marchés visés", scope.markets.join(", ")],
    ["Inclus dans le périmètre", scope.included],
    ["Hors périmètre", scope.excluded || "—"],
    ["Risques et hypothèses", scope.risks || "—"],
  ];
  return (
    <>
      <dl className="divide-y divide-line rounded-xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 text-[15px] sm:grid-cols-[210px_minmax(0,1fr)] sm:gap-3">
            <dt className="text-ink-500">{k}</dt>
            <dd className="text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-ink-500">
        Enregistrée le {formatDateTime(scope.savedAt)}
        {scope.validatedAt ? ` — cadrage validé le ${formatDateTime(scope.validatedAt)}` : ""}.
      </p>
    </>
  );
}

/**
 * Steps of an activity created with the project. Each step is ticked by the work really done
 * in the application; its button leads to the place where that work is done.
 * `ficheHref`: where the scoping sheet is edited when the list is shown outside the activity page.
 */
export function WorkSteps({ activity, ficheHref }: { activity: Activity; ficheHref?: string }) {
  const state = useDemo();
  const project = state.projects.find((p) => p.code === activity.projectCode);
  const steps = workSteps(state, activity);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeKey, setScopeKey] = useState(0);
  if (!project || !steps.length) return null;
  const firstTodo = steps.find((s) => !s.done)?.key;

  return (
    <>
      <ol className="divide-y divide-line rounded-xl border border-line">
        {steps.map((s, i) => {
          const variant = s.key === firstTodo && !activity.done ? "primary" : "outline";
          const icon = s.done ? <Pencil className="h-3.5 w-3.5" /> : undefined;
          return (
            <li key={s.key} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink-600">{i + 1}</span>
              {s.done ? (
                <CircleCheck className="h-7 w-7 shrink-0 fill-success-500 text-white" aria-hidden />
              ) : (
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", s.key === firstTodo ? "border-warn-500" : "border-line-strong")}>
                  {s.key === firstTodo && <span className="h-3 w-3 rounded-full bg-warn-500" />}
                </span>
              )}
              <span className="min-w-40 flex-1 text-sm">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                  {s.title}
                  <Badge tone={s.done ? "success" : "warn"}>{s.done ? "Fait" : "À faire"}</Badge>
                </span>
                <span className="block text-ink-500">
                  {s.detail}
                  {s.done && s.date ? ` (${formatNumeric(s.date)})` : ""}
                </span>
              </span>
              {s.key === "fiche" && !ficheHref ? (
                <Button
                  size="sm"
                  variant={variant}
                  icon={icon}
                  disabled={activity.done}
                  onClick={() => {
                    setScopeKey((k) => k + 1);
                    setScopeOpen(true);
                  }}
                >
                  {s.action}
                </Button>
              ) : (
                <LinkButton href={s.key === "fiche" ? ficheHref! : (s.href ?? "#")} size="sm" variant={variant} iconRight={<ChevronRight className="h-4 w-4" />}>
                  {s.action}
                </LinkButton>
              )}
            </li>
          );
        })}
      </ol>
      <ScopeDrawer key={`scope-${scopeKey}`} project={project} open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </>
  );
}
