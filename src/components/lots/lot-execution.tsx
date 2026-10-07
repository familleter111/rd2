"use client";

import { Check, Clock, CloudUpload, FileText, Info, Pause, Play, Save, TriangleAlert, User, X } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select, Textarea, controlClass } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { labActions, useDemo } from "@/lib/store";
import type { ExecStep, PilotLot, Project } from "@/lib/types";
import { findPilot } from "./lot-frame";
import { MoModal } from "./lot-preparation";

const STEP_STYLE: Record<ExecStep["status"], { circle: string; text: string }> = {
  Terminée: { circle: "bg-success-500 text-white", text: "text-ink-500" },
  "En cours": { circle: "bg-brand-600 text-white", text: "text-brand-700" },
  "En pause": { circle: "bg-warn-500 text-white", text: "text-warn-700" },
  "À venir": { circle: "bg-slate-400 text-white", text: "text-ink-500" },
};

function StepForm({ project, pilot, step, index }: { project: Project; pilot: PilotLot; step: ExecStep; index: number }) {
  const state = useDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(step);
  const [moOpen, setMoOpen] = useState(false);
  const editable = step.status === "En cours" || step.status === "En pause";
  const set = <K extends keyof ExecStep>(key: K, value: ExecStep[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const equipment = state.resources.filter((r) => r.category === "Équipement");
  const options = [...new Set([draft.equipment, ...equipment.map((r) => r.id)])];
  const endInvalid = Boolean(draft.end && draft.start && draft.end <= draft.start);
  const base = `/projets/${project.slug}/lots/${pilot.lotCode.toLowerCase()}`;

  const save = (silent = false) => {
    labActions.saveStep(project.code, pilot.lotCode, step.key, draft, silent);
    if (!silent) toast.show({ title: "Saisie enregistrée", description: `Étape ${index + 1} — ${step.title}.` });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-xl border border-line p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold text-ink-900">
              Étape {index + 1} — {step.title}
            </h3>
            {step.status !== "En cours" && (
              <Badge tone={step.status === "Terminée" ? "success" : step.status === "En pause" ? "warn" : "neutral"} dot>
                {step.status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[15px] text-ink-600">{step.instruction}</p>
          <fieldset disabled={!editable} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Équipement" required htmlFor="st-equip">
              <Select id="st-equip" options={options.map((id) => ({ value: id, label: `${id}   ${state.resources.find((r) => r.id === id)?.label ?? draft.equipmentLabel}` }))} value={draft.equipment} onChange={(e) => set("equipment", e.target.value)} />
            </Field>
            <Field label="Mode opératoire" required htmlFor="st-mo" hint={`${pilot.mo.label} (Version ${pilot.mo.version.replace("v", "")})`}>
              <div className="flex gap-2">
                <Select id="st-mo" className="flex-1" options={[`${pilot.mo.code} ${pilot.mo.version}`]} value={`${pilot.mo.code} ${pilot.mo.version}`} onChange={() => {}} />
                <button
                  type="button"
                  aria-label="Voir le mode opératoire"
                  onClick={() => setMoOpen(true)}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line-strong text-ink-700 hover:bg-subtle"
                >
                  <FileText className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </Field>
            <Field label="Heure début" required htmlFor="st-start">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden />
                <input id="st-start" type="time" value={draft.start} onChange={(e) => set("start", e.target.value)} className={cn(controlClass, "h-11 pl-11 pr-3")} />
              </div>
            </Field>
            <Field label="Heure fin" required htmlFor="st-end" error={endInvalid ? "L'heure de fin doit suivre l'heure de début." : null}>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
                <input id="st-end" type="time" value={draft.end} onChange={(e) => set("end", e.target.value)} className={cn(controlClass, "h-11 pl-11 pr-3", endInvalid && "border-danger-500")} />
              </div>
            </Field>
            <Field label="Paramètres observés" htmlFor="st-params" className="md:col-span-2">
              <Textarea id="st-params" rows={2} placeholder={`Saisir les paramètres observés pendant l'étape (${step.title.toLowerCase()})…`} value={draft.parameters} onChange={(e) => set("parameters", e.target.value)} />
            </Field>
            <Field label="Observations" htmlFor="st-obs" className="md:col-span-2">
              <Textarea id="st-obs" rows={2} placeholder="Saisir des informations ou des observations…" value={draft.observations} onChange={(e) => set("observations", e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <p className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-ink-800">
                Preuve(s) de réalisation
                <Info className="h-4 w-4 text-ink-400" aria-label="Photos ou documents attestant la réalisation de l'étape" />
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line-strong px-4 py-5 text-sm text-ink-600 hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed"
              >
                <CloudUpload className="h-6 w-6 text-brand-600" aria-hidden />
                <span className="font-semibold text-brand-700">Ajouter une photo ou un document</span>
                <span>Glisser-déposer un fichier ici ou cliquer pour sélectionner</span>
                <span className="text-xs text-ink-500">Formats acceptés : JPG, PNG, PDF (max. 10 Mo)</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  const tooBig = files.filter((file) => file.size > 10 * 1024 * 1024);
                  const kept = files.filter((file) => file.size <= 10 * 1024 * 1024);
                  if (tooBig.length) toast.show({ title: "Fichier trop volumineux", description: `10 Mo maximum : ${tooBig.map((x) => x.name).join(", ")}`, tone: "warn" });
                  if (kept.length) set("proofs", [...draft.proofs, ...kept.map((file) => ({ name: file.name, size: formatFileSize(file.size) }))]);
                  e.target.value = "";
                }}
              />
              {draft.proofs.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {draft.proofs.map((p) => (
                    <li key={p.name} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                      <FileText className="h-4 w-4 text-ink-500" aria-hidden />
                      {p.name} <span className="text-ink-500">({p.size})</span>
                      {editable && (
                        <button type="button" aria-label={`Retirer ${p.name}`} onClick={() => set("proofs", draft.proofs.filter((x) => x.name !== p.name))} className="cursor-pointer text-ink-500 hover:text-danger-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line p-4">
            <h3 className="text-lg font-bold text-ink-900">Protocole de l&apos;étape</h3>
            <p className="mt-3 flex items-start gap-3 rounded-lg bg-brand-50 p-3 text-sm text-ink-700">
              <FileText className="h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
              Renseigner selon le mode opératoire approuvé.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-line p-4">
            <User className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
            <div className="text-sm">
              <p className="text-lg font-bold text-ink-900">Responsable de l&apos;étape</p>
              <p className="mt-1 font-medium text-ink-800">{step.owner}</p>
              <p className="text-ink-600">Réalise et enregistre l&apos;exécution de l&apos;étape.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-line p-4">
            <Clock className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
            <div className="text-sm">
              <p className="text-lg font-bold text-ink-900">Dernière sauvegarde</p>
              <p className="mt-1 text-ink-800">{pilot.lastSave ? formatDateTime(pilot.lastSave.at) : "—"}</p>
              {pilot.lastSave && <p className="font-medium text-ink-800">Par {pilot.lastSave.by}</p>}
            </div>
          </div>
        </div>
      </div>

      {editable && (
        <div className="mt-5 flex flex-wrap items-start gap-3">
          <Button
            variant="outline"
            size="lg"
            icon={step.status === "En pause" ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            onClick={() => {
              save(true);
              labActions.togglePauseStep(project.code, pilot.lotCode, step.key);
              toast.show({ title: step.status === "En pause" ? "Étape reprise" : "Étape mise en pause", description: step.title, tone: "info" });
            }}
          >
            {step.status === "En pause" ? "Reprendre" : "Pause"}
          </Button>
          <Button size="lg" icon={<Save className="h-5 w-5" />} onClick={() => save()}>
            Enregistrer
          </Button>
          <LinkButton
            href={`${base}/deviations?declarer=1`}
            variant="outline"
            size="lg"
            icon={<TriangleAlert className="h-5 w-5" />}
            onClick={() => save(true)}
          >
            Déclarer une déviation
          </LinkButton>
          <div className="ml-auto text-right">
            <Button
              size="lg"
              icon={<Check className="h-5 w-5" />}
              disabled={!draft.end || endInvalid || step.status === "En pause"}
              className="disabled:bg-slate-300"
              onClick={() => {
                labActions.saveStep(project.code, pilot.lotCode, step.key, draft, true);
                labActions.completeStep(project.code, pilot.lotCode, step.key);
                toast.show({
                  title: `Étape « ${step.title} » terminée`,
                  description: index + 1 < pilot.steps.length ? `Étape suivante : ${pilot.steps[index + 1].title}.` : "La fabrication du lot est terminée.",
                });
              }}
            >
              Terminer l&apos;étape
            </Button>
            <p className="mt-1 text-xs text-ink-500">
              {step.status === "En pause" ? "Reprenez l'étape pour pouvoir la terminer." : !draft.end ? "Renseigner l'heure de fin pour pouvoir terminer l'étape." : ""}
            </p>
          </div>
        </div>
      )}
      <MoModal pilot={pilot} open={moOpen} onClose={() => setMoOpen(false)} />
    </>
  );
}

export function LotExecutionView({ slug, lotSlug }: { slug: string; lotSlug: string }) {
  const state = useDemo();
  const { project, pilot } = findPilot(state, slug, lotSlug);
  const [selected, setSelected] = useState<string | null>(null);
  if (!project || !pilot) return null;

  if (pilot.status === "Préparation") {
    return (
      <>
        <Card className="mt-5">
          <EmptyState
            icon={Play}
            title="La fabrication n'a pas démarré"
            description="Démarrez le lot depuis l'onglet « Préparation » une fois toutes les conditions préalables remplies."
            action={<LinkButton href={`/projets/${project.slug}/lots/${pilot.lotCode.toLowerCase()}`}>Voir la préparation</LinkButton>}
          />
        </Card>
        <ScreenRef label="Lot pilote — exécution" />
      </>
    );
  }

  const active = pilot.steps.find((s) => s.status === "En cours" || s.status === "En pause") ?? pilot.steps.at(-1)!;
  const step = pilot.steps.find((s) => s.key === selected) ?? active;
  const index = pilot.steps.indexOf(step);

  return (
    <>
      <Card className="mt-5 p-5">
        <h2 className="text-2xl font-bold text-ink-900">Exécution du lot {pilot.lotCode}</h2>
        <p className="text-[15px] text-ink-600">Suivre les étapes de fabrication du lot pilote.</p>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <ol className="h-fit rounded-xl border border-line p-3">
            {pilot.steps.map((s, i) => {
              const style = STEP_STYLE[s.status];
              const current = s.key === step.key;
              return (
                <li key={s.key} className="relative">
                  {i < pilot.steps.length - 1 && (
                    <span className={cn("absolute left-[27px] top-12 h-[calc(100%-32px)] w-0.5", s.status === "Terminée" ? "bg-success-500" : "bg-line-strong")} aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelected(s.key)}
                    aria-current={current ? "step" : undefined}
                    className={cn("relative flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left", current ? "bg-brand-50" : "hover:bg-subtle")}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", style.circle)}>
                      {s.status === "Terminée" ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> : i + 1}
                    </span>
                    <span>
                      <span className="block font-semibold text-ink-900">{s.title}</span>
                      <span className={cn("block text-sm", style.text)}>{s.status === "Terminée" ? "Terminée" : s.status}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <StepForm key={`${step.key}-${step.status}`} project={project} pilot={pilot} step={step} index={index} />
        </div>
      </Card>
      <ScreenRef n={pilot.lotCode === "LP-01" ? 36 : undefined} label="Lot pilote — exécution du mélange" />
    </>
  );
}
