"use client";

import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  Info,
  Maximize,
  Minus,
  Pencil,
  Plus,
  Save,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { GuideSpot, useGuideNav } from "@/components/guide/guide-mark";
import { Button } from "@/components/ui/button";
import { Checkbox, DateInput, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { EXAMPLE_SUPPLIER, SUPPLIERS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, formatFileSize } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { actions } from "@/lib/store";
import type { Prerequisite, PrerequisiteFile, Project } from "@/lib/types";

type FieldState = "à vérifier" | "vérifié" | "corrigé" | "ignoré";

interface Extracted {
  key: string;
  label: string;
  info: string;
  value: string;
  page: number;
  state: FieldState;
  multiline?: boolean;
  editing?: boolean;
}

const DOC_TYPES = ["DMF / CEP", "Certificat GMP", "FDS", "Certificat d'analyse", "Spécification", "Autre document"];

const PAGE_TITLES = ["1. Identification du fabricant", "2. Description du procédé", "3. Contrôles et spécifications", "4. Stabilité du principe actif"];

/** Document of the demonstration (mock-up 13): the supplier's DMF, version 4. */
const EXAMPLE = {
  file: { name: "EXEMPLE-PHARMA-DMF-001.pdf", size: "1,6 Mo", pages: 4 },
  docType: "DMF / CEP",
  version: "v4",
  fields: (): Extracted[] => [
    { key: "fabricant", label: "Fabricant", info: "Nom du fabricant indiqué en page de garde du dossier.", value: EXAMPLE_SUPPLIER, page: 1, state: "vérifié" },
    {
      key: "procede",
      label: "Procédé – Description extraite",
      info: "Résumé du procédé de fabrication repris du dossier : à relire avant de l'accepter.",
      value: "Description du procédé à vérifier",
      page: 1,
      state: "à vérifier",
      multiline: true,
    },
  ],
};

const STEPS = ["Fichier", "Informations", "Vérification"];

function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((title, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={title} className={cn("flex items-center", n < STEPS.length && "flex-1")}>
            <span className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold",
                  done && "bg-success-600 text-white",
                  active && "bg-brand-600 text-white ring-4 ring-brand-100",
                  !done && !active && "border border-line-strong bg-white text-ink-500",
                )}
              >
                {n}
              </span>
              <span>
                <span className="block font-semibold text-ink-900">{title}</span>
                <span className={cn("block text-sm", done ? "text-success-700" : active ? "text-brand-700" : "text-ink-500")}>
                  {done ? "Terminé" : active ? "En cours" : "À venir"}
                </span>
              </span>
            </span>
            {n < STEPS.length && <span aria-hidden className={cn("mx-5 h-1 min-w-10 flex-1 rounded-full", done ? "bg-success-500" : "bg-brand-100")} />}
          </li>
        );
      })}
    </ol>
  );
}

const STATE_LOOK: Record<FieldState, { label: string; className: string; icon: typeof Check }> = {
  "à vérifier": { label: "À vérifier", className: "text-warn-700", icon: CircleAlert },
  vérifié: { label: "Vérifié", className: "text-success-700", icon: CircleCheck },
  corrigé: { label: "Corrigé", className: "text-brand-700", icon: Pencil },
  ignoré: { label: "Ignoré", className: "text-ink-500", icon: Ban },
};

