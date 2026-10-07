"use client";

import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  Download,
  Eye,
  FileText,
  Hammer,
  Paperclip,
  PencilLine,
  Send,
  Timer,
  Weight,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { MetaLine } from "@/components/project-context-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput, controlClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, downloadText, formatFileSize, formatNumeric } from "@/lib/format";
import { inSpec } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { ControlStatus, LotControl, PilotLot, Project, Tone } from "@/lib/types";
import { findPilot } from "./lot-frame";

const CONTROL_ICONS: Record<string, LucideIcon> = { Aspect: FileText, "Masse unitaire": Weight, Dureté: Hammer, Friabilité: Timer };

const STATUS: Record<ControlStatus, { label: string; tone: Tone; icon: LucideIcon; iconClass: string }> = {
  Validé: { label: "Résultat validé", tone: "success", icon: CircleCheck, iconClass: "fill-success-500 text-white" },
  "À saisir": { label: "À saisir", tone: "info", icon: PencilLine, iconClass: "text-brand-600" },
  Saisi: { label: "Résultat saisi", tone: "info", icon: CircleCheck, iconClass: "fill-brand-500 text-white" },
  "En revue": { label: "En revue", tone: "warn", icon: Send, iconClass: "text-warn-600" },
  "En attente": { label: "En attente", tone: "neutral", icon: Clock, iconClass: "text-ink-400" },
};

