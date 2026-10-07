"use client";

import { CircleAlert, CircleCheck, CircleHelp, Download, FileText, Info, ListChecks, Pencil, Plus, RotateCcw, Scale, ShieldAlert, Trash2, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ExcelButton, SectionTitle } from "@/components/cadrage/cadrage-bits";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, Radio, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { COUNTRIES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import {
  CRITERION_TONE,
  FEASIBILITY_AXES,
  canLaunch,
  equipmentNeeds,
  feasibilityBlocks,
  feasibilityReport,
  feasibilityRows,
  feasibilityScore,
  matchEquipment,
  type Alert,
  type CriterionRow,
} from "@/lib/feasibility";
import { downloadText, formatDateTime, formatLong, plural } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { feasibilityWorkbook } from "@/lib/step-exports";
import { feasibilityActions, useDemo } from "@/lib/store";
import type { CriterionStatus, EquipmentNeed, FeasibilityChoice, Project, Tone } from "@/lib/types";

const STATUSES: { value: CriterionStatus; detail: string }[] = [
  { value: "Établi", detail: "Vérifié, avec sa preuve." },
  { value: "À compléter", detail: "Une information ou une preuve manque encore." },
  { value: "Bloquant", detail: "Empêche de lancer tant qu'il n'est pas levé." },
  { value: "Non évalué", detail: "Personne ne s'est encore prononcé." },
];

const CHOICES: { value: FeasibilityChoice; detail: string; tone: Tone }[] = [
  { value: "Lancer", detail: "Engager le développement : la fiche princeps et la stratégie s'ouvrent.", tone: "success" },
  { value: "Compléter", detail: "Créer uniquement les activités nécessaires pour lever les inconnues, puis redécider.", tone: "info" },
  { value: "Différer", detail: "Mettre le projet en attente, avec son motif.", tone: "warn" },
  { value: "Arrêter", detail: "Ne pas engager le projet. L'historique et les preuves sont conservés.", tone: "danger" },
];

const CHOICE_TONE = Object.fromEntries(CHOICES.map((c) => [c.value, c.tone])) as Record<FeasibilityChoice, Tone>;

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function CriterionModal({ project, row, onClose }: { project: Project; row: CriterionRow; onClose: () => void }) {
  const [status, setStatus] = useState<CriterionStatus>(row.status);
  const [note, setNote] = useState(row.note);
  const [proof, setProof] = useState(row.proof);
  const documents = project.cadrage?.documents.map((d) => d.name) ?? [];
  const proofOptions = [...new Set([...(row.proof ? [row.proof] : []), ...documents])];
  const needsNote = status === "À compléter" || status === "Bloquant";
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Évaluer le critère"
      subtitle={`${row.axis} — ${row.label}`}
      footer={
        <>
          {!row.prefilled && row.updatedAt && (
            <Button
              variant="ghost"
              icon={<RotateCcw className="h-4 w-4" />}
              className="mr-auto"
              onClick={() => {
                feasibilityActions.resetCriterion(project.code, row.key);
                onClose();
              }}
            >
              Revenir à la proposition du système
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={needsNote && !note.trim()}
            onClick={() => {
              feasibilityActions.evaluate(project.code, row.key, { status, note, proof });
              onClose();
            }}
          >
            Enregistrer l&apos;évaluation
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {row.prefilled && (
          <p className="flex gap-2.5 rounded-xl bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span>
              Proposition du système : <strong className="font-semibold">{row.status}</strong> — {row.note} Un fichier présent ne vaut pas contenu suffisant : c&apos;est votre évaluation
              qui fait foi.
            </span>
          </p>
        )}
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold text-ink-800">Évaluation</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {STATUSES.map((s) => (
              <div key={s.value} className={cn("rounded-xl border p-3.5", status === s.value ? "border-brand-400 bg-brand-50/50" : "border-line")}>
                <Radio name="statut" checked={status === s.value} onChange={() => setStatus(s.value)} label={s.value} description={s.detail} />
              </div>
            ))}
          </div>
        </fieldset>
        <Field label="Motif" required={needsNote} optional={!needsNote} htmlFor="crit-note" hint="Ce qui est établi, ce qui manque ou ce qui bloque — en une phrase.">
          <Textarea id="crit-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        <Field label="Preuve" optional htmlFor="crit-proof" hint="Document du projet sur lequel repose l'évaluation.">
          <Select id="crit-proof" placeholder="Aucune preuve rattachée" options={proofOptions} value={proof} onChange={(e) => setProof(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function DecisionModal({ project, rows, onClose }: { project: Project; rows: CriterionRow[]; onClose: () => void }) {
  const launchable = canLaunch(rows);
  const score = feasibilityScore(rows);
  const [choice, setChoice] = useState<FeasibilityChoice>(launchable && !score.criticalOpen ? "Lancer" : "Compléter");
  const [justification, setJustification] = useState("");
  const [hypotheses, setHypotheses] = useState("");
  const open = rows.filter((r) => r.status !== "Établi");
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Porte G1 — Décider de la faisabilité"
      subtitle="Lancer, compléter, différer ou arrêter ?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!justification.trim()}
            onClick={() => {
              feasibilityActions.decide(project.code, { choice, justification, hypotheses });
              toast.show({
                title: `Décision G1 : ${choice}`,
                description: choice === "Compléter" ? `${open.length} ${plural(open.length, "activité créée", "activités créées")} pour lever les inconnues.` : "Décision enregistrée avec son auteur, sa date et son motif.",
              });
              onClose();
            }}
          >
            Enregistrer la décision
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 rounded-xl border border-line bg-subtle p-4 sm:grid-cols-3">
          <div>
            <p className="text-[13px] text-ink-500">Score</p>
            <p className="text-xl font-bold text-ink-900">{score.value} %</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-500">Critères non établis</p>
            <p className="text-xl font-bold text-ink-900">{open.length}</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-500">Critiques ouverts</p>
            <p className={cn("text-xl font-bold", score.criticalOpen ? "text-danger-700" : "text-ink-900")}>{score.criticalOpen}</p>
          </div>
        </div>
        <fieldset className="space-y-2.5">
          <legend className="mb-2 text-[15px] font-semibold text-ink-800">Décision du comité</legend>
          {CHOICES.map((c) => {
            const disabled = c.value === "Lancer" && !launchable;
            return (
              <div key={c.value} className={cn("rounded-xl border p-3.5", choice === c.value ? "border-brand-400 bg-brand-50/50" : "border-line", disabled && "opacity-55")}>
                <Radio
                  name="decision"
                  checked={choice === c.value}
                  onChange={() => !disabled && setChoice(c.value)}
                  label={c.value}
                  description={disabled ? "Indisponible : un critère est déclaré bloquant. Levez-le ou requalifiez-le d'abord." : c.detail}
                />
              </div>
            );
          })}
        </fieldset>
        {choice === "Lancer" && score.criticalOpen > 0 && (
          <p className="flex gap-2.5 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-ink-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" aria-hidden />
            {score.criticalOpen} {plural(score.criticalOpen, "critère critique n'est pas établi", "critères critiques ne sont pas établis")}. Un bon score ne les compense pas : précisez dans le
            motif pourquoi le comité lance malgré tout.
          </p>
        )}
        <Field label="Motif de la décision" required htmlFor="g1-motif">
          <Textarea id="g1-motif" value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={400} />
        </Field>
        <Field label="Hypothèses retenues" optional htmlFor="g1-hyp" hint="Conservées dans le rapport de faisabilité avec les sources.">
          <Textarea id="g1-hyp" value={hypotheses} onChange={(e) => setHypotheses(e.target.value)} maxLength={400} placeholder="Ex. fournisseur de principe actif confirmé avant le lot pilote." />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

function AlertBlock({
  icon,
  tone,
  title,
  empty,
  alerts,
  code,
  tasks,
  onEvaluate,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  empty: string;
  alerts: Alert[];
  code: string;
  /** Criteria that already have an open activity. */
  tasks: Set<string>;
  onEvaluate: (key: string) => void;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} tone={alerts.length ? tone : "neutral"} />
        <h2 className="flex-1 text-lg font-bold text-ink-900">{title}</h2>
        <span className={cn("text-[28px] font-bold leading-none", alerts.length ? "text-ink-900" : "text-ink-300")}>{alerts.length}</span>
      </div>
      {alerts.length === 0 ? (
        <p className="mt-4 flex-1 rounded-xl bg-subtle px-4 py-5 text-sm text-ink-500">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {alerts.map((a) => (
            <li key={a.key} className="rounded-xl border border-line p-3.5">
              <p className="text-[15px] font-semibold leading-snug text-ink-900">
                {a.title}
                {a.critical && tone !== "success" && <span className="ml-2 align-middle text-xs font-semibold text-danger-700">critique</span>}
              </p>
              {a.detail && <p className="mt-0.5 text-[13px] leading-snug text-ink-600">{a.detail}</p>}
              <dl className="mt-2 space-y-0.5 text-[13px] leading-snug">
                <div className="flex gap-1.5">
                  <dt className="shrink-0 text-ink-500">Preuve :</dt>
                  <dd className={a.proof ? "text-ink-800" : "text-ink-400"}>{a.proof || "aucune rattachée"}</dd>
                </div>
                {tone !== "success" && (
                  <div className="flex gap-1.5">
                    <dt className="shrink-0 text-ink-500">Action proposée :</dt>
                    <dd className="text-ink-800">{a.action}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEvaluate(a.key)}>
                  Évaluer
                </Button>
                {tone !== "success" &&
                  (tasks.has(a.key) ? (
                    <Badge tone="info" icon={CircleCheck} size="md">
                      Activité créée
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        feasibilityActions.createTask(code, a.key);
                        toast.show({ title: "Activité créée", description: a.action, action: { label: "Voir mes activités", href: "/activites" } });
                      }}
                    >
                      Créer l&apos;activité
                    </Button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function FeasibilityView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [editing, setEditing] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [equipment, setEquipment] = useState({ name: "", use: "Analytique" as EquipmentNeed["use"] });
  const [patent, setPatent] = useState({ reference: "", territory: "", expiry: "", question: "" });

  if (!project) return null;
  if (!project.cadrage) {
    return (
      <>
        <ProjectTabs slug={project.slug} />
        <Card className="mt-6">
          <EmptyState icon={Info} title="Faisabilité indisponible pour ce projet" description="Ce projet a été créé avant le nouveau parcours d'aide à la décision : il n'a pas de fiche de cadrage sur laquelle appuyer la faisabilité." />
        </Card>
      </>
    );
  }

  const code = project.code;
  const rows = feasibilityRows(state, project);
  const score = feasibilityScore(rows);
  const blocks = feasibilityBlocks(rows);
  const needs = equipmentNeeds(project);
  const f = project.feasibility;
  const last = f?.decisions[0];
  const g0 = project.cadrage.g0.status === "Approuvée";
  const tasks = new Set(state.activities.filter((a) => a.projectCode === code && !a.done && a.cadrageTask?.startsWith("faisabilite-")).map((a) => a.cadrageTask!.replace("faisabilite-", "")));
  const editingRow = rows.find((r) => r.key === editing);
  const blockProps = { code, tasks, onEvaluate: setEditing };

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Faisabilite_${code}`} sheets={() => feasibilityWorkbook(state, project)} />} />

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-ink-900">Sélection &amp; faisabilité</h2>
              <Badge tone={last ? CHOICE_TONE[last.choice] : g0 ? "info" : "neutral"} size="md">
                {last ? `G1 — ${last.choice}` : g0 ? "G1 — décision attendue" : "G1 — après le cadrage"}
              </Badge>
            </div>
            <p className="mt-1 text-[15px] text-ink-600">Le projet mérite-t-il d&apos;être engagé avec nos capacités, nos délais et les informations disponibles ?</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button
              variant="outline"
              icon={<Download className="h-4 w-4" />}
              onClick={() => {
                downloadText(`Faisabilite_${code}.md`, feasibilityReport(state, project), "text/markdown");
                toast.show({ title: "Rapport de faisabilité téléchargé", description: "Évaluation, sources, hypothèses et décisions." });
              }}
            >
              Rapport de faisabilité
            </Button>
            <Button size="lg" icon={<Scale className="h-5 w-5" />} disabled={!g0} onClick={() => setDeciding(true)}>
              {last ? "Redécider (G1)" : "Décider (G1)"}
            </Button>
          </div>
        </div>

        {!g0 && (
          <p className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-[15px] text-ink-800">
            <CircleAlert className="h-5 w-5 shrink-0 text-warn-600" aria-hidden />
            <span className="flex-1">Vous pouvez préparer la faisabilité dès maintenant ; la décision G1 s&apos;ouvrira quand le cadrage (G0) sera validé.</span>
            <LinkButton href={`/projets/${project.slug}/cadrage`} variant="outline" size="sm">
              Ouvrir le cadrage
            </LinkButton>
          </p>
        )}

        <div className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <p className="text-[13px] font-semibold text-ink-600">Score de la grille</p>
            <p className="text-[40px] font-bold leading-none text-ink-900">{score.value} %</p>
            <p className="mt-1 text-[13px] text-ink-500">du poids des critères est établi</p>
          </div>
          <div className="min-w-0">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              {(
                [
                  ["Établis", score.established, "success"],
                  ["À compléter", score.toComplete, "warn"],
                  ["Non évalués", score.notEvaluated, "neutral"],
                  ["Bloquants", score.blocking, "danger"],
                ] as const
              ).map(([label, n, tone]) => (
                <li key={label} className="flex items-center gap-2">
                  <Badge tone={tone}>{n}</Badge>
                  <span className="text-ink-700">{label}</span>
                </li>
              ))}
            </ul>
            <p className={cn("mt-3 flex gap-2.5 rounded-xl px-4 py-3 text-sm", score.criticalOpen || score.blocking ? "bg-danger-50 text-ink-800" : "bg-success-50 text-ink-800")}>
              <ShieldAlert className={cn("mt-0.5 h-4 w-4 shrink-0", score.criticalOpen || score.blocking ? "text-danger-600" : "text-success-600")} aria-hidden />
              {score.criticalOpen || score.blocking
                ? `${score.criticalOpen} ${plural(score.criticalOpen, "critère critique n'est pas établi", "critères critiques ne sont pas établis")} : le score est affiché à part et ne compense jamais un prérequis bloquant.`
                : "Tous les critères critiques sont établis. Le score reste un indicateur : la décision appartient au comité."}
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <AlertBlock icon={CircleCheck} tone="success" title="Ce qui est établi" empty="Rien n'est encore établi." alerts={blocks.established} {...blockProps} />
        <AlertBlock icon={CircleHelp} tone="warn" title="Ce qui manque" empty="Aucune information manquante sur les critères non critiques." alerts={blocks.missing} {...blockProps} />
        <AlertBlock icon={TriangleAlert} tone="danger" title="Ce qui peut bloquer" empty="Aucun point bloquant identifié." alerts={blocks.blocking} {...blockProps} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="h-fit p-6">
          <SectionTitle
            icon={ListChecks}
            title="Évaluation détaillée"
            subtitle="Grille proposée : elle sera remplacée par les 27 critères pondérés de votre classeur, une fois chargés dans Configuration."
          />
          {FEASIBILITY_AXES.map((axis) => (
            <section key={axis} className="mt-5">
              <h3 className="text-[15px] font-bold text-ink-900">{axis}</h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {rows
                  .filter((r) => r.axis === axis)
                  .map((r) => (
                    <li key={r.key} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-1 basis-72">
                        <p className="text-[15px] font-semibold text-ink-900">
                          {r.label}
                          {r.critical && (
                            <span className="ml-1 text-danger-600" title="Critère critique" aria-label="Critère critique">
                              *
                            </span>
                          )}
                        </p>
                        <p className="text-[13px] leading-snug text-ink-600">{r.note || "Pas encore évalué."}</p>
                        {r.proof && <p className="mt-0.5 truncate text-[13px] text-ink-500">Preuve : {r.proof}</p>}
                      </div>
                      <span className="w-16 shrink-0 text-[13px] text-ink-500">Poids {r.weight}</span>
                      <div className="flex w-36 shrink-0 flex-col items-start gap-1">
                        <Badge tone={CRITERION_TONE[r.status]} dot>
                          {r.status}
                        </Badge>
                        <span className="text-xs text-ink-500">{r.prefilled ? "Prérempli par le système" : r.by ? `${r.by}` : ""}</span>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setEditing(r.key)}>
                        Évaluer
                      </Button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          <p className="mt-3 text-[13px] text-ink-500">* Critère critique : s&apos;il n&apos;est pas établi, il apparaît dans « Ce qui peut bloquer », quel que soit le score.</p>
        </Card>

        <aside className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Wrench} title="Équipements requis" subtitle="Comparés à l'inventaire réellement déclaré dans Configuration → Ressources." />
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {needs.map((n) => {
                const match = matchEquipment(n, state.resources);
                return (
                  <li key={n.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    {match ? <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden /> : <CircleAlert className="h-5 w-5 shrink-0 fill-warn-500 text-white" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">{n.name}</p>
                      <p className={cn("text-[13px]", match ? "text-ink-500" : "text-warn-700")}>
                        {n.use} · {match ? `déclaré : ${match.name}` : "non renseigné dans l'inventaire"}
                      </p>
                    </div>
                    <IconButton label={`Retirer ${n.name}`} onClick={() => feasibilityActions.removeEquipment(code, n.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_130px] gap-2">
              <Input aria-label="Équipement requis" placeholder="Ex. colonne C18, tamiseuse…" value={equipment.name} onChange={(e) => setEquipment({ ...equipment, name: e.target.value })} />
              <Select aria-label="Usage" options={["Analytique", "Fabrication"]} value={equipment.use} onChange={(e) => setEquipment({ ...equipment, use: e.target.value as EquipmentNeed["use"] })} />
            </div>
            <Button
              variant="outline"
              className="mt-2 w-full"
              icon={<Plus className="h-4 w-4" />}
              disabled={!equipment.name.trim()}
              onClick={() => {
                feasibilityActions.addEquipment(code, equipment.name, equipment.use);
                setEquipment({ ...equipment, name: "" });
              }}
            >
              Ajouter un besoin
            </Button>
            <p className="mt-2 text-[13px] text-ink-500">Un équipement absent de l&apos;inventaire n&apos;est pas forcément indisponible : la disponibilité est à confirmer auprès du laboratoire ou de la production.</p>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={FileText} title="Brevets à examiner" subtitle="Documents, territoires, dates et questions. Une recherche ne constitue pas une conclusion de liberté d'exploitation." />
            {f?.patents.length ? (
              <ul className="mt-4 space-y-2.5">
                {f.patents.map((x) => (
                  <li key={x.id} className="flex items-start gap-3 rounded-xl border border-line p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">{x.reference}</p>
                      <p className="text-[13px] text-ink-500">
                        {x.territory}
                        {x.expiry && ` · échéance ${formatLong(x.expiry)}`}
                      </p>
                      <p className="mt-1 text-sm text-ink-700">Question : {x.question || "à formuler"}</p>
                    </div>
                    <IconButton label={`Retirer ${x.reference}`} onClick={() => feasibilityActions.removePatent(code, x.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-subtle px-4 py-4 text-sm text-ink-500">Aucun document recensé.</p>
            )}
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label={<span className="text-sm">Référence du brevet</span>} htmlFor="pat-ref">
                  <Input id="pat-ref" placeholder="N° ou titre" value={patent.reference} onChange={(e) => setPatent({ ...patent, reference: e.target.value })} />
                </Field>
                <Field label={<span className="text-sm">Territoire</span>} htmlFor="pat-ter">
                  <Select id="pat-ter" placeholder="Sélectionner…" options={[...COUNTRIES, "Europe (OEB)", "International (PCT)"]} value={patent.territory} onChange={(e) => setPatent({ ...patent, territory: e.target.value })} />
                </Field>
              </div>
              <Field label={<span className="text-sm">Date d&apos;échéance</span>} optional htmlFor="pat-exp">
                <DateInput id="pat-exp" value={patent.expiry} onChange={(v) => setPatent({ ...patent, expiry: v })} onClear={() => setPatent({ ...patent, expiry: "" })} />
              </Field>
              <Field label={<span className="text-sm">Question à examiner</span>} htmlFor="pat-q">
                <Input id="pat-q" placeholder="Ex. la revendication couvre-t-elle la forme visée ?" value={patent.question} onChange={(e) => setPatent({ ...patent, question: e.target.value })} />
              </Field>
              <Button
                variant="outline"
                className="w-full"
                icon={<Plus className="h-4 w-4" />}
                disabled={!patent.reference.trim() || !patent.territory}
                onClick={() => {
                  feasibilityActions.addPatent(code, patent);
                  setPatent({ reference: "", territory: "", expiry: "", question: "" });
                }}
              >
                Recenser ce brevet
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={Scale} title="Décisions du comité" subtitle="Chaque décision garde son auteur, sa date, son motif et l'état de la grille." />
            {f?.decisions.length ? (
              <ol className="mt-4 space-y-3">
                {f.decisions.map((d, i) => (
                  <li key={d.decidedAt + i} className={cn("rounded-xl border p-3.5", i === 0 ? "border-brand-200 bg-brand-50/40" : "border-line")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={CHOICE_TONE[d.choice]} size="md">
                        {d.choice}
                      </Badge>
                      <span className="text-[13px] text-ink-500">
                        {d.decidedBy} — {formatDateTime(d.decidedAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-800">« {d.justification} »</p>
                    {d.hypotheses && <p className="mt-1 text-[13px] text-ink-600">Hypothèses retenues : {d.hypotheses}</p>}
                    <p className="mt-1 text-xs text-ink-500">
                      Score {d.score} % · {d.open} {plural(d.open, "critère non établi", "critères non établis")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-subtle px-4 py-4 text-sm text-ink-500">Aucune décision enregistrée. Décideur proposé : comité développement.</p>
            )}
          </Card>
        </aside>
      </div>

      {editingRow && <CriterionModal key={editingRow.key} project={project} row={editingRow} onClose={() => setEditing(null)} />}
      {deciding && <DecisionModal project={project} rows={rows} onClose={() => setDeciding(false)} />}
    </>
  );
}
