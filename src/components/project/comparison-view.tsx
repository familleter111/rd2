"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Info,
  Package,
  Paperclip,
  Scale,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Radio, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadText, formatDateTime, formatNumeric, toCsv } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { criteriaFor, findProject, pendingTests, projectFormulas, testsForFormula } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { DecisionChoice, Formula, Project } from "@/lib/types";
import { DecisionReviewModal } from "./decision-review";
import { CRITERION_ICONS, FormulaStatusBadge, TestStatusText } from "./formula-bits";
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
  const existing = state.formulaDecisions.find((d) => d.projectCode === project.code);
  const [formula, setFormula] = useState(existing?.formula ?? initialFormula);
  const [choice, setChoice] = useState<DecisionChoice>(existing?.choice ?? "poursuivre");
  const [justification, setJustification] = useState(existing?.justification ?? "");
  const [attachments, setAttachments] = useState<string[]>(
    () => existing?.attachments ?? state.documents.filter((d) => d.projectCode === project.code && d.formula === initialFormula && d.type === "Rapport d'essais").map((d) => d.id),
  );
  const [submitted, setSubmitted] = useState(false);

  const current = formulas.find((f) => f.code === formula);
  const pending = pendingTests(testsForFormula(state, project.code, formula));
  const docs = state.documents.filter((d) => d.projectCode === project.code);
  const justificationError = justification.trim().length < 20 ? "Rédigez une justification (20 caractères minimum)." : null;
  const blockedByTests = choice === "retenir" && pending.length > 0;
  const isSubmitted = existing?.status === "Soumise" || existing?.status === "Approuvée";
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
        <fieldset disabled={isSubmitted} className="min-w-0 space-y-5">
          <Field label="Formule concernée" htmlFor="dec-formula">
            <div className="flex items-center gap-3">
              <Select
                id="dec-formula"
                className="flex-1"
                options={formulas.map((f) => ({ value: f.code, label: `${f.code} — ${f.label}` }))}
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
              />
              {current && <FormulaStatusBadge status={current.status} size="sm" />}
            </div>
          </Field>

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
  const compared = versions?.length ? formulas.filter((f) => versions.includes(f.code)) : formulas;
  const defaultFocus = compared.find((f) => f.status === "Essais en cours")?.code ?? compared[compared.length - 1]?.code ?? "";

  const [focus, setFocus] = useState(defaultFocus);
  const [decisionOpen, setDecisionOpen] = useState(openDecision && !openExam);
  const [decisionKey, setDecisionKey] = useState(0);
  const [examOpen, setExamOpen] = useState(openExam);
  const [examKey, setExamKey] = useState(0);

  if (!project) return null;

  const columns = [...(reference ? [reference] : []), ...compared];
  const criteria = criteriaFor(state, project.code);
  const focusFormula = formulas.find((f) => f.code === focus);
  const focusTests = testsForFormula(state, project.code, focus);
  const focusDocs = state.documents.filter((d) => d.projectCode === project.code && d.formula === focus);
  const decision = state.formulaDecisions.find((d) => d.projectCode === project.code);

  const openModal = () => {
    setExamOpen(false);
    setDecisionKey((k) => k + 1);
    setDecisionOpen(true);
  };
  const openExamModal = () => {
    setDecisionOpen(false);
    setExamKey((k) => k + 1);
    setExamOpen(true);
  };
  const examinable = decision && decision.status !== "Brouillon";

  const exportCsv = () => {
    const rows = [
      ["Critère", ...columns.map((c) => c.code)],
      ...criteria.map((cr) => [cr, ...columns.map((c) => testsForFormula(state, project.code, c.code).find((t) => t.criterion === cr)?.status ?? "—")]),
    ];
    downloadText(`comparaison-${project.code}.csv`, toCsv(rows), "text/csv");
    toast.show({ title: "Synthèse exportée", description: `comparaison-${project.code}.csv` });
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
              { label: "Préparer la décision", icon: Scale, onSelect: openModal, disabled: !formulas.length },
              { label: "Nouvelle version de formule", icon: Copy, href: `/projets/${slug}/formules/nouvelle${focus ? `?parent=${focus}` : ""}` },
              { label: "Créer un lot", icon: Package, href: `/projets/${slug}/formules/lots?creer=1${focus ? `&formule=${focus}` : ""}` },
              { label: "Exporter la synthèse (CSV)", icon: Download, onSelect: exportCsv, separatorBefore: true },
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
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-5">
            {decision && (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-100 bg-brand-50/70 p-4">
                <Scale className="h-6 w-6 text-brand-600" aria-hidden />
                <div className="flex-1">
                  <p className="font-semibold text-ink-900">
                    Décision sur la formule {decision.formula} — {CHOICES.find((c) => c.value === decision.choice)?.label}
                  </p>
                  <p className="text-sm text-ink-600">
                    {DECISION_BANNER[decision.status].text} · mis à jour le {formatDateTime(decision.updatedAt)}
                  </p>
                </div>
                <Badge tone={DECISION_BANNER[decision.status].tone} size="md">
                  {DECISION_BANNER[decision.status].badge}
                </Badge>
                {examinable ? (
                  <Button variant="outline" onClick={openExamModal} guide={21}>
                    {decision.status === "Soumise" ? "Examiner la décision" : "Consulter"}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={openModal}>
                    Reprendre
                  </Button>
                )}
              </div>
            )}

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-ink-900">Formules à comparer</h2>
                <Button icon={<Scale className="h-4 w-4" />} onClick={openModal} guide={examinable ? undefined : 21}>
                  Préparer la décision
                </Button>
              </div>
              <div className="relative mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[15px]">
                  <thead>
                    <tr className="bg-subtle text-sm text-ink-700">
                      <th className="rounded-l-lg px-4 py-2.5 font-semibold">Formule</th>
                      <th className="px-4 py-2.5 font-semibold">Statut</th>
                      <th className="px-4 py-2.5 font-semibold">Lot testé</th>
                      <th className="rounded-r-lg px-4 py-2.5 font-semibold">Essais conformes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {columns.map((f) => {
                      const tests = testsForFormula(state, project.code, f.code);
                      const ok = tests.filter((t) => t.status === "Conforme").length;
                      const isRef = f.status === "Référence";
                      return (
                        <tr key={f.id} className={cn(focus === f.code && "bg-brand-50/60")}>
                          <td className="px-4 py-3">
                            {isRef ? (
                              <span className="flex items-center gap-3 pl-8 font-medium text-ink-900">Référence</span>
                            ) : (
                              <label className="flex cursor-pointer items-center gap-3 font-semibold text-ink-900">
                                <input type="radio" name="focus" checked={focus === f.code} onChange={() => setFocus(f.code)} className="h-5 w-5 cursor-pointer accent-brand-600" />
                                {f.code}
                              </label>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <FormulaStatusBadge status={f.status} size="sm" />
                          </td>
                          <td className="px-4 py-3 text-ink-700">{isRef ? "Produit de référence" : (tests[0]?.lotCode ?? "—")}</td>
                          <td className="px-4 py-3 text-ink-700">{tests.length ? `${ok} / ${tests.length}` : "Aucun essai"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-xl font-bold text-ink-900">Synthèse des résultats</h2>
              <div className="relative mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[15px]">
                  <thead>
                    <tr className="bg-subtle text-sm text-ink-700">
                      <th className="rounded-l-lg px-4 py-2.5 font-semibold">Critère</th>
                      {columns.map((c, i) => (
                        <th key={c.id} className={cn("px-4 py-2.5 font-semibold", i === columns.length - 1 && "rounded-r-lg", c.code === focus && "text-brand-700")}>
                          {c.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {criteria.map((cr) => (
                      <tr key={cr}>
                        <td className="px-4 py-3 font-medium text-ink-900">{cr}</td>
                        {columns.map((c) => {
                          const t = testsForFormula(state, project.code, c.code).find((x) => x.criterion === cr);
                          return (
                            <td key={c.id} className={cn("px-4 py-3 align-top", c.code === focus && "bg-brand-50/50")}>
                              <TestStatusText status={t?.status} short />
                              {t?.result && <span className="mt-0.5 block text-xs text-ink-500">{t.result}</span>}
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
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink-900">État des essais – {focus}</h2>
                {focusFormula && <FormulaStatusBadge status={focusFormula.status} size="sm" />}
              </div>
              {focusTests.length ? (
                <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                  {focusTests.map((t) => {
                    const Icon = CRITERION_ICONS[t.criterion] ?? FileText;
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Icon className="h-5 w-5 text-ink-600" strokeWidth={1.6} aria-hidden />
                        <span className="flex-1 text-[15px] text-ink-800">{t.criterion}</span>
                        <TestStatusText status={t.status} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg bg-subtle p-4 text-sm text-ink-500">Aucun essai réalisé sur cette formule. Créez un lot d&apos;essai pour lancer les analyses.</p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-bold text-ink-900">Documents associés – {focus}</h2>
              {focusDocs.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {focusDocs.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-3">
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
                <p className="mt-3 text-sm text-ink-500">Aucun document rattaché à cette formule.</p>
              )}
              <LinkButton
                href={`/projets/${slug}/documents`}
                variant="outline"
                className="mt-3 w-full justify-between"
                iconRight={<ChevronRight className="h-4 w-4" />}
              >
                <span className="flex-1 text-center">Voir tous les documents</span>
              </LinkButton>
            </Card>
          </div>
        </div>
      )}

      {formulas.length > 0 && (
        <DecisionModal
          key={decisionKey}
          project={project}
          formulas={formulas}
          initialFormula={focus || defaultFocus}
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
        open={examOpen}
        onClose={() => {
          setExamOpen(false);
          if (openExam) router.replace(pathname, { scroll: false });
        }}
        onEdit={openModal}
      />
      {examOpen || (examinable && !decisionOpen) ? (
        <ScreenRef n={21} label="Décision — examen et approbation" />
      ) : (
        <ScreenRef n={20} label="Décision sur une formule" />
      )}
    </>
  );
}
