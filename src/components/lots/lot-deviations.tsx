"use client";

import { Ban, Box, ChevronRight, CircleAlert, FileText, FlaskConical, Folder, Image as ImageIcon, Info, Paperclip, Plus, Send, Settings, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select, Textarea, controlClass } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { MIXING_DEVIATION_EXAMPLE } from "@/lib/data-lab";
import { DEMO_TODAY, formatDateTime, formatFileSize } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { nextDeviationId } from "@/lib/lab";
import { getDemoState, labActions, useDemo } from "@/lib/store";
import type { DeviationDraft, PilotLot, Project, Tone } from "@/lib/types";
import { findPilot } from "./lot-frame";

const CATEGORIES = ["Équipement", "Procédé", "Matière", "Environnement", "Documentation"];
const CRITICALITY = ["À évaluer", "Mineure", "Majeure", "Critique"];
const INFORMED = ["Production", "Qualité", "Autre"];

export const DEVIATION_TONE: Record<string, Tone> = {
  Brouillon: "neutral",
  "Analyse en cours": "warn",
  "Actions en cours": "info",
  "Efficacité à vérifier": "info",
  Clôturée: "success",
};

function ContextItem({ icon: Icon, label, value, sub }: { icon: typeof Folder; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 bg-white p-3">
      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="text-xs text-ink-500">{label}</p>
        <p className="font-semibold text-ink-900">{value}</p>
        {sub && <p className="text-xs text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

function DeclareForm({ project, pilot, onCancel }: { project: Project; pilot: PilotLot; onCancel?: () => void }) {
  const router = useRouter();
  const go = useGuideNav();
  const guideCreate = useGuideTarget(39);
  const fileRef = useRef<HTMLInputElement>(null);
  const step = pilot.steps.find((s) => s.status === "En cours" || s.status === "En pause") ?? pilot.steps.find((s) => s.status !== "Terminée") ?? pilot.steps[0];
  const example = step.key === "melange" && pilot.status === "En fabrication";
  const initial: DeviationDraft = pilot.deviationDraft ?? {
    ...(example
      ? MIXING_DEVIATION_EXAMPLE
      : { title: "", category: "Équipement", criticality: "À évaluer", description: "", immediateAction: "", attachments: [], informed: ["Production", "Qualité"], securingAction: true }),
    observedAt: `${DEMO_TODAY}T09:15`,
  };
  const [draft, setDraft] = useState<DeviationDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof DeviationDraft>(key: K, value: DeviationDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const equipment = getDemoState().resources.find((r) => r.id === step.equipment);
  const errors = {
    title: draft.title.trim().length < 5 ? "Renseignez le titre de la déviation." : null,
    observedAt: !draft.observedAt ? "Indiquez la date et l'heure d'observation." : null,
    description: draft.description.trim().length < 10 ? "Décrivez l'écart constaté (10 caractères minimum)." : null,
    immediateAction: !draft.immediateAction.trim() ? "Indiquez la mesure immédiate prise." : null,
    informed: draft.informed.length === 0 ? "Sélectionnez au moins une personne informée." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);
  const impact: Record<string, { tone: "warn" | "danger" | "info"; title: string; detail: string }> = {
    "À évaluer": { tone: "warn", title: "Impact sur le lot à évaluer", detail: "Cette déviation doit être analysée pour déterminer son impact sur le lot." },
    Mineure: { tone: "info", title: "Impact mineur présumé", detail: "Sans effet attendu sur la qualité ; l'analyse le confirmera." },
    Majeure: { tone: "danger", title: "Impact majeur", detail: "Le lot est bloqué dans l'attente de l'analyse d'impact." },
    Critique: { tone: "danger", title: "Impact critique", detail: "Le lot est bloqué ; information immédiate du pharmacien responsable." },
  };
  const imp = impact[draft.criticality] ?? impact["À évaluer"];

  const create = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const id = nextDeviationId(getDemoState());
    labActions.createDeviation({
      ...draft,
      title: draft.title.trim(),
      projectCode: project.code,
      lotCode: pilot.lotCode,
      formula: pilot.formula,
      step: step.title,
      equipment: step.equipment,
      equipmentLabel: equipment?.label ?? step.equipmentLabel,
    });
    toast.show({ title: `Déviation créée • ${id}`, description: `La déviation ${id} a été créée avec succès.` });
    if (guideCreate) go(39);
    else router.push(`/projets/${project.slug}/deviations/${id.toLowerCase()}?onglet=actions`);
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="min-w-0 p-5">
        <h2 className="text-2xl font-bold text-ink-900">Déclarer une déviation</h2>
        <p className="text-[15px] text-ink-600">Signaler un écart constaté pendant la fabrication d&apos;un lot.</p>
        <div className="mt-4 rounded-xl border border-line p-3">
          <p className="mb-2 px-1 font-bold text-ink-900">Contexte</p>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-2 lg:grid-cols-4">
            <ContextItem icon={Folder} label="Projet" value={`${project.code} • ${project.name}`} sub={`${project.formLabel} | ${project.dosage}`} />
            <ContextItem icon={FlaskConical} label="Lot pilote" value={pilot.lotCode} sub={`Formule ${pilot.formula}`} />
            <ContextItem icon={Settings} label="Étape de fabrication" value={step.title} />
            <ContextItem icon={Box} label="Équipement" value={step.equipment} sub={equipment?.label ?? step.equipmentLabel} />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Titre de la déviation" required htmlFor="dv-title" error={show(errors.title)}>
            <Input id="dv-title" value={draft.title} invalid={Boolean(show(errors.title))} placeholder="Ex. Interruption imprévue du mélange" onChange={(e) => set("title", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <Field label="Date et heure d'observation" required htmlFor="dv-at" error={show(errors.observedAt)}>
              <input id="dv-at" type="datetime-local" value={draft.observedAt} onChange={(e) => set("observedAt", e.target.value)} className={cn(controlClass, "h-11 px-3.5")} />
            </Field>
            <Field label="Catégorie" required htmlFor="dv-cat">
              <Select id="dv-cat" options={CATEGORIES} value={draft.category} onChange={(e) => set("category", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <Field label="Description de la déviation" required htmlFor="dv-desc" error={show(errors.description)}>
              <Textarea id="dv-desc" rows={2} maxLength={1000} value={draft.description} invalid={Boolean(show(errors.description))} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Criticité" required htmlFor="dv-crit">
              <Select id="dv-crit" options={CRITICALITY} value={draft.criticality} onChange={(e) => set("criticality", e.target.value)} />
            </Field>
          </div>
          <Field label="Mesure immédiate prise" required htmlFor="dv-action" error={show(errors.immediateAction)}>
            <Textarea id="dv-action" rows={2} maxLength={500} value={draft.immediateAction} invalid={Boolean(show(errors.immediateAction))} onChange={(e) => set("immediateAction", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                  Pièces jointes
                  <Info className="h-4 w-4 text-ink-400" aria-label="Photos, extraits de journal ou tout élément de preuve" />
                </p>
                <Button variant="outline" size="sm" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                  Ajouter un document
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) set("attachments", [...draft.attachments, ...files.map((file) => ({ name: file.name, kind: file.type.startsWith("image/") ? ("Image" as const) : ("Document" as const), size: formatFileSize(file.size) }))]);
                    e.target.value = "";
                  }}
                />
              </div>
              {draft.attachments.length === 0 ? (
                <p className="mt-2 text-sm text-ink-500">Aucune pièce jointe.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {draft.attachments.map((a) => (
                    <li key={a.name} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                      {a.kind === "Image" ? <ImageIcon className="h-5 w-5 text-ink-600" aria-hidden /> : <FileText className="h-5 w-5 text-ink-600" aria-hidden />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">{a.name}</span>
                        <span className="block text-xs text-ink-500">
                          {a.kind} | {a.size}
                        </span>
                      </span>
                      <button type="button" aria-label={`Retirer ${a.name}`} onClick={() => set("attachments", draft.attachments.filter((x) => x.name !== a.name))} className="cursor-pointer text-ink-500 hover:text-danger-600">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-line p-3">
              <p className="font-semibold text-ink-900">
                Personnes informées <span className="text-danger-600">*</span>
              </p>
              <div className="mt-2 space-y-2">
                {INFORMED.map((p) => (
                  <Checkbox
                    key={p}
                    checked={draft.informed.includes(p)}
                    onChange={(checked) => set("informed", checked ? [...draft.informed, p] : draft.informed.filter((x) => x !== p))}
                    label={p}
                  />
                ))}
              </div>
              {show(errors.informed) && <p className="mt-2 text-sm text-danger-600">{errors.informed}</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button
            variant="outline"
            size="lg"
            icon={<FileText className="h-5 w-5" />}
            onClick={() => {
              labActions.saveDeviationDraft(project.code, pilot.lotCode, draft);
              toast.show({ title: "Brouillon enregistré", description: "La déviation n'est pas encore créée." });
            }}
          >
            Enregistrer le brouillon
          </Button>
          {onCancel && (
            <Button variant="ghost" size="lg" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button size="lg" className="ml-auto" icon={<Send className="h-5 w-5" />} onClick={create} guide={39}>
            Créer la déviation
          </Button>
        </div>
      </Card>

      <Card className="h-fit p-5">
        <h2 className="text-xl font-bold text-ink-900">Impact sur le lot</h2>
        <div
          className={cn(
            "mt-4 flex items-start gap-3 rounded-xl p-4",
            imp.tone === "warn" ? "bg-warn-50" : imp.tone === "danger" ? "bg-danger-50" : "bg-brand-50",
          )}
        >
          <CircleAlert className={cn("h-7 w-7 shrink-0 text-white", imp.tone === "warn" ? "fill-warn-500" : imp.tone === "danger" ? "fill-danger-500" : "fill-brand-600")} aria-hidden />
          <div>
            <p className={cn("font-bold", imp.tone === "warn" ? "text-warn-700" : imp.tone === "danger" ? "text-danger-700" : "text-brand-700")}>{imp.title}</p>
            <p className="text-sm text-ink-700">{imp.detail}</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-line p-4 text-sm">
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" aria-hidden />
          <div>
            <p className="font-bold text-ink-900">Libération du lot</p>
            <p className="text-ink-700">Pas de libération automatique</p>
            <p className="text-ink-600">La libération du lot sera décidée après analyse de la déviation et mise en œuvre des actions éventuelles.</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-line p-4 text-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" aria-hidden />
          <div>
            <p className="font-bold text-ink-900">Conséquences potentielles</p>
            <p className="text-ink-600">L&apos;évaluation de l&apos;impact sur la qualité du lot sera réalisée lors de l&apos;analyse de la déviation.</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-subtle p-4">
          <Checkbox
            checked={draft.securingAction}
            onChange={(v) => set("securingAction", v)}
            label={<span className="font-bold">Créer une action de sécurisation</span>}
            description="Une action de sécurisation sera créée après enregistrement de la déviation."
          />
        </div>
      </Card>
    </div>
  );
}

export function LotDeviationsView({ slug, lotSlug, declare }: { slug: string; lotSlug: string; declare: boolean }) {
  const state = useDemo();
  const { project, pilot } = findPilot(state, slug, lotSlug);
  const [formOpen, setFormOpen] = useState(declare);
  if (!project || !pilot) return null;
  const deviations = state.deviations.filter((d) => d.projectCode === project.code && d.lotCode === pilot.lotCode);
  const showForm = formOpen || deviations.length === 0;

  let body: ReactNode;
  if (showForm) {
    body = <DeclareForm key={pilot.deviationDraft ? "draft" : "new"} project={project} pilot={pilot} onCancel={deviations.length ? () => setFormOpen(false) : undefined} />;
  } else {
    body = (
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink-900">Déviations du lot {pilot.lotCode}</h2>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
            Déclarer une déviation
          </Button>
        </div>
        {deviations.length === 0 ? (
          <EmptyState icon={TriangleAlert} title="Aucune déviation" />
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {deviations.map((d) => (
              <li key={d.id}>
                <Link href={`/projets/${project.slug}/deviations/${d.id.toLowerCase()}`} className="group flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-subtle">
                  <TriangleAlert className="h-6 w-6 text-warn-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink-900">
                      {d.id} • {d.title}
                    </span>
                    <span className="block text-sm text-ink-500">
                      Étape {d.step} — {d.equipment} • déclarée le {formatDateTime(d.createdAt)}
                    </span>
                  </span>
                  <Badge tone={DEVIATION_TONE[d.status]} dot size="md">
                    {d.status}
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-ink-500 group-hover:text-brand-700" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  return (
    <>
      {body}
      {showForm ? <ScreenRef n={pilot.lotCode === "LP-01" ? 38 : undefined} label="Déclarer une déviation de lot" /> : <ScreenRef label="Déviations du lot" />}
    </>
  );
}
