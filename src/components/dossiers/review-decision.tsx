"use client";

import { CalendarDays, Check, CircleCheck, CirclePlus, Download, FileSearch, Info, Save, ShieldAlert, Target, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, DateInput, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DECISION_EXAMPLE, RESERVE_OWNERS } from "@/lib/data-dossier";
import { nextReserveId } from "@/lib/dossier";
import { REVIEW_STATUS_TONE } from "@/lib/dossier-selectors";
import { DEMO_TODAY, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { dossierActions, getDemoState } from "@/lib/store";
import type { DossierReview, ReviewDecisionChoice } from "@/lib/types";
import { DossierHeader, DossierMissing, DossierTabs, projectCrumbs, useDossier } from "./dossier-frame";

const CHOICES: { value: ReviewDecisionChoice; title: string; detail: string }[] = [
  { value: "approuver", title: "Approuver", detail: "Le dossier est approuvé sans réserve." },
  { value: "reserves", title: "Approuver avec réserves", detail: "Le dossier est approuvé avec des réserves à lever avant transfert." },
  { value: "correction", title: "Demander une correction", detail: "Des corrections sont requises avant une nouvelle revue." },
];

interface ReserveDraft {
  key: number;
  description: string;
  owner: string;
  due: string;
  blocking: boolean;
}

function Circuit({ review }: { review: DossierReview }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-ink-900">Circuit de validation</h2>
      <ol className="mt-4 space-y-5">
        {review.circuit.map((c, i) => {
          const done = c.status === "Avis favorable" || c.status === "Approuvé";
          return (
            <li key={c.role} className="relative flex gap-4">
              {i < review.circuit.length - 1 && <span className="absolute left-4 top-9 h-[calc(100%-12px)] w-px bg-line-strong" aria-hidden />}
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", done || i === 0 ? "bg-brand-600" : "bg-slate-400")}>{i + 1}</span>
              <div>
                <p className="font-semibold text-ink-900">{c.role}</p>
                {done ? (
                  <p className="mt-1 flex items-center gap-2 text-sm text-ink-700">
                    <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
                    {c.status === "Avis favorable" ? "Avis enregistré" : "Décision enregistrée"}
                  </p>
                ) : (
                  <Badge tone={c.status === "Correction demandée" ? "danger" : "neutral"} size="md" className="mt-1">
                    {c.status}
                  </Badge>
                )}
                {c.date && done && <p className="mt-0.5 pl-7 text-sm text-ink-600">{formatNumeric(c.date)}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function ReviewDecision({ slug, reviewId }: { slug: string; reviewId: string }) {
  const { state, project, dossier } = useDossier(slug);
  const go = useGuideNav();
  const guideConfirm = useGuideTarget(52);
  const review = state.dossierReviews.find((r) => r.id.toLowerCase() === reviewId.toLowerCase() && r.projectCode === project?.code);
  const [decision, setDecision] = useState<ReviewDecisionChoice>("reserves");
  const [justification, setJustification] = useState(DECISION_EXAMPLE.justification);
  const [reserves, setReserves] = useState<ReserveDraft[]>([{ key: 1, ...DECISION_EXAMPLE.reserve }]);
  const [attempted, setAttempted] = useState(false);

  if (!project) return null;
  if (!dossier) return <DossierMissing slug={slug} />;
  if (!review) {
    return (
      <Card className="mt-6">
        <EmptyState icon={FileSearch} title="Revue introuvable" action={<LinkButton href={`/dossiers/${slug}/revues`}>Voir les revues</LinkButton>} />
      </Card>
    );
  }

  const decided = review.status !== "En revue";
  const reserveErrors = reserves.map((r) => (r.description.trim().length < 5 ? "description" : !r.owner ? "owner" : !r.due ? "due" : r.due < DEMO_TODAY ? "past" : null));
  const errors = {
    justification: justification.trim().length < 10 ? "Justifiez la décision (10 caractères minimum)." : null,
    reserves: decision === "reserves" && (reserves.length === 0 || reserveErrors.some(Boolean)) ? "Complétez chaque réserve (description, responsable, échéance à venir)." : null,
  };
  const blocking = decision === "reserves" && reserves.some((r) => r.blocking);
  const created = state.reserves.filter((r) => r.reviewId === review.id);
  const firstId = nextReserveId(getDemoState());
  const upd = (key: number, patch: Partial<ReserveDraft>) => setReserves((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const confirm = () => {
    setAttempted(true);
    if (errors.justification || errors.reserves) return;
    dossierActions.decideDossierReview(review.id, {
      decision,
      justification: justification.trim(),
      reserves: decision === "reserves" ? reserves.map(({ description, owner, due, blocking: b }) => ({ description: description.trim(), owner, due, blocking: b })) : [],
    });
    toast.show({
      title: "Décision confirmée",
      description: `${review.id} : ${CHOICES.find((c) => c.value === decision)?.title.toLowerCase()}${decision === "reserves" ? ` — ${reserves.length} réserve(s) ouverte(s)` : ""}.`,
    });
    if (guideConfirm) go(52);
  };

  return (
    <>
      <DossierHeader
        crumbs={[...projectCrumbs(project), { label: "Revues", href: `/dossiers/${slug}/revues` }, { label: review.id }]}
        title={`Revue ${review.id} — Décision`}
        meta={[
          <span key="p" className="font-semibold text-ink-900">
            {project.code} • {project.name}
          </span>,
          project.dosage,
          dossier.formula,
        ]}
        aside={
          <Card className="flex divide-x divide-line">
            <div className="flex items-center gap-3 px-5 py-3">
              <Target className={cn("h-8 w-8", decided ? "text-success-600" : "text-warn-500")} strokeWidth={1.6} aria-hidden />
              <span>
                <span className="block text-sm text-ink-600">Statut</span>
                <span className="block font-semibold text-ink-900">{review.status}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <CalendarDays className="h-7 w-7 text-ink-700" strokeWidth={1.6} aria-hidden />
              <span>
                <span className="block text-sm text-ink-600">Date de revue</span>
                <span className="block font-semibold text-ink-900">{formatNumeric(review.date)}</span>
              </span>
            </div>
          </Card>
        }
      />
      <DossierTabs slug={slug} />

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {decided ? (
          <Card className="h-fit p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink-900">Décision de revue</h2>
              <Badge tone={REVIEW_STATUS_TONE[review.status]} size="md">
                {review.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-600">Décision enregistrée le {review.decidedAt ? formatNumeric(review.decidedAt) : "—"} par Qualité.</p>
            <p className="mt-4 font-semibold text-ink-900">Justification de la décision</p>
            <p className="mt-2 rounded-lg bg-subtle px-4 py-3 text-[15px] text-ink-700">{review.decisionJustification}</p>
            {created.length > 0 && (
              <>
                <p className="mt-5 font-semibold text-ink-900">Réserves associées</p>
                <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                  {created.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-ink-700">{r.id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink-900">{r.description}</span>
                        <span className="text-sm text-ink-500">
                          {r.owner} • échéance {formatNumeric(r.due)}
                          {r.blocking && " • bloquante pour le transfert"}
                        </span>
                      </span>
                      <Badge tone={r.status === "Levée" ? "success" : "warn"}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href={`/dossiers/${slug}/export`} icon={<Download className="h-4 w-4" />} guide={review.id === "RD-01" ? 52 : undefined}>
                Exporter le dossier
              </LinkButton>
              {created.length > 0 && (
                <LinkButton href={`/dossiers/${slug}/reserves`} variant="outline">
                  Voir les réserves
                </LinkButton>
              )}
              <LinkButton href={`/dossiers/${slug}/transfert`} variant="outline">
                Transfert
              </LinkButton>
            </div>
          </Card>
        ) : (
          <Card className="p-5 sm:p-6">
            <h2 className="text-xl font-bold text-ink-900">Décision de revue</h2>
            <p className="mt-3 font-semibold text-ink-900">Décision pour la revue {review.id}</p>
            <p className="text-sm text-ink-600">Sélectionner une décision concernant ce dossier.</p>
            <div role="radiogroup" aria-label="Décision" className="mt-3 grid gap-3 md:grid-cols-3">
              {CHOICES.map((c) => {
                const active = decision === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDecision(c.value)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      active ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200" : "border-line hover:bg-subtle",
                    )}
                  >
                    <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", active ? "border-brand-600" : "border-line-strong")}>
                      {active && <span className="h-3 w-3 rounded-full bg-brand-600" />}
                    </span>
                    <span>
                      <span className="block font-semibold text-ink-900">{c.title}</span>
                      <span className="mt-1 block text-sm text-ink-600">{c.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Field label="Justification de la décision" required htmlFor="dec-justif" className="mt-5" error={attempted ? errors.justification : null}>
              <Textarea id="dec-justif" rows={3} maxLength={1000} value={justification} onChange={(e) => setJustification(e.target.value)} invalid={attempted && Boolean(errors.justification)} />
            </Field>

            {decision === "reserves" && (
              <>
                <h3 className="mt-5 text-lg font-bold text-ink-900">Réserves associées</h3>
                <p className="text-sm text-ink-600">Les réserves bloquantes doivent être levées avant le transfert du dossier.</p>
                <ul className="mt-3 space-y-3">
                  {reserves.map((r, i) => {
                    const err = attempted ? reserveErrors[i] : null;
                    return (
                      <li key={r.key} className="rounded-xl border border-line p-4">
                        <div className="grid gap-4 md:grid-cols-[64px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
                          <span className="flex h-14 items-center justify-center rounded-lg bg-slate-100 font-bold text-ink-700">
                            R-{String(Number(firstId.slice(2)) + i).padStart(2, "0")}
                          </span>
                          <Field label="Description de la réserve" required htmlFor={`res-desc-${r.key}`} error={err === "description" ? "Décrivez la réserve." : null}>
                            <Input id={`res-desc-${r.key}`} value={r.description} onChange={(e) => upd(r.key, { description: e.target.value })} invalid={err === "description"} />
                          </Field>
                          <Field label="Responsable" required htmlFor={`res-owner-${r.key}`}>
                            <Select id={`res-owner-${r.key}`} options={RESERVE_OWNERS} value={r.owner} onChange={(e) => upd(r.key, { owner: e.target.value })} />
                          </Field>
                          <Field label="Échéance" required htmlFor={`res-due-${r.key}`} error={err === "due" ? "Indiquez l'échéance." : err === "past" ? "L'échéance est passée." : null}>
                            <DateInput id={`res-due-${r.key}`} value={r.due} onChange={(v) => upd(r.key, { due: v })} invalid={err === "due" || err === "past"} />
                          </Field>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 md:pl-20">
                          <Checkbox
                            checked={r.blocking}
                            onChange={(v) => upd(r.key, { blocking: v })}
                            label={
                              <span className="flex items-center gap-1.5">
                                Bloquante pour le transfert
                                <Info className="h-4 w-4 text-ink-400" aria-label="Une réserve bloquante empêche la transmission du dossier à la production." />
                              </span>
                            }
                          />
                          {reserves.length > 1 && (
                            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setReserves((l) => l.filter((x) => x.key !== r.key))}>
                              Retirer
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  variant="outline"
                  className="mt-3"
                  icon={<CirclePlus className="h-5 w-5" />}
                  onClick={() => setReserves((l) => [...l, { key: Math.max(0, ...l.map((x) => x.key)) + 1, description: "", owner: RESERVE_OWNERS[0], due: "", blocking: false }])}
                >
                  Ajouter une réserve
                </Button>
                {attempted && errors.reserves && (
                  <p className="mt-2 text-sm text-danger-600" role="alert">
                    {errors.reserves}
                  </p>
                )}
              </>
            )}

            {blocking && (
              <p className="mt-5 flex items-center gap-2 rounded-lg bg-warn-50 px-4 py-3 text-sm font-medium text-warn-700">
                <ShieldAlert className="h-5 w-5" aria-hidden />
                Le transfert reste bloqué tant que les réserves bloquantes sont ouvertes.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                size="lg"
                icon={<Save className="h-5 w-5" />}
                onClick={() => toast.show({ title: "Brouillon de décision enregistré", description: `${review.id} — décision non confirmée.` })}
              >
                Enregistrer le brouillon
              </Button>
              <Button size="lg" icon={<Check className="h-5 w-5" />} onClick={confirm} guide={review.id === "RD-01" ? 52 : undefined}>
                Confirmer la décision
              </Button>
            </div>
          </Card>
        )}

        <div className="space-y-5">
          <Circuit review={review} />
          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Mon rôle dans cette décision</h2>
            <div className="mt-3 flex items-start gap-4 rounded-xl border border-line p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <User className="h-6 w-6" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold text-ink-900">Qualité</span>
                <span className="block text-sm text-ink-600">Vous êtes l&apos;acteur en charge de l&apos;examen et de la décision.</span>
              </span>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Objet de la revue</h2>
            <p className="mt-2 text-sm text-ink-700">{review.objet}</p>
            <p className="mt-3 text-sm font-semibold text-ink-900">Documents examinés</p>
            <ul className="mt-1 text-sm text-ink-600">
              {review.documents.map((id) => (
                <li key={id}>• {state.documents.find((d) => d.id === id)?.name ?? id}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <ScreenRef n={project.code === "CS-01" && review.id === "RD-01" ? 51 : undefined} label="Revue — décision et réserves" />
    </>
  );
}
