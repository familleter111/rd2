"use client";

import { Check, CircleCheck, Clock, FileText, Info, MessageSquare, Paperclip, Send, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Radio, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumeric } from "@/lib/format";
import { advanceTo, useGuideTarget } from "@/lib/guide";
import { pendingTests, testsForFormula } from "@/lib/selectors";
import { labActions, useDemo } from "@/lib/store";
import type { CircuitStatus, DecisionChoice, Project, Tone } from "@/lib/types";
import { CRITERION_ICONS } from "./formula-bits";

const CIRCUIT_TONE: Record<CircuitStatus, Tone> = {
  Soumis: "success",
  "Avis favorable": "success",
  Approuvé: "success",
  "À examiner": "info",
  "En attente": "neutral",
  "Correction demandée": "danger",
};

export function CircuitList({ steps, className }: { steps: { role: string; detail: string; status: CircuitStatus; date?: string }[]; className?: string }) {
  return (
    <ol className={cn("space-y-1", className)}>
      {steps.map((c, i) => {
        const tone = CIRCUIT_TONE[c.status];
        const current = c.status === "À examiner";
        return (
          <li key={c.role} className={cn("relative flex gap-3 rounded-xl p-3", current && "bg-brand-50/80")}>
            {i < steps.length - 1 && <span className="absolute left-[27px] top-12 h-[calc(100%-36px)] w-px bg-line-strong" aria-hidden />}
            <span
              className={cn(
                "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                current ? "bg-brand-600" : tone === "success" ? "bg-ink-400" : tone === "danger" ? "bg-danger-500" : "bg-slate-400",
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">{c.role}</p>
              <p className="text-sm text-ink-500">{c.detail}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Badge tone={tone} icon={tone === "success" ? CircleCheck : undefined} dot={tone !== "success"} size="md">
                {c.status}
              </Badge>
              <span className="w-[74px] text-right text-sm text-ink-600">{c.date ? formatNumeric(c.date) : "–"}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const CHOICES: { value: DecisionChoice; label: (f: string) => string; detail: string }[] = [
  { value: "retenir", label: (f) => `Retenir la formule ${f}`, detail: "Passer à la préparation du lot pilote." },
  { value: "poursuivre", label: () => "Poursuivre les essais", detail: "Compléter les essais en cours avant une décision finale." },
  { value: "revoir", label: () => "Revoir les hypothèses", detail: "Analyser les écarts et ajuster la stratégie." },
];

/** Screen 21 — the reviewer of the circuit examines and approves the formula decision. */
export function DecisionReviewModal({
  project,
  open,
  onClose,
  onEdit,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
  /** Reopens the project manager's decision form (after a correction request). */
  onEdit: () => void;
}) {
  const state = useDemo();
  const go = useGuideNav();
  const guideApprove = useGuideTarget(22);
  const decision = state.formulaDecisions.find((d) => d.projectCode === project.code);
  const [attachments, setAttachments] = useState<string[]>(decision?.attachments ?? []);
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const title = decision ? `Examiner la décision — ${decision.formula}` : "Examiner la décision";

  if (!decision || decision.status === "Brouillon" || !decision.circuit) {
    return (
      <Modal open={open} onClose={onClose} title={title} size="md">
        <EmptyState
          icon={Clock}
          title="Aucune décision en attente d'examen"
          description="La décision doit d'abord être préparée et soumise pour avis par le chef de projet (écran « Décision sur une formule »)."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={onEdit}>
                Préparer la décision
              </Button>
              <Button
                onClick={() => {
                  advanceTo(21);
                  toast.show({
                    title: "Parcours avancé",
                    description: "Essais F2 terminés, décision « Retenir F2 » soumise et avis favorable du responsable développement.",
                    tone: "info",
                  });
                }}
              >
                Simuler la suite du parcours
              </Button>
            </div>
          }
        />
      </Modal>
    );
  }

  const tests = testsForFormula(state, project.code, decision.formula);
  const pending = pendingTests(tests);
  const lot = decision.lot ?? tests[0]?.lotCode ?? "—";
  const docs = state.documents.filter((d) => d.projectCode === project.code);
  const step = decision.step;
  const examining = decision.status === "Soumise";
  const reviewer = step === 3 ? "Pharmacien responsable" : "Responsable développement";
  const pilot = state.lots.find((l) => l.projectCode === project.code && l.type === "Pilote" && l.formula === decision.formula);

  const approve = () => {
    if (step === 2) {
      labActions.reviewDecision(project.code);
      toast.show({ title: "Avis favorable enregistré", description: "La décision est transmise au pharmacien responsable pour approbation finale." });
      return;
    }
    labActions.approveDecision(project.code);
    toast.show({
      title: "Décision approuvée",
      description: pilot ? `La formule ${decision.formula} est retenue : la préparation du lot pilote ${pilot.code} est autorisée.` : "La décision est approuvée.",
    });
    if (guideApprove) go(22);
    else onClose();
  };

  const sendCorrection = () => {
    if (reason.trim().length < 10) {
      setReasonError("Précisez le motif de la correction (10 caractères minimum).");
      return;
    }
    labActions.requestDecisionCorrection(project.code, reason.trim());
    toast.show({ title: "Correction demandée", description: "La décision est renvoyée au chef de projet.", tone: "info" });
    setCorrecting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      subtitle={
        <>
          <p className="text-[16px] text-ink-800">
            Décision pour le projet{" "}
            <strong>
              {project.code} • {project.name}
            </strong>
          </p>
          <p className="flex flex-wrap gap-x-2 text-sm text-ink-500">
            <span>{project.formLabel}</span>
            <span className="text-ink-300">|</span>
            <span>{project.dosage}</span>
            <span className="text-ink-300">|</span>
            <span>Formule {decision.formula}</span>
            <span className="text-ink-300">|</span>
            <span>Lot {lot}</span>
          </p>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="min-w-0 space-y-5">
          {decision.status === "Approuvée" && (
            <div className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50 p-4 text-sm">
              <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden />
              <div>
                <p className="font-semibold text-success-700">Décision approuvée{decision.approvedAt ? ` le ${formatDateTime(decision.approvedAt)}` : ""}</p>
                {pilot && (
                  <Link href={`/projets/${project.slug}/lots/${pilot.code.toLowerCase()}`} className="font-semibold text-brand-700 hover:underline">
                    Voir la préparation du lot pilote {pilot.code}
                  </Link>
                )}
              </div>
            </div>
          )}
          {decision.status === "Correction demandée" && (
            <div className="flex items-start gap-3 rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm">
              <MessageSquare className="h-5 w-5 shrink-0 text-danger-600" aria-hidden />
              <div className="flex-1">
                <p className="font-semibold text-danger-700">Correction demandée</p>
                <p className="text-ink-700">{decision.correction}</p>
              </div>
              <Button size="sm" variant="outline" onClick={onEdit}>
                Reprendre la décision
              </Button>
            </div>
          )}

          <fieldset disabled className="min-w-0">
            <legend className="mb-2 text-[15px] font-semibold text-ink-800">
              Décision proposée <span className="text-danger-600">*</span>
            </legend>
            <div className="space-y-2.5">
              {CHOICES.map((c) => (
                <Radio
                  key={c.value}
                  name="decision-review"
                  checked={decision.choice === c.value}
                  onChange={() => {}}
                  label={c.label(decision.formula)}
                  description={c.detail}
                  className={cn(
                    "cursor-default rounded-xl border p-3.5",
                    decision.choice === c.value ? "border-brand-400 bg-brand-50/60" : "border-line",
                  )}
                />
              ))}
            </div>
          </fieldset>

          <Field label="Justification" required htmlFor="review-justification">
            <Textarea id="review-justification" rows={3} maxLength={1000} value={decision.justification} readOnly className="bg-white" />
          </Field>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-ink-800">
              Pièce(s) justificative(s)
              <span title="Documents joints au dossier de décision." className="cursor-help text-ink-400">
                <Info className="h-4 w-4" aria-hidden />
              </span>
            </p>
            <ul className="space-y-2">
              {attachments.map((id) => {
                const d = docs.find((x) => x.id === id);
                if (!d) return null;
                return (
                  <li key={id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                    <FileText className="h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.5} aria-hidden />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold text-ink-900">{d.name}</span>
                      <span className="block text-ink-500">
                        {d.lot ? `Essais sur le lot ${d.lot}` : d.type} • {formatNumeric(d.updatedAt)}
                      </span>
                    </span>
                    {examining && (
                      <button
                        type="button"
                        aria-label={`Retirer ${d.name}`}
                        onClick={() => setAttachments((l) => l.filter((x) => x !== id))}
                        className="cursor-pointer rounded p-1 text-ink-500 hover:text-danger-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {examining && (
              <Menu
                label="Ajouter un document"
                align="left"
                widthClass="w-80"
                className="mt-2"
                triggerClassName="flex h-10 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
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
            )}
          </div>

          {examining && correcting && (
            <div className="rounded-xl border border-line bg-subtle p-4">
              <Field label="Motif de la correction" required htmlFor="review-reason" error={reasonError}>
                <Textarea
                  id="review-reason"
                  rows={3}
                  maxLength={500}
                  value={reason}
                  invalid={Boolean(reasonError)}
                  placeholder="Ex. Joindre le rapport de dissolution complet avant approbation."
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError(null);
                  }}
                />
              </Field>
              <div className="mt-3 flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={() => setCorrecting(false)}>
                  Annuler
                </Button>
                <Button icon={<Send className="h-4 w-4" />} onClick={sendCorrection}>
                  Renvoyer au chef de projet
                </Button>
              </div>
            </div>
          )}

          {examining && !correcting && (
            <div className="flex flex-wrap gap-3 border-t border-line pt-5">
              <Button variant="outline" size="lg" icon={<MessageSquare className="h-5 w-5" />} onClick={() => setCorrecting(true)} className="flex-1 sm:flex-none">
                Demander une correction
              </Button>
              <Button
                size="lg"
                icon={<Check className="h-5 w-5" />}
                onClick={approve}
                disabled={step === 3 && pending.length > 0}
                guide={step === 3 ? 22 : undefined}
                className="flex-1 sm:flex-none"
              >
                {step === 3 ? "Approuver la décision" : "Émettre un avis favorable"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-ink-900">
                Résultats des essais — {decision.formula} ({lot})
              </h3>
              <Badge tone={pending.length ? "warn" : "info"} dot>
                {pending.length ? "Essais en cours" : "Essais terminés"}
              </Badge>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="bg-subtle text-ink-700">
                  <th className="rounded-l-lg px-3 py-2 font-semibold">Critère</th>
                  <th className="rounded-r-lg px-3 py-2 font-semibold">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tests.map((t) => {
                  const Icon = CRITERION_ICONS[t.criterion] ?? FileText;
                  const ok = t.status === "Conforme";
                  return (
                    <tr key={t.id}>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2.5 text-ink-800">
                          <Icon className="h-4 w-4 text-ink-500" strokeWidth={1.7} aria-hidden />
                          {t.criterion}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("flex items-center gap-2", ok ? "text-success-700" : t.status === "Non conforme" ? "text-danger-700" : "text-warn-700")}>
                          {ok ? <CircleCheck className="h-4 w-4 fill-success-500 text-white" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
                          {ok ? "Résultat validé" : t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-line p-4">
            <h3 className="font-bold text-ink-900">Circuit de validation</h3>
            <CircuitList steps={decision.circuit} className="mt-3" />
          </section>

          {examining && (
            <p className="flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-ink-700">
              <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
              {step === 3
                ? `L'approbation autorise la préparation du lot pilote${pilot ? ` ${pilot.code}` : ""}.`
                : `Examen en cours par le ${reviewer.toLowerCase()} ; l'approbation finale revient au pharmacien responsable.`}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
