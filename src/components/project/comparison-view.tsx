"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleEllipsis,
  CirclePlus,
  CircleX,
  Clock,
  Copy,
  Download,
  Ellipsis,
  FileText,
  Info,
  Package,
  Paperclip,
  Scale,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge, StatusDot, TONE_TEXT } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Radio, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadText, formatDateTime, formatNumber, formatNumeric, toCsv } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { criteriaFor, decisionFor, decisionLocked, findProject, pendingTests, projectDecisions, projectFormulas, testsForFormula } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { DecisionChoice, Formula, FormulaDecision, FormulaStatus, LotType, Project, TestStatus, Tone } from "@/lib/types";
import { DecisionReviewModal } from "./decision-review";
import { CRITERION_ICONS, FormulaStatusBadge } from "./formula-bits";
import { FormulaSubTabs, ProjectTabs } from "./project-frame";

const CHOICES: { value: DecisionChoice; label: string; detail: string }[] = [
  { value: "poursuivre", label: "Poursuivre les essais", detail: "Compléter les essais en cours avant une décision finale." },
  { value: "retenir", label: "Retenir une formule", detail: "Passer à la préparation du dossier et au transfert." },
  { value: "revoir", label: "Revoir les hypothèses", detail: "Analyser les écarts et ajuster la stratégie." },
];

const CIRCUIT = [
  { role: "Chef de projet", detail: "Prépare et soumet la décision" },
  { role: "Responsable développement", detail: "Examine et valide" },
  { role: "Pharmacien responsable", detail: "Approbation finale" },
];

