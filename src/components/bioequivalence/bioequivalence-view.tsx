"use client";

import { ArrowRight, Check, CircleAlert, CircleCheck, FileText, GitBranch, Info, ListChecks, Microscope, Paperclip, Pencil, Plus, Scale, ShieldCheck, Sparkles, Trash2, Users } from "lucide-react";
import { useRef, useState } from "react";
import { DatumModal, ExcelButton, SectionTitle } from "@/components/cadrage/cadrage-bits";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Radio, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { toast } from "@/components/ui/toast";
import { BE_TONE, ORIENTATIONS, ORIENTATION_TONE, STUDY_FIELDS, beDocuments, beInputs, beOf, beStatus, isApproved, isValidated, proposeOrientation, strategyBlocks, studyDefaults, studyMissing, waiverStatus, type StrategyInput } from "@/lib/bioequivalence";
import { allData, docLabel } from "@/lib/cadrage";
import { formatDateTime, plural } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { bioequivalenceWorkbook } from "@/lib/step-exports";
import { bioequivalenceActions, cadrageActions, useDemo } from "@/lib/store";
import type { BeCriterion, BeFile, BeStudy, Project } from "@/lib/types";

const INPUT_TONE = { Vérifiée: "success", "À confirmer": "warn", Contradictoire: "danger", "Non documentée": "neutral" } as const;
const CRITERION_TONE = { "À documenter": "warn", "Preuve disponible": "success", "Non satisfait": "danger" } as const;
const WAIVER_TONE = { "Éligibilité à examiner": "warn", "Argumentaire préparé": "success", "Critère non satisfait": "danger" } as const;
const ORIENTATION_HELP = {
  "Étude à préparer": "Les éléments sont réunis pour le spécialiste ou le CRO, qui confirme le plan et le dimensionnement.",
  "Dispense à examiner": "Chaque critère est rattaché à sa référence et à sa preuve. Le résultat est un argumentaire, jamais une dispense accordée.",
  "Données insuffisantes": "Les informations manquantes sont à compléter avant de retenir une stratégie.",
} as const;

/* ------------------------------------------------------------------ */
/* Strategy                                                            */
/* ------------------------------------------------------------------ */

function StrategyEditor({ project, be, proposed }: { project: Project; be: BeFile; proposed: string }) {
  const saved: StrategyInput = { referential: be.referential, orientation: be.orientation, rationale: be.rationale, limits: be.limits };
  const [form, setForm] = useState<StrategyInput>(saved);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  return (
    <Card className="p-6">
      <SectionTitle icon={Scale} title="Stratégie retenue" subtitle="L'orientation est choisie par une personne, à partir des références retenues pour le marché. La proposition du système n'est qu'une aide à la lecture." />
      <div className="mt-5 grid gap-5">
        <Field label="Référentiels applicables (texte et version)" required htmlFor="be-ref" hint="Références retenues avec les affaires réglementaires pour les marchés visés. Aucune n'est appliquée d'office.">
          <Input id="be-ref" value={form.referential} onChange={(e) => setForm({ ...form, referential: e.target.value })} placeholder="Ex. ligne directrice applicable au marché visé, version…" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold text-ink-800">Orientation</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {ORIENTATIONS.map((o) => (
              <Radio
                key={o}
                name="be-orientation"
                checked={form.orientation === o}
                onChange={() => setForm({ ...form, orientation: o })}
                label={
                  <span className="flex flex-wrap items-center gap-2">
                    {o}
                    {o === proposed && <Badge tone="neutral">Proposée</Badge>}
                  </span>
                }
                description={ORIENTATION_HELP[o]}
                className="rounded-xl border border-line p-4"
              />
            ))}
          </div>
        </fieldset>
        <Field label="Justification" required htmlFor="be-rationale" hint="Pourquoi cette orientation, avec les preuves qui la soutiennent.">
          <Textarea id="be-rationale" value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} maxLength={600} className="min-h-24" />
        </Field>
        <Field label="Limites et inconnues" htmlFor="be-limits" hint="Ce qui n'est pas établi et ce que cela peut changer.">
          <Textarea id="be-limits" value={form.limits} onChange={(e) => setForm({ ...form, limits: e.target.value })} maxLength={600} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button
          disabled={!dirty}
          onClick={() => {
            bioequivalenceActions.saveStrategy(project.code, form);
            toast.show({ title: "Stratégie enregistrée", description: be.scientific || be.regulatory ? "La stratégie a changé : les approbations sont à redemander." : undefined, tone: "info" });
          }}
        >
          Enregistrer la stratégie
        </Button>
        <span className="text-[13px] text-ink-500">{dirty ? "Modifications non enregistrées." : be.scientific || be.regulatory ? "Modifier la stratégie retire les approbations déjà données." : ""}</span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Waiver criteria                                                     */