function ExtractedField({ field, onChange, onSource }: { field: Extracted; onChange: (f: Extracted) => void; onSource: (page: number) => void }) {
  const look = STATE_LOOK[field.state];
  const Icon = look.icon;
  const accepted = field.state === "vérifié" || field.state === "corrigé";
  const id = `extract-${field.key}`;
  return (
    <div className="rounded-xl border border-line p-3.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-1.5 font-semibold text-ink-900">
          {field.label}
          <span className="text-danger-600" aria-hidden>
            *
          </span>
          <span title={field.info} className="inline-flex cursor-help text-ink-400">
            <Info className="h-4 w-4" aria-label={field.info} />
          </span>
        </label>
        <span className={cn("flex items-center gap-1.5 text-sm font-semibold", look.className)}>
          <Icon className={cn("h-5 w-5", field.state === "vérifié" && "fill-success-500 text-white", field.state === "à vérifier" && "text-warn-600")} aria-hidden />
          {look.label}
        </span>
      </div>
      {field.editing ? (
        field.multiline ? (
          <Textarea id={id} rows={3} value={field.value} autoFocus className="mt-2" onChange={(e) => onChange({ ...field, value: e.target.value })} />
        ) : (
          <Input id={id} value={field.value} autoFocus className="mt-2" onChange={(e) => onChange({ ...field, value: e.target.value })} />
        )
      ) : (
        <div id={id} className={cn("mt-2 rounded-lg border border-line-strong px-3 py-2", field.multiline && "min-h-[72px]")}>
          <span className={cn("rounded px-1 py-0.5 text-[15px] text-ink-900", field.state === "ignoré" ? "bg-slate-100 text-ink-500 line-through" : "bg-yellow-100")}>
            {field.value || "—"}
          </span>
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onSource(field.page)} className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 text-sm text-ink-600 hover:text-brand-700">
          <FileText className="h-4 w-4" aria-hidden />
          Source : page {field.page}
        </button>
        <span className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Ban className="h-3.5 w-3.5" />} onClick={() => onChange({ ...field, state: "ignoré", editing: false })}>
            Ignorer
          </Button>
          <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onChange({ ...field, editing: true })}>
            Corriger
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Check className="h-3.5 w-3.5" />}
            disabled={!field.value.trim()}
            className={cn(accepted && "border-success-500 text-success-700 hover:border-success-600 hover:bg-success-50")}
            onClick={() => onChange({ ...field, editing: false, state: field.editing ? "corrigé" : field.state === "corrigé" ? "corrigé" : "vérifié" })}
          >
            Accepter
          </Button>
        </span>
      </div>
    </div>
  );
}

function DocumentPreview({ title, fileBase, page, pages, onPage }: { title: string; fileBase: string; page: number; pages: number; onPage: (p: number) => void }) {
  const [zoom, setZoom] = useState(100);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="flex h-full flex-col rounded-xl border border-line bg-white p-4">
      <h3 className="font-semibold text-ink-900">Aperçu du document</h3>
      <div className="mt-3 flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-sm text-ink-700">
        <button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)} className="cursor-pointer rounded p-1 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="rounded border border-line px-2 tabular-nums">{page}</span>
        <span className="tabular-nums">/ {pages}</span>
        <button type="button" aria-label="Page suivante" disabled={page >= pages} onClick={() => onPage(page + 1)} className="cursor-pointer rounded p-1 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <button type="button" aria-label="Réduire" disabled={zoom <= 60} onClick={() => setZoom((z) => z - 20)} className="cursor-pointer rounded p-1 hover:bg-brand-50 disabled:opacity-40">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center tabular-nums">{zoom} %</span>
        <button type="button" aria-label="Agrandir" disabled={zoom >= 160} onClick={() => setZoom((z) => z + 20)} className="cursor-pointer rounded p-1 hover:bg-brand-50 disabled:opacity-40">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Plein écran" onClick={() => ref.current?.requestFullscreen?.()} className="ml-auto cursor-pointer rounded p-1 hover:bg-brand-50">
          <Maximize className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex-1 overflow-auto rounded-lg bg-slate-200/70 p-3">
        <div
          className="mx-auto flex aspect-[1/1.3] w-full max-w-[340px] origin-top flex-col bg-white px-6 pb-4 pt-8 shadow-card"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          <p className="font-bold text-ink-900">{title}</p>
          <p className="mt-6 text-sm font-semibold text-ink-900">{PAGE_TITLES[(page - 1) % PAGE_TITLES.length]}</p>
          <div className="mt-4 space-y-2" aria-hidden>
            <div className="h-2.5 w-1/3 rounded bg-slate-300" />
            {[92, 80, 70, 86].map((w) => (
              <div key={w} className="h-2 rounded bg-slate-200" style={{ width: `${w}%` }} />
            ))}
            <div className="!mt-5 h-2.5 w-1/4 rounded bg-slate-300" />
            {[88, 64, 50].map((w) => (
              <div key={w} className="h-2 rounded bg-slate-200" style={{ width: `${w}%` }} />
            ))}
          </div>
          <p className="mt-auto flex justify-between border-t border-ink-900 pt-2 text-[10px] text-ink-800">
            <span>{fileBase}</span>
            <span>
              Page {page} sur {pages}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Screen 13: import a supporting document of a prerequisite in three steps (file, information,
 * verification of the automatically extracted fields). Saving attaches the file and verifies the prerequisite.
 */
