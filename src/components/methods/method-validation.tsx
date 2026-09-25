"use client";

import { Check, CircleCheck, CircleX, ClipboardList, FileText, Info, MessageSquare, Send, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, DateInput, Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { PEOPLE_LAB } from "@/lib/data-lab";
import { DEMO_TODAY, formatDateTime, formatNumeric, formatTime } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { ANALYSIS_STATUS, analysesOf, inSpec } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { Analysis, CircuitStatus, Method, Person, Tone } from "@/lib/types";
import { findMethodBySlug } from "./method-frame";

const RECIPIENTS: Person[] = [PEOPLE_LAB.marie, PEOPLE_LAB.julien, PEOPLE_LAB.thomas];

const CIRCUIT_TONE: Record<CircuitStatus, Tone> = {
  Soumis: "info",
  "Avis favorable": "success",
  Approuvé: "success",
  "À examiner": "warn",
  "En attente": "neutral",
  "Correction demandée": "danger",
};

function CorrectionModal({ method, analysis, open, onClose }: { method: Method; analysis: Analysis; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const go = useGuideNav();
  const guideSend = useGuideTarget(28);
  const lastSample = analysis.results.at(-1)?.sample ?? "";
  const [recipient, setRecipient] = useState(analysis.analyst.name);
  const [reason, setReason] = useState(lastSample ? `Joindre le chromatogramme de l'échantillon ${lastSample}.` : "");
  const [due, setDue] = useState("2026-10-02");
  const [notify, setNotify] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    reason: reason.trim().length < 10 ? "Précisez le motif (10 caractères minimum)." : null,
    due: !due ? "Indiquez une date d'échéance." : due < DEMO_TODAY ? "L'échéance ne peut pas être passée." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);
  const person = RECIPIENTS.find((p) => p.name === recipient) ?? analysis.analyst;

  const send = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    labActions.requestAnalysisCorrection(analysis.id, { recipient: person, reason: reason.trim(), due, notify });
    toast.show({
      title: "Correction demandée",
      description: `${person.name} doit compléter ${analysis.id} avant le ${formatNumeric(due)}.`,
      action: { label: "Voir l'activité", href: "/activites" },
    });
    if (guideSend) go(28);
    else {
      onClose();
      router.push(`/methodes/${method.ref.toLowerCase()}/historique`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Demander une correction"
      subtitle="Une correction sera demandée à l'analyste pour cette série de résultats."
      footer={
        <>
          <Button variant="outline" size="lg" onClick={onClose} className="min-w-40">
            Annuler
          </Button>
          <Button size="lg" icon={<Send className="h-5 w-5" />} onClick={send} guide={28}>
            Renvoyer pour correction
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Destinataire" required htmlFor="corr-recipient">
          <Select
            id="corr-recipient"
            icon={User}
            options={RECIPIENTS.map((p) => ({ value: p.name, label: `${p.role} — ${p.name}` }))}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </Field>
        <Field label="Motif de la correction" required htmlFor="corr-reason" error={show(errors.reason)}>
          <Textarea id="corr-reason" rows={3} maxLength={1000} value={reason} invalid={Boolean(show(errors.reason))} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Date d'échéance" required htmlFor="corr-due" error={show(errors.due)}>
          <DateInput id="corr-due" value={due} onChange={setDue} onClear={() => setDue("")} invalid={Boolean(show(errors.due))} />
        </Field>
        <Checkbox checked={notify} onChange={setNotify} label="Notifier le responsable" />
        <p className="flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm">
          <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
          <span>
            <span className="block font-medium text-brand-700">Les résultats restent conservés dans l&apos;historique.</span>
            <span className="text-ink-600">L&apos;analyste pourra compléter et resoumettre pour nouvelle revue.</span>
          </span>
        </p>
      </div>
    </Modal>
  );
}

function ReviewPanel({ method, analysis, openCorrection }: { method: Method; analysis: Analysis; openCorrection: boolean }) {
  const state = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const [correction, setCorrection] = useState(openCorrection && analysis.status === "En revue");
  const [correctionKey, setCorrectionKey] = useState(0);
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const project = state.projects.find((p) => p.code === analysis.projectCode);
  const lot = state.lots.find((l) => l.projectCode === analysis.projectCode && l.code === analysis.lotCode);
  const spec = method.protocol?.criteria[0]?.value ?? "";
  const inReview = analysis.status === "En revue";
  const status = ANALYSIS_STATUS[analysis.status];

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-ink-900">Revue des résultats — {analysis.id}</h2>
            <Badge tone={status.tone} icon={ClipboardList} size="md" className="rounded-full">
              {analysis.status === "En revue" ? "En revue" : status.label}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white p-3 text-sm">
              <p className="text-ink-500">Projet</p>
              <p className="font-bold text-ink-900">{project ? `${project.code} • ${project.name}` : analysis.projectCode}</p>
              <p className="text-ink-600">
                {project?.formLabel} <span className="text-ink-300">|</span> {project?.dosage}
              </p>
            </div>
            <div className="bg-white p-3 text-sm">
              <p className="text-ink-500">Formule</p>
              <p className="font-bold text-ink-900">{analysis.formula}</p>
            </div>
            <div className="bg-white p-3 text-sm">
              <p className="text-ink-500">{lot?.type === "Pilote" ? "Lot pilote" : "Lot d'essai"}</p>
              <p className="font-bold text-ink-900">{analysis.lotCode}</p>
              <p className="text-ink-600">Conforme à la formule {analysis.formula}</p>
            </div>
            <div className="bg-white p-3 text-sm">
              <p className="text-ink-500">Période d&apos;analyse</p>
              <p className="font-bold text-ink-900">
                {formatNumeric(analysis.periodFrom)} → {formatNumeric(analysis.periodTo)}
              </p>
            </div>
          </div>

          <h3 className="mt-6 text-lg font-bold text-ink-900">
            Résultats d&apos;essais ({analysis.results.filter((r) => r.value.trim()).length}/{analysis.results.length})
          </h3>
          <div className="relative mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="bg-subtle text-ink-700">
                  <th className="px-4 py-3 font-semibold">N°</th>
                  <th className="px-4 py-3 font-semibold">Échantillon</th>
                  <th className="px-4 py-3 font-semibold">Date d&apos;analyse</th>
                  <th className="px-4 py-3 font-semibold">Résultat</th>
                  <th className="px-4 py-3 font-semibold">Conformité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {analysis.results.map((r, i) => {
                  const ok = inSpec(r.value, spec);
                  return (
                    <tr key={r.sample}>
                      <td className="px-4 py-3 text-ink-700">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-ink-900">{r.sample}</td>
                      <td className="px-4 py-3 text-ink-700">{formatNumeric(r.date)}</td>
                      <td className="px-4 py-3 text-ink-900">{r.value ? `${r.value} ${analysis.unit}` : "—"}</td>
                      <td className="px-4 py-3">
                        {ok === undefined ? (
                          <span className="text-ink-500">—</span>
                        ) : ok ? (
                          <span className="flex items-center gap-1.5 text-success-700">
                            <CircleCheck className="h-4 w-4 fill-success-500 text-white" aria-hidden />
                            Conforme
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-danger-700">
                            <CircleX className="h-4 w-4 fill-danger-500 text-white" aria-hidden />
                            Hors critère
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">Critère d&apos;acceptation : {method.protocol?.criteria[0]?.label} — {spec || "non défini"}.</p>

          <h3 className="mt-6 text-lg font-bold text-ink-900">Documents associés</h3>
          <ul className="mt-3 space-y-2">
            {[
              { name: `Données brutes — ${analysis.id}`, sub: `Résultats d'instrument (${method.equipment.code})`, href: `/methodes/${method.ref.toLowerCase()}/analyses/${analysis.id.toLowerCase()}` },
              { name: `Protocole — ${method.ref}`, sub: `Méthode ${method.ref} • ${method.name}`, href: `/methodes/${method.ref.toLowerCase()}/protocole` },
              ...analysis.attachments.filter((a) => !/données/i.test(a.name)).map((a) => ({ name: a.name, sub: a.kind, href: `/methodes/${method.ref.toLowerCase()}/analyses/${analysis.id.toLowerCase()}` })),
            ].map((d) => (
              <li key={d.name}>
                <Link href={d.href} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 hover:border-brand-200 hover:bg-subtle">
                  <FileText className="h-7 w-7 text-ink-600" strokeWidth={1.4} aria-hidden />
                  <span className="text-sm">
                    <span className="block font-bold text-ink-900">{d.name}</span>
                    <span className="block text-ink-500">{d.sub}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {inReview && (
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
              <Button
                variant="outline"
                size="lg"
                icon={<MessageSquare className="h-5 w-5" />}
                guide={28}
                onClick={() => {
                  setCorrectionKey((k) => k + 1);
                  setCorrection(true);
                }}
              >
                Demander une correction
              </Button>
              <Button
                variant="outline"
                size="lg"
                icon={<Check className="h-5 w-5" />}
                onClick={() => {
                  labActions.validateAnalysis(analysis.id);
                  toast.show({ title: "Résultats validés", description: `${analysis.id} — approbation enregistrée.` });
                }}
              >
                Valider les résultats
              </Button>
            </div>
          )}
          {analysis.status === "Correction demandée" && analysis.correction && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm">
              <MessageSquare className="h-5 w-5 text-danger-600" aria-hidden />
              <span className="flex-1 text-ink-700">
                <strong className="text-danger-700">Correction demandée</strong> à {analysis.correction.recipient} — échéance {formatNumeric(analysis.correction.due)} : {analysis.correction.reason}
              </span>
              <LinkButton href="/activites" variant="outline" size="sm">
                Voir l&apos;activité
              </LinkButton>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Circuit de validation</h2>
            <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
              {analysis.circuit.map((c, i) => {
                const tone = CIRCUIT_TONE[c.status];
                return (
                  <li key={c.role} className="flex gap-3 p-4">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                        c.status === "Soumis" || c.status === "Approuvé" ? "bg-brand-600" : "bg-slate-400",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="text-sm">
                      <p className="font-bold text-ink-900">{i === 0 ? "Analyse laboratoire" : c.role}</p>
                      {c.date && (
                        <p className="text-ink-600">
                          {c.status === "Soumis" ? "Soumis" : c.status} le {formatNumeric(c.date)}
                          {formatTime(c.date) && ` à ${formatTime(c.date)}`}
                        </p>
                      )}
                      <Badge tone={tone} size="md" className="mt-1.5">
                        {c.status}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Commentaires</h2>
            {analysis.comments.length === 0 ? (
              <p className="mt-3 flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink-600">
                <MessageSquare className="h-6 w-6 text-ink-500" strokeWidth={1.5} aria-hidden />
                Aucun commentaire pour le moment.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {analysis.comments.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line px-4 py-3 text-sm">
                    <p className="text-ink-800">{c.text}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {c.author} — {formatDateTime(c.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {commenting ? (
              <div className="mt-3 space-y-2">
                <Textarea aria-label="Nouveau commentaire" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setCommenting(false)}>
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    disabled={!comment.trim()}
                    onClick={() => {
                      labActions.addAnalysisComment(analysis.id, comment.trim());
                      setComment("");
                      setCommenting(false);
                    }}
                  >
                    Publier
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="mt-3 w-full" onClick={() => setCommenting(true)}>
                Ajouter un commentaire
              </Button>
            )}
          </Card>
        </div>
      </div>

      <CorrectionModal
        key={`corr-${correctionKey}`}
        method={method}
        analysis={analysis}
        open={correction}
        onClose={() => {
          setCorrection(false);
          if (openCorrection) router.replace(pathname, { scroll: false });
        }}
      />
      <ScreenRef n={method.ref === "M-01" ? 27 : undefined} label="Validation — demande de correction" />
    </>
  );
}

export function MethodValidationView({ slug, openCorrection }: { slug: string; openCorrection: boolean }) {
  const state = useDemo();
  const method = findMethodBySlug(state, slug);
  if (!method) return null;
  const analysis = analysesOf(state, method.ref)
    .filter((a) => a.status !== "Brouillon")
    .at(-1);
  const draft = analysesOf(state, method.ref).find((a) => a.status === "Brouillon");

  if (!analysis) {
    return (
      <>
        <Card className="mt-5">
          <EmptyState
            icon={ClipboardList}
            title="Aucun résultat à revoir"
            description={
              draft
                ? `Les résultats de ${draft.id} ne sont pas encore soumis pour revue.`
                : "Les résultats apparaissent ici une fois les essais lancés et soumis pour revue par l'analyste."
            }
            action={
              draft ? (
                <LinkButton href={`/methodes/${method.ref.toLowerCase()}/analyses/${draft.id.toLowerCase()}`}>Saisir les résultats</LinkButton>
              ) : (
                <LinkButton href={`/methodes/${method.ref.toLowerCase()}/essais`}>Préparer les essais</LinkButton>
              )
            }
          />
        </Card>
        <ScreenRef n={method.ref === "M-01" ? 27 : undefined} label="Validation — demande de correction" />
      </>
    );
  }

  return <ReviewPanel key={`${analysis.id}-${analysis.status}`} method={method} analysis={analysis} openCorrection={openCorrection} />;
}
