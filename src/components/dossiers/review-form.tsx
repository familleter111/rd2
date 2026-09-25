"use client";

import { CircleAlert, CircleCheck, FilePlus2, FileText, Paperclip, Save, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GuideSpot, useGuideNav } from "@/components/guide/guide-mark";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput, Field, MultiSelect, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { REVIEW_EXAMPLE, REVIEW_PARTICIPANTS, REVIEW_TYPES_DOSSIER } from "@/lib/data-dossier";
import { nextReviewId } from "@/lib/dossier";
import { missingElements, reviewReadiness, reviewReady } from "@/lib/dossier-selectors";
import { useGuideTarget } from "@/lib/guide";
import { dossierActions, getDemoState } from "@/lib/store";
import type { ReviewDraft } from "@/lib/types";
import { DossierHeader, DossierMissing, DossierTabs, projectCrumbs, useDossier } from "./dossier-frame";

function StepCard({ n, title, subtitle, children }: { n: number; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{n}</span>
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-ink-600">{subtitle}</p>
      <div className="mt-3 flex-1">{children}</div>
    </Card>
  );
}

export function ReviewForm({ slug }: { slug: string }) {
  const { state, project, dossier } = useDossier(slug);
  const router = useRouter();
  const go = useGuideNav();
  const guideSubmit = useGuideTarget(51);
  const [draft, setDraft] = useState<ReviewDraft>(() => dossier?.reviewDraft ?? { ...REVIEW_EXAMPLE, justification: "" });
  const [justifOpen, setJustifOpen] = useState(Boolean(dossier?.reviewDraft?.justification));
  const set = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  if (!project) return null;
  if (!dossier) return <DossierMissing slug={slug} />;

  const missing = missingElements(state, dossier);
  const docs = state.documents.filter((d) => d.projectCode === project.code && !d.archived);
  const available = docs.filter((d) => !draft.documents.includes(d.id));
  const readiness = reviewReadiness(draft);
  const ready = reviewReady(draft);

  const addDocMenu = (label: string, variant: "outline" | "secondary") => (
    <Menu
      label={label}
      align="left"
      widthClass="w-80"
      triggerClassName="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-brand-300 bg-white px-4 font-semibold text-brand-700 hover:bg-brand-50"
      trigger={
        <>
          {variant === "outline" ? <FilePlus2 className="h-5 w-5" aria-hidden /> : <Paperclip className="h-5 w-5" aria-hidden />}
          {label}
        </>
      }
      items={
        available.length
          ? available.map((d) => ({ label: d.name, description: `v${d.version} • ${d.status}`, icon: FileText, onSelect: () => set("documents", [...draft.documents, d.id]) }))
          : [{ label: "Tous les documents sont déjà sélectionnés", disabled: true }]
      }
    />
  );

  const submit = () => {
    if (!ready) return;
    const id = nextReviewId(getDemoState());
    dossierActions.submitDossierReview(project.code, draft);
    toast.show({ title: `Revue ${id} soumise`, description: `${draft.type} du ${draft.date.split("-").reverse().join("/")} — participants notifiés.` });
    if (guideSubmit) go(51);
    else router.push(`/dossiers/${slug}/revues/${id.toLowerCase()}`);
  };

  return (
    <>
      <DossierHeader
        crumbs={[...projectCrumbs(project), { label: "Dossiers & revues", href: `/dossiers/${slug}` }, { label: "Préparer une revue" }]}
        title={`Préparer la revue — ${project.code}`}
        meta={[project.name, project.dosage, dossier.formula]}
      />
      <DossierTabs slug={slug} />

      {missing.length > 0 ? (
        <Card className="mt-5 p-6">
          <p className="flex items-center gap-2 text-lg font-bold text-ink-900">
            <CircleAlert className="h-6 w-6 fill-warn-500 text-white" aria-hidden />
            Le dossier doit être complet pour préparer une revue
          </p>
          <ul className="mt-3 list-disc pl-6 text-[15px] text-ink-700">
            {missing.map((r) => (
              <li key={r.id}>
                {r.label} — {r.detail}
              </li>
            ))}
          </ul>
          <LinkButton href={`/dossiers/${slug}`} className="mt-4">
            Compléter le dossier
          </LinkButton>
        </Card>
      ) : (
        <>
          <Card className="mt-5 p-5">
            <h2 className="text-lg font-bold text-ink-900">Informations générales</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr_1.4fr]">
              <Field label="Type de revue" required htmlFor="rv-type">
                <Select id="rv-type" options={REVIEW_TYPES_DOSSIER} value={draft.type} onChange={(e) => set("type", e.target.value)} />
              </Field>
              <Field label="Date de la revue" required htmlFor="rv-date">
                <DateInput id="rv-date" value={draft.date} onChange={(v) => set("date", v)} invalid={!draft.date} />
              </Field>
              <Field label="Participants" required>
                <MultiSelect label="Participants" options={REVIEW_PARTICIPANTS} value={draft.participants} onChange={(v) => set("participants", v)} placeholder="Sélectionner les participants" />
              </Field>
            </div>
          </Card>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <StepCard n={1} title="Objet de la revue" subtitle="Précisez l'objet et le périmètre de la revue.">
              <Textarea aria-label="Objet de la revue" rows={5} maxLength={1000} value={draft.objet} onChange={(e) => set("objet", e.target.value)} invalid={!draft.objet.trim()} />
            </StepCard>
            <StepCard n={2} title="Documents à examiner" subtitle="Sélectionnez les documents à examiner lors de la revue.">
              <ul className="divide-y divide-line rounded-xl border border-line">
                {draft.documents.map((id) => {
                  const doc = docs.find((d) => d.id === id);
                  return (
                    <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="h-5 w-5 shrink-0 text-ink-700" strokeWidth={1.6} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[15px] text-ink-900">
                        {doc ? `${doc.name} v${doc.approvedVersion ?? doc.version}` : id}
                      </span>
                      <button
                        type="button"
                        aria-label={`Retirer ${doc?.name ?? id}`}
                        onClick={() => set("documents", draft.documents.filter((x) => x !== id))}
                        className="cursor-pointer rounded p-1 text-ink-600 hover:bg-slate-100"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  );
                })}
                {draft.documents.length === 0 && <li className="px-3 py-3 text-sm text-ink-500">Aucun document sélectionné.</li>}
              </ul>
              <div className="mt-3">{addDocMenu("Ajouter un document", "outline")}</div>
            </StepCard>
            <StepCard n={3} title="Décision attendue" subtitle="Indiquez la décision attendue à l'issue de la revue.">
              <Textarea aria-label="Décision attendue" rows={5} maxLength={1000} value={draft.expected} onChange={(e) => set("expected", e.target.value)} invalid={!draft.expected.trim()} />
            </StepCard>
          </div>

          <Card className="mt-5 p-5">
            <h2 className="text-lg font-bold text-ink-900">État de préparation</h2>
            <p className="text-sm text-ink-600">Vérifiez que tous les éléments requis sont complétés avant de soumettre la revue.</p>
            <ul className="mt-4 grid gap-4 md:grid-cols-3">
              {readiness.map((r) => (
                <li key={r.key} className="flex items-start gap-3 md:border-l md:border-line md:pl-4 md:first:border-0 md:first:pl-0">
                  {r.ok ? (
                    <CircleCheck className="h-9 w-9 shrink-0 fill-success-500 text-white" aria-hidden />
                  ) : (
                    <CircleAlert className="h-9 w-9 shrink-0 text-warn-500" strokeWidth={1.8} aria-hidden />
                  )}
                  <span>
                    <span className={cn("block font-semibold", r.ok ? "text-success-700" : "text-warn-700")}>{r.ok ? r.okTitle : r.koTitle}</span>
                    <span className="block text-sm text-ink-600">{r.detail}</span>
                    {r.key === "justification" && !justifOpen && (
                      <button type="button" onClick={() => setJustifOpen(true)} className="mt-1 cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
                        Renseigner la justification
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <GuideSpot step={51} active={draft.justification.trim().length < 20} hint="À faire d'abord : renseigner la justification (20 caractères minimum), puis « Soumettre la revue »." className="mt-4">
              {justifOpen ? (
                <Field label="Justification de la revue" required htmlFor="rv-justification" hint="20 caractères minimum.">
                  <Textarea id="rv-justification" rows={3} maxLength={1000} value={draft.justification} onChange={(e) => set("justification", e.target.value)} />
                </Field>
              ) : (
                <Button variant="outline" onClick={() => setJustifOpen(true)}>
                  Renseigner la justification
                </Button>
              )}
            </GuideSpot>
          </Card>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              icon={<Save className="h-5 w-5" />}
              onClick={() => {
                dossierActions.saveReviewDraft(project.code, draft);
                toast.show({ title: "Brouillon enregistré", description: "La préparation de la revue est conservée." });
              }}
            >
              Enregistrer le brouillon
            </Button>
            <div className="w-full sm:w-auto">{addDocMenu("Ajouter un document", "secondary")}</div>
            {!ready && (
              <p className="flex items-center gap-2 rounded-lg bg-warn-50 px-4 py-3 text-sm font-medium text-warn-700 sm:ml-auto">
                <CircleAlert className="h-5 w-5 fill-warn-500 text-white" aria-hidden />
                {readiness.find((r) => !r.ok)?.key === "justification" ? "Complétez la justification avant soumission." : "Complétez les éléments requis avant soumission."}
              </p>
            )}
            <Button size="lg" icon={<Send className="h-5 w-5" />} onClick={submit} disabled={!ready} guide={51} className={cn("disabled:bg-slate-300", ready && "sm:ml-auto")}>
              Soumettre la revue
            </Button>
          </div>
        </>
      )}
      <ScreenRef n={project.code === "CS-01" ? 50 : undefined} label="Préparer une revue de dossier" />
    </>
  );
}
