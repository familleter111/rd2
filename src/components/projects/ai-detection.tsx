"use client";

/**
 * "Détection IA" of step 1 of the creation of a project (screens IA-01 → IA-06): the documents are
 * dropped, read, their data shown with their source, the dosage gap resolved, the R&D suggestions
 * reviewed, then everything is applied to the form. The detection is simulated (see lib/data-ai.ts).
 */
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Eye,
  FileText,
  FlaskConical,
  Info,
  Link2,
  ListChecks,
  Loader2,
  Settings,
  Sparkles,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { Fragment, useEffect, useState, type DragEvent } from "react";
import { GuideSpot } from "@/components/guide/guide-mark";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Radio, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { TEMPLATE_BY_FAMILY } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import {
  AI_ACTIVITIES,
  AI_DOSAGE_OPTIONS,
  AI_DOSAGE_REASON,
  AI_ELEMENTS,
  AI_EXTRACTS,
  AI_FIELDS,
  AI_FILES,
  AI_MISSING,
  AI_PREFILL,
  aiFileDetail,
  aiFileKind,
  dosageActivity,
  type AiActivityKey,
  type AiStage,
} from "@/lib/data-ai";
import { formatFileSize, plural } from "@/lib/format";
import { IA } from "@/lib/guide";
import type { AiPrefill, ProjectDraft } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export type AiTab = "produit" | "parcours" | "points";

export interface AiDosageChoice {
  value: string;
  reason: string;
  /** Adds the activity updating the document that keeps the other value. */
  activity: boolean;
}

export interface AiState {
  phase: "idle" | "running" | "data" | "conflict";
  /** Progress of the simulated reading, 0 → 100. */
  progress: number;
  /** "Réduire la fenêtre": the detection goes on, its progress is shown in the page. */
  minimized: boolean;
  tab: AiTab;
  dosage: AiDosageChoice | null;
  /** Proposed activities kept in the "Parcours R&D" tab. */
  activities: AiActivityKey[];
  /** Source shown in "Source sélectionnée" (index in AI_EXTRACTS, highlighted line). */
  source: { extract: number; ref?: string };
}

const CONFIRMED_DOSAGE: AiDosageChoice = { value: "250", reason: AI_DOSAGE_REASON, activity: true };

export const AI_IDLE: AiState = {
  phase: "idle",
  progress: 0,
  minimized: false,
  tab: "produit",
  dosage: null,
  activities: ["formule", "essais", "stabilite", "dosage"],
  source: { extract: 0, ref: "B2" },
};

export function aiStateFor(stage: AiStage | undefined): AiState {
  switch (stage) {
    case "analyse":
      return { ...AI_IDLE, phase: "running" };
    case "donnees":
      return { ...AI_IDLE, phase: "data", progress: 100 };
    case "ecart":
      return { ...AI_IDLE, phase: "conflict", progress: 100 };
    case "parcours":
      return { ...AI_IDLE, phase: "data", progress: 100, tab: "parcours", dosage: CONFIRMED_DOSAGE };
    case "applique":
      return { ...AI_IDLE, progress: 100, dosage: CONFIRMED_DOSAGE };
    default:
      return AI_IDLE;
  }
}

/** Draft of the guided tour: code GL-01 and the three documents of the scenario. */
export function aiDraft(base: ProjectDraft, stage: AiStage): ProjectDraft {
  const draft = { ...base, code: "GL-01", files: AI_FILES.map(({ name, size }) => ({ name, size })) };
  return stage === "applique" ? applyDetection(draft, aiStateFor(stage)) : draft;
}

/** Runs the simulated reading (about 3 s), also while the window is reduced. */
export function useDetectionProgress(ai: AiState, setAi: (update: (a: AiState) => AiState) => void) {
  const running = ai.phase === "running" && ai.progress < 100;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setAi((a) => (a.progress >= 100 ? a : { ...a, progress: Math.min(100, a.progress + 2) })), 60);
    return () => window.clearInterval(timer);
  }, [running, setAi]);
}

/** Screen of the series shown by the wizard (step 1), or `null` for screen 07. */
export function aiScreen(ai: AiState, draft: ProjectDraft): { n: number; label: string } | null {
  if (ai.phase === "running") return { n: IA.analyse, label: "Détection en cours" };
  if (ai.phase === "conflict") return { n: IA.ecart, label: "Résolution d'un écart" };
  if (ai.phase === "data") return ai.tab === "parcours" ? { n: IA.parcours, label: "Suggestions R&D" } : { n: IA.donnees, label: "Données et provenance" };
  if (draft.ai) return { n: IA.applique, label: "Préremplissage confirmé" };
  if (draft.files.length) return { n: IA.depot, label: "Dépôt des documents" };
  return null;
}

const activitiesOf = (ai: AiState) => {
  const dosage = ai.dosage ?? CONFIRMED_DOSAGE;
  return [...AI_ACTIVITIES, ...(dosage.activity ? [dosageActivity(dosage.value)] : [])].filter((a) => ai.activities.includes(a.key));
};