function DecisionModal({
  project,
  formulas,
  initialFormula,
  open,
  onClose,
}: {
  project: Project;
  formulas: Formula[];
  initialFormula: string;
  open: boolean;
  onClose: () => void;
}) {
  const state = useDemo();
  const go = useGuideNav();
  const guideSubmit = useGuideTarget(21);
  /** Decision being written for a formula: its draft (or correction), else a blank one. */
  const draftOf = (code: string) => {
    const d = decisionFor(state, project.code, code);
    const open = d && (decisionLocked(d) || d.status !== "Approuvée") ? d : undefined;
    return {
      choice: open?.choice ?? ("poursuivre" as DecisionChoice),
      justification: open?.justification ?? "",
      attachments: open?.attachments ?? state.documents.filter((x) => x.projectCode === project.code && x.formula === code && x.type === "Rapport d'essais").map((x) => x.id),
    };
  };
  const [formula, setFormula] = useState(initialFormula);
  const [choice, setChoice] = useState<DecisionChoice>(() => draftOf(initialFormula).choice);
  const [justification, setJustification] = useState(() => draftOf(initialFormula).justification);
  const [attachments, setAttachments] = useState<string[]>(() => draftOf(initialFormula).attachments);
  const [submitted, setSubmitted] = useState(false);

  /** Each formula has its own decision: changing the formula loads its decision (or a blank form). */
  const pickFormula = (code: string) => {
    const d = draftOf(code);
    setFormula(code);
    setChoice(d.choice);
    setJustification(d.justification);
    setAttachments(d.attachments);
    setSubmitted(false);
  };

  const stored = decisionFor(state, project.code, formula);
  const isSubmitted = decisionLocked(stored);
  /** « Poursuivre » or « revoir » already approved: the form prepares the next decision on the formula. */
  const previous = stored?.status === "Approuvée" && !isSubmitted ? stored : undefined;
  const existing = previous ? undefined : stored;
  const current = formulas.find((f) => f.code === formula);
  const pending = pendingTests(testsForFormula(state, project.code, formula));
  const docs = state.documents.filter((d) => d.projectCode === project.code);
  const justificationError = justification.trim().length < 20 ? "Rédigez une justification (20 caractères minimum)." : null;
  const blockedByTests = choice === "retenir" && pending.length > 0;
  const step = existing?.step ?? 1;

  const save = (submit: boolean) => {
    setSubmitted(true);
    if (justificationError || (submit && blockedByTests)) return;
    actions.saveDecision({ projectCode: project.code, formula, choice, justification: justification.trim(), attachments }, submit);
    if (submit) {
      toast.show({ title: "Décision soumise pour avis", description: "Le responsable développement a été notifié." });
      if (guideSubmit) {
        toast.show({
          title: "Parcours : quelques jours plus tard…",
          description: "Les essais F2 sont terminés, la décision « Retenir F2 » a reçu l'avis favorable du responsable développement.",
          tone: "info",
        });
        go(21);
      } else onClose();
    } else {
      toast.show({ title: "Décision enregistrée en brouillon", description: "Votre décision a été enregistrée. Elle n'est pas encore soumise." });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Préparer la décision"
      subtitle={
        <>
          <p className="text-[16px] text-ink-800">
            Décider de la suite pour le projet{" "}
            <strong>
              {project.code} • {project.name}
            </strong>
          </p>
          <p className="text-sm text-ink-500">
            {project.formLabel} <span className="mx-1 text-ink-300">|</span> {project.dosage}
          </p>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Field label="Formule concernée" htmlFor="dec-formula" hint={formulas.length > 1 ? "Chaque formule a sa propre décision." : undefined}>
            <div className="flex items-center gap-3">
              <Select
                id="dec-formula"
                className="flex-1"
                options={formulas.map((f) => ({ value: f.code, label: `${f.code} — ${f.label}` }))}
                value={formula}
                onChange={(e) => pickFormula(e.target.value)}
              />
              {current && <FormulaStatusBadge status={current.status} size="sm" />}
            </div>
          </Field>

          {isSubmitted && stored && (
            <p className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-ink-700">
              <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
              <span>
                La décision sur la formule {formula} est {stored.status === "Approuvée" ? "approuvée" : "en cours d'examen"} : elle n&apos;est plus modifiable.
                {formulas.length > 1 && " Choisissez une autre formule pour préparer sa décision."}
              </span>
            </p>
          )}
          {previous && (
            <p className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50 p-4 text-sm text-ink-700">
              <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden />
              <span>
                Décision précédente sur {formula} — « {CHOICES.find((c) => c.value === previous.choice)?.label} » — approuvée
                {previous.approvedAt ? ` le ${formatDateTime(previous.approvedAt)}` : ""}. Préparez ici la nouvelle décision, une fois les essais complétés.
              </span>
            </p>
          )}

        <fieldset disabled={isSubmitted} className="min-w-0 space-y-5">
          <fieldset>
            <legend className="mb-2 text-[15px] font-semibold text-ink-800">
              Décision proposée <span className="text-danger-600">*</span>
            </legend>
            <div className="space-y-2.5">
              {CHOICES.map((c) => (
                <Radio
                  key={c.value}
                  name="decision"
                  checked={choice === c.value}
                  onChange={() => setChoice(c.value)}
                  label={c.label}
                  description={c.detail}
                  className={cn("rounded-xl border p-3.5 transition-colors", choice === c.value ? "border-brand-400 bg-brand-50/60" : "border-line hover:border-brand-200")}
                />
              ))}
            </div>
          </fieldset>

          <Field label="Justification" required htmlFor="dec-justification" error={submitted ? justificationError : null}>
            <Textarea
              id="dec-justification"
              rows={4}
              maxLength={1000}
              value={justification}
              invalid={submitted && Boolean(justificationError)}
              placeholder="Ex. Les résultats disponibles sont conformes. Il est proposé de poursuivre les essais pour finaliser l'évaluation."
              onChange={(e) => setJustification(e.target.value)}
            />
          </Field>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-ink-800">
              Pièce(s) justificative(s)
              <span title="Documents du projet joints à la décision." className="cursor-help text-ink-400">
                <Info className="h-4 w-4" aria-hidden />
              </span>
            </p>
            <div className="flex flex-wrap items-stretch gap-3">
              {attachments.map((id) => {
                const d = docs.find((x) => x.id === id);
                if (!d) return null;
                return (
                  <span key={id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                    <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
                    <span className="text-sm">
                      <span className="block font-semibold text-ink-900">
                        {d.name} v{d.version}
                      </span>
                      <span className="block text-ink-500">
                        {d.type} • {formatNumeric(d.updatedAt)}
                      </span>
                    </span>
                    <button type="button" aria-label={`Retirer ${d.name}`} onClick={() => setAttachments((l) => l.filter((x) => x !== id))} className="cursor-pointer rounded p-1 text-ink-500 hover:text-danger-600">
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                );
              })}
              <Menu
                label="Ajouter un document"
                align="left"
                widthClass="w-80"
                triggerClassName="flex h-full min-h-12 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                trigger={
                  <>
                    <Paperclip className="h-4 w-4" aria-hidden />
                    Ajouter un document
                  </>
                }
                items={
                  docs.filter((d) => !attachments.includes(d.id)).length
                    ? docs
                        .filter((d) => !attachments.includes(d.id))
                        .map((d) => ({ label: `${d.name} v${d.version}`, description: d.type, icon: FileText, onSelect: () => setAttachments((l) => [...l, d.id]) }))
                    : [{ label: "Aucun autre document", disabled: true }]
                }
              />
            </div>
          </div>

          {pending.length > 0 && (
            <div className={cn("flex gap-3 rounded-xl border p-4", blockedByTests ? "border-danger-200 bg-danger-50" : "border-warn-200 bg-warn-50")}>
              <TriangleAlert className={cn("h-5 w-5 shrink-0", blockedByTests ? "fill-danger-500 text-white" : "fill-warn-500 text-white")} aria-hidden />
              <div className="text-sm">
                <p className={cn("font-semibold", blockedByTests ? "text-danger-700" : "text-warn-700")}>
                  {pending.map((t) => t.criterion).join(", ")} : {pending.length > 1 ? "résultats encore attendus" : "résultat encore attendu"}
                </p>
                <p className="text-ink-700">
                  La décision « Retenir une formule » pourra être soumise une fois tous les essais requis disponibles.
                </p>
              </div>
            </div>
          )}

          {!isSubmitted && (
            <div className="flex flex-wrap gap-3 border-t border-line pt-5">
              <Button variant="outline" size="lg" icon={<FileText className="h-5 w-5" />} onClick={() => save(false)} className="flex-1 sm:flex-none">
                Enregistrer le brouillon
              </Button>
              <Button size="lg" icon={<Send className="h-5 w-5" />} onClick={() => save(true)} disabled={blockedByTests} guide={21} className="flex-1 sm:flex-none">
                Soumettre pour avis
              </Button>
            </div>
          )}
        </fieldset>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line p-4">
            <h3 className="font-bold text-ink-900">Circuit de validation</h3>
            <ol className="mt-4 space-y-3">
              {CIRCUIT.map((c, i) => {
                const n = i + 1;
                const done = existing?.status === "Approuvée" || n < step;
                const active = !done && n === step;
                return (
                  <li key={c.role} className={cn("flex gap-3 rounded-xl p-3", active && "bg-brand-50")}>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        done ? "bg-success-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-400 text-white",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
                    </span>
                    <div>
                      <p className="font-semibold text-ink-900">{c.role}</p>
                      <p className="text-sm text-ink-500">{c.detail}</p>
                      <Badge tone={done ? "success" : active ? "info" : "neutral"} className="mt-1.5">
                        {done ? "Validé" : active ? "Étape actuelle" : "En attente"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="mt-auto">
            <Button size="lg" disabled className="w-full disabled:bg-slate-300" icon={<Check className="h-5 w-5" />}>
              Retenir cette formule
            </Button>
            <p className="mt-1.5 text-center text-xs text-ink-500">Disponible après validation du circuit</p>
          </div>
          {existing && (
            <p className="text-center text-xs text-ink-500">
              {existing.status === "Brouillon" ? "Brouillon enregistré" : existing.status} le {formatDateTime(existing.updatedAt)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

const DECISION_BANNER: Record<string, { text: string; badge: string; tone: "info" | "warn" | "success" | "danger" }> = {
  Brouillon: { text: "Brouillon non soumis", badge: "Brouillon", tone: "warn" },
  Soumise: { text: "Soumise pour avis — en cours d'examen dans le circuit de validation", badge: "Soumise pour avis", tone: "info" },
  Approuvée: { text: "Approuvée par le pharmacien responsable", badge: "Approuvée", tone: "success" },
  "Correction demandée": { text: "Renvoyée au chef de projet pour correction", badge: "Correction demandée", tone: "danger" },
};

const LOT_TYPE_LABEL: Record<LotType, string> = { Essai: "Lot d'essais", Pilote: "Lot pilote", Échantillon: "Lot d'échantillons" };

const FORMULA_DOT: Record<FormulaStatus, Tone> = {
  Référence: "success",
  Brouillon: "neutral",
  "Essais en cours": "info",
  "Essais terminés": "success",
  "À améliorer": "warn",
  Retenue: "success",
  Archivée: "neutral",
};

const RESULT_LOOK: Record<TestStatus, { label: string; icon: typeof Check; text: string; iconClass: string }> = {
  Conforme: { label: "Conforme", icon: CircleCheck, text: "text-success-700", iconClass: "fill-success-500 text-white" },
  "Non conforme": { label: "Non conforme", icon: CircleX, text: "text-danger-700", iconClass: "fill-danger-500 text-white" },
  "En attente": { label: "Résultat attendu", icon: Clock, text: "text-warn-700", iconClass: "text-warn-600" },
  "Non démarré": { label: "Non démarrée", icon: CircleEllipsis, text: "text-ink-600", iconClass: "fill-slate-200 text-ink-500" },
};

function ResultCell({ status, result, compact }: { status?: TestStatus; result?: string; compact?: boolean }) {
  if (!status) return <span className="text-sm text-ink-400">—</span>;
  const look = RESULT_LOOK[status];
  return (
    <span title={result} className={cn("inline-flex items-center whitespace-nowrap", compact ? "gap-2 text-sm" : "gap-2.5 text-[15px]", look.text)}>
      <look.icon className={cn("h-5 w-5 shrink-0", look.iconClass)} aria-hidden />
      {look.label}
    </span>
  );
}

/** Formula status as a coloured dot + text ("● Essais en cours"). */
function StatusText({ status }: { status: FormulaStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", TONE_TEXT[FORMULA_DOT[status]])}>
      <StatusDot tone={FORMULA_DOT[status]} />
      {status === "Référence" ? "Validée" : status}
    </span>
  );
}

export function ComparisonView({
  slug,
  versions,
  openDecision,
  openExam,
}: {
  slug: string;
  versions?: string[];
  openDecision: boolean;
  openExam: boolean;
}) {
  const state = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const project = findProject(state, slug);
  const formulas = project ? projectFormulas(state, project.code).sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true })) : [];
  const reference = project ? state.formulas.find((f) => f.projectCode === project.code && f.status === "Référence") : undefined;
  const candidates = [...(reference ? [reference] : []), ...formulas];
  const defaultSelection = (versions?.length ? candidates.filter((f) => f.status === "Référence" || versions.includes(f.code)) : candidates).slice(0, 3).map((f) => f.code);
  const defaultFocus = formulas.find((f) => f.status === "Essais en cours")?.code ?? formulas[formulas.length - 1]?.code ?? "";

  const [selection, setSelection] = useState<string[]>(defaultSelection);
  const [focus, setFocus] = useState(defaultFocus);
  const [decisionOpen, setDecisionOpen] = useState(openDecision && !openExam);
  const [decisionKey, setDecisionKey] = useState(0);
  const [examOpen, setExamOpen] = useState(openExam);
  const [examKey, setExamKey] = useState(0);
  /** Formula whose decision is shown in the dialogs (the focused one by default). */
  const [modalFormula, setModalFormula] = useState<string | undefined>();
  const guideDecision = useGuideTarget(20);

  if (!project) return null;

  const columns = candidates.filter((f) => selection.includes(f.code));
  const criteria = criteriaFor(state, project.code);
  const focusFormula = candidates.find((f) => f.code === focus);
  const focusTests = testsForFormula(state, project.code, focus);
  const focusDocs = state.documents.filter((d) => d.projectCode === project.code && d.formula === focus);
  const decisions = projectDecisions(state, project.code);
  /** Decision of the formula shown in the right panel. */
  const decision = decisionFor(state, project.code, focus);

  /** Lot tested for a formula (the most recent one), or the reference product. */
  const lotOf = (f: Formula) => {
    if (f.status === "Référence") return { code: "REF-01", type: "Lot de référence", lot: undefined };
    const code = testsForFormula(state, project.code, f.code)[0]?.lotCode;
    const lot = state.lots.find((l) => l.projectCode === project.code && (code ? l.code === code : l.formula === f.code && l.type === "Essai"));
    return { code: lot?.code ?? "—", type: lot ? LOT_TYPE_LABEL[lot.type] : "Aucun lot", lot };
  };
  const focusLot = focusFormula ? lotOf(focusFormula) : undefined;
  const pendingOf = (f: Formula) => (f.status === "Référence" ? [] : pendingTests(testsForFormula(state, project.code, f.code)));
  const blocked = columns.filter((f) => pendingOf(f).length > 0);
  const toWatch = focusTests.filter((t) => t.status !== "Conforme").sort((a, b) => (a.method ?? "").localeCompare(b.method ?? ""));

  const toggle = (code: string, checked: boolean) => {
    if (checked && selection.length >= 3) {
      toast.show({ title: "Trois formules au maximum", description: "Décochez une formule pour en comparer une autre.", tone: "info" });
      return;
    }
    const next = checked ? candidates.map((f) => f.code).filter((c) => c === code || selection.includes(c)) : selection.filter((c) => c !== code);
    setSelection(next);
    if (!checked && code === focus) setFocus(next.find((c) => c !== reference?.code) ?? next[0] ?? "");
  };

  const openModal = (formula?: string) => {
    setModalFormula(formula);
    setExamOpen(false);
    setDecisionKey((k) => k + 1);
    setDecisionOpen(true);
  };
  const openExamModal = (formula?: string) => {
    setModalFormula(formula);
    setDecisionOpen(false);
    setExamKey((k) => k + 1);
    setExamOpen(true);
  };
  /** Approved « poursuivre » / « revoir »: closed, a new decision can be prepared on the formula. */
  const renewable = (d: FormulaDecision) => d.status === "Approuvée" && !decisionLocked(d);
  const examinable = decision && decision.status !== "Brouillon" && !renewable(decision);

  const exportCsv = () => {
    const rows = [
      ["Critère", ...columns.map((c) => `${c.code} (${lotOf(c).code})`)],
      ...criteria.map((cr) => [cr, ...columns.map((c) => testsForFormula(state, project.code, c.code).find((t) => t.criterion === cr)?.status ?? "—")]),
    ];
    downloadText(`comparaison-${project.code}.csv`, toCsv(rows), "text/csv");
    toast.show({ title: "Comparaison exportée", description: `comparaison-${project.code}.csv` });
  };

  return (
    <>
      <ProjectTabs
        slug={slug}
        actions={
          <Menu
            label="Actions projet"
            widthClass="w-72"
            triggerClassName="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 font-semibold text-brand-700 hover:bg-brand-50"
            trigger={
              <>
                Actions projet
                <ChevronDown className="h-4 w-4" aria-hidden />
              </>
            }
            items={[
              { label: "Préparer la décision", icon: Scale, onSelect: () => openModal(focus !== reference?.code ? focus : undefined), disabled: !formulas.length },
              { label: "Nouvelle version de formule", icon: Copy, href: `/projets/${slug}/formules/nouvelle${focus ? `?parent=${focus}` : ""}` },
              { label: "Créer un lot", icon: Package, href: `/projets/${slug}/formules/lots?creer=1${focus ? `&formule=${focus}` : ""}` },
              { label: "Exporter la comparaison (CSV)", icon: Download, onSelect: exportCsv, separatorBefore: true },
            ]}
          />
        }
      />
      <FormulaSubTabs slug={slug} />

      {formulas.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={Scale}
            title="Rien à comparer pour le moment"
            description="Créez au moins une formule et un lot d'essai pour comparer les résultats."
            action={<LinkButton href={`/projets/${slug}/formules/nouvelle`}>Créer une formule</LinkButton>}
          />
        </Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {decisions.map((d, i) => (
              <div key={d.formula} className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-100 bg-brand-50/70 p-4">
                <Scale className="h-6 w-6 text-brand-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">
                    Décision sur la formule {d.formula} — {CHOICES.find((c) => c.value === d.choice)?.label}
                  </p>
                  <p className="text-sm text-ink-600">
                    {DECISION_BANNER[d.status].text} · mis à jour le {formatDateTime(d.updatedAt)}
                  </p>
                </div>
                <Badge tone={DECISION_BANNER[d.status].tone} size="md">
                  {DECISION_BANNER[d.status].badge}
                </Badge>
                {d.status !== "Brouillon" ? (
                  <Button variant="outline" onClick={() => openExamModal(d.formula)} guide={i === 0 && !renewable(d) ? 21 : undefined}>
                    {d.status === "Soumise" ? "Examiner la décision" : "Consulter"}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => openModal(d.formula)}>
                    Reprendre
                  </Button>
                )}
                {renewable(d) && <Button onClick={() => openModal(d.formula)}>Nouvelle décision</Button>}
              </div>
            ))}

            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Sélection des formules à comparer</h2>
                  <p className="text-sm text-ink-600">Choisissez jusqu&apos;à 3 formules pour afficher la comparaison des résultats disponibles.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((f) => (
                    <Checkbox
                      key={f.id}
                      checked={selection.includes(f.code)}
                      onChange={(v) => toggle(f.code, v)}
                      label={<span className="font-medium">{f.code}</span>}
                      className="items-center rounded-lg border border-line px-3 py-2 hover:border-brand-300"
                    />
                  ))}
                </div>
              </div>

              <div className={cn("mt-4 grid gap-4", columns.length >= 3 ? "grid-cols-3" : columns.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
                {columns.map((f) => {
                  const lot = lotOf(f);
                  const isRef = f.status === "Référence";
                  const active = f.code === focus;
                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={active}
                      onClick={() => setFocus(f.code)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setFocus(f.code);
                      }}
                      className={cn(
                        "cursor-pointer rounded-xl border p-4 text-left transition-colors",
                        active ? "border-brand-400 bg-brand-50/50 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-extrabold text-ink-900">{lot.code}</span>
                        <span className={cn("rounded-md px-2 py-0.5 text-sm font-medium", isRef ? "bg-slate-100 text-ink-600" : "bg-brand-50 text-brand-700")}>{isRef ? "Référence" : f.code}</span>
                        <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
                          <Menu
                            label={`Actions pour ${f.code}`}
                            trigger={<Ellipsis className="h-5 w-5" />}
                            triggerClassName="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-600 hover:bg-brand-50"
                            items={[
                              { label: "Voir les versions", icon: FileText, href: `/projets/${slug}/formules` },
                              ...(lot.lot ? [{ label: `Voir le lot ${lot.code}`, icon: Package, href: `/projets/${slug}/formules/lots` }] : []),
                              ...(!isRef ? [{ label: "Nouvelle version", icon: Copy, href: `/projets/${slug}/formules/nouvelle?parent=${f.code}` }] : []),
                            ]}
                          />
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] gap-y-2 text-[15px]">
                        <dt className="text-ink-600">Formule</dt>
                        <dd className="font-medium text-ink-900">{isRef ? "Référence" : f.code}</dd>
                        <dt className="text-ink-600">Statut</dt>
                        <dd>
                          <StatusText status={f.status} />
                        </dd>
                        <dt className="text-ink-600">Type de lot</dt>
                        <dd className="text-ink-800">{lot.type}</dd>
                      </dl>
                    </div>
                  );
                })}
              </div>

              <h2 className="mt-6 text-lg font-bold text-ink-900">Comparaison des résultats</h2>
              <div className="relative mt-3 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[620px] text-left text-[15px]">
                  <thead>
                    <tr className="bg-subtle text-ink-900">
                      <th className="px-4 py-3 font-semibold">Critère</th>
                      {columns.map((c) => (
                        <th key={c.id} className={cn("border-l border-line px-4 py-3 text-center font-semibold", c.code === focus && "text-brand-700")}>
                          {c.status === "Référence" ? "Référence" : c.code} ({lotOf(c).code})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {criteria.map((cr) => (
                      <tr key={cr}>
                        <td className="px-4 py-2.5 text-ink-900">{cr}</td>
                        {columns.map((c) => {
                          const t = testsForFormula(state, project.code, c.code).find((x) => x.criterion === cr);
                          return (
                            <td key={c.id} className={cn("border-l border-line px-4 py-2.5", c.code === focus && "bg-brand-50/40")}>
                              <span className="flex justify-center">
                                <ResultCell status={t?.status} result={t?.result} />
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {criteria.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-sm text-ink-500">
                          Aucun résultat d&apos;essai pour ce projet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {blocked.length > 0 ? (
                <p className="mt-4 flex items-start gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-[15px] text-ink-800">
                  <TriangleAlert className="h-5 w-5 shrink-0 fill-warn-500 text-white" aria-hidden />
                  <span>
                    <strong className="font-semibold text-warn-700">La sélection finale reste bloquée</strong> tant que les essais requis ne sont pas disponibles
                    <span className="text-ink-600"> ({blocked.map((f) => `${f.code} : ${pendingOf(f).map((t) => t.criterion.toLowerCase()).join(", ")}`).join(" ; ")})</span>.
                  </span>
                </p>
              ) : (
                <p className="mt-4 flex items-start gap-3 rounded-xl border border-success-500/30 bg-success-50 px-4 py-3 text-[15px] text-success-700">
                  <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden />
                  Tous les essais requis sont disponibles : la sélection finale peut être proposée.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline" size="lg" icon={<FileText className="h-5 w-5" />} onClick={exportCsv} className="min-w-60">
                  Exporter la comparaison
                </Button>
                <Button size="lg" icon={<CirclePlus className="h-5 w-5" />} onClick={() => router.push(`/projets/${slug}/formules/nouvelle${focus ? `?parent=${focus}` : ""}`)} className="min-w-56">
                  Ajouter une formule
                </Button>
              </div>
            </Card>
          </div>

          {focusFormula && focusLot && (
            <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink-900">
                  {focusFormula.status === "Référence" ? "Référence" : `Formule ${focusFormula.code}`} – {focusLot.code}
                </h2>
                <Badge tone={FORMULA_DOT[focusFormula.status]} dot>
                  {focusFormula.status === "Référence" ? "Validée" : focusFormula.status}
                </Badge>
              </div>
              <dl className="mt-4 grid grid-cols-[150px_minmax(0,1fr)] gap-y-2.5 rounded-xl border border-line p-4 text-[15px]">
                <dt className="text-ink-600">Formule</dt>
                <dd className="text-ink-900">{focusFormula.code}</dd>
                <dt className="text-ink-600">Lot</dt>
                <dd className="text-ink-900">{focusLot.code}</dd>
                <dt className="text-ink-600">Type de lot</dt>
                <dd className="text-ink-900">{focusLot.type}</dd>
                <dt className="text-ink-600">Statut</dt>
                <dd>
                  <StatusText status={focusFormula.status} />
                </dd>
                <dt className="text-ink-600">Date de fabrication</dt>
                <dd className="text-ink-900">{focusLot.lot ? formatNumeric(focusLot.lot.createdAt) : "—"}</dd>
                <dt className="text-ink-600">Quantité produite</dt>
                <dd className="text-ink-900">{focusLot.lot?.status === "Disponible" ? `${formatNumber(focusLot.lot.quantity)} ${focusLot.lot.unit}` : "—"}</dd>
              </dl>

              <h3 className="mt-5 font-bold text-ink-900">Essais et résultats</h3>
              {focusTests.length === 0 ? (
                <p className="mt-2 rounded-lg bg-subtle p-3 text-sm text-ink-500">Aucun essai réalisé sur cette formule. Créez un lot d&apos;essai pour lancer les analyses.</p>
              ) : toWatch.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 rounded-lg bg-success-50 p-3 text-sm text-success-700">
                  <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
                  Tous les essais sont conformes ({focusTests.length} / {focusTests.length}).
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line border-y border-line">
                  {toWatch.map((t) => {
                    const Icon = CRITERION_ICONS[t.criterion] ?? FileText;
                    return (
                      <li key={t.id}>
                        <Link href={`/projets/${slug}/essais`} className="flex items-center gap-3 px-1 py-2.5 hover:bg-brand-50/50">
                          <Icon className="h-5 w-5 text-ink-600" strokeWidth={1.6} aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[15px] text-ink-900">
                            {t.method ? `${t.method} – ` : ""}
                            {t.criterion}
                          </span>
                          <ResultCell status={t.status} result={t.result} compact />
                          <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              <h3 className="mt-5 font-bold text-ink-900">Documents associés</h3>
              {focusDocs.length ? (
                <ul className="mt-2 space-y-2">
                  {focusDocs.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                      <FileText className="h-7 w-7 text-ink-600" strokeWidth={1.4} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink-900">
                          {d.name} v{d.version}
                        </span>
                        <span className="block text-sm text-ink-500">{d.type}</span>
                      </span>
                      <span className="text-sm text-ink-600">{formatNumeric(d.updatedAt)}</span>
                      <Menu
                        label={`Actions pour ${d.name}`}
                        items={[
                          { label: "Ouvrir", icon: FileText, href: `/projets/${slug}/documents?doc=${d.id}` },
                          {
                            label: "Télécharger",
                            icon: Download,
                            onSelect: () => {
                              downloadText(`${d.name} v${d.version}.txt`, `${d.name} — v${d.version}\n${d.type}\nDocument de démonstration.`);
                              toast.show({ title: "Téléchargement lancé", description: d.name });
                            },
                          },
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-500">Aucun document rattaché à cette formule.</p>
              )}

              {focusFormula.status !== "Référence" && (
                <Button
                  size="lg"
                  className="mt-5 w-full justify-start"
                  icon={<FileText className="h-5 w-5" />}
                  onClick={() => (examinable ? openExamModal(focus) : openModal(focus))}
                  guide={examinable ? undefined : guideDecision ? 20 : 21}
                  guideHint="Préparez la décision sur la formule F2."
                  iconRight={
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold">
                      <span className="h-2 w-2 rounded-sm bg-current" aria-hidden />
                      {decision && !renewable(decision) ? DECISION_BANNER[decision.status].badge : "À préparer"}
                    </span>
                  }
                >
                  {examinable
                    ? decision?.status === "Soumise"
                      ? `Examiner la décision ${focus}`
                      : `Consulter la décision ${focus}`
                    : decision && renewable(decision)
                      ? `Préparer une nouvelle décision ${focus}`
                      : `Préparer la décision ${focus}`}
                </Button>
              )}
            </Card>
          )}
        </div>
      )}

      {formulas.length > 0 && (
        <DecisionModal
          key={decisionKey}
          project={project}
          formulas={formulas}
          initialFormula={modalFormula ?? (focus && focus !== reference?.code ? focus : defaultFocus)}
          open={decisionOpen}
          onClose={() => {
            setDecisionOpen(false);
            if (openDecision) router.replace(pathname, { scroll: false });
          }}
        />
      )}
      <DecisionReviewModal
        key={`exam-${examKey}`}
        project={project}
        formula={modalFormula}
        open={examOpen}
        onClose={() => {
          setExamOpen(false);
          if (openExam) router.replace(pathname, { scroll: false });
        }}
        onEdit={openModal}
      />
      {examOpen || (examinable && !decisionOpen) ? (
        <ScreenRef n={21} label="Décision — examen et approbation" />
      ) : decisionOpen ? (
        <ScreenRef n={20} label="Décision sur une formule" />
      ) : (
        <ScreenRef n={19} label="Comparaison des formules" />
      )}
    </>
  );
}
