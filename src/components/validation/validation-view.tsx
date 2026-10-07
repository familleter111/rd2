"use client";

import { ArrowRight, Check, CircleAlert, CircleCheck, CircleX, Download, FileText, FolderTree, Info, Layers, ListChecks, Lock, Plus, Scale, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { ExcelButton, SectionTitle } from "@/components/cadrage/cadrage-bits";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Radio, Select, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { PROCEDURES, PROCEDURE_UNKNOWN } from "@/lib/cadrage";
import { cn } from "@/lib/cn";
import { buildFormPdf, downloadBlob } from "@/lib/export-files";
import { formatDateTime, plural } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { validationWorkbook } from "@/lib/step-exports";
import { useDemo, validationActions } from "@/lib/store";
import type { Project, ValidationFile, ValidationSection, ValidationState } from "@/lib/types";
import type { DossierField, Gap } from "@/lib/validation";
import { COVER_FIELDS, IMPACT_TONE, MODULES, PREDEPOSIT_FIELDS, STATE_TONE, allGaps, canFreeze, canSubmit, consistencyChecks, coverDefaults, dossierForm, g4Requirements, gapForm, isFrozen, reviewOpen, sectionFeed, validationOf, validationState } from "@/lib/validation";

const STATES: ValidationState[] = ["En constitution", "Incomplet", "Prêt pour revue", "En revue", "À corriger", "Prêt pour validation interne"];
const REVIEW_TONE = { "À revoir": "neutral", Approuvée: "success", "À corriger": "danger" } as const;

/* ------------------------------------------------------------------ */
/* Gate G4                                                             */
/* ------------------------------------------------------------------ */

function G4Card({ project, v }: { project: Project; v: ValidationFile }) {
  const reqs = g4Requirements(project);
  const ready = reqs.every((r) => r.ok);
  const [choice, setChoice] = useState<"Préparer le dossier" | "Compléter">(ready ? "Préparer le dossier" : "Compléter");
  const [motif, setMotif] = useState("");
  const decided = v.g4?.choice === "Préparer le dossier";
  return (
    <Card className="p-6">
      <SectionTitle
        icon={Scale}
        title="Porte G4 — Confirmation"
        subtitle="Les résultats requis permettent-ils de préparer le dossier ?"
        aside={
          <Badge tone={decided ? "success" : v.g4 ? "warn" : "neutral"} size="md">
            {decided ? (v.g4?.conditional ? "Préparation décidée sous conditions" : "Préparation décidée") : v.g4 ? "Compléments demandés" : "Décision attendue"}
          </Badge>
        }
      />
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {reqs.map((r) => (
          <li key={r.label} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {r.ok ? <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden /> : <CircleAlert className="h-5 w-5 shrink-0 text-warn-600" aria-hidden />}
            <p className="min-w-56 flex-1 text-[15px] font-semibold text-ink-900">{r.label}</p>
            <p className="text-sm text-ink-600">{r.detail}</p>
            {!r.ok && (
              <LinkButton href={r.href} variant="link" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
                Compléter
              </LinkButton>
            )}
          </li>
        ))}
      </ul>
      {v.g4 && (
        <div className={cn("mt-4 rounded-xl border p-4 text-sm", decided ? "border-success-100 bg-success-50/70" : "border-warn-200 bg-warn-50")}>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
            {v.g4.choice}
            {v.g4.conditional && <Badge tone="warn">Sous conditions</Badge>} — {v.g4.by}, {formatDateTime(v.g4.at)}
          </p>
          <p className="mt-1 text-ink-800">{v.g4.justification}</p>
          {decided && !isFrozen(v) && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => validationActions.reopenG4(project.code)}>
              Modifier la décision
            </Button>
          )}
        </div>
      )}
      {!decided && (
        <div className="mt-5 border-t border-line pt-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Radio name="g4-choice" checked={choice === "Préparer le dossier"} onChange={() => setChoice("Préparer le dossier")} label={ready ? "Préparer le dossier" : "Préparer le dossier sous conditions"} description={ready ? "Les prérequis sont réunis." : "Un prérequis manque : la justification doit dire à quelles conditions, par qui et pour quand."} className="rounded-xl border border-line p-4" />
            <Radio name="g4-choice" checked={choice === "Compléter"} onChange={() => setChoice("Compléter")} label="Compléter" description="Demander des compléments avant de préparer le dossier." className="rounded-xl border border-line p-4" />
          </div>
          <Field label="Justification" required htmlFor="g4-motif" className="mt-4">
            <Textarea id="g4-motif" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={400} />
          </Field>
          <Button
            className="mt-3"
            icon={<Check className="h-4 w-4" />}
            disabled={!motif.trim()}
            onClick={() => {
              validationActions.decideG4(project.code, choice, motif);
              setMotif("");
            }}
          >
            Enregistrer la décision G4
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Scope                                                               */
/* ------------------------------------------------------------------ */

function ScopeCard({ project, v, frozen }: { project: Project; v: ValidationFile; frozen: boolean }) {
  const c = project.cadrage!;
  const saved = { market: v.market, procedure: v.procedure, variants: v.variants };
  const [form, setForm] = useState({
    market: v.market || (c.markets.length === 1 ? c.markets[0] : ""),
    procedure: v.procedure || (c.procedure !== PROCEDURE_UNKNOWN ? c.procedure : ""),
    variants: v.variants || c.variants.map((x) => `${x.dosage} ${x.unit}`.trim()).join(", "),
  });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  return (
    <Card className="p-6">
      <SectionTitle icon={Layers} title={`Périmètre du dossier — version ${v.version}`} subtitle="Produit et variantes, marché et procédure de cette version. Les valeurs du cadrage sont proposées." />
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Field label="Marché" required htmlFor="vd-market">
          <Select id="vd-market" placeholder="Choisir" options={c.markets} value={form.market} disabled={frozen} onChange={(e) => setForm({ ...form, market: e.target.value })} />
        </Field>
        <Field label="Procédure" required htmlFor="vd-procedure">
          <Select id="vd-procedure" placeholder="Choisir" options={PROCEDURES.filter((x) => x !== PROCEDURE_UNKNOWN)} value={form.procedure} disabled={frozen} onChange={(e) => setForm({ ...form, procedure: e.target.value })} />
        </Field>
        <Field label="Variantes couvertes" htmlFor="vd-variants">
          <Input id="vd-variants" value={form.variants} disabled={frozen} onChange={(e) => setForm({ ...form, variants: e.target.value })} />
        </Field>
      </div>
      {!frozen && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button
            variant={dirty ? "primary" : "outline"}
            icon={<Check className="h-4 w-4" />}
            disabled={!form.market || !form.procedure}
            onClick={() => {
              validationActions.saveScope(project.code, form);
              toast.show({ title: "Périmètre validé", description: `${form.market} · ${form.procedure}` });
            }}
          >
            Valider le périmètre
          </Button>
          <span className={cn("flex items-center gap-1.5 text-[13px]", dirty ? "text-ink-500" : "font-semibold text-success-700")}>
            {dirty ? (
              "Périmètre à valider."
            ) : (
              <>
                <CircleCheck className="h-4 w-4 fill-success-500 text-white" aria-hidden />
                Périmètre validé : vous pouvez passer aux sections.
              </>
            )}
          </span>
        </div>
      )}
    </Card>
  );
}

/** A block of the working form: its fields, values proposed from the project, and one button to record them. */
function FieldsCard({ icon, title, subtitle, fields, values, defaults, locked, saveLabel, note, onSave }: { icon: typeof Layers; title: string; subtitle: string; fields: DossierField[]; values?: Record<string, string>; defaults?: Record<string, string>; locked?: boolean; saveLabel: string; note?: string; onSave: (values: Record<string, string>) => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, values?.[f.key] || defaults?.[f.key] || ""])));
  const saved = Object.fromEntries(fields.map((f) => [f.key, values?.[f.key] ?? ""]));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const filled = fields.filter((f) => form[f.key].trim()).length;
  return (
    <Card className="p-6">
      <SectionTitle
        icon={icon}
        title={title}
        subtitle={subtitle}
        aside={
          <Badge tone={filled === fields.length ? "success" : "neutral"} size="md">
            {filled} / {fields.length} renseignés
          </Badge>
        }
      />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`df-${f.key}`} hint={f.hint} className={f.long ? "md:col-span-2" : undefined}>
            {f.long ? (
              <Textarea id={`df-${f.key}`} value={form[f.key]} disabled={locked} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} maxLength={600} />
            ) : (
              <Input id={`df-${f.key}`} value={form[f.key]} disabled={locked} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            )}
          </Field>
        ))}
      </div>
      {note && <p className="mt-3 text-[13px] text-ink-500">{note}</p>}
      {!locked && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button variant={dirty ? "primary" : "outline"} icon={<Check className="h-4 w-4" />} onClick={() => onSave(form)}>
            {saveLabel}
          </Button>
          <span className={cn("text-[13px]", dirty ? "text-ink-500" : "font-semibold text-success-700")}>{dirty ? "Modifications à enregistrer." : "Enregistré."}</span>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

function SectionModal({ project, section, frozen, onClose }: { project: Project; section: ValidationSection; frozen: boolean; onClose: () => void }) {
  const feed = sectionFeed(project, section.feed);
  const [content, setContent] = useState(section.content);
  const [applicable, setApplicable] = useState(section.applicable);
  const [naReason, setNaReason] = useState(section.naReason);
  const [approver, setApprover] = useState("");
  const [comment, setComment] = useState(section.comment);
  const dirty = content.trim() !== section.content || applicable !== section.applicable || naReason.trim() !== section.naReason;
  const code = project.code;
  const inReview = !frozen;
  const save = () => validationActions.saveSection(code, section.id, { content, applicable, naReason });
  const draft = feed.lines.map((l) => `${l.text} [source : ${l.source}]`).join("\n");
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={section.title}
      subtitle={section.module}
      footer={
        <>
          <Badge tone={section.applicable ? REVIEW_TONE[section.review] : "neutral"} dot size="md" className="mr-auto">
            {section.applicable ? section.review : "Non applicable"}
          </Badge>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          {!frozen && (
            <Button variant="outline" disabled={!dirty || (!applicable && !naReason.trim())} onClick={save}>
              Enregistrer la section
            </Button>
          )}
          {inReview && applicable && (
            <>
              <Button
                variant="outline"
                disabled={dirty || !section.applicable || !comment.trim()}
                title="Un commentaire de revue est nécessaire"
                onClick={() => {
                  validationActions.reviewSection(code, section.id, "À corriger", comment);
                  onClose();
                }}
              >
                Demander une correction
              </Button>
              <Button
                icon={<Check className="h-4 w-4" />}
                disabled={!content.trim()}
                onClick={() => {
                  // Entered content is saved and the section validated in one go.
                  if (dirty) validationActions.saveAndApprove(code, section.id, { content, applicable, naReason });
                  else validationActions.reviewSection(code, section.id, "Approuvée", comment);
                  onClose();
                }}
              >
                Valider la section
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <Checkbox checked={applicable} disabled={frozen} onChange={setApplicable} label="Section applicable à ce dossier" description="Une section non applicable doit être justifiée, et la justification approuvée." />
        {!applicable ? (
          <div className="rounded-xl border border-line p-4">
            <Field label="Justification de non-applicabilité" required htmlFor="vs-na">
              <Textarea id="vs-na" value={naReason} disabled={frozen} onChange={(e) => setNaReason(e.target.value)} maxLength={400} />
            </Field>
            {section.naApprovedBy && !dirty ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-800">
                <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
                Justification approuvée par {section.naApprovedBy}
              </p>
            ) : (
              !frozen && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input aria-label="Approbateur de la non-applicabilité" placeholder="Nom de l'approbateur" value={approver} onChange={(e) => setApprover(e.target.value)} className="max-w-64" />
                  <Button variant="outline" disabled={dirty || section.applicable || !section.naReason || !approver.trim()} onClick={() => validationActions.approveNa(code, section.id, approver)}>
                    Approuver la justification
                  </Button>
                  {dirty && <span className="text-[13px] text-ink-500">Enregistrez d&apos;abord la section.</span>}
                </div>
              )
            )}
          </div>
        ) : (
          <>
            <div>
              <p className="text-[15px] font-semibold text-ink-900">Éléments disponibles dans le projet</p>
              {feed.lines.length === 0 ? (
                <p className="mt-2 rounded-xl bg-subtle px-4 py-3 text-sm text-ink-600">{section.feed === "libre" || section.feed === "nonclinique" ? "Aucune donnée du projet n'alimente cette section : son contenu est rédigé ici." : "Aucune donnée approuvée n'alimente encore cette section."}</p>
              ) : (
                <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                  {feed.lines.map((l, i) => (
                    <li key={i} className="px-4 py-2.5 text-sm">
                      <p className="text-ink-900">{l.text}</p>
                      <p className="text-[13px] text-ink-500">Source : {l.source}</p>
                    </li>
                  ))}
                </ul>
              )}
              {feed.gaps.length > 0 && (
                <div className="mt-3 rounded-xl border border-warn-200 bg-warn-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <CircleAlert className="h-4 w-4 text-warn-600" aria-hidden />
                    {feed.gaps.length} {plural(feed.gaps.length, "élément manquant", "éléments manquants")}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-ink-700">
                    {feed.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                  <LinkButton href={feed.href} variant="link" size="sm" className="mt-2" iconRight={<ArrowRight className="h-4 w-4" />}>
                    Compléter à la source
                  </LinkButton>
                </div>
              )}
            </div>
            <Field
              label="Contenu de la section"
              htmlFor="vs-content"
              hint="Brouillon construit depuis les données approuvées, chaque phrase avec sa preuve ; à relire et compléter."
              aside={
                !frozen && draft ? (
                  <Button variant="link" size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={() => setContent(draft)}>
                    Générer le brouillon
                  </Button>
                ) : undefined
              }
            >
              <Textarea id="vs-content" value={content} disabled={frozen} onChange={(e) => setContent(e.target.value)} maxLength={6000} className="min-h-56" />
            </Field>
            {(inReview || section.comment) && (
              <Field label="Commentaire de revue" htmlFor="vs-comment" hint={inReview ? "Obligatoire pour demander une correction." : undefined}>
                <Textarea id="vs-comment" value={comment} disabled={!inReview} onChange={(e) => setComment(e.target.value)} maxLength={400} />
              </Field>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Handles a gap on the page, with fields worded for what the gap is about. */
function HandleGapModal({ code, gap, onClose }: { code: string; gap: Gap; onClose: () => void }) {
  const form = gapForm(gap);
  return (
    <FormModal
      title={form.title}
      subtitle={gap.label}
      fields={[
        { key: "subject", label: form.subject, required: true, wide: true },
        { key: "value", label: form.value, required: true, wide: true, placeholder: form.valueHint },
        { key: "by", label: form.person, required: true, wide: true, placeholder: "Nom de la personne" },
        { key: "reason", label: form.reason, type: "textarea", required: true, wide: true },
      ]}
      initial={{ subject: gap.detail }}
      submitLabel="Marquer comme traité"
      note={<p className="text-[13px] text-ink-500">Le constat reste visible avec ces éléments, dans la page, l&apos;export et la version figée. Si la donnée est complétée à sa source, le manque disparaît de lui-même.</p>}
      onClose={onClose}
      onSubmit={(x) =>
        validationActions.handleGap(code, gap.key, gap.label, String(x.by), String(x.reason), [
          { label: form.subject, value: String(x.subject) },
          { label: form.value, value: String(x.value) },
        ])
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ValidationView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [versioning, setVersioning] = useState(false);
  const [sender, setSender] = useState("");
  const [handling, setHandling] = useState<Gap | null>(null);

  if (!project) return null;
  if (!project.cadrage) {
    return (
      <>
        <ProjectTabs slug={project.slug} />
        <Card className="mt-6">
          <EmptyState icon={Info} title="Étape indisponible pour ce projet" description="Ce projet a été créé avant le nouveau parcours d'aide à la décision." />
        </Card>
      </>
    );
  }

  const code = project.code;
  const v = validationOf(project);
  const status = validationState(project);
  const frozen = isFrozen(v);
  const checks = consistencyChecks(project);
  const every = allGaps(project);
  const missing = every.filter((g) => !g.handled);
  const handled = every.filter((g) => g.handled);
  const section = v.sections.find((s) => s.id === open);
  const applicable = v.sections.filter((s) => s.applicable);
  const approved = applicable.filter((s) => s.review === "Approuvée").length;
  const exportDossier = () => {
    downloadBlob(`Dossier_AMM_${code}_v${v.version}.pdf`, buildFormPdf(dossierForm(project), { band: "DOSSIER AMM | Trame de travail | Médicament à usage humain", footer: `${code} - ${project.name} - version ${v.version} - Modèle non officiel, à adapter au produit et au pays de dépôt.` }));
    toast.show({ title: "Dossier exporté en PDF", description: "Mis en page comme le formulaire AMM : 7 fiches et les contrôles. Ce n'est pas un eCTD." });
  };

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Dossier_${code}`} sheets={() => validationWorkbook(project)} />} />

      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Dossier de validation</h2>
          <Badge tone={STATE_TONE[status]} size="md">
            {status}
          </Badge>
          <Badge tone="neutral" size="md">
            Version {v.version}
          </Badge>
          {v.transmittedAt && (
            <Badge tone="success" size="md">
              Transmis
            </Badge>
          )}
        </div>
        <p className="mt-1 text-[15px] text-ink-600">Peut-on transmettre une version cohérente et traçable pour validation interne ?</p>
        <ol className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
          {STATES.map((s) => (
            <li key={s} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", s === status ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line text-ink-500")}>
              {s}
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-6">
        <G4Card project={project} v={v} />
      </div>

      <div className="mt-6">
        <ScopeCard key={`${v.version}-${v.market}-${v.procedure}-${v.variants}-${frozen}`} project={project} v={v} frozen={frozen} />
      </div>

      <div className="mt-6">
        <FieldsCard
          key={`cover-${v.version}-${JSON.stringify(v.cover ?? {})}-${frozen}`}
          icon={FileText}
          title="Fiche de couverture"
          subtitle="Ce qui identifie le dossier au-delà du produit lu au cadrage : présentation, demandeur, fabricants, type de demande, code et responsable."
          fields={COVER_FIELDS}
          values={v.cover}
          defaults={coverDefaults(project)}
          locked={frozen}
          saveLabel="Valider la fiche de couverture"
          onSave={(values) => {
            validationActions.saveCover(code, values);
            toast.show({ title: "Fiche de couverture enregistrée" });
          }}
        />
      </div>

      <Card className="mt-6 p-6">
        <SectionTitle
          icon={FolderTree}
          title="Sections du dossier"
          subtitle="Alimentées depuis les données et documents approuvés. Le module 3 et les synthèses qualité sont prioritaires ; le dossier n'est pas présenté comme un CTD complet si d'autres éléments restent requis."
          aside={
            v.sections.length ? (
              <Badge tone={approved === applicable.length && applicable.length ? "success" : "neutral"} size="md">
                {approved} / {applicable.length} {plural(applicable.length, "approuvée")}
              </Badge>
            ) : undefined
          }
        />
        {v.sections.length === 0 ? (
          <p className="mt-4 rounded-xl bg-subtle px-4 py-5 text-center text-sm text-ink-600">Aucune section. Reprenez la liste proposée, puis ajustez-la au marché et à la procédure.</p>
        ) : (
          MODULES.filter((m) => v.sections.some((s) => s.module === m)).map((m) => (
            <section key={m} className="mt-5">
              <h3 className="text-[15px] font-bold text-ink-900">{m}</h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {v.sections
                  .filter((s) => s.module === m)
                  .map((s) => {
                    const feedGaps = s.applicable ? sectionFeed(project, s.feed).gaps.length : 0;
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <p className="min-w-56 flex-1 text-[15px] font-semibold text-ink-900">{s.title}</p>
                        {!s.applicable ? (
                          <Badge tone={s.naApprovedBy ? "neutral" : "warn"}>{s.naApprovedBy ? "Non applicable — approuvé" : "Non applicable — à approuver"}</Badge>
                        ) : (
                          <>
                            {!s.content.trim() && <Badge tone="warn">Vide</Badge>}
                            {feedGaps > 0 && (
                              <Badge tone="warn">
                                {feedGaps} {plural(feedGaps, "manque")}
                              </Badge>
                            )}
                            <Badge tone={REVIEW_TONE[s.review]}>{s.review}</Badge>
                          </>
                        )}
                        {!frozen && s.applicable && s.review !== "Approuvée" && s.content.trim() && (
                          <Button size="sm" icon={<Check className="h-4 w-4" />} onClick={() => validationActions.reviewSection(code, s.id, "Approuvée", "")}>
                            Valider
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setOpen(s.id)}>
                          {s.applicable && !s.content.trim() ? "Remplir" : "Ouvrir"}
                        </Button>
                        {!frozen && <Button variant="ghost" size="sm" aria-label={`Retirer ${s.title}`} icon={<Trash2 className="h-4 w-4" />} onClick={() => validationActions.removeSection(code, s.id)} />}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))
        )}
        {!frozen && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" icon={<Sparkles className="h-4 w-4" />} onClick={() => validationActions.proposeSections(code)}>
              Reprendre les sections proposées
            </Button>
            <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Ajouter une section
            </Button>
          </div>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <SectionTitle
          icon={ShieldCheck}
          title="Contrôles de cohérence"
          subtitle="Présence, version et cohérence des contenus entre le développement, les contrôles, la stabilité et la bioéquivalence."
          aside={
            <Badge tone={checks.every((c) => c.ok || v.overrides?.[c.label]) ? "success" : "warn"} size="md">
              {checks.filter((c) => c.ok || v.overrides?.[c.label]).length} / {checks.length} conformes ou traités
            </Badge>
          }
        />
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {checks.map((c) => (
            <li key={c.label} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {c.ok || v.overrides?.[c.label] ? <CircleCheck className={cn("h-5 w-5 shrink-0 text-white", c.ok ? "fill-success-500" : "fill-brand-500")} aria-hidden /> : <CircleX className="h-5 w-5 shrink-0 text-danger-600" aria-hidden />}
              <div className="min-w-56 flex-1">
                <p className="text-[15px] font-semibold text-ink-900">{c.label}</p>
                <p className="text-[13px] text-ink-600">{c.detail}</p>
                {!c.ok && v.overrides?.[c.label] && (
                  <p className="text-[13px] text-brand-700">
                    {[...(v.overrides[c.label].details ?? []).map((d) => `${d.label} : ${d.value}`), v.overrides[c.label].reason].join(" · ")} — {v.overrides[c.label].by}
                  </p>
                )}
              </div>
              {!c.ok &&
                (v.overrides?.[c.label] ? (
                  <Badge tone="info">Traité avec justification</Badge>
                ) : (
                  <>
                    <Badge tone={IMPACT_TONE[c.impact]}>{c.impact}</Badge>
                    {!frozen && (
                      <Button variant="outline" size="sm" onClick={() => setHandling({ key: c.label, label: c.label, detail: c.detail, impact: c.impact, action: c.action, href: c.href })}>
                        Traiter ici
                      </Button>
                    )}
                  </>
                ))}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 p-6">
        <SectionTitle
          icon={ListChecks}
          title="Manques à résoudre"
          subtitle="Classés par impact. Chaque manque se résout à sa source, ou se traite ici avec une justification ; seuls les manques bloquants ouverts empêchent de figer la version."
          aside={
            <Badge tone={missing.length ? "warn" : "success"} size="md">
              {missing.length ? `${missing.length} ${plural(missing.length, "manque")}` : "Aucun manque"}
            </Badge>
          }
        />
        {missing.length === 0 ? (
          <p className="mt-4 rounded-xl bg-subtle px-4 py-5 text-center text-sm text-ink-600">{v.sections.length ? "Les contrôles ne relèvent aucun manque." : "Aucun manque relevé pour l'instant : la liste des sections reste à construire."}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {missing.map((g, i) => (
              <li key={`${g.label}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge tone={IMPACT_TONE[g.impact]}>{g.impact}</Badge>
                <div className="min-w-56 flex-1">
                  <p className="text-[15px] font-semibold text-ink-900">{g.label}</p>
                  <p className="text-[13px] text-ink-600">{g.detail}</p>
                </div>
                <LinkButton href={g.href} variant="link" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
                  {g.action}
                </LinkButton>
                {!frozen && (
                  <Button variant="outline" size="sm" onClick={() => setHandling(g)}>
                    Traiter ici
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {handled.length > 0 && (
          <div className="mt-5">
            <p className="text-[15px] font-semibold text-ink-900">Traités avec justification ({handled.length})</p>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {handled.map((g) => (
                <li key={g.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Badge tone="info">Traité</Badge>
                  <div className="min-w-56 flex-1">
                    <p className="text-[15px] font-semibold text-ink-900">{g.label}</p>
                    <p className="text-[13px] text-ink-600">{g.detail}</p>
                    <p className="text-[13px] text-brand-700">
                      {[...(g.handled!.details ?? []).map((d) => `${d.label} : ${d.value}`), g.handled!.reason].join(" · ")} — {g.handled!.by}, {formatDateTime(g.handled!.at)}
                    </p>
                  </div>
                  {!frozen && (
                    <Button variant="ghost" size="sm" onClick={() => validationActions.reopenGap(code, g.key, g.label)}>
                      Rouvrir
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <FieldsCard
          key={`pre-${v.version}-${JSON.stringify(v.preDeposit ?? {})}`}
          icon={ShieldCheck}
          title="Revue avant dépôt"
          subtitle="Contrôle interne et approbation : index des pièces, revues réglementaire et qualité, décision interne et approbateur."
          fields={PREDEPOSIT_FIELDS}
          values={v.preDeposit}
          saveLabel="Enregistrer la revue avant dépôt"
          note="L'approbation interne pour dépôt ne constitue pas une AMM. Vérifiez les exigences nationales et les modalités de soumission avant dépôt."
          onSave={(values) => {
            validationActions.savePreDeposit(code, values);
            toast.show({ title: "Revue avant dépôt enregistrée" });
          }}
        />
      </div>

      <Card className="mt-6 p-6">
        <SectionTitle icon={FileText} title="Revue, version figée et export" subtitle="Chaque section se valide dès qu'elle est remplie ; la version est ensuite figée. Transmettre le dossier est une action distincte." />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!reviewOpen(v) && !frozen && (
            <Button variant="outline" icon={<Send className="h-4 w-4" />} disabled={!canSubmit(project)} onClick={() => validationActions.submitReview(code)}>
              Soumettre à la revue
            </Button>
          )}
          {!frozen && (
            <Button icon={<Lock className="h-4 w-4" />} disabled={!canFreeze(project)} onClick={() => validationActions.freeze(code)}>
              Figer la version {v.version}
            </Button>
          )}
          <Button variant="outline" icon={<Download className="h-4 w-4" />} disabled={!v.sections.length} onClick={exportDossier}>
            Exporter le dossier (PDF)
          </Button>
          <span className="text-[13px] text-ink-500">
            {frozen
              ? `Version ${v.version} figée : elle reste intacte.`
              : canFreeze(project)
                ? "Toutes les sections sont validées : la version peut être figée."
                : !v.sections.length
                  ? "Construisez d'abord la liste des sections."
                  : approved < applicable.length
                    ? `${approved} / ${applicable.length} sections validées${v.reviewStartedAt ? ` — revue ouverte le ${formatDateTime(v.reviewStartedAt)}` : ""}. Remplissez puis validez chaque section.`
                    : "Toutes les sections sont validées ; il reste des manques bloquants à résoudre avant de figer (liste ci-dessus)."}
          </span>
        </div>
        {frozen && (
          <div className="mt-5 rounded-xl border border-success-100 bg-success-50/70 p-4">
            <p className="flex items-center gap-2 font-semibold text-ink-900">
              <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
              Dossier v{v.version} prêt pour validation interne
            </p>
            <p className="mt-1 text-sm text-ink-700">
              Figé par {v.snapshots[0].by} le {formatDateTime(v.snapshots[0].at)} — {v.snapshots[0].sections.length} sections, {v.snapshots[0].checks.length} contrôles et {v.snapshots[0].decisions.length} décisions conservés.
            </p>
            {v.transmittedAt ? (
              <p className="mt-3 text-sm font-semibold text-ink-900">
                Transmis pour validation interne par {v.transmittedBy} — {formatDateTime(v.transmittedAt)}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input aria-label="Personne qui transmet le dossier" placeholder="Nom de la personne autorisée" value={sender} onChange={(e) => setSender(e.target.value)} className="max-w-64 bg-white" />
                <Button icon={<Send className="h-4 w-4" />} disabled={!sender.trim()} onClick={() => validationActions.transmit(code, sender)}>
                  Transmettre pour validation interne
                </Button>
              </div>
            )}
            <Button variant="outline" className="mt-3" icon={<Plus className="h-4 w-4" />} onClick={() => setVersioning(true)}>
              Ouvrir une nouvelle version
            </Button>
          </div>
        )}
        {v.snapshots.length > 0 && (
          <div className="mt-5">
            <p className="text-[15px] font-semibold text-ink-900">Versions figées</p>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {v.snapshots.map((s) => (
                <li key={s.version} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <Badge tone="neutral">v{s.version}</Badge>
                  <span className="flex-1 text-ink-800">
                    {s.scope} — figée par {s.by} le {formatDateTime(s.at)}
                  </span>
                  <span className="text-ink-600">
                    {s.sections.length} sections · {s.checks.filter((c) => c.ok).length}/{s.checks.length} contrôles conformes
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-[13px] text-ink-500">L&apos;export regroupe des documents organisés par module du CTD. Il ne s&apos;appelle pas « eCTD » : aucun format électronique réglementaire n&apos;est produit ni vérifié.</p>
      </Card>

      {section && <SectionModal key={`${section.id}-${section.review}-${section.content.length}-${section.applicable}-${section.naApprovedBy ?? ""}-${frozen}`} project={project} section={section} frozen={frozen} onClose={() => setOpen(null)} />}
      {handling && <HandleGapModal key={handling.key} code={code} gap={handling} onClose={() => setHandling(null)} />}
      {adding && (
        <FormModal
          title="Ajouter une section"
          fields={[
            { key: "module", label: "Module", type: "select", required: true, options: MODULES, wide: true },
            { key: "title", label: "Titre de la section", required: true, wide: true },
          ]}
          submitLabel="Ajouter"
          onClose={() => setAdding(false)}
          onSubmit={(x) => validationActions.addSection(code, { module: String(x.module), title: String(x.title) })}
        />
      )}
      {versioning && (
        <FormModal
          title={`Ouvrir la version ${v.version + 1}`}
          subtitle={`La version ${v.version} reste figée et consultable. Les sections repassent en revue.`}
          fields={[{ key: "reason", label: "Motif de la nouvelle version", type: "textarea", required: true, wide: true }]}
          submitLabel="Ouvrir la version"
          onClose={() => setVersioning(false)}
          onSubmit={(x) => validationActions.newVersion(code, String(x.reason))}
        />
      )}
    </>
  );
}
