"use client";

import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  FileText,
  FlaskConical,
  Folder,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Plus,
  Save,
  Settings,
  TriangleAlert,
  User,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DEVIATION_TONE } from "@/components/lots/lot-deviations";
import { ACTIONS_TRIGGER_CLASS, MetaLine, actionsTrigger } from "@/components/project-context-header";
import { EVENT_ICONS } from "@/components/project/project-overview";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, addDays, formatDateTime, formatNumeric } from "@/lib/format";
import { nextActionId } from "@/lib/lab";
import { findProject } from "@/lib/selectors";
import { labActions, useDemo } from "@/lib/store";
import type { Deviation, DeviationAction, Project } from "@/lib/types";

export type DeviationTab = "constat" | "analyse" | "actions" | "efficacite" | "historique";

const OWNERS = ["Service Maintenance", "Assurance qualité", "Production", "Pharmacien responsable", "Chef de projet"];
const CATEGORIES = ["Maintenance", "Qualité", "Production", "Formation", "Documentation"];
const STATUSES: DeviationAction["status"][] = ["À faire", "En cours", "Terminée"];
const CAUSES = ["Équipement", "Méthode", "Matière", "Main-d'œuvre", "Milieu"];
const IMPACTS = ["À évaluer", "Aucun impact", "Impact mineur", "Impact majeur"];

const ACTION_TONE: Record<DeviationAction["status"], "info" | "neutral" | "success"> = { "En cours": "info", "À faire": "neutral", Terminée: "success" };