function ControlForm({ project, pilot, control }: { project: Project; pilot: PilotLot; control: LotControl }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState(control.result);
  const [date, setDate] = useState(control.date || DEMO_TODAY);
  const [attachments, setAttachments] = useState(control.attachments);
  const [attempted, setAttempted] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const editable = control.status !== "Validé" && control.status !== "En revue";
  const missing = pilot.controls.filter((c) => !(c.id === control.id ? result : c.result).trim());
  const status = STATUS[control.status];
  const out = result ? inSpec(result, control.specification) === false : false;

  const save = (silent = false) => {
    labActions.saveControl(project.code, pilot.lotCode, control.id, { result: result.trim(), date, attachments });
    if (!silent) toast.show({ title: "Résultat enregistré", description: `${control.name} : ${result.trim()} ${control.unit}`.trim() });
  };

  return (
    <Card className="h-fit p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink-900">{control.name}</h2>
        <Badge tone={status.tone} icon={status.icon} size="md" className="rounded-full">
          {status.label}
        </Badge>
      </div>
      <fieldset disabled={!editable} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div>
            <label htmlFor="ctl-result" className="mb-1.5 block text-[15px] font-semibold text-ink-800">
              Résultat <span className="text-danger-600">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="ctl-result"
                value={result}
                inputMode={control.unit ? "decimal" : "text"}
                placeholder={control.unit ? "Valeur" : "Conforme / Non conforme"}
                onChange={(e) => setResult(e.target.value)}
                className={cn(controlClass, "h-11 flex-1 px-3.5", attempted && !result.trim() && "border-danger-500")}
                aria-invalid={(attempted && !result.trim()) || undefined}
              />
              {control.unit && <span className="flex h-11 min-w-12 items-center justify-center rounded-lg border border-line-strong px-3 text-sm text-ink-700">{control.unit}</span>}
            </div>
            {attempted && !result.trim() && <p className="mt-1 text-sm text-danger-600">Résultat requis.</p>}
            {out && <p className="mt-1 text-sm text-warn-700">Hors spécification ({control.specification}).</p>}
          </div>
          <div>
            <label htmlFor="ctl-date" className="mb-1.5 block text-[15px] font-semibold text-ink-800">
              Date d&apos;analyse
            </label>
            <DateInput id="ctl-date" value={date} onChange={setDate} />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">Méthode d&apos;analyse</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-lg border border-line px-3 py-2">
              <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
              <span className="text-sm">
                <span className="block font-semibold text-ink-900">{control.methodLabel}</span>
                <span className="block text-ink-500">{control.methodVersion}</span>
              </span>
            </div>
            {control.method ? (
              <Link href={`/methodes/${control.method.toLowerCase()}`} className="flex h-auto items-center justify-center gap-2 rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                <Paperclip className="h-4 w-4" aria-hidden />
                Voir le document
              </Link>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-ink-800">
            Critère d&apos;acceptation
            <CircleHelp className="h-4 w-4 text-ink-400" aria-label="Spécification approuvée du produit" />
          </p>
          <button
            type="button"
            onClick={() => setSpecOpen(true)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left hover:bg-subtle"
          >
            <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
            <span className="flex-1 font-medium text-brand-700">Voir la spécification approuvée</span>
            <ChevronRight className="h-5 w-5 text-brand-700" aria-hidden />
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">
            Pièce(s) jointe(s) <span className="font-normal text-ink-500">(optionnel)</span>
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line-strong px-4 py-4 text-sm text-ink-600 hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="flex items-center gap-2 font-semibold text-brand-700">
              <Paperclip className="h-4 w-4" aria-hidden />
              Ajouter un fichier
            </span>
            Glisser-déposer un fichier ici ou cliquer pour sélectionner
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).map((file) => ({ name: file.name, size: formatFileSize(file.size) }));
              if (files.length) setAttachments((l) => [...l, ...files]);
              e.target.value = "";
            }}
          />
          {attachments.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li key={a.name} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                  {a.name} <span className="text-ink-500">({a.size})</span>
                  {editable && (
                    <button type="button" aria-label={`Retirer ${a.name}`} onClick={() => setAttachments((l) => l.filter((x) => x.name !== a.name))} className="cursor-pointer text-ink-500 hover:text-danger-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          icon={<FileText className="h-4 w-4" />}
          disabled={!editable}
          onClick={() => {
            setAttempted(true);
            if (!result.trim()) return;
            save();
          }}
        >
          Enregistrer le résultat
        </Button>
        <Button
          icon={<Send className="h-4 w-4" />}
          disabled={Boolean(pilot.controlsSubmittedAt)}
          onClick={() => {
            setAttempted(true);
            if (editable && result.trim()) save(true);
            if (missing.length) {
              toast.show({ title: "Soumission impossible", description: `Résultats manquants : ${missing.map((m) => m.name).join(", ")}.`, tone: "warn" });
              return;
            }
            labActions.submitControls(project.code, pilot.lotCode);
            toast.show({ title: "Contrôles soumis pour revue", description: `Lot ${pilot.lotCode} — ${pilot.controls.length} contrôles.` });
          }}
        >
          {pilot.controlsSubmittedAt ? "Soumis pour revue" : "Soumettre pour revue"}
        </Button>
        <Button
          variant="outline"
          icon={<Eye className="h-4 w-4" />}
          onClick={() => {
            downloadText(`donnees-${pilot.lotCode}-${control.name}.csv`, `controle;resultat;unite;date\n${control.name};${result};${control.unit};${date}`, "text/csv");
            toast.show({ title: "Données sources téléchargées", description: control.name });
          }}
        >
          Voir les données sources
        </Button>
      </div>
      {missing.length > 0 && !pilot.controlsSubmittedAt && (
        <p className="mt-4 flex items-start gap-3 rounded-xl border border-warn-200 bg-warn-50 p-4 text-sm">
          <CircleAlert className="h-5 w-5 shrink-0 fill-warn-500 text-white" aria-hidden />
          <span>
            <span className="block font-medium text-warn-700">Tous les résultats requis doivent être saisis avant de pouvoir soumettre le lot pour revue.</span>
            <span className="text-ink-600">Les résultats en attente ne constituent pas une non-conformité.</span>
          </span>
        </p>
      )}
      <Modal open={specOpen} onClose={() => setSpecOpen(false)} size="sm" title="Spécification approuvée" subtitle={`${control.name} — lot ${pilot.lotCode}`}>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-600">Critère</dt>
            <dd className="font-semibold text-ink-900">{control.specification}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-600">Méthode</dt>
            <dd className="text-ink-900">{control.methodLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-600">Référence</dt>
            <dd className="text-ink-900">Spécification produit fini CS-01 v1</dd>
          </div>
        </dl>
        <Button
          variant="outline"
          className="mt-4"
          icon={<Download className="h-4 w-4" />}
          onClick={() => {
            downloadText("specification-CS-01.txt", `Spécification CS-01\n${control.name} : ${control.specification}\n`);
            toast.show({ title: "Téléchargement lancé", description: "specification-CS-01.txt" });
          }}
        >
          Télécharger
        </Button>
      </Modal>
    </Card>
  );
}

export function LotControlsView({ slug, lotSlug }: { slug: string; lotSlug: string }) {
  const state = useDemo();
  const { project, pilot } = findPilot(state, slug, lotSlug);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!project || !pilot) return null;

  const validated = pilot.controls.filter((c) => c.status === "Validé").length;
  const toEnter = pilot.controls.filter((c) => c.status === "À saisir" || c.status === "Saisi").length;
  const waiting = pilot.controls.filter((c) => c.status === "En attente").length;
  const selected =
    pilot.controls.find((c) => c.id === selectedId) ??
    pilot.controls.find((c) => c.status === "À saisir") ??
    pilot.controls.find((c) => c.status !== "Validé") ??
    pilot.controls[0];

  return (
    <>
      <h2 className="mt-5 text-[28px] font-extrabold tracking-tight text-ink-900">Contrôles du lot {pilot.lotCode}</h2>
      <MetaLine
        items={[
          `Formule ${pilot.formula}`,
          project.dosage,
          <span key="l">
            Lot pilote <strong className="text-ink-800">{pilot.lotCode}</strong>
          </span>,
          `Phase : ${project.phase}`,
        ]}
      />
      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <Card className="grid grid-cols-3 divide-x divide-line p-4">
            {[
              { value: validated, label: "contrôles validés", icon: CircleCheck, cls: "fill-success-500 text-white" },
              { value: toEnter, label: "à saisir", icon: PencilLine, cls: "text-brand-600" },
              { value: waiting, label: "en attente", icon: Clock, cls: "text-ink-400" },
            ].map((k) => (
              <div key={k.label} className="flex items-center gap-3 px-3">
                <k.icon className={cn("h-9 w-9 shrink-0", k.cls)} aria-hidden />
                <div>
                  <p className="text-2xl font-bold text-ink-900">{k.value}</p>
                  <p className="text-sm text-ink-600">{k.label}</p>
                </div>
              </div>
            ))}
          </Card>
          <Card className="p-4">
            <h3 className="px-1 text-lg font-bold text-ink-900">Liste des contrôles</h3>
            <ul className="mt-3 space-y-2">
              {pilot.controls.map((c) => {
                const Icon = CONTROL_ICONS[c.name] ?? FileText;
                const s = STATUS[c.status];
                const active = c.id === selected?.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                        active ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
                      )}
                    >
                      <Icon className="h-7 w-7 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink-900">{c.name}</span>
                        <span className="block text-sm text-ink-500">{c.detail}</span>
                      </span>
                      <s.icon className={cn("h-6 w-6 shrink-0", s.iconClass)} aria-hidden />
                      <Badge tone={s.tone} size="md" className="hidden sm:inline-flex">
                        {s.label}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-ink-500" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            {pilot.controlsSubmittedAt && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
                <CircleCheck className="h-4 w-4 fill-success-500 text-white" aria-hidden />
                Contrôles soumis pour revue le {formatNumeric(pilot.controlsSubmittedAt)}.
              </p>
            )}
          </Card>
        </div>
        {selected && <ControlForm key={`${selected.id}-${selected.status}-${selected.result}`} project={project} pilot={pilot} control={selected} />}
      </div>
      <ScreenRef n={pilot.lotCode === "LP-01" ? 37 : undefined} label="Lot pilote — contrôles" />
    </>
  );
}
