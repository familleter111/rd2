"use client";

import { CircleAlert, CircleCheck, FileText, FlaskConical, Info, Lightbulb, Pill, Scale, Sparkles, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { DatumList, DatumModal, DocStateBadge, ExcelButton, ProofDrawer, SectionTitle } from "@/components/cadrage/cadrage-bits";
import { AddDocumentModal } from "@/components/cadrage/cadrage-view";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { allData, docLabel, docState } from "@/lib/cadrage";
import { PEOPLE } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatDateTime, plural } from "@/lib/format";
import { useTeamNames } from "@/lib/people";
import { NATURES, NATURE_TONE, PRINCEPS_GROUPS, canValidate, groupOf, isEstablished, isGap, isToVerify, provisionalData, sheetStats, versionState } from "@/lib/princeps";
import { REFERENCE_SOURCE_LABEL } from "@/lib/reference-catalog";
import { findProject } from "@/lib/selectors";
import { princepsWorkbook } from "@/lib/step-exports";
import { cadrageActions, princepsActions, useDemo } from "@/lib/store";
import type { CadrageDatum, Project } from "@/lib/types";

type Tab = "confirmees" | "verifier" | "manques" | "sources";

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function TrialModal({ project, datum, people, onClose }: { project: Project; datum: CadrageDatum; people: string[]; onClose: () => void }) {
  const [title, setTitle] = useState(`Déterminer : ${datum.label.toLowerCase()}`);
  const [objective, setObjective] = useState("");
  const [owner, setOwner] = useState(project.team.find((m) => m.role === "Responsable analytique")?.person || project.owner);
  return (
    <Modal
      open
      onClose={onClose}
      title="Créer un essai pour lever l'inconnue"
      subtitle={datum.label}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!title.trim()}
            icon={<FlaskConical className="h-4 w-4" />}
            onClick={() => {
              princepsActions.addTrial(project.code, { datumKey: datum.key, title, objective, owner });
              toast.show({ title: "Essai créé", description: "Une activité a été ajoutée pour le réaliser.", action: { label: "Voir mes activités", href: "/activites" } });
              onClose();
            }}
          >
            Créer l&apos;essai
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Question expérimentale" required htmlFor="trial-title">
          <Input id="trial-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Ce que l'essai doit établir" optional htmlFor="trial-objective" hint="Méthode envisagée, lot du princeps, critère qui permettra de conclure.">
          <Textarea id="trial-objective" value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={300} />
        </Field>
        <Field label="Responsable" htmlFor="trial-owner">
          <Select id="trial-owner" options={people} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ValidateModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [strategy, setStrategy] = useState(project.princeps?.versions[0]?.strategy ?? "");
  const [note, setNote] = useState("");
  const provisional = provisionalData(project);
  const n = (project.princeps?.versions[0]?.n ?? 0) + 1;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Porte G2 — Valider la fiche princeps v${n}`}
      subtitle="Quelles formulations et quels essais explorer ?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!strategy.trim()}
            onClick={() => {
              princepsActions.validate(project.code, { strategy, note });
              toast.show({ title: `Fiche princeps v${n} validée`, description: provisional.length ? "Validation partielle : ce qui dépend des inconnues reste provisoire." : "Validation complète." });
              onClose();
            }}
          >
            Valider la version {provisional.length ? "(partielle)" : "(complète)"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {provisional.length > 0 ? (
          <div className="rounded-xl border border-warn-200 bg-warn-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-ink-900">
              <CircleAlert className="h-5 w-5 text-warn-600" aria-hidden />
              Validation partielle — {provisional.length} {plural(provisional.length, "caractéristique reste provisoire", "caractéristiques restent provisoires")}
            </p>
            <p className="mt-1 text-sm text-ink-700">{provisional.map((d) => d.label.toLowerCase()).join(", ")}.</p>
            <p className="mt-2 text-sm text-ink-700">Seules les analyses compatibles avec ces inconnues sont autorisées ; toute recommandation qui en dépend reste provisoire.</p>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-[15px] text-ink-800">
            <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
            Toutes les caractéristiques sont établies : la validation est complète.
          </p>
        )}
        <Field label="Stratégie initiale" required htmlFor="g2-strategy" hint="Les pistes de formulation et les essais à explorer en priorité, au vu de ce qui est établi et de ce qui reste inconnu.">
          <Textarea id="g2-strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)} maxLength={600} className="min-h-32" />
        </Field>
        <Field label="Commentaire" optional htmlFor="g2-note" hint="Décideurs proposés : galéniste + analytique + R&D (à confirmer selon votre organisation).">
          <Textarea id="g2-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PrincepsView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const people = [...new Set(useTeamNames([...PEOPLE, "Responsable affaires réglementaires"]))];
  const [tab, setTab] = useState<Tab>("verifier");
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; mode: "edit" | "resolve" } | null>(null);
  const [trialKey, setTrialKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"document" | "validate" | null>(null);

  if (!project) return null;
  const c = project.cadrage;
  if (!c) {
    return (
      <>
        <ProjectTabs slug={project.slug} />
        <Card className="mt-6">
          <EmptyState icon={Info} title="Fiche princeps indisponible pour ce projet" description="Ce projet a été créé avant le nouveau parcours d'aide à la décision : il n'a pas de données sourcées." />
        </Card>
      </>
    );
  }
  if (!project.princeps) {
    return (
      <>
        <ProjectTabs slug={project.slug} />
        <Card className="mt-6">
          <EmptyState icon={Pill} title="Fiche princeps à ouvrir" description="Ouvrez la fiche pour structurer les caractéristiques à reproduire ou maîtriser." action={<Button onClick={() => princepsActions.open(project.code)}>Ouvrir la fiche princeps</Button>} />
        </Card>
      </>
    );
  }

  const code = project.code;
  const data = allData(project);
  const stats = sheetStats(project);
  const version = versionState(project);
  const launched = project.feasibility?.decisions[0]?.choice === "Lancer";
  const validatable = canValidate(project);
  const value = (key: string) => data.find((d) => d.key === key)?.value ?? "";
  const lists: Record<Exclude<Tab, "sources">, CadrageDatum[]> = {
    confirmees: data.filter(isEstablished),
    verifier: data.filter(isToVerify),
    manques: data.filter(isGap),
  };
  const proof = data.find((d) => d.key === proofKey) ?? null;
  const editingDatum = editing && data.find((d) => d.key === editing.key);
  const trialDatum = data.find((d) => d.key === trialKey);
  const functions = data.find((d) => d.key === "excipientFunctions");
  const documents = c.documents.map(docLabel);
  const manual = data.filter((d) => d.value && !d.source);

  const handlers = {
    showNature: true,
    onProof: (d: CadrageDatum) => setProofKey(d.key),
    onConfirm: (d: CadrageDatum) => cadrageActions.confirm(code, [d.key]),
    onEdit: (d: CadrageDatum) => setEditing({ key: d.key, mode: "edit" }),
    onResolve: (d: CadrageDatum) => setEditing({ key: d.key, mode: "resolve" }),
    onTrial: (d: CadrageDatum) => setTrialKey(d.key),
  };

  const empty: Record<Exclude<Tab, "sources">, string> = {
    confirmees: "Aucune caractéristique établie pour l'instant.",
    verifier: "Rien à vérifier : ni valeur lue en attente, ni hypothèse.",
    manques: "Aucun manque ni contradiction.",
  };

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Fiche_princeps_${code}`} sheets={() => princepsWorkbook(project)} />} />

      {/* Résumé du produit */}
      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-ink-900">Compréhension du princeps</h2>
              <Badge tone={version.tone} size="md">
                {version.label}
              </Badge>
            </div>
            <p className="mt-1 text-[15px] text-ink-600">Quelles caractéristiques devons-nous reproduire ou maîtriser, et lesquelles restent inconnues ?</p>
            <p className="mt-3 text-[17px] font-bold text-ink-900">
              {value("name")} {value("dosage")} <span className="font-normal text-ink-600">— {value("form").toLowerCase()}, {value("dci")}</span>
            </p>
            <p className="text-sm text-ink-600">
              {value("holder")} · {value("country")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 lg:items-end">
            <Button size="lg" icon={<Scale className="h-5 w-5" />} disabled={!validatable} onClick={() => setDialog("validate")}>
              Valider une version (G2)
            </Button>
            {!validatable && (
              <p className="max-w-[300px] text-right text-[13px] text-ink-500">
                {stats.conflicting ? "Résolvez d'abord les contradictions." : launched ? "" : "La validation s'ouvre quand le comité a lancé le projet (G1). Vous pouvez déjà compléter la fiche."}
              </p>
            )}
          </div>
        </div>
        <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-4">
          {(
            [
              ["Données confirmées", stats.established, "text-success-700"],
              ["À vérifier", stats.toVerify, "text-warn-700"],
              ["Non documentées", stats.missing, "text-ink-600"],
              ["Contradictions", stats.conflicting, stats.conflicting ? "text-danger-700" : "text-ink-600"],
            ] as const
          ).map(([label, n, tone]) => (
            <div key={label} className="rounded-xl bg-subtle px-4 py-3">
              <dt className="text-[13px] text-ink-500">{label}</dt>
              <dd className={cn("text-[28px] font-bold leading-tight", tone)}>
                {n} <span className="text-sm font-medium text-ink-400">/ {stats.total}</span>
              </dd>
            </div>
          ))}
        </dl>
        {!launched && (
          <p className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
            <Info className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span className="flex-1">La compréhension du princeps commence dès les premiers documents et s&apos;enrichit pendant la faisabilité.</span>
            <LinkButton href={`/projets/${project.slug}/faisabilite`} variant="outline" size="sm">
              Ouvrir la faisabilité
            </LinkButton>
          </p>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="h-fit min-w-0 p-6">
          <Tabs<Tab>
            size="sm"
            value={tab}
            onChange={setTab}
            items={[
              { value: "confirmees", label: "Données confirmées", count: lists.confirmees.length },
              { value: "verifier", label: "À vérifier", count: lists.verifier.length },
              { value: "manques", label: "Manques et contradictions", count: lists.manques.length },
              { value: "sources", label: "Sources", count: c.documents.length },
            ]}
          />

          {tab !== "sources" &&
            (lists[tab].length === 0 ? (
              <p className="mt-5 rounded-xl bg-subtle px-4 py-6 text-center text-[15px] text-ink-500">{empty[tab]}</p>
            ) : (
              PRINCEPS_GROUPS.map((group) => {
                const items = lists[tab].filter((d) => groupOf(d) === group);
                if (!items.length) return null;
                return (
                  <section key={group} className="mt-5">
                    <h3 className="text-[15px] font-bold text-ink-900">{group}</h3>
                    <DatumList className="mt-2" data={items} {...handlers} />
                  </section>
                );
              })
            ))}
          {tab === "manques" && lists.manques.length > 0 && (
            <p className="mt-4 text-[13px] text-ink-500">Une caractéristique absente des sources reste inconnue jusqu&apos;à obtention d&apos;une preuve : renseignez-la avec sa source, ou créez un essai pour la lever.</p>
          )}

          {tab === "sources" && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-600">Les documents dont une partie seulement est accessible ne sont jamais présentés comme intégralement analysés.</p>
                <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setDialog("document")}>
                  Ajouter un document
                </Button>
              </div>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {c.documents.map((d) => {
                  const n = data.filter((x) => x.source?.document === docLabel(d) || x.alternatives?.some((a) => a.source.document === docLabel(d))).length;
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <FileText className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.7} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-ink-900">
                          {d.name} <span className="font-normal text-ink-500">· v{d.version}</span>
                        </p>
                        <p className="text-[13px] text-ink-500">
                          {d.type} · reçu le {formatDateTime(d.receivedAt)}
                        </p>
                      </div>
                      <span className="text-sm text-ink-600">
                        {n} {plural(n, "valeur rattachée", "valeurs rattachées")}
                      </span>
                      <DocStateBadge state={docState(d, data)} />
                    </li>
                  );
                })}
                {data.some((d) => d.source?.document === REFERENCE_SOURCE_LABEL) && (
                  <li className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <FileText className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.7} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">{REFERENCE_SOURCE_LABEL}</p>
                      <p className="text-[13px] text-ink-500">Source connectée — preuve plus faible qu&apos;un document du princeps</p>
                    </div>
                    <span className="text-sm text-ink-600">{data.filter((d) => d.source?.document === REFERENCE_SOURCE_LABEL).length} valeurs</span>
                  </li>
                )}
                {manual.length > 0 && (
                  <li className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Lightbulb className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.7} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">Sans document rattaché</p>
                      <p className="text-[13px] text-ink-500">Saisies manuelles et hypothèses : {manual.map((d) => d.label.toLowerCase()).join(", ")}</p>
                    </div>
                    <span className="text-sm text-ink-600">
                      {manual.length} {plural(manual.length, "valeur")}
                    </span>
                  </li>
                )}
                {!c.documents.length && !manual.length && !data.some((d) => d.source) && <li className="px-4 py-5 text-center text-[15px] text-ink-500">Aucune source pour l&apos;instant.</li>}
              </ul>
            </div>
          )}
        </Card>

        <aside className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Sparkles} title="Propositions du système" subtitle="Toujours distinguées des faits : une proposition acceptée devient une hypothèse." />
            <div className="mt-4 rounded-xl border border-line p-3.5">
              <p className="text-[15px] font-semibold text-ink-900">Fonctions possibles des excipients</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-600">
                À partir des excipients déclarés. La notice ne donne ni leurs proportions ni leur rôle réel : ces informations restent inconnues jusqu&apos;à obtention de preuves.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                icon={<Sparkles className="h-4 w-4" />}
                disabled={!value("excipients") || Boolean(functions?.value)}
                onClick={() => {
                  princepsActions.proposeFunctions(code);
                  setTab("verifier");
                  toast.show({ title: "Proposition ajoutée", description: "À accepter comme hypothèse ou à remplacer, dans l'onglet « À vérifier »." });
                }}
              >
                {functions?.value ? "Proposition déjà faite" : value("excipients") ? "Proposer les fonctions" : "Excipients non documentés"}
              </Button>
            </div>
            <p className="mt-3 text-[13px] text-ink-500">Dans cette version, la proposition provient d&apos;un dictionnaire des fonctions usuelles, pas d&apos;un modèle d&apos;IA connecté.</p>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={FlaskConical} title={`Questions expérimentales (${project.princeps.trials.length})`} subtitle="Les essais demandés pour lever une inconnue." />
            {project.princeps.trials.length ? (
              <ul className="mt-4 space-y-2.5">
                {project.princeps.trials.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 rounded-xl border border-line p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">{t.title}</p>
                      <p className="text-[13px] text-ink-500">
                        Lève : {data.find((d) => d.key === t.datumKey)?.label.toLowerCase()} · {t.owner}
                      </p>
                      {t.objective && <p className="mt-1 text-sm text-ink-700">{t.objective}</p>}
                    </div>
                    <IconButton label={`Retirer l'essai ${t.title}`} onClick={() => princepsActions.removeTrial(code, t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-subtle px-4 py-4 text-sm text-ink-500">Aucun essai demandé. Utilisez « Créer un essai » sur une caractéristique inconnue ou supposée.</p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle icon={Scale} title="Versions validées" subtitle="Porte G2 — fiche princeps et stratégie initiale." />
            {project.princeps.versions.length ? (
              <ol className="mt-4 space-y-3">
                {project.princeps.versions.map((v, i) => (
                  <li key={v.n} className={cn("rounded-xl border p-3.5", i === 0 ? "border-brand-200 bg-brand-50/40" : "border-line")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={i === 0 && version.stale ? "warn" : v.scope === "Complète" ? "success" : "info"} size="md">
                        v{v.n} — {v.scope.toLowerCase()}
                      </Badge>
                      <span className="text-[13px] text-ink-500">
                        {v.by} — {formatDateTime(v.at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-800">Stratégie : {v.strategy}</p>
                    {v.provisional.length > 0 && <p className="mt-1 text-[13px] text-ink-600">Restaient provisoires : {v.provisional.map((x) => x.toLowerCase()).join(", ")}.</p>}
                    {i === 0 && version.stale && <p className="mt-1.5 text-[13px] font-semibold text-warn-700">La fiche a changé depuis : cette version est à réévaluer. Elle reste consultable telle quelle.</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-subtle px-4 py-4 text-sm text-ink-500">Aucune version validée.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Quatre natures, jamais confondues</h2>
            <ul className="mt-3 space-y-2.5">
              {NATURES.map((n) => (
                <li key={n.value} className="flex items-start gap-3">
                  <Badge tone={NATURE_TONE[n.value]} className="mt-0.5 w-[150px] justify-center">
                    {n.value === "Proposition IA" ? "Proposition du système" : n.value}
                  </Badge>
                  <p className="min-w-0 text-[13px] leading-snug text-ink-600">{n.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <ProofDrawer datum={proof} context={`${project.code} • ${project.name}`} onClose={() => setProofKey(null)} />
      {editing && editingDatum && (
        <DatumModal
          key={`${editing.key}-${editing.mode}`}
          datum={editingDatum}
          mode={editing.mode}
          natureInput={{ documents }}
          onClose={() => setEditing(null)}
          onSubmit={(v, note, extra) => {
            if (editing.mode === "resolve") cadrageActions.resolve(code, editing.key, v, note);
            else cadrageActions.correct(code, editing.key, v, note, extra);
            setEditing(null);
          }}
        />
      )}
      {trialDatum && <TrialModal key={trialDatum.key} project={project} datum={trialDatum} people={people} onClose={() => setTrialKey(null)} />}
      {dialog === "document" && <AddDocumentModal code={code} onClose={() => setDialog(null)} />}
      {dialog === "validate" && <ValidateModal project={project} onClose={() => setDialog(null)} />}
    </>
  );
}
