"use client";

import { Check, CircleAlert, CircleCheck, ClipboardList, Factory, FlaskConical, Info, Microscope, Package, Pencil, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ExcelButton, SectionTitle } from "@/components/cadrage/cadrage-bits";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { FormModal, type FormField, type FormValues } from "@/components/ui/form-modal";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumeric } from "@/lib/format";
import { MATERIAL_CONTROLS, MATERIAL_DECISIONS, METHOD_KINDS, METHOD_STATUSES, checkResult, pilotPrerequisites, qualityOf, qualitySummary, specLimit } from "@/lib/quality";
import { findProject } from "@/lib/selectors";
import { qualityWorkbook } from "@/lib/step-exports";
import { qualityActions, useDemo } from "@/lib/store";
import type { QImpurity, QMaterial, QMethod, QSpec, Tone } from "@/lib/types";

type Tab = "methodes" | "specs" | "matieres" | "pilote" | "controles";
type Dialog = { kind: "method"; item?: QMethod } | { kind: "spec"; item?: QSpec } | { kind: "impurity"; item?: QImpurity } | { kind: "material"; item?: QMaterial } | { kind: "control" } | { kind: "approve"; item: QSpec } | null;

const METHOD_TONE: Record<QMethod["status"], Tone> = { "À évaluer": "neutral", "Vérification en cours": "warn", Utilisable: "success", "Non utilisable": "danger" };
const DECISION_TONE: Record<QMaterial["decision"], Tone> = { "En attente": "warn", Utilisable: "success", Refusée: "danger" };
const VERDICT_TONE = { Conforme: "success", "Hors limite": "danger", "Non évaluable": "neutral" } as const;

const str = (v: FormValues, key: string) => String(v[key] ?? "").trim();

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl bg-subtle px-4 py-6 text-center text-sm text-ink-500">{children}</p>;
}

function RowActions({ label, onEdit, onRemove }: { label: string; onEdit?: () => void; onRemove?: () => void }) {
  return (
    <span className="flex shrink-0">
      {onEdit && (
        <IconButton label={`Modifier ${label}`} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconButton>
      )}
      {onRemove && (
        <IconButton label={`Retirer ${label}`} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      )}
    </span>
  );
}