/** "Appliquer au formulaire": writes the detected values in the draft (tagged "Issu des documents"). */
export function applyDetection(draft: ProjectDraft, ai: AiState): ProjectDraft {
  const dosage = ai.dosage ?? CONFIRMED_DOSAGE;
  return {
    ...draft,
    ...AI_PREFILL,
    countries: [...AI_PREFILL.countries],
    template: TEMPLATE_BY_FAMILY[AI_PREFILL.family],
    dosage: dosage.value,
    dosageUnit: "mg",
    ai: {
      fields: { name: "documents", dci: "documents", family: "documents", form: "documents", dosage: "confirme", countries: "documents", referenceProduct: "documents" },
      activities: activitiesOf(ai).map((a) => ({ title: a.title, detail: a.detail })),
      prerequisites: AI_MISSING.map((m) => m.name),
      dosageReason: dosage.reason.trim(),
      files: draft.files.map((f) => f.name),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const FILE_LOOK = {
  xlsx: { className: "bg-success-600", label: "X" },
  pdf: { className: "bg-danger-600 text-[8px]", label: "PDF" },
  docx: { className: "bg-brand-600", label: "W" },
};

/** Excel / PDF / Word tile. */
export function FileTypeIcon({ name, small }: { name: string; small?: boolean }) {
  const kind = aiFileKind(name);
  if (kind === "other") return <FileText className={cn("shrink-0 text-brand-600", small ? "h-5 w-5" : "h-7 w-7")} aria-hidden />;
  const look = FILE_LOOK[kind];
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded font-bold text-white", small ? "h-6 w-5 text-[10px]" : "h-8 w-7 text-xs", look.className)}
    >
      {look.label}
    </span>
  );
}

/** Tag of a field filled by the detection. */
export function SourceTag({ confirmed }: { confirmed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-ink-700 ring-1 ring-inset ring-brand-100">
      <Sparkles className="h-3 w-3 text-violet-500" aria-hidden />
      {confirmed ? "Choix confirmé" : "Issu des documents"}
    </span>
  );
}

function AiIcon() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50" aria-hidden>
      <Sparkles className="h-6 w-6 text-violet-500" strokeWidth={1.8} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* IA-01 — Dépôt des documents                                         */
/* ------------------------------------------------------------------ */

const ACCEPTED = ["pdf", "docx", "xlsx"];
const MAX_SIZE = 10 * 1024 * 1024;

/** "Démarrer à partir de vos documents": drop zone, files and the "Détection IA" button. */
export function DocumentsStart({
  draft,
  setDraft,
  ai,
  onDetect,
  onShow,
  onPreview,
}: {
  draft: ProjectDraft;
  setDraft: (d: ProjectDraft) => void;
  ai: AiState;
  onDetect: () => void;
  /** Reopens the reduced detection window (or its result). */
  onShow: () => void;
  onPreview: (name: string) => void;
}) {
  const [rejected, setRejected] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const running = ai.phase === "running";
  // Detection reduced, or finished and closed without applying it: its state stays in the page.
  const status = (running && ai.minimized) || (ai.phase === "idle" && ai.progress >= 100);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: ProjectDraft["files"] = [];
    const refused: string[] = [];
    Array.from(list).forEach((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED.includes(ext)) refused.push(`${f.name} : format non accepté`);
      else if (f.size > MAX_SIZE) refused.push(`${f.name} : fichier supérieur à 10 Mo`);
      else if (!draft.files.some((x) => x.name === f.name)) accepted.push({ name: f.name, size: formatFileSize(f.size) });
    });
    setRejected(refused);
    if (accepted.length) setDraft({ ...draft, files: [...draft.files, ...accepted] });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <section aria-labelledby="ai-start-title">
      <h2 id="ai-start-title" className="flex items-center gap-2 text-xl font-bold text-ink-900">
        Démarrer à partir de vos documents
        <Sparkles className="h-5 w-5 text-violet-500" aria-hidden />
      </h2>
      <p className="mt-1 max-w-2xl text-[15px] text-ink-600">
        Ajoutez vos documents pour permettre à l&apos;IA d&apos;identifier automatiquement les informations produit et les éléments utiles au parcours R&amp;D.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div>
          <GuideSpot step={IA.depot} hint="Déposez les documents du projet : les 3 documents d'exemple sont ajoutés." active={draft.files.length === 0}>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-5 text-center transition-colors",
                over ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-subtle hover:border-brand-300 hover:bg-brand-50/60",
              )}
            >
              <CloudUpload className="h-9 w-9 text-brand-500" strokeWidth={1.5} aria-hidden />
              <span className="mt-1.5 font-semibold text-ink-900">Déposer des fichiers ici</span>
              <span className="text-sm text-brand-600">ou cliquer pour parcourir</span>
              <span className="mt-1.5 text-[13px] text-ink-500">PDF, DOCX, XLSX • 10 Mo max par fichier</span>
              <input type="file" multiple accept=".pdf,.docx,.xlsx" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            </label>
          </GuideSpot>
          {rejected.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-danger-600" role="alert">
              {rejected.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {draft.files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {draft.files.map((f) => (
                <li key={f.name} className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-2 text-sm">
                  <FileTypeIcon name={f.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink-900">{f.name}</span>
                    <span className="block text-[13px] text-ink-500">{aiFileDetail(f.name, f.size)}</span>
                  </span>
                  <span className="flex w-28 items-center gap-1.5 text-success-700">
                    <CircleCheck className="h-[18px] w-[18px] fill-success-500 text-white" aria-hidden />
                    Prêt
                  </span>
                  <button
                    type="button"
                    aria-label={`Aperçu de ${f.name}`}
                    onClick={() => onPreview(f.name)}
                    className="cursor-pointer rounded p-1 text-brand-600 hover:bg-brand-50"
                  >
                    <Eye className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Retirer ${f.name}`}
                    disabled={running}
                    onClick={() => setDraft({ ...draft, files: draft.files.filter((x) => x.name !== f.name) })}
                    className="cursor-pointer rounded p-1 text-brand-700 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col justify-center rounded-xl border border-line p-4">
          {status ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-ink-900">
                {ai.progress < 100 ? <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden /> : <CircleCheck className="h-4 w-4 text-success-600" aria-hidden />}
                {ai.progress < 100 ? "Détection en cours…" : "Détection terminée"}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={ai.progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-brand-600 transition-[width] duration-100" style={{ width: `${ai.progress}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-ink-500">{ai.progress} %</p>
              <Button
                variant={ai.progress < 100 ? "outline" : "primary"}
                className="mt-3"
                onClick={onShow}
                guide={ai.progress < 100 ? undefined : IA.donnees}
              >
                {ai.progress < 100 ? "Afficher la détection" : "Voir les informations détectées"}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="lg"
                icon={<Sparkles className="h-5 w-5" />}
                disabled={draft.files.length === 0 || running}
                onClick={onDetect}
                guide={IA.analyse}
                guideHint="Lancez la lecture des 3 documents."
              >
                Détection IA
              </Button>
              <p className="mt-3 text-sm text-ink-600">Identifiez les informations produit et les éléments utiles au parcours R&amp;D.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/** "Pièces initiales" once the detection is applied (screen IA-06). */
export function AnalysedFiles({ files, onReview }: { files: ProjectDraft["files"]; onReview: (name: string) => void }) {
  return (
    <Field label="Pièces initiales" optional info="Les pièces seront ajoutées aux documents du projet (catégorie Références).">
      <ul className="space-y-2 rounded-xl border-2 border-dashed border-brand-200 bg-subtle/60 p-3">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-4 rounded-lg border border-line bg-white px-4 py-2.5 text-sm">
            <FileTypeIcon name={f.name} />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink-900">{f.name}</span>
            <span className="w-16 text-ink-500">{f.size}</span>
            <span className="flex w-40 items-center gap-1.5 text-success-700">
              <CircleCheck className="h-[18px] w-[18px] fill-success-500 text-white" aria-hidden />
              Analyse terminée
            </span>
            <Button variant="outline" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => onReview(f.name)}>
              Revoir la détection
            </Button>
          </li>
        ))}
      </ul>
    </Field>
  );
}

/** Right column before the detection: "Ce que l'IA recherchera". */
export function AiLookupCard() {
  const items = [
    { icon: FileText, title: "Informations produit", detail: "Nom du projet, DCI, forme, dosage, famille, pays cible, produit de référence…" },
    { icon: FlaskConical, title: "Formules et matières", detail: "Formulation, composition, excipients, spécifications des matières premières…" },
    { icon: Settings, title: "Essais et méthodes", detail: "Méthodes analytiques, essais de développement, critères d'acceptation, plans d'essais…" },
    { icon: FileText, title: "Prérequis documentaires", detail: "Documents réglementaires, lignes directrices applicables, références…" },
  ];
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink-900">Ce que l&apos;IA recherchera</h2>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3.5">
            <IconTile icon={item.icon} className="bg-brand-50 text-ink-700" />
            <div>
              <p className="font-semibold text-ink-900">{item.title}</p>
              <p className="text-sm text-ink-600">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex gap-2.5 rounded-xl border border-brand-100 bg-brand-50/70 p-3.5 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        <div>
          <p className="font-semibold text-brand-800">Sources visibles avant application</p>
          <p className="mt-0.5 text-ink-700">
            Les informations détectées par l&apos;IA vous seront présentées avant toute application dans le formulaire. Vous pourrez valider, modifier ou ignorer chaque élément.
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Right column after the detection (screen IA-06): the proposed activities. */
export function AiActivitiesCard({ prefill }: { prefill: AiPrefill }) {
  const count = prefill.activities.length;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-violet-500" strokeWidth={1.7} aria-hidden />
        <div>
          <h2 className="text-lg font-bold text-ink-900">
            {count} {plural(count, "activité proposée", "activités proposées")}
          </h2>
          <p className="text-sm text-ink-600">Suggestions issues de vos documents, à confirmer et affecter à l&apos;étape Parcours &amp; équipe.</p>
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        {prefill.activities.map((a, i) => {
          const summary = [...AI_ACTIVITIES, dosageActivity("250"), dosageActivity("200")].find((x) => x.title === a.title)?.summary ?? a.detail;
          return (
            <li key={a.title} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{a.title}</p>
                <p className="text-[13px] text-ink-500">{summary}</p>
              </div>
              <Badge tone="info">Brouillon</Badge>
            </li>
          );
        })}
      </ol>
      {prefill.prerequisites.length > 0 && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-warn-200 bg-warn-50 p-3.5 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" aria-hidden />
          <div>
            <p className="font-semibold text-ink-900">Prérequis documentaires à compléter</p>
            <p className="text-ink-600">
              {prefill.prerequisites.join(", ")} — ajoutés aux prérequis du projet, à affecter à l&apos;étape suivante.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* IA-02 — Détection en cours                                          */
/* ------------------------------------------------------------------ */

const PHASES = ["Lire les fichiers", "Croiser les informations", "Préparer les suggestions"];

function PhaseSteps({ progress }: { progress: number }) {
  const current = progress >= 100 ? 3 : progress < 34 ? 0 : progress < 80 ? 1 : 2;
  return (
    <div role="group" className="flex items-start" aria-label="Étapes de la détection">
      {PHASES.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && <span aria-hidden className={cn("mt-4 h-0.5 flex-1", i <= current ? "bg-brand-600" : "bg-line-strong")} />}
            <div className="flex w-44 flex-col items-center text-center">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-sm font-semibold",
                  done ? "border-brand-600 bg-brand-600 text-white" : active ? "border-brand-600 text-brand-600" : "border-line-strong text-ink-500",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : active ? <span className="h-3 w-3 rounded-full bg-brand-600" /> : i + 1}
              </span>
              <span className={cn("mt-2 text-sm", done || active ? "font-medium text-ink-900" : "text-ink-500")}>{label}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export function DetectionModal({
  open,
  ai,
  files,
  onCancel,
  onMinimize,
  onShow,
}: {
  open: boolean;
  ai: AiState;
  files: ProjectDraft["files"];
  onCancel: () => void;
  onMinimize: () => void;
  onShow: () => void;
}) {
  const done = ai.progress >= 100;
  const perFile = 33 / Math.max(files.length, 1);
  return (
    <Modal
      open={open}
      onClose={onMinimize}
      size="md"
      centered
      icon={<Sparkles className="h-10 w-10 text-violet-500" strokeWidth={1.5} aria-hidden />}
      title={done ? "Détection IA terminée" : "Détection IA en cours"}
      subtitle={`Lecture de ${files.length} ${plural(files.length, "document")} pour préparer GL-01.`}
    >
      <PhaseSteps progress={ai.progress} />
      <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
        {files.map((f, i) => {
          const read = ai.progress >= (i + 1) * perFile;
          const reading = !read && ai.progress >= i * perFile;
          return (
            <li key={f.name} className="flex items-center gap-3 px-4 py-2.5">
              <FileTypeIcon name={f.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{f.name}</span>
                <span className="block text-[13px] text-ink-500">{read ? `Lu • ${aiFileDetail(f.name, f.size)}` : reading ? "Lecture en cours" : "En attente"}</span>
              </span>
              {read ? (
                <CircleCheck className="h-6 w-6 fill-success-500 text-white" aria-label="Lu" />
              ) : reading ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-label="Lecture en cours" />
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Avancement de la détection" aria-valuenow={ai.progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-100" style={{ width: `${ai.progress}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink-600" aria-live="polite">
        {done
          ? "Détection terminée : 6 données prêtes à reprendre, 1 écart à résoudre, 1 donnée non trouvée."
          : "Recherche des informations produit, des essais prévus et des pièces manquantes…"}
      </p>
      <p className="mt-4 flex items-center gap-2.5 rounded-lg border border-brand-100 bg-brand-50/70 px-3.5 py-2.5 text-sm text-ink-700">
        <Info className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        Vos champs seront préremplis après votre confirmation.
      </p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Annuler l&apos;analyse
        </Button>
        {done ? (
          <Button iconRight={<ArrowRight className="h-4 w-4" />} onClick={onShow} guide={IA.donnees}>
            Voir les informations détectées
          </Button>
        ) : (
          <Button variant="outline" icon={<ChevronDown className="h-4 w-4" />} onClick={onMinimize}>
            Réduire la fenêtre
          </Button>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* IA-03 / IA-05 — Informations détectées (Produit, Parcours R&D, Points) */
/* ------------------------------------------------------------------ */

function SourcePanel({
  ai,
  setSource,
  showFiles,
  setShowFiles,
}: {
  ai: AiState;
  setSource: (s: AiState["source"]) => void;
  showFiles: boolean;
  setShowFiles: (v: boolean) => void;
}) {
  const extract = AI_EXTRACTS[ai.source.extract];
  const sheet = aiFileKind(extract.file) === "xlsx";
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-ink-900">Source sélectionnée</h3>
        {showFiles && (
          <button type="button" onClick={() => setShowFiles(false)} className="cursor-pointer text-[13px] font-semibold text-brand-700 hover:underline">
            Voir l&apos;extrait
          </button>
        )}
      </div>
      {showFiles ? (
        <ul className="mt-3 space-y-2">
          {AI_FILES.map((f) => (
            <li key={f.name}>
              <button
                type="button"
                onClick={() => {
                  setSource({ extract: AI_EXTRACTS.findIndex((x) => x.file === f.name) });
                  setShowFiles(false);
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-left hover:border-brand-200 hover:bg-subtle"
              >
                <FileTypeIcon name={f.name} small />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900">{f.name}</span>
                  <span className="block text-xs text-ink-500">Lu • {f.detail}</span>
                </span>
                <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2.5">
            <FileTypeIcon name={extract.file} small />
            <Select
              aria-label="Source"
              size="sm"
              className="flex-1"
              options={AI_EXTRACTS.map((x, i) => ({ value: String(i), label: `${x.file} — ${x.where.replace("Feuille : ", "")}` }))}
              value={String(ai.source.extract)}
              onChange={(e) => setSource({ extract: Number(e.target.value) })}
            />
          </div>
          <p className="mt-1 pl-8 text-xs text-ink-500">{extract.where}</p>
          <p className="mt-4 text-sm font-semibold text-ink-800">Extrait du document</p>
          {sheet ? (
            <table className="mt-2 w-full overflow-hidden rounded-lg border border-line text-[13px]">
              <thead className="bg-subtle text-ink-600">
                <tr>
                  <th className="w-9 border-r border-line py-1.5 font-medium" aria-label="Ligne" />
                  <th className="border-r border-line px-2 py-1.5 text-left font-medium">A</th>
                  <th className="px-2 py-1.5 text-left font-medium">B</th>
                </tr>
              </thead>
              <tbody>
                {extract.rows.map((r) => (
                  <tr key={r.ref} className={cn("border-t border-line", r.ref === ai.source.ref && "bg-brand-50")}>
                    <td className="border-r border-line bg-subtle py-1.5 text-center text-ink-500">{r.ref.slice(1)}</td>
                    <td className="border-r border-line px-2 py-1.5 text-ink-600">{r.label}</td>
                    <td className={cn("px-2 py-1.5 text-ink-900", r.ref === ai.source.ref && "font-semibold text-brand-800")}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="mt-2 space-y-1.5 rounded-lg border border-line bg-subtle/60 p-3 text-[13px] leading-relaxed">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{extract.where}</p>
              {extract.rows.map((r) => (
                <p key={r.ref} className={cn("rounded px-1.5 py-0.5 text-ink-700", r.ref === ai.source.ref && "bg-brand-100/70 text-brand-900")}>
                  <span className="font-semibold">{r.label} :</span> {r.value}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductTab({
  ai,
  setSource,
  onResolve,
  showFiles,
  setShowFiles,
}: {
  ai: AiState;
  setSource: (s: AiState["source"]) => void;
  onResolve: () => void;
  showFiles: boolean;
  setShowFiles: (v: boolean) => void;
}) {
  const dosage = ai.dosage && AI_DOSAGE_OPTIONS.find((o) => o.value === ai.dosage?.value);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-ink-600">
            <tr>
              <th className="w-10" aria-label="État" />
              <th className="py-2.5 pr-3 font-semibold">Champ</th>
              <th className="py-2.5 pr-3 font-semibold">Valeur détectée</th>
              <th className="py-2.5 pr-3 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {AI_FIELDS.map((f) => {
              const resolved = f.status === "ecart" && dosage;
              const status = resolved ? "ok" : f.status;
              const extract = resolved ? dosage.extract : f.extract;
              const ref = resolved ? dosage.ref : f.ref;
              const selected = extract === ai.source.extract && ref === ai.source.ref;
              const select = () => {
                if (extract === undefined) return;
                setSource({ extract, ref });
                setShowFiles(false);
              };
              return (
                <tr
                  key={f.key}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={select}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                    e.preventDefault();
                    select();
                  }}
                  className={cn(
                    "cursor-pointer border-t border-line outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300",
                    status === "ecart" ? "bg-warn-50" : status === "absent" ? "bg-danger-50/70" : selected ? "bg-brand-50/70" : "hover:bg-subtle",
                  )}
                >
                  <td className="py-3 pl-4">
                    {status === "ok" ? (
                      <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-label="Donnée prête" />
                    ) : status === "ecart" ? (
                      <TriangleAlert className="h-5 w-5 text-warn-600" aria-label="Écart" />
                    ) : (
                      <CircleAlert className="h-5 w-5 fill-danger-600 text-white" aria-label="Non trouvée" />
                    )}
                  </td>
                  <td className="py-3 pr-3 font-medium text-ink-900">{f.label}</td>
                  <td className={cn("py-3 pr-3", status === "ecart" ? "font-semibold text-warn-700" : status === "absent" ? "font-semibold text-danger-700" : "text-ink-800")}>
                    {resolved ? dosage.label : f.value}
                  </td>
                  <td className="py-3 pr-3">
                    {status === "ecart" ? (
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-warn-700">{f.source}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolve();
                          }}
                          guide={IA.ecart}
                          guideHint="Choisissez la valeur du dosage à retenir."
                        >
                          Résoudre
                        </Button>
                      </span>
                    ) : (
                      <span className={status === "absent" ? "text-danger-700" : "text-ink-600"}>{resolved ? `Choix confirmé • ${dosage.source}` : f.source}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SourcePanel ai={ai} setSource={setSource} showFiles={showFiles} setShowFiles={setShowFiles} />
    </div>
  );
}

function SourceChip({ label, where, onClick }: { label: string; where?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-start gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-left text-xs text-brand-800 ring-1 ring-inset ring-brand-100 hover:bg-brand-100"
    >
      <Link2 className="mt-0.5 h-3.5 w-3.5" aria-hidden />
      <span>
        <span className="block font-semibold">{label}</span>
        {where && <span className="block text-ink-600">{where}</span>}
      </span>
    </button>
  );
}

function PathwayTab({
  ai,
  setAi,
  onResolve,
  openSource,
}: {
  ai: AiState;
  setAi: (update: (a: AiState) => AiState) => void;
  onResolve: () => void;
  openSource: (extract: number) => void;
}) {
  const dosage = ai.dosage;
  const activities = [...AI_ACTIVITIES, ...(dosage?.activity ? [dosageActivity(dosage.value)] : [])];
  const toggle = (key: AiActivityKey, on: boolean) =>
    setAi((a) => ({ ...a, activities: on ? [...a.activities, key] : a.activities.filter((k) => k !== key) }));

  return (
    <div className="space-y-4">
      {dosage ? (
        <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <div>
            <p className="font-semibold text-brand-800">
              Dosage retenu : {dosage.value} mg · Écart documenté
            </p>
            <p className="text-ink-700">
              Le dosage de {dosage.value} mg a été identifié dans vos documents et sera utilisé pour préparer le parcours.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-sm">
          <TriangleAlert className="h-5 w-5 shrink-0 text-warn-600" aria-hidden />
          <p className="flex-1 text-ink-800">
            <span className="font-semibold">Dosage à confirmer : 250 mg / 200 mg.</span> Résolvez l&apos;écart avant d&apos;appliquer les suggestions.
          </p>
          <Button variant="outline" size="sm" onClick={onResolve}>
            Résoudre l&apos;écart
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-start gap-3">
            <IconTile icon={FileText} size="sm" className="bg-brand-50 text-brand-600" />
            <div>
              <h3 className="font-bold text-ink-900">Éléments détectés</h3>
              <p className="text-[13px] text-ink-500">Informations extraites de vos documents (à titre indicatif).</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {AI_ELEMENTS.map((el) => (
              <li key={el.title} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                <FileTypeIcon name={el.file} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">{el.title}</p>
                  <p className="text-[13px] text-ink-500">{el.detail}</p>
                </div>
                <SourceChip label={el.source} where={el.where} onClick={() => openSource(el.extract)} />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="flex items-start gap-3">
            <IconTile icon={ListChecks} size="sm" className="bg-brand-50 text-brand-600" />
            <div>
              <h3 className="font-bold text-ink-900">Activités proposées</h3>
              <p className="text-[13px] text-ink-500">Suggestions de tâches pour votre parcours R&amp;D.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {activities.map((a) => (
              <li key={a.key} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                <Checkbox
                  className="min-w-0 flex-1"
                  checked={ai.activities.includes(a.key)}
                  onChange={(v) => toggle(a.key, v)}
                  label={<span className="font-semibold">{a.title}</span>}
                  description={a.detail}
                />
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {a.source ? (
                    <SourceChip label={a.source} where={a.where} onClick={a.extract !== undefined ? () => openSource(a.extract!) : undefined} />
                  ) : a.tag ? (
                    <Badge tone={a.tag.tone} icon>
                      {a.tag.label}
                    </Badge>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-ink-600">
                    <User className="h-3.5 w-3.5" aria-hidden />
                    Brouillon · À affecter
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="flex items-start gap-3">
          <IconTile icon={TriangleAlert} size="sm" tone="warn" />
          <div>
            <h3 className="font-bold text-ink-900">Prérequis à compléter</h3>
            <p className="text-[13px] text-ink-500">Informations manquantes ou à confirmer dans vos documents.</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {AI_MISSING.map((m) => (
            <li key={m.name} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
              <IconTile icon={FileText} size="sm" tone={m.tone} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink-900">{m.name}</p>
                  <Badge tone={m.tone} icon>
                    {m.status}
                  </Badge>
                </div>
                <p className="text-[13px] text-ink-500">{m.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-center gap-2.5 rounded-lg bg-brand-50/70 px-4 py-2.5 text-sm text-ink-700">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        Suggestions à confirmer à l&apos;étape Parcours &amp; équipe. Aucun essai n&apos;est déclaré réalisé.
      </p>
    </div>
  );
}

function PointsTab({ ai, onResolve }: { ai: AiState; onResolve: () => void }) {
  const dosage = ai.dosage;
  return (
    <ul className="space-y-3">
      <li className={cn("flex items-start gap-3 rounded-xl border p-4", dosage ? "border-line" : "border-warn-200 bg-warn-50")}>
        {dosage ? <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden /> : <TriangleAlert className="h-5 w-5 shrink-0 text-warn-600" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">Dosage — écart entre deux fichiers</p>
          <p className="text-sm text-ink-600">
            {dosage
              ? `${dosage.value} mg retenu. Motif : ${dosage.reason}`
              : "Formulation_F2.xlsx indique 250 mg, Protocole_essais_v1.docx indique 200 mg."}
          </p>
        </div>
        {dosage ? (
          <Badge tone="success">Résolu</Badge>
        ) : (
          <Button variant="outline" size="sm" onClick={onResolve}>
            Résoudre
          </Button>
        )}
      </li>
      <li className="flex items-start gap-3 rounded-xl border border-line p-4">
        <CircleAlert className="h-5 w-5 shrink-0 fill-danger-600 text-white" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">Responsable du projet — non trouvé</p>
          <p className="text-sm text-ink-600">À renseigner à l&apos;étape Parcours &amp; équipe.</p>
        </div>
        <Badge tone="neutral">Étape suivante</Badge>
      </li>
      {AI_MISSING.map((m) => (
        <li key={m.name} className="flex items-start gap-3 rounded-xl border border-line p-4">
          <FileText className={cn("h-5 w-5 shrink-0", m.tone === "danger" ? "text-danger-600" : "text-warn-600")} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-900">{m.name}</p>
            <p className="text-sm text-ink-600">{m.detail} Sera ajouté aux prérequis du projet.</p>
          </div>
          <Badge tone={m.tone}>{m.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function DetectedDataModal({
  open,
  ai,
  setAi,
  onClose,
  onResolve,
  onApply,
}: {
  open: boolean;
  ai: AiState;
  setAi: (update: (a: AiState) => AiState) => void;
  onClose: () => void;
  onResolve: () => void;
  onApply: () => void;
}) {
  const resolved = Boolean(ai.dosage);
  const [showFiles, setShowFiles] = useState(false);
  // Reopened ("Revoir la détection"): back to the extract of the selected source.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setShowFiles(false);
  }
  const setTab = (tab: AiTab) => setAi((a) => ({ ...a, tab }));
  const setSource = (source: AiState["source"]) => setAi((a) => ({ ...a, source }));
  const openSource = (extract: number) => setAi((a) => ({ ...a, tab: "produit", source: { extract } }));
  const ready = 6 + (resolved ? 1 : 0);
  const pathway = ai.tab === "parcours";

  const apply = (label: string, guide?: number) => (
    <span className="flex flex-col items-center gap-1">
      <Button disabled={!resolved} iconRight={guide ? <ArrowRight className="h-4 w-4" /> : undefined} onClick={onApply} guide={guide} guideHint="Les valeurs vérifiées sont écrites dans le formulaire.">
        {label}
      </Button>
      {!resolved && <span className="text-xs text-ink-500">Résolvez l&apos;écart de dosage</span>}
    </span>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<AiIcon />}
      title={pathway ? "Préparer le parcours R&D à partir des documents" : "Informations détectées dans vos documents"}
      subtitle={
        pathway
          ? "Nous avons analysé vos documents pour proposer un parcours adapté. Vérifiez et complétez si nécessaire."
          : `${ready} données prêtes à reprendre · ${resolved ? "écart de dosage résolu" : "1 écart à résoudre"} · 1 donnée non trouvée`
      }
      footer={
        ai.tab === "produit" ? (
          <>
            <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={() => setShowFiles(true)} className="mr-auto">
              Voir les fichiers
            </Button>
            {!resolved && (
              <Button variant="outline" icon={<TriangleAlert className="h-4 w-4" />} onClick={onResolve}>
                Résoudre l&apos;écart
              </Button>
            )}
            <Button variant={resolved ? "outline" : "primary"} iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => setTab("parcours")}>
              Continuer la vérification
            </Button>
            {apply("Appliquer")}
          </>
        ) : (
          <>
            <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setTab("produit")} className="mr-auto">
              Retour
            </Button>
            {apply("Appliquer au formulaire", IA.applique)}
          </>
        )
      }
    >
      <Tabs
        size="sm"
        items={[
          { value: "produit" as const, label: "Produit" },
          { value: "parcours" as const, label: "Parcours R&D" },
          { value: "points" as const, label: "Points à vérifier", count: resolved ? undefined : 1 },
        ]}
        value={ai.tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {ai.tab === "produit" && <ProductTab ai={ai} setSource={setSource} onResolve={onResolve} showFiles={showFiles} setShowFiles={setShowFiles} />}
        {ai.tab === "parcours" && <PathwayTab ai={ai} setAi={setAi} onResolve={onResolve} openSource={openSource} />}
        {ai.tab === "points" && <PointsTab ai={ai} onResolve={onResolve} />}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* IA-04 — Résolution d'un écart                                       */
/* ------------------------------------------------------------------ */

export function DosageConflictModal({
  open,
  current,
  onBack,
  onConfirm,
}: {
  open: boolean;
  current: AiDosageChoice | null;
  onBack: () => void;
  onConfirm: (choice: AiDosageChoice) => void;
}) {
  const [choice, setChoice] = useState<AiDosageChoice>(current ?? CONFIRMED_DOSAGE);
  const activity = dosageActivity(choice.value);
  const valid = choice.reason.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onBack}
      size="lg"
      icon={<Sparkles className="mt-1 h-6 w-6 text-brand-600" strokeWidth={1.7} aria-hidden />}
      title="Vérifier le dosage détecté"
      subtitle="Plusieurs valeurs de dosage ont été détectées dans les pièces jointes. Veuillez sélectionner la valeur correcte pour ce projet."
      footer={
        <>
          <Button variant="secondary" onClick={onBack} className="mr-auto">
            Retour
          </Button>
          <Button disabled={!valid} onClick={() => onConfirm({ ...choice, reason: choice.reason.trim() })} guide={IA.parcours} guideHint="250 mg est retenu, avec son motif.">
            Confirmer le choix
          </Button>
        </>
      }
    >
      <p className="flex items-center gap-2.5 rounded-lg border border-warn-200 bg-warn-50 px-4 py-2.5 text-sm text-warn-700">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
        Deux valeurs différentes ont été trouvées pour le même produit.
      </p>
      <div role="radiogroup" aria-label="Valeur du dosage" className="mt-4 grid gap-4 sm:grid-cols-2">
        {AI_DOSAGE_OPTIONS.map((o) => {
          const selected = choice.value === o.value;
          return (
            <div
              key={o.value}
              className={cn("rounded-xl border-2 p-4 transition-colors", selected ? "border-brand-500 bg-brand-50/40" : "border-line hover:border-line-strong")}
            >
              <div className="flex items-start justify-between gap-3">
                <Radio
                  name="ai-dosage"
                  checked={selected}
                  onChange={() => setChoice((c) => ({ ...c, value: o.value }))}
                  label={<span className="text-xl font-bold">{o.label}</span>}
                />
                {selected && <Badge tone="info">Valeur retenue</Badge>}
              </div>
              <ul className="mt-3 space-y-1.5 pl-8 text-sm text-ink-700">
                <li className="flex items-center gap-2">
                  <FileTypeIcon name={o.file} small />
                  <span className="font-semibold text-ink-900">{o.file}</span>
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-ink-500" aria-hidden />
                  {o.location}
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-ink-500" aria-hidden />
                  {o.document}
                </li>
              </ul>
            </div>
          );
        })}
      </div>
      <Field label="Motif du choix" required htmlFor="ai-dosage-reason" className="mt-5" error={valid ? null : "Indiquez le motif du choix."}>
        <Textarea id="ai-dosage-reason" rows={3} value={choice.reason} invalid={!valid} onChange={(e) => setChoice((c) => ({ ...c, reason: e.target.value }))} />
      </Field>
      <Checkbox
        className="mt-4"
        checked={choice.activity}
        onChange={(v) => setChoice((c) => ({ ...c, activity: v }))}
        label={activity.check}
        description="Une tâche sera ajoutée au parcours pour mettre à jour le document concerné."
      />
      <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-500">
        <Info className="h-4 w-4" aria-hidden />
        Les fichiers sources ne seront pas modifiés.
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* File preview (eye button of the files)                              */
/* ------------------------------------------------------------------ */

export function FilePreviewModal({ name, onClose }: { name: string | null; onClose: () => void }) {
  const extracts = AI_EXTRACTS.filter((x) => x.file === name);
  return (
    <Modal open={name !== null} onClose={onClose} size="md" title={name ?? ""} subtitle={name ? aiFileDetail(name, "Pièce déposée") : undefined}>
      {extracts.length ? (
        <div className="space-y-4">
          {extracts.map((x) => (
            <div key={x.where} className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{x.where}</p>
              <dl className="mt-2 grid grid-cols-[180px_1fr] gap-x-4 gap-y-1.5 text-sm">
                {x.rows.map((r) => (
                  <div key={r.ref} className="contents">
                    <dt className="text-ink-600">{r.label}</dt>
                    <dd className="text-ink-900">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2.5 text-sm text-ink-600">
          <Info className="h-4 w-4 text-brand-600" aria-hidden />
          Aperçu non disponible pour ce fichier dans la démonstration.
        </p>
      )}
    </Modal>
  );
}