function ProgressPanel({ deviation }: { deviation: Deviation }) {
  const analysisDone = Boolean(deviation.analysis.doneAt);
  const actionsDone = deviation.actions.length > 0 && deviation.actions.every((a) => a.status === "Terminée");
  const steps = [
    { title: "Constat enregistré", detail: "", done: true, current: false, date: deviation.createdAt },
    { title: analysisDone ? "Analyse terminée" : "Analyse en cours", detail: "Identification des causes et évaluation initiale", done: analysisDone, current: !analysisDone, date: deviation.analysis.doneAt ?? deviation.createdAt },
    { title: "Actions à réaliser", detail: "Mise en œuvre des actions correctives", done: actionsDone, current: analysisDone && !actionsDone, date: undefined },
    { title: "Efficacité à vérifier", detail: "Vérification de l'efficacité des actions", done: Boolean(deviation.effectivenessAt), current: actionsDone && !deviation.effectivenessAt, date: deviation.effectivenessAt },
  ];
  return (
    <ol className="rounded-xl border border-line p-3">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-line-strong" aria-hidden />}
          {s.done ? (
            <CircleCheck className="relative h-8 w-8 shrink-0 fill-success-500 text-white" aria-hidden />
          ) : (
            <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", s.current ? "bg-white text-brand-700 ring-2 ring-brand-500" : "bg-slate-400 text-white")}>
              {i + 1}
            </span>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex items-start justify-between gap-2 font-semibold text-ink-900">
              {s.title}
              {s.date && <span className="shrink-0 font-normal text-ink-600">{formatNumeric(s.date)}</span>}
            </p>
            {s.detail && <p className="text-ink-500">{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActionForm({ deviation, action, onCancel }: { deviation: Deviation; action: DeviationAction; onCancel: () => void }) {
  const [draft, setDraft] = useState(action);
  const [newStep, setNewStep] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof DeviationAction>(key: K, value: DeviationAction[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const errors = {
    title: draft.title.trim().length < 3 ? "Renseignez le titre." : null,
    description: draft.description.trim().length < 10 ? "Décrivez l'action (10 caractères minimum)." : null,
    due: !draft.due ? "Indiquez une échéance." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);
  const closed = deviation.status === "Clôturée";

  return (
    <Card className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-ink-900">Détails de l&apos;action</h2>
        <button type="button" aria-label="Fermer le détail" onClick={onCancel} className="cursor-pointer rounded p-1 text-ink-500 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <fieldset disabled={closed} className="mt-4 space-y-4">
        <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
          <span className="text-sm text-ink-700">Identifiant</span>
          <Input value={draft.id} readOnly className="w-28 bg-subtle" aria-label="Identifiant" />
          <span className="text-sm text-ink-700">
            Titre <span className="text-danger-600">*</span>
          </span>
          <div>
            <Input aria-label="Titre de l'action" value={draft.title} invalid={Boolean(show(errors.title))} onChange={(e) => set("title", e.target.value)} />
            {show(errors.title) && <p className="mt-1 text-sm text-danger-600">{errors.title}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Responsable" required htmlFor="ac-owner">
            <Select id="ac-owner" icon={User} options={[...new Set([draft.owner, ...OWNERS])]} value={draft.owner} onChange={(e) => set("owner", e.target.value)} />
          </Field>
          <Field label="Catégorie" required htmlFor="ac-cat">
            <Select id="ac-cat" icon={Wrench} options={[...new Set([draft.category, ...CATEGORIES])]} value={draft.category} onChange={(e) => set("category", e.target.value)} />
          </Field>
          <Field label="Statut" required htmlFor="ac-status">
            <Select id="ac-status" options={STATUSES} value={draft.status} onChange={(e) => set("status", e.target.value as DeviationAction["status"])} />
          </Field>
          <Field label="Échéance" required htmlFor="ac-due" error={show(errors.due)}>
            <DateInput id="ac-due" value={draft.due} onChange={(v) => set("due", v)} invalid={Boolean(show(errors.due))} />
          </Field>
        </div>
        <Field label="Description / Instruction" required htmlFor="ac-desc" error={show(errors.description)}>
          <Textarea id="ac-desc" rows={3} maxLength={1000} value={draft.description} invalid={Boolean(show(errors.description))} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">Étapes de réalisation</p>
          <ol className="space-y-2 rounded-xl border border-line p-3">
            {draft.steps.map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-400 text-xs font-semibold text-white">{i + 1}</span>
                <span className="flex-1 text-ink-800">{s}</span>
                {!closed && (
                  <button type="button" aria-label={`Supprimer l'étape ${i + 1}`} onClick={() => set("steps", draft.steps.filter((_, j) => j !== i))} className="cursor-pointer text-ink-400 hover:text-danger-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
            {addingStep ? (
              <li className="flex gap-2">
                <Input aria-label="Nouvelle étape" value={newStep} onChange={(e) => setNewStep(e.target.value)} className="h-9 flex-1 text-sm" />
                <Button
                  size="sm"
                  disabled={!newStep.trim()}
                  onClick={() => {
                    set("steps", [...draft.steps, newStep.trim()]);
                    setNewStep("");
                    setAddingStep(false);
                  }}
                >
                  Ajouter
                </Button>
              </li>
            ) : (
              !closed && (
                <li>
                  <button type="button" onClick={() => setAddingStep(true)} className="flex cursor-pointer items-center gap-2 pl-1 text-sm font-medium text-brand-700 hover:underline">
                    <Plus className="h-4 w-4" aria-hidden />
                    Ajouter une étape
                  </button>
                </li>
              )
            )}
          </ol>
        </div>
        <Field label="Preuves attendues" htmlFor="ac-proofs">
          <Textarea id="ac-proofs" rows={2} maxLength={1000} value={draft.proofs} onChange={(e) => set("proofs", e.target.value)} />
        </Field>
      </fieldset>
      {!closed && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            size="lg"
            icon={<Save className="h-5 w-5" />}
            onClick={() => {
              setSubmitted(true);
              if (Object.values(errors).some(Boolean)) return;
              labActions.saveDeviationAction(deviation.id, { ...draft, title: draft.title.trim(), description: draft.description.trim() });
              toast.show({ title: `Action ${draft.id} enregistrée`, description: `${draft.title.trim()} — ${draft.status.toLowerCase()}.` });
            }}
          >
            Enregistrer l&apos;action
          </Button>
        </div>
      )}
    </Card>
  );
}

function ActionsTab({ deviation }: { deviation: Deviation }) {
  const [selectedId, setSelectedId] = useState<string | null>(deviation.actions[0]?.id ?? null);
  const [creating, setCreating] = useState<DeviationAction | null>(null);
  const current = creating ?? deviation.actions.find((a) => a.id === selectedId);
  const closed = deviation.status === "Clôturée";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Card className="h-fit p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink-900">Actions à réaliser ({deviation.actions.filter((a) => a.status !== "Terminée").length})</h2>
          {!closed && (
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                setCreating({
                  id: nextActionId(deviation),
                  title: "",
                  owner: "Production",
                  category: "Production",
                  group: "Production",
                  status: "À faire",
                  due: addDays(DEMO_TODAY, 7),
                  description: "",
                  steps: [],
                  proofs: "",
                })
              }
            >
              Ajouter une action
            </Button>
          )}
        </div>
        <ul className="mt-3 space-y-2">
          {deviation.actions.map((a) => {
            const active = !creating && a.id === current?.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(null);
                    setSelectedId(a.id);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left",
                    active ? "border-brand-400 bg-brand-50/60" : "border-line hover:border-brand-200",
                  )}
                >
                  <span className={cn("mt-0.5 h-5 w-5 shrink-0 rounded-full border-2", a.status === "Terminée" ? "border-success-500 bg-success-500" : "border-line-strong")} aria-hidden />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-bold text-ink-900">{a.id}</span>
                    <span className="block font-semibold text-ink-900">{a.title}</span>
                    <span className="block text-ink-500">{a.group}</span>
                  </span>
                  <Badge tone={ACTION_TONE[a.status]} dot>
                    {a.status}
                  </Badge>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-ink-500" aria-hidden />
                </button>
              </li>
            );
          })}
          {creating && (
            <li className="rounded-xl border border-dashed border-brand-300 px-3 py-3 text-sm text-brand-700">
              {creating.id} — nouvelle action en cours de saisie
            </li>
          )}
        </ul>
      </Card>
      {current ? (
        <ActionForm
          key={`${current.id}-${creating ? "new" : "edit"}-${JSON.stringify(deviation.actions.find((a) => a.id === current.id) ?? {})}`}
          deviation={deviation}
          action={current}
          onCancel={() => {
            setCreating(null);
            setSelectedId(null);
          }}
        />
      ) : (
        <Card>
          <EmptyState icon={Wrench} title="Sélectionnez une action" description="Choisissez une action à gauche ou ajoutez-en une." />
        </Card>
      )}
    </div>
  );
}

function AnalysisTab({ deviation }: { deviation: Deviation }) {
  const [cause, setCause] = useState(deviation.analysis.cause || deviation.category);
  const [rootCause, setRootCause] = useState(deviation.analysis.rootCause);
  const [impact, setImpact] = useState(deviation.analysis.impact);
  const done = Boolean(deviation.analysis.doneAt);
  const save = (complete: boolean) => {
    labActions.saveDeviationAnalysis(deviation.id, { cause, rootCause: rootCause.trim(), impact }, complete);
    toast.show({ title: complete ? "Analyse terminée" : "Analyse enregistrée", description: complete ? "Les actions correctives peuvent être mises en œuvre." : undefined });
  };
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink-900">Analyse de la déviation</h2>
      <fieldset disabled={deviation.status === "Clôturée"} className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Famille de cause (5M)" htmlFor="an-cause">
            <Select id="an-cause" options={[...new Set([cause, ...CAUSES])]} value={cause} onChange={(e) => setCause(e.target.value)} />
          </Field>
          <Field label="Impact sur le lot" htmlFor="an-impact">
            <Select id="an-impact" options={IMPACTS} value={impact} onChange={(e) => setImpact(e.target.value)} />
          </Field>
        </div>
        <Field label="Analyse des causes" htmlFor="an-root" hint="Décrire la cause racine identifiée (méthode des 5 pourquoi, Ishikawa…).">
          <Textarea id="an-root" rows={4} maxLength={1000} value={rootCause} placeholder="Ex. Surchauffe du moteur liée à un défaut de ventilation du mélangeur." onChange={(e) => setRootCause(e.target.value)} />
        </Field>
      </fieldset>
      {deviation.status !== "Clôturée" && (
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="outline" icon={<Save className="h-4 w-4" />} onClick={() => save(false)}>
            Enregistrer
          </Button>
          {!done && (
            <Button icon={<Check className="h-4 w-4" />} disabled={rootCause.trim().length < 10 || impact === "À évaluer"} onClick={() => save(true)}>
              Terminer l&apos;analyse
            </Button>
          )}
        </div>
      )}
      {!done && (rootCause.trim().length < 10 || impact === "À évaluer") && (
        <p className="mt-2 text-right text-xs text-ink-500">Renseigner l&apos;analyse des causes et l&apos;impact pour terminer l&apos;analyse.</p>
      )}
    </Card>
  );
}

function EffectivenessTab({ deviation }: { deviation: Deviation }) {
  const pending = deviation.actions.filter((a) => a.status !== "Terminée");
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink-900">Vérification de l&apos;efficacité</h2>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {deviation.actions.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="font-bold text-ink-900">{a.id}</span>
            <span className="flex-1 text-ink-800">{a.title}</span>
            <Badge tone={ACTION_TONE[a.status]} dot>
              {a.status}
            </Badge>
            {a.effective && <Badge tone="success">Efficace</Badge>}
          </li>
        ))}
      </ul>
      {deviation.effectivenessAt ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
          <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
          Efficacité vérifiée le {formatDateTime(deviation.effectivenessAt)}.
        </p>
      ) : pending.length ? (
        <p className="mt-4 rounded-lg bg-subtle px-4 py-3 text-sm text-ink-600">
          {pending.length} action(s) à terminer avant de pouvoir vérifier leur efficacité ({pending.map((a) => a.id).join(", ")}).
        </p>
      ) : (
        <Button
          className="mt-4"
          icon={<Check className="h-4 w-4" />}
          onClick={() => {
            labActions.verifyEffectiveness(deviation.id);
            toast.show({ title: "Efficacité vérifiée", description: "La déviation peut être clôturée." });
          }}
        >
          Confirmer l&apos;efficacité des actions
        </Button>
      )}
    </Card>
  );
}