/* ------------------------------------------------------------------ */

function WaiverCard({ project, be }: { project: Project; be: BeFile }) {
  const [edit, setEdit] = useState<BeCriterion | "new" | null>(null);
  const status = waiverStatus(be);
  const code = project.code;
  return (
    <Card className="p-6">
      <SectionTitle
        icon={ListChecks}
        title="Critères de la dispense envisagée"
        subtitle="Pour chaque critère : sa référence, la preuve disponible et l'information manquante. Une forte solubilité seule ne suffit pas à conclure."
        aside={
          <Badge tone={WAIVER_TONE[status]} size="md">
            {status}
          </Badge>
        }
      />
      {be.criteria.length === 0 ? (
        <p className="mt-4 rounded-xl bg-subtle px-4 py-5 text-center text-sm text-ink-600">Aucun critère pour l&apos;instant. Reprenez la liste proposée ou ajoutez les critères du référentiel retenu.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {be.criteria.map((c) => (
            <li key={c.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink-900">
                  {c.label}
                  <Badge tone={CRITERION_TONE[c.state]}>{c.state}</Badge>
                  {c.origin === "Proposition du système" && <Badge tone="neutral">Proposé par le système</Badge>}
                </p>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-[13px] text-ink-500">Référence</dt>
                    <dd className={c.source ? "text-ink-800" : "text-ink-400"}>{c.source || "À renseigner"}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-500">Preuve disponible</dt>
                    <dd className={c.evidence ? "text-ink-800" : "text-ink-400"}>{c.evidence || "Aucune"}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-ink-500">Information manquante</dt>
                    <dd className={c.missing ? "text-ink-800" : "text-ink-400"}>{c.missing || "—"}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex items-start gap-1">
                <Button variant="ghost" size="sm" aria-label={`Modifier ${c.label}`} icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(c)} />
                <Button variant="ghost" size="sm" aria-label={`Retirer ${c.label}`} icon={<Trash2 className="h-4 w-4" />} onClick={() => bioequivalenceActions.removeCriterion(code, c.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="outline" icon={<Sparkles className="h-4 w-4" />} onClick={() => bioequivalenceActions.proposeCriteria(code)}>
          Reprendre les critères proposés
        </Button>
        <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>
          Ajouter un critère
        </Button>
      </div>
      <p className="mt-3 text-[13px] text-ink-500">La liste proposée est une aide : seuls les critères du référentiel retenu font foi. Le résultat reste « Éligibilité à examiner » ou « Argumentaire préparé » — l&apos;autorité seule accorde une dispense.</p>
      {edit && (
        <FormModal
          title={edit === "new" ? "Ajouter un critère" : "Documenter le critère"}
          fields={[
            { key: "label", label: "Critère", required: true, wide: true },
            { key: "source", label: "Référence (texte, section)", wide: true, placeholder: "D'où vient ce critère" },
            { key: "evidence", label: "Preuve disponible", type: "textarea", wide: true, placeholder: "Document, résultat ou donnée qui le soutient" },
            { key: "missing", label: "Information manquante", type: "textarea", wide: true },
            { key: "state", label: "État", type: "select", required: true, options: ["À documenter", "Preuve disponible", "Non satisfait"] },
          ]}
          initial={edit === "new" ? { state: "À documenter" } : { label: edit.label, source: edit.source, evidence: edit.evidence, missing: edit.missing, state: edit.state }}
          note={<p className="text-[13px] text-ink-500">« Preuve disponible » ne compte pour l&apos;argumentaire que si la référence et la preuve sont renseignées.</p>}
          onClose={() => setEdit(null)}
          onSubmit={(v) =>
            bioequivalenceActions.saveCriterion(code, {
              id: edit === "new" ? undefined : edit.id,
              label: String(v.label),
              source: String(v.source),
              evidence: String(v.evidence),
              missing: String(v.missing),
              state: v.state as BeCriterion["state"],
            })
          }
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Study elements                                                      */
/* ------------------------------------------------------------------ */

function StudyCard({ project, be }: { project: Project; be: BeFile }) {
  const [study, setStudy] = useState<BeStudy>(be.study);
  const dirty = JSON.stringify(study) !== JSON.stringify(be.study);
  const missing = studyMissing(be);
  const defaults = studyDefaults(project);
  return (
    <Card className="p-6">
      <SectionTitle
        icon={Microscope}
        title="Éléments pour le spécialiste / CRO"
        subtitle="Produit test et référence, lots, hypothèses, données disponibles et points à préciser. Aucun effectif n'est calculé ici."
        aside={
          <Badge tone={missing.length ? "warn" : "success"} size="md">
            {missing.length ? `${missing.length} ${plural(missing.length, "élément requis manquant", "éléments requis manquants")}` : "Éléments requis réunis"}
          </Badge>
        }
      />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {STUDY_FIELDS.map((f) => {
          const proposed = defaults[f.key];
          const long = f.key === "design" || f.key === "hypotheses" || f.key === "available" || f.key === "open" || f.key === "sizing";
          return (
            <Field
              key={f.key}
              label={f.label}
              required={f.required}
              htmlFor={`be-study-${f.key}`}
              hint={f.hint}
              className={long ? "md:col-span-2" : undefined}
              aside={
                proposed && !study[f.key] ? (
                  <Button variant="link" size="sm" onClick={() => setStudy({ ...study, [f.key]: proposed })}>
                    Reprendre du projet
                  </Button>
                ) : undefined
              }
            >
              {long ? (
                <Textarea id={`be-study-${f.key}`} value={study[f.key]} onChange={(e) => setStudy({ ...study, [f.key]: e.target.value })} maxLength={600} />
              ) : (
                <Input id={`be-study-${f.key}`} value={study[f.key]} onChange={(e) => setStudy({ ...study, [f.key]: e.target.value })} />
              )}
            </Field>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button disabled={!dirty} onClick={() => bioequivalenceActions.saveStudy(project.code, study)}>
          Enregistrer les éléments
        </Button>
        <span className="text-[13px] text-ink-500">{dirty ? "Modifications non enregistrées." : "Le dimensionnement relève d'une méthode vérifiable, soumise à une revue compétente."}</span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

function ApprovalCard({ project, be }: { project: Project; be: BeFile }) {
  const blocks = strategyBlocks(be);
  const person = (pattern: RegExp) => project.team.find((m) => pattern.test(m.role) && m.person)?.person ?? "";
  const [names, setNames] = useState({ scientific: person(/scientif|galén|r&d|développement/i), regulatory: person(/réglement/i) });
  const file = useRef<HTMLInputElement>(null);
  const rows = [
    { role: "scientific" as const, label: "Responsable scientifique", approval: be.scientific },
    { role: "regulatory" as const, label: "Affaires réglementaires", approval: be.regulatory },
  ];
  const kind = be.orientation === "Dispense à examiner" ? "l'argumentaire de dispense" : "le rapport d'étude";
  const docs = beDocuments(be);
  return (
    <Card className="p-6">
      <SectionTitle
        icon={Users}
        title="Approbation de la stratégie"
        subtitle="La stratégie est confirmée par les responsables scientifique et réglementaire. Les deux approbations sont nécessaires."
        aside={
          <Badge tone={isApproved(be) ? "success" : "neutral"} size="md">
            {isApproved(be) ? "Stratégie approuvée" : `${rows.filter((r) => r.approval).length} / 2`}
          </Badge>
        }
      />
      {blocks.length > 0 && (
        <div className="mt-4 rounded-xl border border-warn-200 bg-warn-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-ink-900">
            <CircleAlert className="h-5 w-5 text-warn-600" aria-hidden />
            La stratégie ne peut pas encore être approuvée
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-7 text-sm text-ink-700">
            {blocks.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {rows.map((r) => (
          <li key={r.role} className="flex flex-wrap items-center gap-3 p-4">
            <p className="min-w-52 flex-1 text-[15px] font-semibold text-ink-900">{r.label}</p>
            {r.approval ? (
              <p className="flex items-center gap-2 text-sm text-ink-800">
                <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
                Approuvée par {r.approval.by} — {formatDateTime(r.approval.at)}
              </p>
            ) : (
              <>
                <Input aria-label={`Nom — ${r.label}`} placeholder="Nom de la personne" value={names[r.role]} onChange={(e) => setNames({ ...names, [r.role]: e.target.value })} className="max-w-64" />
                <Button icon={<Check className="h-4 w-4" />} disabled={blocks.length > 0 || !names[r.role].trim()} onClick={() => bioequivalenceActions.approve(project.code, r.role, names[r.role])}>
                  Approuver
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {isApproved(be) && (
        <div className="mt-4 rounded-xl bg-subtle p-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <FileText className="h-5 w-5 text-ink-600" aria-hidden />
            {docs.length ? `${be.deliverable?.kind ?? "Document"} et pièces rattachés (${docs.length})` : `Rattacher ${kind}`}
          </p>
          {docs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {docs.map((d) => (
                <li key={d.name} className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
                  <span className="min-w-0 flex-1 truncate">
                    {d.name} — {formatDateTime(d.at)}
                  </span>
                  <Button variant="ghost" size="sm" aria-label={`Retirer ${d.name}`} icon={<Trash2 className="h-4 w-4" />} onClick={() => bioequivalenceActions.detach(project.code, d.name)} />
                </li>
              ))}
            </ul>
          )}
          <input
            ref={file}
            type="file"
            multiple
            className="hidden"
            aria-label="Document de bioéquivalence"
            onChange={(e) => {
              const names = Array.from(e.target.files ?? []).map((f) => f.name);
              if (names.length) bioequivalenceActions.attach(project.code, names);
              e.target.value = "";
            }}
          />
          <Button variant="outline" className="mt-3" icon={<Paperclip className="h-4 w-4" />} onClick={() => file.current?.click()}>
            {docs.length ? "Ajouter des documents" : "Choisir un ou plusieurs documents"}
          </Button>
          <p className="mt-2 text-[13px] text-ink-500">Les documents seront repris dans le dossier de validation. Seul leur nom est enregistré dans cette version.</p>
        </div>
      )}
    </Card>
  );
}

/** Last block of the step: the study is validated with its conclusion, which opens the dossier. */
function ValidationCard({ project, be }: { project: Project; be: BeFile }) {
  const waiver = be.orientation === "Dispense à examiner";
  const what = waiver ? "l'argumentaire" : "l'étude";
  const [by, setBy] = useState("");
  const [conclusion, setConclusion] = useState("");
  const approved = isApproved(be);
  const docs = beDocuments(be);
  return (
    <Card className="p-6">
      <SectionTitle
        icon={ShieldCheck}
        title={waiver ? "Validation de l'argumentaire" : "Validation de l'étude"}
        subtitle={`Dernière action de l'étape : valider ${what} avec sa conclusion pour passer à la préparation du dossier.`}
        aside={
          <Badge tone={isValidated(be) ? "success" : "neutral"} size="md">
            {isValidated(be) ? "Validée" : "À valider"}
          </Badge>
        }
      />
      {isValidated(be) && be.validated ? (
        <div className="mt-4 rounded-xl border border-success-100 bg-success-50/70 p-4">
          <p className="flex items-center gap-2 font-semibold text-ink-900">
            <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
            Validée par {be.validated.by} — {formatDateTime(be.validated.at)}
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-ink-800">{be.validated.conclusion}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <LinkButton href={`/projets/${project.slug}/dossier`} iconRight={<ArrowRight className="h-4 w-4" />}>
              Passer à l&apos;étape suivante : Dossier
            </LinkButton>
            <Button variant="outline" onClick={() => bioequivalenceActions.reopen(project.code)}>
              Rouvrir la validation
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {!approved && <p className="mb-4 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-ink-800">La stratégie doit d&apos;abord être approuvée par les deux responsables (bloc ci-dessus).</p>}
          {approved && docs.length === 0 && <p className="mb-4 rounded-xl bg-subtle px-4 py-3 text-sm text-ink-700">Aucun document n&apos;est rattaché : vous pouvez valider, mais le dossier demandera le rapport ou l&apos;argumentaire.</p>}
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field label="Validé par" required htmlFor="be-valid-by">
              <Input id="be-valid-by" value={by} onChange={(e) => setBy(e.target.value)} placeholder="Nom de la personne" />
            </Field>
            <Field label="Conclusion" required htmlFor="be-valid-conclusion" hint="Résultat retenu, limites et points encore ouverts.">
              <Textarea id="be-valid-conclusion" value={conclusion} onChange={(e) => setConclusion(e.target.value)} maxLength={600} />
            </Field>
          </div>
          <Button
            className="mt-4"
            icon={<Check className="h-4 w-4" />}
            disabled={!approved || !by.trim() || !conclusion.trim()}
            onClick={() => {
              bioequivalenceActions.validate(project.code, by, conclusion);
              toast.show({ title: waiver ? "Argumentaire validé" : "Étude validée", description: "L'étape suivante — le dossier de validation — est ouverte." });
            }}
          >
            {waiver ? "Valider l'argumentaire" : "Valider l'étude"}
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function BioequivalenceView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [editing, setEditing] = useState<string | null>(null);

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

  const be = beOf(project);
  const data = allData(project);
  const editingDatum = data.find((d) => d.key === editing);
  const inputs = beInputs(project);
  const proposal = proposeOrientation(project);
  const status = beStatus(be);

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Bioequivalence_${project.code}`} sheets={() => bioequivalenceWorkbook(project)} />} />

      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Stratégie de bioéquivalence</h2>
          <Badge tone={BE_TONE[status]} size="md">
            {status}
          </Badge>
          {be.orientation && (
            <Badge tone={ORIENTATION_TONE[be.orientation]} size="md">
              {be.orientation}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-[15px] text-ink-600">Quelle stratégie démonstrative est pertinente, et quelles preuves manquent pour la soutenir ? Ce volet peut être ouvert dès le cadrage et complété au fil du projet.</p>
      </Card>

      <Card className="mt-6 p-6">
        <SectionTitle icon={FileText} title="Informations réunies" subtitle="Reprises du cadrage et de la fiche princeps, avec leur état. Une information manquante se complète ici même ; elle est enregistrée dans la fiche du projet, avec sa nature et sa preuve." />
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {inputs.map((r) => (
            <li key={r.key} className="grid items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto]">
              <p className="text-[15px] font-semibold text-ink-900">{r.label}</p>
              <div className="min-w-0">
                <p className={r.value ? "text-[15px] text-ink-800" : "text-[15px] text-ink-400"}>{r.value || "Non documentée"}</p>
                {r.source && <p className="truncate text-[13px] text-ink-500">{r.source}</p>}
              </div>
              <Badge tone={INPUT_TONE[r.state]}>{r.state}</Badge>
              {!data.some((d) => d.key === r.key) ? (
                r.state === "Vérifiée" ? (
                  <span />
                ) : (
                  <LinkButton href={r.href} variant="link" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
                    Compléter
                  </LinkButton>
                )
              ) : (
                <span className="flex items-center gap-1">
                  {r.state === "À confirmer" && (
                    <Button variant="outline" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => cadrageActions.confirm(project.code, [r.key])}>
                      Confirmer
                    </Button>
                  )}
                  <Button variant={r.state === "Vérifiée" ? "ghost" : "outline"} size="sm" icon={<Pencil className="h-4 w-4" />} aria-label={`${r.state === "Vérifiée" ? "Modifier" : "Compléter"} ${r.label}`} onClick={() => setEditing(r.key)}>
                    {r.state === "Vérifiée" ? "" : r.state === "Contradictoire" ? "Résoudre" : r.state === "À confirmer" ? "Corriger" : "Compléter"}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 p-6">
        <SectionTitle
          icon={GitBranch}
          title="Arbre de décision"
          subtitle="Lecture des seules valeurs vérifiées. C'est une proposition du système à confronter aux références applicables."
          aside={
            <Badge tone={ORIENTATION_TONE[proposal.orientation]} size="md">
              Proposition : {proposal.orientation}
            </Badge>
          }
        />
        <ol className="mt-4 space-y-2">
          {proposal.steps.map((x, i) => (
            <li key={x.question} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
              <p className="min-w-56 flex-1 text-[15px] font-semibold text-ink-900">{x.question}</p>
              <p className="text-sm text-ink-600">{x.answer}</p>
              <Badge tone={x.ok === null ? "neutral" : x.ok ? "success" : "info"}>{x.ok === null ? "Non évaluable" : x.ok ? "Compatible avec une dispense" : "Oriente vers une étude"}</Badge>
            </li>
          ))}
        </ol>
        {proposal.missing.length > 0 && (
          <p className="mt-3 rounded-xl bg-subtle px-4 py-3 text-sm text-ink-700">
            À vérifier avant de conclure : {proposal.missing.map((m) => m.toLowerCase()).join(", ")}.
          </p>
        )}
      </Card>

      <div className="mt-6">
        <StrategyEditor key={`${be.orientation}-${be.referential}-${be.rationale.length}-${be.limits.length}`} project={project} be={be} proposed={proposal.orientation} />
      </div>

      {be.orientation === "Dispense à examiner" && (
        <div className="mt-6">
          <WaiverCard project={project} be={be} />
        </div>
      )}
      {be.orientation === "Étude à préparer" && (
        <div className="mt-6">
          <StudyCard key={JSON.stringify(be.study)} project={project} be={be} />
        </div>
      )}

      <div className="mt-6">
        <ApprovalCard project={project} be={be} />
      </div>

      <div className="mt-6">
        <ValidationCard key={be.validated?.at ?? "open"} project={project} be={be} />
      </div>

      {editingDatum && (
        <DatumModal
          key={editingDatum.key}
          datum={editingDatum}
          mode={editingDatum.status === "Contradictoire" ? "resolve" : "edit"}
          natureInput={{ documents: project.cadrage.documents.map(docLabel) }}
          onClose={() => setEditing(null)}
          onSubmit={(v, note, extra) => {
            if (editingDatum.status === "Contradictoire") cadrageActions.resolve(project.code, editingDatum.key, v, note);
            else cadrageActions.correct(project.code, editingDatum.key, v, note, extra);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