export function ImportDocumentModal({
  project,
  prerequisite,
  prerequisites,
  example,
  open,
  onClose,
  onSaved,
}: {
  project: Project;
  prerequisite: Prerequisite;
  prerequisites: Prerequisite[];
  example: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const go = useGuideNav();
  const guideSave = useGuideTarget(14);
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(example ? 3 : 1);
  const [file, setFile] = useState<PrerequisiteFile | null>(example ? EXAMPLE.file : null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [docType, setDocType] = useState(example ? EXAMPLE.docType : (DOC_TYPES.find((t) => t === prerequisite.name) ?? DOC_TYPES[DOC_TYPES.length - 1]));
  const [linkedId, setLinkedId] = useState(prerequisite.id);
  const [supplier, setSupplier] = useState(example ? EXAMPLE_SUPPLIER : "");
  const [version, setVersion] = useState(example ? EXAMPLE.version : "");
  const [docDate, setDocDate] = useState(DEMO_TODAY);
  const [fields, setFields] = useState<Extracted[]>(example ? EXAMPLE.fields() : []);
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(1);
  const [tried, setTried] = useState(false);

  const linked = prerequisites.find((p) => p.id === linkedId) ?? prerequisite;
  const pages = file?.pages ?? 1;
  const pending = fields.filter((f) => f.state !== "vérifié" && f.state !== "corrigé");
  const ready = pending.length === 0 && confirmed && fields.every((f) => f.value.trim());
  const infoErrors = { supplier: !supplier ? "Choisissez le fournisseur." : null, version: !version.trim() ? "Indiquez la version du document." : null };

  const pick = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "doc", "docx", "xlsx"].includes(ext)) return setFileError("Format non accepté (PDF, DOC, XLSX).");
    if (f.size > 10 * 1024 * 1024) return setFileError("Le fichier dépasse 10 Mo.");
    setFileError(null);
    setFile({ name: f.name, size: formatFileSize(f.size), pages: ext === "pdf" ? 3 : 1 });
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    pick(e.dataTransfer.files?.[0]);
  };

  const useExample = () => {
    setFile(EXAMPLE.file);
    setFileError(null);
    setDocType(EXAMPLE.docType);
    setSupplier(EXAMPLE_SUPPLIER);
    setVersion(EXAMPLE.version);
  };

  /** Simulated extraction: the example document gives its own fields, any other file generic ones. */
  const extract = () => {
    if (file?.name === EXAMPLE.file.name) return EXAMPLE.fields();
    return [
      { key: "fabricant", label: "Fabricant", info: "Nom du fabricant indiqué dans le document.", value: supplier, page: 1, state: "à vérifier" as const },
      { key: "titre", label: "Titre du document", info: "Titre lu en première page.", value: file?.name.replace(/\.[^.]+$/, "") ?? "", page: 1, state: "à vérifier" as const },
    ];
  };

  const next = () => {
    if (step === 1) {
      if (!file) return setFileError("Sélectionnez un fichier à importer.");
      setStep(2);
    } else if (step === 2) {
      setTried(true);
      if (infoErrors.supplier || infoErrors.version) return;
      setFields(extract());
      setConfirmed(false);
      setPage(1);
      setStep(3);
    }
  };

  const save = () => {
    if (!file || !ready) return;
    actions.importPrerequisiteDocument(linked.id, {
      file: { ...file, fields: fields.map((f) => ({ label: f.label, value: f.value })) },
      docType,
      version: version.trim(),
      supplier,
    });
    toast.show({ title: "Document enregistré", description: `${linked.name} ${version.trim()} — informations vérifiées, prérequis vérifié.` });
    if (guideSave) {
      toast.show({ title: "Parcours", description: "Il reste le certificat GMP : demandez-le au responsable (Achats).", tone: "info" });
      go(14);
    } else onSaved(linked.id);
  };

  const fileBase = (file?.name ?? "document").replace(/\.[^.]+$/, "");
  const previewTitle = `${docType.split(" /")[0]} — ${supplier || "Fournisseur"}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Importer et vérifier un document"
      subtitle="Ajouter un document et vérifier les informations extraites automatiquement."
      footer={
        <>
          <Button variant="outline" size="lg" className="min-w-28" onClick={onClose}>
            Annuler
          </Button>
          {step > 1 && (
            <Button variant="outline" size="lg" className="min-w-28" onClick={() => setStep((s) => s - 1)}>
              Retour
            </Button>
          )}
          {step < 3 ? (
            <Button size="lg" className="min-w-36" iconRight={<ChevronRight className="h-5 w-5" />} onClick={next}>
              Continuer
            </Button>
          ) : (
            <Button size="lg" className="min-w-40 disabled:bg-slate-300" icon={<Save className="h-5 w-5" />} disabled={!ready} onClick={save} guide={14}>
              Enregistrer
            </Button>
          )}
        </>
      }
    >
      <ImportSteps current={step} />

      {step === 1 && (
        <div className="mt-6 space-y-4">
          <p className="text-[15px] text-ink-700">
            Prérequis : <strong className="text-ink-900">{prerequisite.name}</strong> — projet {project.code} • {project.name}
          </p>
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-line-strong px-4 py-3">
              <FileText className="h-8 w-8 text-ink-600" strokeWidth={1.4} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink-900">{file.name}</span>
                <span className="block text-sm text-ink-500">
                  {file.size}
                  {file.pages ? ` · ${file.pages} pages` : ""}
                </span>
              </span>
              <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-label="Fichier prêt" />
              <button type="button" aria-label="Retirer le fichier" onClick={() => setFile(null)} className="cursor-pointer rounded p-1 text-ink-500 hover:bg-slate-100">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-10 text-center hover:border-brand-400"
            >
              <Upload className="h-7 w-7 text-brand-600" aria-hidden />
              <span className="font-semibold text-brand-700">Glisser-déposer ou cliquer pour choisir un fichier</span>
              <span className="text-sm text-ink-500">PDF, DOC, XLSX (max. 10 Mo)</span>
            </button>
          )}
          {fileError && (
            <p className="flex items-center gap-1.5 text-sm text-danger-600" role="alert">
              <CircleAlert className="h-4 w-4 fill-danger-600 text-white" aria-hidden />
              {fileError}
            </p>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xlsx" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          {!file && (
            <Button variant="link" onClick={useExample}>
              Utiliser le document d&apos;exemple ({EXAMPLE.file.name})
            </Button>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Field label="Type de document" required htmlFor="imp-type">
            <Select id="imp-type" options={DOC_TYPES} value={docType} onChange={(e) => setDocType(e.target.value)} />
          </Field>
          <Field label="Prérequis associé" required htmlFor="imp-prereq">
            <Select id="imp-prereq" options={prerequisites.filter((p) => p.category === "Documents").map((p) => ({ value: p.id, label: p.name }))} value={linkedId} onChange={(e) => setLinkedId(e.target.value)} />
          </Field>
          <Field label="Fournisseur" required htmlFor="imp-supplier" error={tried ? infoErrors.supplier : null}>
            <Select id="imp-supplier" placeholder="À sélectionner" options={SUPPLIERS} value={supplier} invalid={tried && Boolean(infoErrors.supplier)} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
          <Field label="Version" required htmlFor="imp-version" error={tried ? infoErrors.version : null} hint={linked.reference ? `Version actuelle : ${linked.reference}` : undefined}>
            <Input id="imp-version" value={version} placeholder="Ex. v4" invalid={tried && Boolean(infoErrors.version)} onChange={(e) => setVersion(e.target.value)} />
          </Field>
          <Field label="Date du document" htmlFor="imp-date" optional>
            <DateInput id="imp-date" value={docDate} onChange={setDocDate} onClear={() => setDocDate("")} />
          </Field>
          <p className="col-span-2 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            « Continuer » lance l&apos;extraction automatique des informations du document : vous les vérifierez à l&apos;étape suivante.
          </p>
        </div>
      )}

      {step === 3 && file && (
        <div className="mt-6 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5">
          <DocumentPreview title={previewTitle} fileBase={fileBase} page={page} pages={pages} onPage={setPage} />
          <div className="min-w-0">
            <div className="flex gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3">
              <CircleAlert className="h-5 w-5 shrink-0 fill-warn-500 text-white" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-warn-700">Extraction automatique à vérifier</p>
                <p className="text-ink-700">Les informations ci-dessous ont été extraites automatiquement. Veuillez les vérifier et les corriger si nécessaire.</p>
              </div>
            </div>
            <h3 className="mt-4 font-semibold text-ink-900">Informations extraites</h3>
            <GuideSpot
              step={14}
              active={!ready}
              className="mt-2 rounded-xl"
              hint="À faire d'abord : accepter (ou corriger) la description du procédé, cocher la confirmation, puis « Enregistrer »."
            >
              <div className="space-y-3">
                {fields.map((f) => (
                  <ExtractedField key={f.key} field={f} onSource={setPage} onChange={(n) => setFields((list) => list.map((x) => (x.key === n.key ? n : x)))} />
                ))}
              </div>
              <Checkbox
                className="mt-4"
                checked={confirmed}
                onChange={setConfirmed}
                label={
                  <>
                    Je confirme avoir vérifié les informations extraites. <span className="text-danger-600">*</span>
                  </>
                }
              />
            </GuideSpot>
            {!ready && (
              <p className="mt-3 text-sm text-ink-500">
                {pending.length
                  ? `À valider avant l'enregistrement : ${pending.map((f) => f.label).join(", ")}.`
                  : "Cochez la confirmation pour enregistrer le document."}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