function ReportTab({ deviation }: { deviation: Deviation }) {
  const rows: [string, ReactNode][] = [
    ["Titre", deviation.title],
    ["Observée le", formatDateTime(deviation.observedAt)],
    ["Catégorie", deviation.category],
    ["Criticité", deviation.criticality],
    ["Description", deviation.description],
    ["Mesure immédiate", deviation.immediateAction],
    ["Personnes informées", deviation.informed.join(", ")],
    ["Action de sécurisation", deviation.securingAction ? "Oui" : "Non"],
  ];
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink-900">Constat</h2>
      <dl className="mt-3 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 gap-1 py-2.5 text-sm sm:grid-cols-[200px_minmax(0,1fr)]">
            <dt className="text-ink-600">{k}</dt>
            <dd className="text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 font-bold text-ink-900">Pièces jointes</h3>
      <ul className="mt-2 space-y-2">
        {deviation.attachments.map((a) => (
          <li key={a.name} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
            {a.kind === "Image" ? <ImageIcon className="h-5 w-5 text-ink-600" aria-hidden /> : <FileText className="h-5 w-5 text-ink-600" aria-hidden />}
            <span className="flex-1 text-ink-900">{a.name}</span>
            <span className="text-ink-500">
              {a.kind} | {a.size}
            </span>
          </li>
        ))}
        {deviation.attachments.length === 0 && <li className="text-sm text-ink-500">Aucune pièce jointe.</li>}
      </ul>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[22px_110px_minmax(0,1fr)] items-start gap-2 py-1.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 text-ink-600" strokeWidth={1.6} aria-hidden />
      <span className="text-ink-600">{label}</span>
      <span className="text-ink-900">{children}</span>
    </div>
  );
}