export function QualityView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [tab, setTab] = useState<Tab>("methodes");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

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
  // Always available: the origin of the limit is asked on the spot when it is missing.
  const approve = (spec: QSpec) => (spec.origin.trim() ? qualityActions.approveSpec(code, spec.id) : setDialog({ kind: "approve", item: spec }));
  const q = qualityOf(project);
  const summary = qualitySummary(project);
  const prerequisites = pilotPrerequisites(project);
  const ready = prerequisites.every((x) => x.ok);
  const specOf = (id: string) => q.specs.find((s) => s.id === id);
  const g3 = Boolean(project.formulation?.decision);
  const add = (kind: "method" | "spec" | "impurity" | "material") => (
    <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ kind })}>
      Ajouter
    </Button>
  );

  const METHOD_FIELDS: FormField[] = [
    { key: "name", label: "Méthode", required: true, placeholder: "Ex. Dosage par CLHP" },
    { key: "kind", label: "Nature", type: "select", options: METHOD_KINDS, required: true, hint: "Une méthode référencée n'est pas utilisable sans évaluation." },
    { key: "reference", label: "Référence", placeholder: "Pharmacopée, monographie, document interne" },
    { key: "status", label: "État", type: "select", options: METHOD_STATUSES, required: true },
    { key: "needs", label: "Réactifs, colonnes, substances de référence, instruments, compétences", type: "textarea", wide: true },
  ];
  const SPEC_FIELDS: FormField[] = [
    { key: "test", label: "Essai", required: true, placeholder: "Ex. Dosage" },
    { key: "method", label: "Méthode / version", placeholder: "Ex. M-01 v1" },
    { key: "min", label: "Limite basse", placeholder: "Vide si non applicable" },
    { key: "max", label: "Limite haute", placeholder: "Vide si non applicable" },
    { key: "unit", label: "Unité" },
    { key: "origin", label: "Origine de la limite", placeholder: "Pharmacopée, princeps, données de développement", hint: "Requise pour approuver. Une limite manquante n'est jamais inventée." },
  ];
  const IMPURITY_FIELDS: FormField[] = [
    { key: "name", label: "Impureté", required: true, wide: true },
    { key: "reported", label: "Rapportée dans les sources", type: "checkbox" },
    { key: "searched", label: "Recherchée au laboratoire", type: "checkbox" },
    { key: "observed", label: "Effectivement observée (valeur mesurée)", placeholder: "Vide si non observée", wide: true, hint: "Une liste attendue ne remplace pas une mesure." },
  ];
  const MATERIAL_FIELDS: FormField[] = [
    { key: "name", label: "Matière première", required: true },
    { key: "supplierLot", label: "Lot fournisseur" },
    { key: "coa", label: "Certificat d'analyse reçu", type: "checkbox" },
    { key: "sds", label: "Fiche de données de sécurité reçue", type: "checkbox" },
    { key: "control", label: "Prélèvement et contrôle", type: "select", options: MATERIAL_CONTROLS, required: true },
    { key: "decision", label: "Décision d'utilisation", type: "select", options: MATERIAL_DECISIONS, required: true, hint: "« Utilisable » exige des résultats de contrôle revus : un certificat reçu ne vaut pas libération." },
  ];
  const CONTROL_FIELDS: FormField[] = [
    { key: "specId", label: "Spécification", type: "select", options: q.specs.map((s) => s.test), required: true },
    { key: "lot", label: "Lot", required: true },
    { key: "sample", label: "Échantillon", placeholder: "Ex. T0, microbiologie" },
    { key: "value", label: "Résultat", required: true },
    { key: "date", label: "Date", type: "date" },
  ];

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Qualite_lot-pilote_${code}`} sheets={() => qualityWorkbook(project)} />} />

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">Analytique, qualité &amp; lot pilote</h2>
            <p className="mt-1 text-[15px] text-ink-600">Méthode utilisable ? Matière et lot utilisables ? Résultat acceptable ou investigation nécessaire ? Les responsables tranchent.</p>
          </div>
          <Button
            variant="outline"
            icon={<Sparkles className="h-4 w-4" />}
            disabled={!g3}
            onClick={() => {
              qualityActions.seed(code);
              toast.show({ title: "Listes initialisées", description: "Matières de la formule retenue et essais des critères cibles repris — les limites restent à définir." });
            }}
          >
            Reprendre la formule retenue
          </Button>
        </div>
        {!g3 && (
          <p className="mt-4 flex gap-2.5 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-[15px] text-ink-800">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn-600" aria-hidden />
            Aucune formule n&apos;est retenue (G3). Le développement analytique peut avancer en parallèle, mais le lot pilote ne pourra pas être autorisé.
          </p>
        )}
        <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ["Méthodes utilisables", `${summary.methods.done} / ${summary.methods.total}`],
              ["Spécifications approuvées", `${summary.specs.done} / ${summary.specs.total}`],
              ["Matières utilisables", `${summary.materials.done} / ${summary.materials.total}`],
              ["Lot pilote", summary.pilot],
              ["Résultats de contrôle", String(summary.controls)],
              ["Investigations ouvertes", String(summary.investigations)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-subtle px-4 py-3">
              <dt className="text-[13px] text-ink-500">{label}</dt>
              <dd className={cn("text-lg font-bold", label === "Investigations ouvertes" && summary.investigations ? "text-danger-700" : "text-ink-900")}>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mt-6 p-6">
        <Tabs<Tab>
          size="sm"
          value={tab}
          onChange={setTab}
          items={[
            { value: "methodes", label: "Méthodes analytiques", count: q.methods.length },
            { value: "specs", label: "Spécifications & impuretés", count: q.specs.length + q.impurities.length },
            { value: "matieres", label: "Matières premières", count: q.materials.length },
            { value: "pilote", label: "Lot pilote" },
            { value: "controles", label: "Contrôles", count: q.controls.length },
          ]}
        />

        {tab === "methodes" && (
          <div className="mt-5">
            <SectionTitle icon={Microscope} title="Méthodes analytiques" subtitle="Méthode référencée, adaptation ou nouvelle méthode — avec ce qu'il faut pour l'appliquer." aside={add("method")} />
            {q.methods.length === 0 ? (
              <Empty>Aucune méthode. Identifiez les méthodes documentées et leur applicabilité.</Empty>
            ) : (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {q.methods.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="text-[15px] font-semibold text-ink-900">{m.name}</p>
                      <p className="text-[13px] text-ink-500">
                        {m.kind}
                        {m.reference && ` · ${m.reference}`}
                      </p>
                      {m.needs && <p className="mt-0.5 text-[13px] text-ink-600">Besoins : {m.needs}</p>}
                    </div>
                    <Badge tone={METHOD_TONE[m.status]} dot>
                      {m.status}
                    </Badge>
                    <RowActions label={m.name} onEdit={() => setDialog({ kind: "method", item: m })} onRemove={() => qualityActions.removeMethod(code, m.id)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "specs" && (
          <div className="mt-5 space-y-8">
            <div>
              <SectionTitle icon={ClipboardList} title="Spécifications" subtitle="Essai, méthode, limite et son origine. Les résultats ne sont comparés qu'aux spécifications approuvées." aside={add("spec")} />
              {q.specs.length === 0 ? (
                <Empty>Aucune spécification.</Empty>
              ) : (
                <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                  {q.specs.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1 basis-64">
                        <p className="text-[15px] font-semibold text-ink-900">{s.test}</p>
                        <p className="text-[13px] text-ink-500">
                          {s.method || "Méthode à préciser"} · origine : {s.origin || "non renseignée"}
                        </p>
                      </div>
                      <span className={cn("text-[15px] font-semibold", s.min || s.max ? "text-ink-900" : "text-ink-400")}>{specLimit(s)}</span>
                      <Badge tone={s.approved ? "success" : "neutral"} dot>
                        {s.approved ? "Approuvée" : "Brouillon"}
                      </Badge>
                      {!s.approved && (
                        <Button size="sm" variant="outline" icon={<Check className="h-4 w-4" />} onClick={() => approve(s)}>
                          Approuver
                        </Button>
                      )}
                      <RowActions label={s.test} onEdit={() => setDialog({ kind: "spec", item: s })} onRemove={q.controls.some((c) => c.specId === s.id) ? undefined : () => qualityActions.removeSpec(code, s.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <SectionTitle icon={FlaskConical} title="Impuretés" subtitle="Trois colonnes distinctes : rapportée dans les sources, recherchée au laboratoire, effectivement observée." aside={add("impurity")} />
              {q.impurities.length === 0 ? (
                <Empty>Aucune impureté enregistrée.</Empty>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-subtle text-left text-[13px] text-ink-600">
                        <th className="px-4 py-2.5 font-semibold">Impureté</th>
                        <th className="px-4 py-2.5 font-semibold">Rapportée</th>
                        <th className="px-4 py-2.5 font-semibold">Recherchée</th>
                        <th className="px-4 py-2.5 font-semibold">Observée</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {q.impurities.map((i) => (
                        <tr key={i.id}>
                          <td className="px-4 py-2.5 font-semibold text-ink-900">{i.name}</td>
                          <td className="px-4 py-2.5">{i.reported ? "Oui" : "Non"}</td>
                          <td className="px-4 py-2.5">{i.searched ? "Oui" : "Non"}</td>
                          <td className={cn("px-4 py-2.5", i.observed ? "font-semibold text-ink-900" : "text-ink-400")}>{i.observed || "Non observée"}</td>
                          <td className="px-2">
                            <RowActions label={i.name} onEdit={() => setDialog({ kind: "impurity", item: i })} onRemove={() => qualityActions.removeImpurity(code, i.id)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "matieres" && (
          <div className="mt-5">
            <SectionTitle icon={Package} title="Matières premières" subtitle="Réception documentaire → lot fournisseur → certificat et FDS → prélèvement et contrôle → décision d'utilisation." aside={add("material")} />
            {q.materials.length === 0 ? (
              <Empty>Aucune matière. Reprenez la formule retenue ou ajoutez les matières une à une.</Empty>
            ) : (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {q.materials.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-[15px] font-semibold text-ink-900">{m.name}</p>
                      <p className="text-[13px] text-ink-500">Lot fournisseur : {m.supplierLot || "non identifié"}</p>
                    </div>
                    <Badge tone={m.coa ? "success" : "neutral"}>{m.coa ? "CoA reçu" : "CoA attendu"}</Badge>
                    <Badge tone={m.sds ? "success" : "neutral"}>{m.sds ? "FDS reçue" : "FDS attendue"}</Badge>
                    <Badge tone={m.control === "Résultats revus" ? "success" : m.control === "En contrôle" ? "warn" : "neutral"}>{m.control}</Badge>
                    <Badge tone={DECISION_TONE[m.decision]} dot size="md">
                      {m.decision}
                    </Badge>
                    <RowActions label={m.name} onEdit={() => setDialog({ kind: "material", item: m })} onRemove={() => qualityActions.removeMaterial(code, m.id)} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[13px] text-ink-500">Un certificat reçu ne vaut pas décision de libération : la décision d&apos;utilisation est prise selon les procédures de l&apos;entreprise, après revue des résultats.</p>
          </div>
        )}

        {tab === "pilote" && (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <SectionTitle icon={Factory} title="Prérequis du lancement" subtitle="La plateforme montre exactement ce qu'il manque." />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Numéro du lot pilote" htmlFor="pilot-lot">
                  <Input id="pilot-lot" value={q.pilot.lot} disabled={q.pilot.status !== "À préparer"} onChange={(e) => qualityActions.setPilot(code, { lot: e.target.value })} placeholder="Ex. LP-001" />
                </Field>
                <div className="space-y-2 pt-1">
                  <Checkbox checked={q.pilot.batchRecord} disabled={q.pilot.status !== "À préparer"} onChange={(v) => qualityActions.setPilot(code, { batchRecord: v })} label="Dossier de lot préparé" />
                  <Checkbox checked={q.pilot.equipmentChecked} disabled={q.pilot.status !== "À préparer"} onChange={(v) => qualityActions.setPilot(code, { equipmentChecked: v })} label="Équipements vérifiés" />
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {prerequisites.map((x) => (
                  <li key={x.key} className="flex items-start gap-2.5">
                    {x.ok ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 fill-danger-500 text-white" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">{x.label}</p>
                      <p className={cn("text-[13px]", x.ok ? "text-ink-500" : "text-danger-700")}>{x.detail}</p>
                    </div>
                    {!x.ok && x.key === "matieres" && (
                      <Button variant="outline" size="sm" onClick={() => setTab("matieres")}>
                        Compléter
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionTitle icon={Factory} title="Déroulement" subtitle="Autorisation interne → fabrication et conditionnement → résultats et écarts → revue du lot." aside={<Badge tone={q.pilot.status === "Revu" ? "success" : q.pilot.status === "À préparer" ? "neutral" : "info"} size="md">{q.pilot.status}</Badge>} />
              {q.pilot.authorizedAt && (
                <p className="mt-4 rounded-xl bg-success-50 px-4 py-3 text-sm text-ink-800">
                  Lancement autorisé par {q.pilot.authorizedBy} — {formatDateTime(q.pilot.authorizedAt)}
                </p>
              )}
              <Field label="Résultats et écarts observés" optional htmlFor="pilot-dev" className="mt-4">
                <Textarea id="pilot-dev" value={q.pilot.deviations} disabled={q.pilot.status === "À préparer" || q.pilot.status === "Revu"} onChange={(e) => qualityActions.setPilot(code, { deviations: e.target.value })} maxLength={400} placeholder="Écarts de fabrication, rendement, observations" />
              </Field>
              <div className="mt-4">
                {q.pilot.status === "À préparer" && (
                  <>
                    <Button size="lg" className="w-full" disabled={!ready} onClick={() => qualityActions.authorizePilot(code)}>
                      Autoriser le lancement du lot pilote
                    </Button>
                    {!ready && <p className="mt-2 text-center text-[13px] text-ink-500">L&apos;autorisation s&apos;ouvre quand tous les prérequis sont satisfaits.</p>}
                  </>
                )}
                {q.pilot.status === "Autorisé" && (
                  <Button size="lg" className="w-full" onClick={() => qualityActions.advancePilot(code)}>
                    Déclarer la fabrication et le conditionnement terminés
                  </Button>
                )}
                {q.pilot.status === "Fabriqué" && (
                  <Button size="lg" className="w-full" onClick={() => qualityActions.advancePilot(code)}>
                    Enregistrer la revue du lot
                  </Button>
                )}
                {q.pilot.status === "Revu" && q.pilot.reviewedAt && <p className="rounded-xl bg-success-50 px-4 py-3 text-sm text-ink-800">Lot revu le {formatDateTime(q.pilot.reviewedAt)}. Ses contrôles et sa stabilité alimentent la confirmation (G4).</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "controles" && (
          <div className="mt-5">
            <SectionTitle
              icon={ClipboardList}
              title="Contrôles T0, microbiologie et comparabilité"
              subtitle="Chaque résultat est lié au lot, à l'échantillon, à la méthode et à la spécification approuvée."
              aside={
                <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} disabled={!q.specs.length} onClick={() => setDialog({ kind: "control" })}>
                  Saisir un résultat
                </Button>
              }
            />
            {q.controls.length === 0 ? (
              <Empty>{q.specs.length ? "Aucun résultat saisi." : "Créez d'abord les spécifications."}</Empty>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {q.controls.map((c) => {
                  const spec = specOf(c.specId);
                  const { verdict, reason } = checkResult(spec, c.value);
                  const open = c.investigation && !c.investigation.closedAt;
                  return (
                    <li key={c.id} className={cn("rounded-xl border p-3.5", open ? "border-danger-200 bg-danger-50/40" : "border-line")}>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1 basis-64">
                          <p className="text-[15px] font-semibold text-ink-900">
                            {spec?.test ?? "Spécification supprimée"} : {c.value} {spec?.unit}
                          </p>
                          <p className="text-[13px] text-ink-500">
                            Lot {c.lot}
                            {c.sample && ` · échantillon ${c.sample}`}
                            {c.date && ` · ${formatNumeric(c.date)}`} · {spec?.method || "méthode à préciser"}
                          </p>
                          <p className="text-[13px] text-ink-600">{reason}</p>
                        </div>
                        <Badge tone={VERDICT_TONE[verdict]} dot size="md">
                          {verdict}
                        </Badge>
                        {spec && !spec.approved && (
                          <Button size="sm" variant="outline" icon={<Check className="h-4 w-4" />} onClick={() => approve(spec)}>
                            Approuver la spécification
                          </Button>
                        )}
                      </div>
                      {open && (
                        <div className="mt-3 border-t border-danger-200 pt-3">
                          <p className="flex items-center gap-2 text-sm font-semibold text-danger-700">
                            <TriangleAlert className="h-4 w-4" aria-hidden />
                            Résultat hors limite à investiguer — le résultat initial est conservé, aucune répétition automatique.
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Input aria-label="Conclusion de l'investigation" className="min-w-64 flex-1" placeholder="Conclusion de l'investigation" value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                            <Button size="sm" disabled={!notes[c.id]?.trim()} onClick={() => qualityActions.closeInvestigation(code, c.id, notes[c.id])}>
                              Clôturer l&apos;investigation
                            </Button>
                          </div>
                        </div>
                      )}
                      {c.investigation?.closedAt && (
                        <p className="mt-2 text-[13px] text-ink-600">
                          Investigation clôturée le {formatDateTime(c.investigation.closedAt)} : {c.investigation.note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Card>

      {dialog?.kind === "method" && (
        <FormModal
          title={dialog.item ? "Modifier la méthode" : "Ajouter une méthode"}
          fields={METHOD_FIELDS}
          initial={dialog.item as unknown as FormValues}
          onClose={() => setDialog(null)}
          onSubmit={(v) => qualityActions.saveMethod(code, { id: dialog.item?.id, name: str(v, "name"), kind: str(v, "kind") as QMethod["kind"], reference: str(v, "reference"), needs: str(v, "needs"), status: str(v, "status") as QMethod["status"] })}
        />
      )}
      {dialog?.kind === "approve" && (
        <FormModal
          title={`Approuver la spécification — ${dialog.item.test}`}
          subtitle={`Limite : ${specLimit(dialog.item)}. L'origine de la limite est demandée une fois, au moment d'approuver.`}
          fields={[{ key: "origin", label: "Origine de la limite", required: true, wide: true, placeholder: "Pharmacopée, princeps, données de développement…" }]}
          submitLabel="Approuver"
          onClose={() => setDialog(null)}
          onSubmit={(v) => qualityActions.approveSpec(code, dialog.item.id, str(v, "origin"))}
        />
      )}
      {dialog?.kind === "spec" && (
        <FormModal
          title={dialog.item ? "Modifier la spécification" : "Ajouter une spécification"}
          subtitle={dialog.item?.approved ? "Une modification retire l'approbation : la spécification devra être approuvée à nouveau." : undefined}
          fields={SPEC_FIELDS}
          initial={dialog.item as unknown as FormValues}
          onClose={() => setDialog(null)}
          onSubmit={(v) => qualityActions.saveSpec(code, { id: dialog.item?.id, test: str(v, "test"), method: str(v, "method"), min: str(v, "min"), max: str(v, "max"), unit: str(v, "unit"), origin: str(v, "origin") })}
        />
      )}
      {dialog?.kind === "impurity" && (
        <FormModal
          title={dialog.item ? "Modifier l'impureté" : "Ajouter une impureté"}
          fields={IMPURITY_FIELDS}
          initial={dialog.item as unknown as FormValues}
          onClose={() => setDialog(null)}
          onSubmit={(v) => qualityActions.saveImpurity(code, { id: dialog.item?.id, name: str(v, "name"), reported: Boolean(v.reported), searched: Boolean(v.searched), observed: str(v, "observed") })}
        />
      )}
      {dialog?.kind === "material" && (
        <FormModal
          title={dialog.item ? "Modifier la matière première" : "Ajouter une matière première"}
          fields={MATERIAL_FIELDS}
          initial={dialog.item as unknown as FormValues}
          onClose={() => setDialog(null)}
          onSubmit={(v) => {
            const decision = str(v, "decision") as QMaterial["decision"];
            const control = str(v, "control") as QMaterial["control"];
            if (decision === "Utilisable" && control !== "Résultats revus") toast.show({ tone: "warn", title: "Décision laissée en attente", description: "« Utilisable » exige des résultats de contrôle revus." });
            qualityActions.saveMaterial(code, { id: dialog.item?.id, name: str(v, "name"), supplierLot: str(v, "supplierLot"), coa: Boolean(v.coa), sds: Boolean(v.sds), control, decision });
          }}
        />
      )}
      {dialog?.kind === "control" && (
        <FormModal
          title="Saisir un résultat de contrôle"
          subtitle="Comparé à la spécification approuvée par une règle déterministe."
          fields={CONTROL_FIELDS}
          initial={{ lot: q.pilot.lot, sample: "T0" }}
          onClose={() => setDialog(null)}
          onSubmit={(v) => {
            const spec = q.specs.find((s) => s.test === str(v, "specId"));
            if (spec) qualityActions.addControl(code, { specId: spec.id, lot: str(v, "lot"), sample: str(v, "sample"), value: str(v, "value"), date: str(v, "date") });
          }}
        />
      )}
    </>
  );
}
