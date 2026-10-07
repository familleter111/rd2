"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  CircleCheck,
  Clock,
  EllipsisVertical,
  FileText,
  Info,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Save,
  Send,
  Thermometer,
  Trash2,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { MetaLine, ACTIONS_TRIGGER_CLASS, actionsTrigger } from "@/components/project-context-header";
import { EVENT_ICONS } from "@/components/project/project-overview";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, DateInput, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Breadcrumb, ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { PEOPLE_LAB, STORAGE_CONDITIONS } from "@/lib/data-lab";
import { buildPdf, downloadBlob } from "@/lib/export-files";
import { DEMO_TODAY, addMonths, formatDateTime, formatFileSize, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { stabilitySpec } from "@/lib/lab";
import { labActions, useDemo } from "@/lib/store";
import type { StabilityMilestone, StabilityProtocol, StabilityResult, StabilityResultStatus, StabilityStudy } from "@/lib/types";
import { useTeamNames } from "@/lib/people";

export type StudyTab = "protocole" | "echeancier" | "resultats" | "documents" | "historique";

const PACKAGING = ["Blister de démonstration", "Flacon PEHD", "Flacon verre type I", "Tube aluminium"];
const DEMO_RESPONSIBLES = [PEOPLE_LAB.julie.name, PEOPLE_LAB.marie.name, PEOPLE_LAB.sophie.name, PEOPLE_LAB.thomas.name];
const EXTRA_MILESTONES: [string, number][] = [
  ["M1", 1],
  ["M9", 9],
  ["M18", 18],
  ["M24", 24],
  ["M36", 36],
];
const UNITS = ["%", "mg/g", "mg", "min"];
const SOURCES = ["Analyse interne — HPLC-01", "Analyse interne — UV-01", "Laboratoire de contrôle qualité", "Laboratoire externe"];

/** "25 °C / 60 % HR (long terme)" → "25 °C / 60 % HR". */
const shortStorage = (s: string) => s.replace(/\s*\(.*\)$/, "");
/** "M-01 • Dosage PA" → "Dosage PA". */
const analysisName = (method: string, fallback: string) => method.split(" • ")[1] ?? fallback;

const MILESTONE_TONE: Record<StabilityMilestone["status"], "info" | "success" | "neutral"> = { "À planifier": "info", Planifiée: "info", Réalisée: "success" };

/* ------------------------------------------------------------------ */
/* Protocol (screen 41)                                                */
/* ------------------------------------------------------------------ */

function ProtocolForm({ study, protocol, onSchedule }: { study: StabilityStudy; protocol: StabilityProtocol; onSchedule: () => void }) {
  const RESPONSIBLES = useTeamNames(DEMO_RESPONSIBLES);
  const state = useDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(protocol);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const editable = protocol.status === "Brouillon";
  const set = <K extends keyof StabilityProtocol>(key: K, value: StabilityProtocol[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const project = state.projects.find((p) => p.code === study.projectCode);
  const formulas = [...new Set(state.lots.filter((l) => l.projectCode === study.projectCode).map((l) => l.formula))];
  const lots = state.lots.filter((l) => l.projectCode === study.projectCode);
  const allTests = draft.tests.every((t) => t.selected);
  const missingStorage = !draft.storage;
  const noTests = !draft.tests.some((t) => t.selected);
  const used = new Set(draft.milestones.map((m) => m.code));

  const save = (silent = false) => labActions.saveStudyProtocol(study.id, draft, silent);

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Informations générales</h2>
            <fieldset disabled={!editable} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Projet" required htmlFor="sp-project">
                <Select id="sp-project" options={[{ value: study.projectCode, label: project ? `${project.code} • ${project.name}` : study.projectCode }]} value={study.projectCode} disabled />
              </Field>
              <Field label="Responsable" required htmlFor="sp-owner">
                <Select id="sp-owner" icon={User} options={[...new Set([draft.responsible, ...RESPONSIBLES])]} value={draft.responsible} onChange={(e) => set("responsible", e.target.value)} />
              </Field>
              <Field label="Formule" required htmlFor="sp-formula">
                <Select id="sp-formula" options={formulas} value={draft.formula} onChange={(e) => set("formula", e.target.value)} />
              </Field>
              <Field label="Date de mise en stabilité" required htmlFor="sp-date" hint={draft.startDate ? `T0 le ${formatNumeric(draft.startDate)}` : "À planifier — peut être fixée après soumission."}>
                <DateInput id="sp-date" value={draft.startDate} onChange={(v) => set("startDate", v)} onClear={() => set("startDate", "")} />
              </Field>
              <Field label={study.lotLabel.includes("pilote") ? "Lot pilote" : "Lot"} required htmlFor="sp-lot">
                <Select id="sp-lot" options={lots.map((l) => l.code)} value={draft.lot} onChange={(e) => set("lot", e.target.value)} />
              </Field>
              <Field
                label="Condition de stockage"
                required
                htmlFor="sp-storage"
                info="Condition ICH de conservation des échantillons (température / humidité relative)."
                error={missingStorage && editable ? "À définir avant la soumission." : null}
              >
                <Select id="sp-storage" placeholder="À définir" options={STORAGE_CONDITIONS} value={draft.storage} invalid={missingStorage} onChange={(e) => set("storage", e.target.value)} />
              </Field>
              <div className="hidden md:block" />
              <Field label="Conditionnement" required htmlFor="sp-pack">
                <Select id="sp-pack" options={[...new Set([draft.packaging, ...PACKAGING])]} value={draft.packaging} onChange={(e) => set("packaging", e.target.value)} />
              </Field>
            </fieldset>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-ink-900">
                Essais à réaliser
                <Info className="h-4 w-4 text-ink-400" aria-label="Essais réalisés à chaque échéance du protocole" />
              </h2>
              <button type="button" onClick={() => setConditionsOpen(true)} className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
                Conditions et fréquence selon le protocole approuvé
              </button>
            </div>
            <div className="relative mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="bg-subtle text-ink-700">
                    <th className="w-12 px-4 py-3">
                      <Checkbox checked={allTests} disabled={!editable} onChange={(v) => set("tests", draft.tests.map((t) => ({ ...t, selected: v })))} label={<span className="sr-only">Tout sélectionner</span>} />
                    </th>
                    <th className="px-4 py-3 font-semibold">Essai</th>
                    <th className="px-4 py-3 font-semibold">Méthode</th>
                    <th className="px-4 py-3 font-semibold">Équipement</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {draft.tests.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={t.selected}
                          disabled={!editable}
                          onChange={(v) => set("tests", draft.tests.map((x) => (x.id === t.id ? { ...x, selected: v } : x)))}
                          label={<span className="sr-only">{t.name}</span>}
                        />
                      </td>
                      <td className="px-4 py-3 text-ink-900">{t.name}</td>
                      <td className="px-4 py-3 text-ink-800">{t.method}</td>
                      <td className="px-4 py-3 font-medium text-ink-900">{t.equipment}</td>
                      <td className="px-4 py-3 text-ink-700">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {noTests && <p className="mt-2 text-sm text-danger-600">Sélectionnez au moins un essai.</p>}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-ink-900">Échéances de suivi</h2>
              {editable && (
                <Menu
                  label="Ajouter une échéance"
                  widthClass="w-56"
                  triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-brand-300 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  trigger={
                    <>
                      <Plus className="h-4 w-4" aria-hidden />
                      Ajouter une échéance
                    </>
                  }
                  items={EXTRA_MILESTONES.filter(([code]) => !used.has(code)).map(([code, months]) => ({
                    label: code,
                    description: `${months} mois après la mise en stabilité`,
                    onSelect: () =>
                      set(
                        "milestones",
                        [...draft.milestones, { id: `ms-${code}`, code, months, status: "À planifier" as const }].sort((a, b) => a.months - b.months),
                      ),
                  }))}
                />
              )}
            </div>
            <ol className="mt-3 space-y-1">
              {draft.milestones.map((m, i) => (
                <li key={m.id} className="relative flex items-start gap-3 rounded-xl py-2">
                  {i < draft.milestones.length - 1 && <span className="absolute left-[21px] top-12 h-[calc(100%-28px)] w-px bg-line-strong" aria-hidden />}
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-extrabold text-ink-900 ring-1 ring-brand-100">{m.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-ink-900">{m.code}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {m.date ? formatNumeric(m.date) : draft.startDate ? formatNumeric(addMonths(draft.startDate, m.months)) : "À planifier"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{m.status === "À planifier" ? "Exemple de calendrier à valider" : m.status}</p>
                  </div>
                  {editable && (
                    <Menu
                      label={`Actions pour ${m.code}`}
                      items={[{ label: "Retirer l'échéance", icon: Trash2, tone: "danger", onSelect: () => set("milestones", draft.milestones.filter((x) => x.id !== m.id)) }]}
                    />
                  )}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Documents associés</h2>
            {draft.documents.length === 0 ? (
              <p className="mt-3 flex items-center gap-3 text-sm text-ink-600">
                <FileText className="h-8 w-8 text-ink-500" strokeWidth={1.3} aria-hidden />
                Aucun document associé pour le moment.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {draft.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                    <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                    <span className="flex-1 font-medium text-ink-900">{d.name}</span>
                    <span className="text-ink-500">{formatNumeric(d.date)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" className="mt-3" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()} disabled={!editable}>
              Ajouter un document
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) set("documents", [...draft.documents, ...files.map((file, i) => ({ id: `d-${Date.now().toString(36)}-${i}`, name: file.name, date: DEMO_TODAY }))]);
                e.target.value = "";
              }}
            />
          </Card>
        </div>
      </div>

      {editable ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className="flex min-w-72 flex-1 items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-ink-700">
            <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
            Le protocole doit être soumis puis approuvé pour activer l&apos;échéancier et démarrer la mise en stabilité.
          </p>
          <Button
            variant="outline"
            size="lg"
            icon={<Save className="h-5 w-5" />}
            onClick={() => {
              save();
              toast.show({ title: "Brouillon enregistré", description: `Protocole de stabilité ${study.id}.` });
            }}
          >
            Enregistrer le brouillon
          </Button>
          <div className="relative">
            <Button
              size="lg"
              icon={<Send className="h-5 w-5" />}
              disabled={missingStorage || noTests}
              className="disabled:bg-slate-300"
              onClick={() => {
                save(true);
                labActions.submitStudyProtocol(study.id);
                toast.show({ title: `Protocole ${study.id} soumis`, description: "Il attend l'approbation de l'assurance qualité avant l'activation de l'échéancier." });
              }}
            >
              Soumettre le protocole
            </Button>
            {missingStorage && (
              <p role="tooltip" className="absolute bottom-full right-0 mb-2 w-72 rounded-lg bg-ink-800 px-3 py-2 text-xs text-white shadow-pop">
                La condition de stockage doit être renseignée avant de soumettre le protocole.
              </p>
            )}
          </div>
        </div>
      ) : protocol.status === "Soumis" ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink-700">
          <Send className="h-5 w-5 text-brand-600" aria-hidden />
          <span className="flex-1">
            <strong className="font-semibold text-ink-900">Protocole soumis</strong>
            {protocol.submittedAt ? ` le ${formatDateTime(protocol.submittedAt)}` : ""} — {protocol.storage}, {protocol.packaging}. En attente d&apos;approbation par l&apos;assurance qualité.
          </span>
          <Button
            variant="outline"
            size="sm"
            icon={<Check className="h-4 w-4" />}
            onClick={() => {
              labActions.approveStudyProtocol(study.id);
              toast.show({ title: `Protocole ${study.id} approuvé`, description: "Simulation de l'approbation par l'assurance qualité (Marie Leroy)." });
            }}
          >
            Approuver (simulation)
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
          <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
          <span className="flex-1 font-medium">
            Protocole approuvé{protocol.approvedAt ? ` le ${formatDateTime(protocol.approvedAt)}` : ""}
            {protocol.approvedBy ? ` par ${protocol.approvedBy}` : ""} — {protocol.storage}, {protocol.packaging}.
          </span>
          <Button variant="outline" size="sm" icon={<CalendarDays className="h-4 w-4" />} onClick={onSchedule}>
            Voir l&apos;échéancier
          </Button>
        </div>
      )}

      <Modal open={conditionsOpen} onClose={() => setConditionsOpen(false)} size="md" title="Conditions et fréquence" subtitle="Référence : lignes directrices ICH Q1A(R2)">
        <ul className="space-y-2 text-sm">
          {STORAGE_CONDITIONS.map((s) => (
            <li key={s} className="rounded-lg border border-line px-3 py-2">
              <span className="font-semibold text-ink-900">{s}</span>
              <span className="block text-ink-600">{s.includes("40") ? "0, 3 et 6 mois" : "0, 3, 6, 9, 12, 18, 24 et 36 mois"}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schedule (screen 42)                                                */
/* ------------------------------------------------------------------ */

function ScheduleTab({ study, protocol, onProtocol, onResults }: { study: StabilityStudy; protocol: StabilityProtocol; onProtocol: () => void; onResults: () => void }) {
  const RESPONSIBLES = useTeamNames(DEMO_RESPONSIBLES);
  const initial = { startDate: protocol.startDate, storage: protocol.storage, responsible: protocol.responsible, milestones: protocol.milestones };
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState<{ milestone: StabilityMilestone; date: string } | null>(null);
  const approved = protocol.status === "Approuvé";
  const active = Boolean(protocol.scheduleActivatedAt);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const used = new Set(draft.milestones.map((m) => m.code));
  const dateOf = (m: StabilityMilestone) => m.date ?? (draft.startDate ? addMonths(draft.startDate, m.months) : undefined);
  const analyses = protocol.tests.filter((t) => t.selected && /^M-\d+/.test(t.method));
  const canActivate = approved && !active && Boolean(draft.startDate && draft.storage);
  const results = study.results.filter((r) => r.status !== "À venir");
  const setMilestones = (milestones: StabilityMilestone[]) => setDraft((d) => ({ ...d, milestones }));

  const save = () => {
    labActions.saveStudySchedule(study.id, draft);
    toast.show({ title: "Brouillon de l'échéancier enregistré", description: `${study.id} — ${draft.milestones.length} prélèvements.` });
  };
  const activate = () => {
    if (dirty) labActions.saveStudySchedule(study.id, draft);
    labActions.activateStudySchedule(study.id);
    toast.show({ title: `Échéancier ${study.id} activé`, description: `Prélèvements planifiés à partir du ${formatNumeric(draft.startDate)}.` });
  };

  return (
    <>
      {active ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-success-500/30 bg-success-50 px-4 py-3">
          <CircleCheck className="h-6 w-6 shrink-0 fill-success-500 text-white" aria-hidden />
          <p className="text-[15px] font-medium text-success-700">
            Échéancier actif depuis le {formatNumeric(protocol.scheduleActivatedAt!.slice(0, 10))} : les prélèvements sont planifiés ({shortStorage(protocol.storage)}).
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "mt-5 flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3",
            approved ? "border-brand-100 bg-brand-50/70" : "border-warn-200 bg-warn-50",
          )}
        >
          {approved ? <Info className="h-7 w-7 shrink-0 fill-brand-600 text-white" aria-hidden /> : <TriangleAlert className="h-7 w-7 shrink-0 fill-warn-500 text-white" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold", approved ? "text-ink-900" : "text-warn-700")}>
              {approved ? `Protocole approuvé${protocol.approvedAt ? ` le ${formatNumeric(protocol.approvedAt.slice(0, 10))}` : ""} : l'échéancier peut être activé.` : "Le protocole doit être approuvé avant activation de l'échéancier."}
            </p>
            <p className="text-sm text-ink-700">
              {approved
                ? draft.startDate && draft.storage
                  ? "Les prélèvements seront planifiés aux dates prévues ci-dessous."
                  : "Renseignez la date de départ (T0) et la condition de stockage."
                : protocol.status === "Soumis"
                  ? "Le protocole est soumis : il attend l'approbation de l'assurance qualité."
                  : "Complétez et faites approuver le protocole pour pouvoir activer l'échéancier."}{" "}
              {!approved && (
                <button type="button" onClick={onProtocol} className="cursor-pointer font-semibold text-brand-700 hover:underline">
                  Ouvrir le protocole
                </button>
              )}
            </p>
          </div>
          <div className="text-center">
            <Button size="lg" variant={canActivate ? "primary" : "secondary"} disabled={!canActivate} icon={<Play className="h-5 w-5" />} onClick={activate} className="min-w-60 disabled:bg-slate-200 disabled:text-ink-400">
              Activer l&apos;échéancier
            </Button>
            {!approved && <p className="mt-1 text-xs text-ink-500">Action indisponible : protocole non approuvé.</p>}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Planifier les prélèvements</h2>
            <fieldset disabled={active} className="mt-4 space-y-4">
              <Field label="Date de départ (T0)" required htmlFor="sch-start">
                <DateInput id="sch-start" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v }))} onClear={() => setDraft((d) => ({ ...d, startDate: "" }))} />
              </Field>
              <Field label="Condition de stockage" required htmlFor="sch-storage">
                <Select id="sch-storage" placeholder="À définir" options={STORAGE_CONDITIONS} value={draft.storage} invalid={!draft.storage} onChange={(e) => setDraft((d) => ({ ...d, storage: e.target.value }))} />
              </Field>
              <Field label="Responsable" required htmlFor="sch-owner">
                <Select id="sch-owner" icon={User} options={[...new Set([draft.responsible, ...RESPONSIBLES])]} value={draft.responsible} onChange={(e) => setDraft((d) => ({ ...d, responsible: e.target.value }))} />
              </Field>
            </fieldset>
          </Card>

          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Essais à réaliser</h2>
            <div className="relative mt-3 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="bg-subtle text-sm text-ink-700">
                    <th className="px-4 py-2.5 font-semibold">Essai</th>
                    <th className="px-4 py-2.5 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {analyses.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 text-ink-900">{analysisName(t.method, t.name)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={active ? "success" : "info"} dot>
                          {active ? "Planifié" : "À planifier"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {analyses.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-sm text-ink-500">
                        Aucun essai analytique sélectionné dans le protocole.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Échéancier des prélèvements</h2>
            <div className="relative mt-3 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="bg-subtle text-sm text-ink-700">
                    <th className="px-4 py-2.5 font-semibold">Temps</th>
                    <th className="px-4 py-2.5 font-semibold">Date prévue</th>
                    <th className="px-4 py-2.5 font-semibold">Statut</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {draft.milestones.map((m) => {
                    const date = dateOf(m);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-2.5 font-bold text-ink-900">{m.code}</td>
                        <td className="px-4 py-2.5 tabular-nums text-ink-800">{date ? formatNumeric(date) : "—"}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={MILESTONE_TONE[m.status]} dot>
                            {m.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Menu
                            label={`Actions pour ${m.code}`}
                            items={[
                              { label: "Modifier la date", icon: Pencil, disabled: active, onSelect: () => setEditing({ milestone: m, date: date ?? "" }) },
                              {
                                label: "Retirer l'échéance",
                                icon: Trash2,
                                tone: "danger",
                                disabled: active || m.code === "T0",
                                onSelect: () => setMilestones(draft.milestones.filter((x) => x.id !== m.id)),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Menu
                label="Ajouter une échéance"
                className="w-full"
                widthClass="w-64"
                align="left"
                triggerClassName={cn(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-lg border font-semibold",
                  active ? "cursor-not-allowed border-line text-ink-300" : "border-brand-300 bg-white text-brand-700 hover:bg-brand-50",
                )}
                trigger={
                  <>
                    <Plus className="h-5 w-5" aria-hidden />
                    Ajouter une échéance
                  </>
                }
                items={
                  active
                    ? [{ label: "Échéancier actif : ajout impossible", disabled: true }]
                    : EXTRA_MILESTONES.filter(([code]) => !used.has(code)).map(([code, months]) => ({
                        label: code,
                        description: `${months} mois après le T0`,
                        onSelect: () => setMilestones([...draft.milestones, { id: `ms-${code}`, code, months, status: "À planifier" as const }].sort((a, b) => a.months - b.months)),
                      }))
                }
              />
              <Button
                variant="outline"
                size="lg"
                icon={<RotateCw className="h-5 w-5" />}
                disabled={active || !draft.startDate}
                onClick={() => {
                  setMilestones(draft.milestones.map((m) => (m.status === "Réalisée" ? m : { ...m, date: undefined })));
                  toast.show({ title: "Dates recalculées", description: `À partir du T0 du ${formatNumeric(draft.startDate)}.`, tone: "info" });
                }}
              >
                Recalculer les dates
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Résultats</h2>
            {results.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                  <FileText className="h-8 w-8 text-ink-600" strokeWidth={1.4} aria-hidden />
                </span>
                <p className="mt-3 font-semibold text-ink-900">Aucun résultat disponible</p>
                <p className="max-w-sm text-sm text-ink-600">Les résultats des essais seront affichés ici après réalisation des prélèvements.</p>
              </div>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                  {results.slice(0, 4).map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-10 font-bold text-ink-900">{r.point}</span>
                      <span className="flex-1 text-ink-800">
                        {r.method} — {r.analysis}
                      </span>
                      <ResultStatus status={r.status} />
                    </li>
                  ))}
                </ul>
                <Button variant="link" className="mt-2" onClick={onResults}>
                  Voir tous les résultats
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>

      {!active && (
        <Button size="lg" className="mt-5 min-w-64" icon={<Save className="h-5 w-5" />} onClick={save}>
          Enregistrer le brouillon
        </Button>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="sm"
        title={`Date du prélèvement ${editing?.milestone.code ?? ""}`}
        subtitle="La date saisie remplace la date calculée à partir du T0 (« Recalculer les dates » la rétablit)."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button
              disabled={!editing?.date}
              onClick={() => {
                if (!editing) return;
                setMilestones(draft.milestones.map((m) => (m.id === editing.milestone.id ? { ...m, date: editing.date } : m)));
                setEditing(null);
              }}
            >
              Appliquer
            </Button>
          </>
        }
      >
        {editing && (
          <Field label="Date prévue" required htmlFor="ms-date">
            <DateInput id="ms-date" value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} />
          </Field>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Results (screen 43)                                                 */
/* ------------------------------------------------------------------ */

const RESULT_LOOK: Record<StabilityResultStatus, { label: string; icon: typeof Clock; text: string; iconClass: string }> = {
  Validé: { label: "Validé", icon: CircleCheck, text: "text-success-700", iconClass: "fill-success-500 text-white" },
  "À saisir": { label: "À saisir", icon: Clock, text: "text-brand-700", iconClass: "text-brand-600" },
  "À venir": { label: "À venir", icon: Clock, text: "text-ink-600", iconClass: "text-ink-400" },
  Brouillon: { label: "Brouillon", icon: Pencil, text: "text-warn-700", iconClass: "text-warn-600" },
  Soumis: { label: "Soumis", icon: Send, text: "text-brand-700", iconClass: "text-brand-600" },
};

function ResultStatus({ status }: { status: StabilityResultStatus }) {
  const look = RESULT_LOOK[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-[15px] font-medium", look.text)}>
      <look.icon className={cn("h-5 w-5 shrink-0", look.iconClass)} aria-hidden />
      {look.label}
    </span>
  );
}

function downloadReport(study: StabilityStudy, r: StabilityResult) {
  const blob = buildPdf([
    { text: `${r.report ?? `Résultat ${r.point}`} — étude ${study.id}`, size: 16, bold: true },
    { text: `Lot ${study.lotCode} • formule ${study.formula} • ${r.storage}`, gap: 6 },
    { text: `${r.method} — ${r.analysis} : ${r.value} ${r.unit}`, bold: true, gap: 12 },
    { text: `Source : ${r.source || "—"}. Pièces : ${r.attachments.map((a) => a.name).join(", ") || "—"}.` },
    ...(r.comment ? [{ text: `Commentaire : ${r.comment}` }] : []),
    { text: "Document de démonstration généré par l'Espace R&D.", size: 9, gap: 18 },
  ]);
  downloadBlob(`${study.id}_${r.point}_${r.analysis.replace(/\s+/g, "-")}.pdf`, blob);
  toast.show({ title: "Téléchargement lancé", description: r.report ?? r.point });
}

function ResultForm({ study, result, onClose }: { study: StabilityStudy; result: StabilityResult; onClose: () => void }) {
  const go = useGuideNav();
  const guideDraft = useGuideTarget(44);
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(result.value);
  const [unit, setUnit] = useState(result.unit || "%");
  const [source, setSource] = useState(result.source);
  const [comment, setComment] = useState(result.comment);
  const [attachments, setAttachments] = useState(result.attachments);
  const milestone = study.protocol?.milestones.find((m) => m.code === result.point);
  const spec = stabilitySpec(result.analysis);
  const numeric = Number(value.replace(",", "."));
  const outOfSpec = Boolean(value.trim() && spec && !Number.isNaN(numeric) && !spec.ok(numeric));
  const canSubmit = Boolean(value.trim() && source && attachments.length);
  const caption = !value.trim() || !attachments.length ? "Résultat et pièce justificative requis." : !source ? "Source de l'analyse requise." : null;
  const input = { value: value.trim(), unit, source, comment: comment.trim(), attachments };

  const saveDraft = () => {
    labActions.saveStabilityResult(study.id, result.id, input, false);
    toast.show({ title: "Brouillon enregistré", description: `Résultat ${result.point} — ${result.analysis}.` });
    if (guideDraft) {
      toast.show({ title: "Parcours", description: "Le prélèvement M3 n'est pas encore programmé : une alerte de stabilité le signale.", tone: "info" });
      go(44);
    }
  };
  const submit = () => {
    labActions.saveStabilityResult(study.id, result.id, input, true);
    toast.show({ title: `Résultat ${result.point} soumis`, description: "Il attend la validation du relecteur." });
    if (outOfSpec) toast.show({ title: "Résultat hors spécification", description: "Une alerte de niveau élevé a été créée dans l'onglet Alertes.", tone: "danger" });
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink-900">Saisir un résultat</h2>
        <button type="button" aria-label="Fermer la saisie" onClick={onClose} className="-mr-1 cursor-pointer rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-[15px] text-ink-700">
        <strong className="text-lg font-bold text-ink-900">Point {result.point}</strong>
        <span className="h-5 w-px bg-line-strong" aria-hidden />
        {result.method}
        <span className="h-5 w-px bg-line-strong" aria-hidden />
        {result.analysis}
        <Badge tone="info" icon={Clock} size="md">
          {milestone?.status === "Réalisée" ? "Prélevé" : milestone?.status === "Planifiée" ? "Planifié" : "À planifier"}
        </Badge>
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_140px] gap-4">
        <Field label="Résultat" required htmlFor="res-value" hint={spec ? `Spécification : ${spec.label}` : undefined}>
          <Input id="res-value" inputMode="decimal" value={value} invalid={outOfSpec} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="Unité" required htmlFor="res-unit">
          <Select id="res-unit" options={UNITS} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      {outOfSpec && (
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          Valeur hors spécification : une alerte sera créée à la soumission.
        </p>
      )}
      <Field label="Source de l'analyse" required htmlFor="res-source" className="mt-4">
        <Select id="res-source" placeholder="Sélectionner une source" options={SOURCES} value={source} onChange={(e) => setSource(e.target.value)} />
      </Field>

      <Field label="Pièce(s) justificative(s)" info="Chromatogramme, certificat ou rapport d'analyse du prélèvement." className="mt-4">
        <>
          {attachments.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {attachments.map((a) => (
                <li key={a.name} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{a.name}</span>
                  <span className="text-ink-500">{a.size}</span>
                  <button type="button" aria-label={`Retirer ${a.name}`} onClick={() => setAttachments((l) => l.filter((x) => x.name !== a.name))} className="cursor-pointer rounded p-1 text-ink-500 hover:text-danger-600">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = [...(e.dataTransfer.files ?? [])];
              setAttachments((l) => [...l, ...files.map((f) => ({ name: f.name, size: formatFileSize(f.size) }))]);
            }}
            className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-brand-200 px-4 py-6 hover:border-brand-400 hover:bg-brand-50/40"
          >
            <span className="flex items-center gap-2 font-semibold text-brand-700">
              <Paperclip className="h-5 w-5" aria-hidden />
              Ajouter un document
            </span>
            <span className="text-sm text-ink-500">Glisser-déposer ou cliquer pour parcourir</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              setAttachments((l) => [...l, ...files.map((f) => ({ name: f.name, size: formatFileSize(f.size) }))]);
              e.target.value = "";
            }}
          />
        </>
      </Field>

      <Field label="Commentaire" optional htmlFor="res-comment" className="mt-4">
        <Textarea id="res-comment" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" icon={<FileText className="h-5 w-5" />} onClick={saveDraft} guide={study.id === "ST-02" ? 44 : undefined} guideHint="Enregistrez le brouillon : la pièce justificative manque encore.">
          Enregistrer le brouillon
        </Button>
        <div>
          <Button size="lg" className="w-full disabled:bg-slate-300" icon={<Send className="h-5 w-5" />} disabled={!canSubmit} onClick={submit}>
            Soumettre
          </Button>
          {caption && <p className="mt-1 text-center text-xs text-ink-500">{caption}</p>}
        </div>
      </div>
    </>
  );
}

function ResultDetail({ study, result, onClose }: { study: StabilityStudy; result: StabilityResult; onClose: () => void }) {
  const milestone = study.protocol?.milestones.find((m) => m.code === result.point);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink-900">
          Point {result.point} — {result.analysis}
        </h2>
        <button type="button" aria-label="Fermer le détail" onClick={onClose} className="-mr-1 cursor-pointer rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-2">
        <ResultStatus status={result.status} />
      </p>
      {result.status === "À venir" ? (
        <p className="mt-4 rounded-xl bg-subtle p-4 text-sm text-ink-600">
          La saisie s&apos;ouvre après le prélèvement {result.point}
          {milestone?.date ? ` prévu le ${formatNumeric(milestone.date)}` : ""}.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-[150px_minmax(0,1fr)] gap-y-2.5 rounded-xl border border-line p-4 text-[15px]">
            <dt className="text-ink-600">Résultat</dt>
            <dd className="font-semibold text-ink-900">
              {result.value} {result.unit}
            </dd>
            <dt className="text-ink-600">Méthode</dt>
            <dd className="text-ink-900">{result.method}</dd>
            <dt className="text-ink-600">Source</dt>
            <dd className="text-ink-900">{result.source || "—"}</dd>
            <dt className="text-ink-600">Pièces</dt>
            <dd className="text-ink-900">{result.attachments.map((a) => a.name).join(", ") || "—"}</dd>
            {result.comment && (
              <>
                <dt className="text-ink-600">Commentaire</dt>
                <dd className="text-ink-900">{result.comment}</dd>
              </>
            )}
            {result.updatedAt && (
              <>
                <dt className="text-ink-600">Mis à jour</dt>
                <dd className="text-ink-900">{formatDateTime(result.updatedAt)}</dd>
              </>
            )}
          </dl>
          {result.status === "Soumis" ? (
            <Button
              className="mt-4 w-full"
              size="lg"
              icon={<Check className="h-5 w-5" />}
              onClick={() => {
                labActions.validateStabilityResult(study.id, result.id);
                toast.show({ title: `Résultat ${result.point} validé`, description: "Simulation de la validation par le relecteur (Marie Leroy)." });
              }}
            >
              Valider le résultat (simulation)
            </Button>
          ) : (
            <Button variant="outline" className="mt-4 w-full" size="lg" icon={<FileText className="h-5 w-5" />} onClick={() => downloadReport(study, result)}>
              Télécharger le {result.report ? `r${result.report.slice(1)}` : "rapport"}
            </Button>
          )}
        </>
      )}
    </>
  );
}

function ResultsTab({ study, initialPoint }: { study: StabilityStudy; initialPoint?: string }) {
  const storages = [...new Set(study.results.map((r) => r.storage))];
  const points = [...new Set(study.results.map((r) => r.point))];
  const [storage, setStorage] = useState(storages[0] ?? "");
  const [period, setPeriod] = useState("Toutes");
  const [selectedId, setSelectedId] = useState<string | null>(initialPoint ?? null);
  const rows = study.results.filter((r) => (!storage || r.storage === storage) && (period === "Toutes" || r.point === period));
  const selected = study.results.find((r) => r.id === selectedId);

  if (study.results.length === 0) {
    return (
      <Card className="mt-5">
        <EmptyState icon={ChartNoAxesColumn} title="Aucun résultat" description="Les points de résultats sont créés à l'activation de l'échéancier (onglet Échéancier)." />
      </Card>
    );
  }

  return (
    <div className={cn("mt-5 grid grid-cols-1 gap-5", selected && "xl:grid-cols-[minmax(0,1fr)_520px]")}>
      <Card className="h-fit p-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-[15px] font-semibold text-ink-800">
            Conditions de stockage
            <Select className="mt-1.5" icon={Thermometer} options={storages.map((s) => ({ value: s, label: shortStorage(s) }))} value={storage} onChange={(e) => setStorage(e.target.value)} />
          </label>
          <label className="text-[15px] font-semibold text-ink-800">
            Période
            <Select className="mt-1.5" icon={CalendarDays} options={["Toutes", ...points]} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
        </div>
        <div className="relative mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <thead>
              <tr className="bg-subtle text-sm text-ink-700">
                <th className="px-4 py-3 font-semibold">Point</th>
                <th className="border-l border-line px-4 py-3 font-semibold">Méthode</th>
                <th className="border-l border-line px-4 py-3 font-semibold">Analyse</th>
                <th className="border-l border-line px-4 py-3 font-semibold">Statut</th>
                <th className="border-l border-line px-4 py-3 font-semibold">Rapport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setSelectedId(r.id)} className={cn("cursor-pointer transition-colors", r.id === selectedId ? "bg-brand-50" : "hover:bg-subtle")}>
                  <td className="px-4 py-4 font-bold text-ink-900">
                    <button type="button" className="cursor-pointer" aria-pressed={r.id === selectedId} onClick={() => setSelectedId(r.id)}>
                      {r.point}
                    </button>
                  </td>
                  <td className="border-l border-line px-4 py-4 text-ink-800">{r.method}</td>
                  <td className="border-l border-line px-4 py-4 text-ink-800">{r.analysis}</td>
                  <td className="border-l border-line px-4 py-4">
                    <ResultStatus status={r.status} />
                  </td>
                  <td className="border-l border-line px-4 py-4">
                    {r.report ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadReport(study, r);
                        }}
                        className="inline-flex cursor-pointer items-center gap-2 font-medium text-brand-700 hover:underline"
                      >
                        <FileText className="h-5 w-5" aria-hidden />
                        {r.report}
                      </button>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-500">
                    Aucun résultat pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
          {selected.status === "À saisir" || selected.status === "Brouillon" ? (
            <ResultForm key={`${selected.id}-${selected.updatedAt ?? ""}`} study={study} result={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <ResultDetail study={study} result={selected} onClose={() => setSelectedId(null)} />
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StudyView({ id, initialTab = "protocole", initialPoint }: { id: string; initialTab?: StudyTab; initialPoint?: string }) {
  const state = useDemo();
  const study = state.studies.find((s) => s.id.toLowerCase() === id.toLowerCase());
  const [tab, setTab] = useState<StudyTab>(initialTab);

  if (!study) {
    return (
      <>
        <Card className="mt-4">
          <EmptyState icon={ChartNoAxesColumn} title="Étude introuvable" action={<LinkButton href="/stabilite">Retour aux études</LinkButton>} />
        </Card>
        <ScreenRef label="Étude de stabilité" />
      </>
    );
  }

  const project = state.projects.find((p) => p.code === study.projectCode);
  const protocol = study.protocol;
  const events = state.history.filter((h) => h.studyId === study.id).sort((a, b) => b.at.localeCompare(a.at));
  const running = study.status === "En cours" || study.status === "En revue";
  const status = running || !protocol ? study.status : protocol.status;
  const onProtocolTab = tab === "protocole";
  const openAlerts = study.alerts.filter((a) => a.status !== "Résolue").length;

  const screen =
    study.id === "ST-01" && tab === "protocole" ? 41 : study.id === "ST-01" && tab === "echeancier" ? 42 : study.id === "ST-02" && tab === "resultats" ? 43 : undefined;
  const screenLabel = tab === "echeancier" ? "Stabilité — échéancier" : tab === "resultats" ? "Stabilité — résultats" : "Stabilité — protocole";

  return (
    <>
      <Breadcrumb items={[{ label: "Stabilité", href: "/stabilite" }, ...(onProtocolTab ? [{ label: study.id }] : [{ label: study.id, href: `/stabilite?etude=${study.id}` }, { label: `Lot ${study.lotCode}` }])]} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[36px] font-extrabold tracking-tight text-ink-900">
              {study.id} <span className="text-ink-400">•</span> {onProtocolTab ? "Protocole de stabilité" : `Lot ${study.lotCode}`}
            </h1>
            {onProtocolTab ? (
              <Badge tone={protocol?.status === "Brouillon" || !protocol ? "warn" : protocol.status === "Approuvé" ? "success" : "info"} icon={Pencil} size="md" className="rounded-lg px-3 py-1.5 text-[15px]">
                {status}
              </Badge>
            ) : (
              <Badge tone={status === "En revue" ? "neutral" : "info"} dot size="md" className="rounded-lg px-3 py-1.5 text-[15px]">
                {status}
              </Badge>
            )}
          </div>
          {onProtocolTab && (
            <MetaLine
              className="mt-1"
              items={[
                <span key="p">
                  Projet <strong className="text-ink-800">{project ? `${project.code} • ${project.name}` : study.projectCode}</strong>
                </span>,
                <span key="f">
                  Formule <strong className="text-ink-800">{study.formula}</strong>
                </span>,
                <span key="l">
                  {study.lotLabel.includes("pilote") ? "Lot pilote" : "Lot"} <strong className="text-ink-800">{study.lotCode}</strong>
                </span>,
                study.dosage,
              ]}
            />
          )}
        </div>
        <Menu
          label="Actions"
          widthClass="w-64"
          triggerClassName={ACTIONS_TRIGGER_CLASS}
          trigger={actionsTrigger("Actions")}
          items={[
            { label: "Toutes les études", icon: ChartNoAxesColumn, href: "/stabilite" },
            { label: openAlerts ? `Alertes de l'étude (${openAlerts})` : "Alertes de stabilité", icon: TriangleAlert, href: `/stabilite?onglet=alertes${study.alerts[0] ? `&alerte=${study.alerts[0].id}` : ""}` },
            ...(project ? [{ label: "Fiche projet", icon: FileText, href: `/projets/${project.slug}` }] : []),
            { label: "Planning (étuves)", icon: CalendarDays, href: "/planning?vue=ressources" },
          ]}
        />
      </div>
      <Tabs
        className="mt-4"
        items={[
          { value: "protocole", label: "Protocole" },
          { value: "echeancier", label: "Échéancier", guide: study.id === "ST-01" ? 42 : undefined },
          { value: "resultats", label: "Résultats" },
          { value: "documents", label: "Documents" },
          { value: "historique", label: "Historique", count: events.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {!protocol ? (
        <Card className="mt-5">
          <EmptyState
            icon={FileText}
            title="Aucun protocole associé"
            description="Le protocole doit être préparé avant de démarrer l'étude."
            action={
              <Button
                icon={<FileText className="h-4 w-4" />}
                onClick={() => {
                  labActions.prepareStudyProtocol(study.id);
                  toast.show({ title: `Protocole ${study.id} créé` });
                }}
              >
                Préparer le protocole
              </Button>
            }
          />
        </Card>
      ) : tab === "protocole" ? (
        <ProtocolForm key={`${protocol.status}-${protocol.updatedAt}`} study={study} protocol={protocol} onSchedule={() => setTab("echeancier")} />
      ) : tab === "echeancier" ? (
        <ScheduleTab key={`${protocol.status}-${protocol.updatedAt}`} study={study} protocol={protocol} onProtocol={() => setTab("protocole")} onResults={() => setTab("resultats")} />
      ) : tab === "resultats" ? (
        <ResultsTab study={study} initialPoint={initialPoint} />
      ) : tab === "documents" ? (
        <Card className="mt-5 p-5">
          {protocol.documents.length === 0 ? (
            <EmptyState icon={FileText} title="Aucun document" description="Ajoutez des documents depuis l'onglet Protocole." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {protocol.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                  <span className="flex-1 text-ink-900">{d.name}</span>
                  <span className="text-ink-500">{formatNumeric(d.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="mt-5 p-5">
          {events.length === 0 ? (
            <EmptyState icon={EllipsisVertical} title="Aucun événement" />
          ) : (
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
          )}
        </Card>
      )}
      <Link href="/stabilite" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
        Retour aux études de stabilité
      </Link>
      <ScreenRef n={screen} label={screenLabel} />
    </>
  );
}