export function DeviationView({ slug, id, initialTab }: { slug: string; id: string; initialTab: DeviationTab }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const deviation = project ? state.deviations.find((d) => d.projectCode === project.code && d.id.toLowerCase() === id.toLowerCase()) : undefined;
  const [tab, setTab] = useState<DeviationTab>(initialTab);

  if (!project || !deviation) {
    return (
      <>
        <Card className="mt-4">
          <EmptyState
            icon={TriangleAlert}
            title="Déviation introuvable"
            description={`La déviation ${id.toUpperCase()} n'a pas encore été déclarée. Déclarez-la depuis l'onglet « Déviations » du lot pilote.`}
            action={<LinkButton href={`/projets/${slug}/lots/lp-01/deviations?declarer=1`}>Déclarer une déviation</LinkButton>}
          />
        </Card>
        <ScreenRef label="Déviation" />
      </>
    );
  }

  const events = state.history.filter((h) => h.deviationId === deviation.id).sort((a, b) => b.at.localeCompare(a.at));
  const canClose = Boolean(deviation.effectivenessAt) && deviation.status !== "Clôturée";

  return (
    <>
      <DeviationHeader project={project} deviation={deviation} />
      <Tabs
        className="mt-4"
        items={[
          { value: "constat", label: "Constat" },
          { value: "analyse", label: "Analyse" },
          { value: "actions", label: "Actions" },
          { value: "efficacite", label: "Efficacité" },
          { value: "historique", label: "Historique", count: events.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {tab === "constat" && <ReportTab deviation={deviation} />}
          {tab === "analyse" && <AnalysisTab key={deviation.analysis.doneAt ?? "a"} deviation={deviation} />}
          {tab === "actions" && <ActionsTab deviation={deviation} />}
          {tab === "efficacite" && <EffectivenessTab deviation={deviation} />}
          {tab === "historique" && (
            <Card className="p-5">
              <ol className="space-y-3">
                {events.map((e) => {
                  const Icon = EVENT_ICONS[e.icon];
                  return (
                    <li key={e.id} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
                      <Icon className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
                      <span className="flex-1">
                        <span className="block font-semibold text-ink-900">{e.title}</span>
                        <span className="block text-ink-600">{e.description}</span>
                        <span className="block text-xs text-ink-500">
                          {formatDateTime(e.at)} — {e.author}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Avancement de la déviation</h2>
            <div className="mt-3">
              <ProgressPanel deviation={deviation} />
            </div>
            <div className={cn("mt-4 rounded-xl p-4", canClose ? "bg-success-50" : "bg-slate-100")}>
              <p className="flex items-center gap-3 font-bold text-ink-900">
                {canClose ? <LockOpen className="h-6 w-6 text-success-600" aria-hidden /> : <Lock className="h-6 w-6 text-ink-600" aria-hidden />}
                {deviation.status === "Clôturée" ? "Déviation clôturée" : "Clôturer la déviation"}
              </p>
              <p className="mt-1 text-sm text-ink-600">
                {deviation.status === "Clôturée"
                  ? `Clôturée le ${formatDateTime(deviation.closedAt ?? deviation.createdAt)}.`
                  : canClose
                    ? "L'efficacité des actions est vérifiée : la déviation peut être clôturée."
                    : "La déviation ne peut pas être clôturée tant que l'efficacité des actions n'a pas été vérifiée."}
              </p>
              {deviation.status !== "Clôturée" && (
                <Button
                  className="mt-3 w-full disabled:bg-slate-300"
                  disabled={!canClose}
                  onClick={() => {
                    labActions.closeDeviation(deviation.id);
                    toast.show({ title: `${deviation.id} clôturée` });
                  }}
                >
                  Clôturer la déviation
                </Button>
              )}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Informations</h2>
            <div className="mt-2 divide-y divide-line">
              <InfoRow icon={Folder} label="Projet">
                {project.code} • {project.name}
              </InfoRow>
              <InfoRow icon={FlaskConical} label="Lot pilote">
                <Link href={`/projets/${project.slug}/lots/${deviation.lotCode.toLowerCase()}`} className="text-brand-700 hover:underline">
                  {deviation.lotCode}
                </Link>
              </InfoRow>
              <InfoRow icon={Settings} label="Étape">
                {deviation.equipment} • {deviation.step}
              </InfoRow>
              <InfoRow icon={FileText} label="Formule">
                {deviation.formula} <span className="ml-2">{project.dosage}</span>
              </InfoRow>
              <InfoRow icon={CalendarDays} label="Date de création">
                {formatNumeric(deviation.createdAt)}
              </InfoRow>
              <InfoRow icon={User} label="Créé par">
                {deviation.createdBy}
              </InfoRow>
              <InfoRow icon={FileText} label="Description">
                {deviation.description}
              </InfoRow>
            </div>
          </Card>
        </div>
      </div>
      <ScreenRef n={deviation.id === "DEV-01" ? 39 : undefined} label="Déviation — actions et efficacité" />
    </>
  );
}

function DeviationHeader({ project, deviation }: { project: Project; deviation: Deviation }) {
  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink-900 sm:text-[36px]">
            {deviation.id} <span className="text-ink-400">•</span> {deviation.title}
          </h1>
          <Badge tone={DEVIATION_TONE[deviation.status]} dot size="md" className="rounded-full px-3">
            {deviation.status}
          </Badge>
        </div>
        <MetaLine
          className="mt-1"
          items={[
            <span key="p">
              Projet : <strong className="text-ink-800">{project.code} • {project.name}</strong>
            </span>,
            <span key="l">
              Lot pilote : <strong className="text-ink-800">{deviation.lotCode}</strong>
            </span>,
            <span key="s">
              Étape : <strong className="text-ink-800">{deviation.equipment} • {deviation.step}</strong>
            </span>,
            <span key="f">
              Formule : <strong className="text-ink-800">{deviation.formula}</strong>
            </span>,
            project.dosage,
          ]}
        />
      </div>
      <Menu
        label="Actions projet"
        widthClass="w-72"
        triggerClassName={ACTIONS_TRIGGER_CLASS}
        trigger={actionsTrigger("Actions projet")}
        items={[
          { label: `Lot pilote ${deviation.lotCode}`, icon: FlaskConical, href: `/projets/${project.slug}/lots/${deviation.lotCode.toLowerCase()}` },
          { label: "Exécution du lot", icon: Settings, href: `/projets/${project.slug}/lots/${deviation.lotCode.toLowerCase()}/execution` },
          { label: "Toutes les déviations", icon: TriangleAlert, href: `/projets/${project.slug}/deviations` },
          { label: "Fiche projet", icon: Folder, href: `/projets/${project.slug}` },
        ]}
      />
    </div>
  );
}
