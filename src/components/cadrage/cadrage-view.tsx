"use client";

import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FileSearch,
  FileText,
  FlaskConical,
  Globe,
  Info,
  Map as MapIcon,
  Pencil,
  Pill,
  Plus,
  Scale,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, MultiSelect, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { CADRAGE_ROLES, PROCEDURES, cadrageUnknowns, docState, g0Readiness, hasIdentityProof, infoQuality, isIdentityProof, nextCard, receivedTypes, type NextCardKey } from "@/lib/cadrage";
import { COUNTRIES, DOSAGE_UNITS, PEOPLE } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatDateTime, formatFileSize, formatLong, plural } from "@/lib/format";
import { useTeamNames } from "@/lib/people";
import { DOCUMENT_TYPES, RCP_TYPE, guessDocumentType } from "@/lib/reference-catalog";
import { findProject } from "@/lib/selectors";
import { cadrageActions, useDemo } from "@/lib/store";
import type { CadrageDatum, CadrageEntity, Project, ProjectCadrage, Tone } from "@/lib/types";
import { projectCadrageWorkbook } from "@/lib/step-exports";
import { DatumList, DatumModal, DocStateBadge, ExcelButton, ExpectedDocuments, PathwaySteps, ProofDrawer, QualityBar, SectionTitle, UnknownsList } from "./cadrage-bits";

const ENTITIES: { entity: CadrageEntity; icon: typeof Pill; hint: string }[] = [
  { entity: "Produit de référence", icon: Pill, hint: "Ce que les sources disent du princeps." },
  { entity: "Principe actif", icon: Building2, hint: "La matière du fournisseur : jamais confondue avec le princeps." },
];

const CARD_LOOK: Record<NextCardKey, { tone: Tone; icon: typeof Pill }> = {
  documents: { tone: "warn", icon: FileSearch },
  cadrage: { tone: "warn", icon: CircleAlert },
  g0: { tone: "info", icon: Scale },
  faisabilite: { tone: "success", icon: ArrowRight },
  attente: { tone: "warn", icon: CircleAlert },
  princeps: { tone: "success", icon: ArrowRight },
  suite: { tone: "success", icon: ArrowRight },
  confirmation: { tone: "success", icon: ArrowRight },
  dossier: { tone: "success", icon: ArrowRight },
};

/** Label of the shortcut shown next to a missing proof of the gate G0. */
const COMPLETE_LABEL: Record<string, string> = {
  identite: "Confirmer",
  contradictions: "Résoudre",
  preuve: "Importer",
  marche: "Préciser",
  variantes: "Ajouter",
  chef: "Désigner",
};

const scrollTo =(id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

/** `expected`: type the project is waiting for (kept when the file name says nothing about its type). */
export function AddDocumentModal({ code, onClose, expected }: { code: string; onClose: () => void; expected?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ name: string; size: string; type: string }[]>([]);
  const guessed = (name: string) => {
    const guess = guessDocumentType(name);
    return guess === "Autre document" && expected ? expected : guess;
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Ajouter un document"
      subtitle="L'original est conservé avec sa version ; ses valeurs sont lues quand c'est possible, puis soumises à votre revue."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!files.length}
            onClick={() => {
              for (const f of files) cadrageActions.addDocument(code, f);
              toast.show({ title: files.length > 1 ? `${files.length} documents reçus` : "Document reçu", description: `${files.map((f) => `${f.name} — ${f.type}`).join(" ; ")}. Les données lues attendent votre confirmation.` });
              onClose();
            }}
          >
            Ajouter au projet
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-subtle px-6 py-6 text-center hover:border-brand-400 hover:bg-brand-50/40">
          <Upload className="h-6 w-6 text-brand-600" strokeWidth={1.7} aria-hidden />
          <span className="text-[15px] font-semibold text-ink-900">{files.length ? "Ajouter d'autres fichiers" : "Choisir un ou plusieurs fichiers"}</span>
          <span className="text-sm text-ink-500">PDF, Word ou image scannée</span>
          <input
            ref={input}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tif,.tiff"
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: formatFileSize(f.size), type: guessed(f.name) }));
              setFiles((list) => [...list, ...picked.filter((f) => !list.some((x) => x.name === f.name))]);
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="space-y-3">
            {files.map((f, i) => (
              <li key={f.name} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[15px] font-semibold text-ink-900">
                    {f.name} <span className="font-normal text-ink-500">· {f.size}</span>
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    Retirer
                  </Button>
                </div>
                <Select id={i === 0 ? "doc-type" : `doc-type-${i}`} aria-label={`Type de document — ${f.name}`} className="mt-2" options={DOCUMENT_TYPES} value={f.type} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-[13px] text-ink-500">
          {expected && files.length > 0 && !files.some((f) => isIdentityProof(f.type))
            ? "Pour la porte G0, le document attendu est le RCP ou la notice du princeps : avec un autre type, la preuve restera manquante."
            : "Le type est proposé d'après le nom de chaque fichier : confirmez-le ou corrigez-le."}
        </p>
      </div>
    </Modal>
  );
}

function ScopeModal({ project, cadrage, people, onClose }: { project: Project; cadrage: ProjectCadrage; people: string[]; onClose: () => void }) {
  const [markets, setMarkets] = useState(cadrage.markets);
  const [procedure, setProcedure] = useState(cadrage.procedure);
  const [startDate, setStartDate] = useState(cadrage.startDate);
  const [targetDate, setTargetDate] = useState(cadrage.targetDate);
  const [team, setTeam] = useState<Record<string, string>>(() => Object.fromEntries(CADRAGE_ROLES.map((r) => [r.key, project.team.find((m) => m.role === r.label)?.person ?? ""])));
  const dates = Boolean(startDate && targetDate && targetDate < startDate);
  const valid = markets.length > 0 && Boolean(team.chef) && !dates;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Modifier le périmètre et l'équipe"
      subtitle={`${project.code} • ${project.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              cadrageActions.updateScope(project.code, { markets, procedure, startDate, targetDate, team });
              toast.show({ title: "Périmètre mis à jour", description: "La modification est tracée dans l'historique du projet." });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Pays de dépôt" required htmlFor="s-markets" error={markets.length ? undefined : "Au moins un pays."}>
          <MultiSelect id="s-markets" label="Pays de dépôt" options={COUNTRIES} value={markets} onChange={setMarkets} placeholder="Sélectionner" invalid={!markets.length} />
        </Field>
        <Field label="Procédure d'enregistrement" htmlFor="s-procedure">
          <Select id="s-procedure" options={PROCEDURES} value={procedure} onChange={(e) => setProcedure(e.target.value)} />
        </Field>
        <Field label="Date de démarrage" htmlFor="s-start">
          <DateInput id="s-start" value={startDate} onChange={setStartDate} onClear={() => setStartDate("")} />
        </Field>
        <Field label="Dossier prêt pour validation interne — cible" htmlFor="s-target" error={dates ? "La date cible précède le démarrage." : undefined}>
          <DateInput id="s-target" value={targetDate} onChange={setTargetDate} onClear={() => setTargetDate("")} invalid={dates} />
        </Field>
        {CADRAGE_ROLES.map((r) => (
          <Field key={r.key} label={r.label} required={r.required} htmlFor={`s-team-${r.key}`}>
            <Select id={`s-team-${r.key}`} placeholder="À désigner" options={people} value={team[r.key] ?? ""} onChange={(e) => setTeam({ ...team, [r.key]: e.target.value })} />
          </Field>
        ))}
      </div>
    </Modal>
  );
}

function GateModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [justification, setJustification] = useState("");
  const { checks, alerts } = g0Readiness(project);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Porte G0 — Valider le cadrage"
      subtitle="Quel produit et quel marché développons-nous ?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!justification.trim()}
            icon={<Check className="h-4 w-4" />}
            onClick={() => {
              cadrageActions.approveG0(project.code, justification);
              toast.show({ title: "Cadrage validé", description: "Décision G0 enregistrée avec son auteur, sa date, son motif et ses preuves." });
              onClose();
            }}
          >
            Approuver le cadrage
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-subtle p-4">
          <p className="text-sm font-semibold text-ink-600">Proposition</p>
          <p className="mt-1 text-[17px] font-bold text-ink-900">
            Développer un générique de {project.cadrage!.reference.name} — {project.form.toLowerCase()} {project.dosage}
          </p>
          <p className="text-[15px] text-ink-700">Marché visé : {project.cadrage!.markets.join(", ")}</p>
        </div>
        <div>
          <p className="mb-2 text-[15px] font-bold text-ink-900">Preuves</p>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2.5 text-[15px]">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden />
                <span>
                  <span className="font-semibold text-ink-900">{c.label}</span> <span className="text-ink-600">— {c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {alerts.length > 0 && (
          <div>
            <p className="mb-2 text-[15px] font-bold text-ink-900">Inconnues à garder en vue</p>
            <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-700">
              {alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        <Field label="Motif de la décision" required htmlFor="g0-motif" hint="Décideurs proposés : chef de projet + R&D (à confirmer selon votre organisation).">
          <Textarea id="g0-motif" value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={400} placeholder="Ex. produit et marché conformes à la demande du comité ; identité confirmée sur le RCP." />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CadrageView({ slug }: { slug: string }) {
  const state = useDemo();
  const router = useRouter();
  const project = findProject(state, slug);
  const people = [...new Set(useTeamNames([...PEOPLE, "Responsable affaires réglementaires", "Responsable assurance qualité"]))];
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; mode: "edit" | "resolve" } | null>(null);
  const [dialog, setDialog] = useState<"document" | "scope" | "g0" | null>(null);
  const [newDosage, setNewDosage] = useState("");
  const [newUnit, setNewUnit] = useState("mg");

  if (!project) return null;
  const c = project.cadrage;
  if (!c) {
    return (
      <>
        <ProjectTabs slug={project.slug} />
        <Card className="mt-6">
          <EmptyState
            icon={Info}
            title="Pas de fiche de cadrage pour ce projet"
            description="Ce projet a été créé avant le nouveau parcours d'aide à la décision : il n'a ni données sourcées ni porte G0. Les nouveaux projets sont cadrés dès leur création."
          />
        </Card>
      </>
    );
  }

  const code = project.code;
  const card = nextCard(project);
  const look = CARD_LOOK[card.key];
  const readiness = g0Readiness(project);
  const quality = infoQuality(c.data);
  const unknowns = cadrageUnknowns(c, project.team);
  const pending = c.data.filter((d) => d.status === "Extraite à confirmer");
  const approved = c.g0.status === "Approuvée";
  const proof = c.data.find((d) => d.key === proofKey) ?? null;
  const editingDatum = editing && c.data.find((d) => d.key === editing.key);

  const handlers = {
    onProof: (d: CadrageDatum) => setProofKey(d.key),
    onConfirm: (d: CadrageDatum) => cadrageActions.confirm(code, [d.key]),
    onEdit: (d: CadrageDatum) => setEditing({ key: d.key, mode: "edit" }),
    onResolve: (d: CadrageDatum) => setEditing({ key: d.key, mode: "resolve" }),
  };

  /** Takes the user to the place where a missing proof of the gate is completed. */
  const complete = (key: string) => {
    const conflict = c.data.find((d) => d.status === "Contradictoire");
    if (key === "preuve") setDialog("document");
    else if (key === "marche" || key === "chef") setDialog("scope");
    else if (key === "contradictions" && conflict) setEditing({ key: conflict.key, mode: "resolve" });
    else scrollTo(key === "variantes" ? "variantes" : "fiche");
  };

  const cardAction = () => {
    if (card.key === "documents") scrollTo("fiche");
    else if (card.key === "g0") setDialog("g0");
    else if (card.key === "cadrage") scrollTo("porte-g0");
    else router.push(card.href);
  };

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Cadrage_${code}`} sheets={() => projectCadrageWorkbook(project)} />} />

      {/* First card: what to look at now */}
      <Card className={cn("mt-6 flex flex-col gap-4 p-5 md:flex-row md:items-center", look.tone === "warn" && "border-warn-200 bg-warn-50/60", look.tone === "info" && "border-brand-200 bg-brand-50/60", look.tone === "success" && "border-success-100 bg-success-50/60")}>
        <IconTile icon={look.icon} tone={look.tone} size="lg" className="bg-white" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink-600">Prochaine étape</p>
          <p className="text-xl font-bold text-ink-900">{card.title}</p>
          <p className="text-[15px] text-ink-700">{card.detail}</p>
        </div>
        <Button size="lg" iconRight={<ArrowRight className="h-5 w-5" />} onClick={cardAction}>
          {card.action}
        </Button>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          {/* Fiche d'identité */}
          <Card id="fiche" className="scroll-mt-24 p-6">
            <SectionTitle
              icon={Pill}
              title="Fiche d'identité"
              subtitle="Chaque valeur garde sa provenance : document, emplacement et extrait."
              aside={
                pending.length > 1 && (
                  <Button variant="outline" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => cadrageActions.confirm(code, pending.map((d) => d.key))}>
                    Confirmer les {pending.length} valeurs lues
                  </Button>
                )
              }
            />
            <div className="mt-4 rounded-xl bg-subtle p-4">
              <QualityBar quality={quality} />
            </div>
            {ENTITIES.map(({ entity, icon: Icon, hint }) => (
              <section key={entity} className="mt-6">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
                  <Icon className="h-[18px] w-[18px] text-ink-600" aria-hidden />
                  {entity}
                  <span className="font-normal text-ink-500">— {hint}</span>
                </h3>
                <DatumList className="mt-2.5" data={c.data.filter((d) => d.entity === entity)} {...handlers} />
              </section>
            ))}
            <section className="mt-6">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
                <FlaskConical className="h-[18px] w-[18px] text-ink-600" aria-hidden />
                Produit développé
                <span className="font-normal text-ink-500">— ce que vous visez, décidé par vous.</span>
              </h3>
              <dl className="mt-2.5 grid gap-x-8 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-[13px] text-ink-500">Projet</dt>
                  <dd className="font-semibold text-ink-900">
                    {project.code} • {project.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-ink-500">Forme visée</dt>
                  <dd className="font-semibold text-ink-900">{project.form}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-ink-500">Dosages visés</dt>
                  <dd className="font-semibold text-ink-900">{project.dosage}</dd>
                </div>
              </dl>
            </section>
          </Card>

          {/* Variantes de dosage */}
          <Card id="variantes" className="scroll-mt-24 p-6">
            <SectionTitle icon={FlaskConical} title="Variantes de dosage" subtitle="Preuves communes et preuves propres à chaque dosage : aucune conclusion n'est étendue automatiquement d'un dosage à l'autre." />
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {c.variants.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="text-[17px] font-bold text-ink-900">
                    {v.dosage} {v.unit}
                  </span>
                  {v.reference ? <Badge tone="info">Dosage de la référence</Badge> : <Badge tone="neutral">Autre dosage visé</Badge>}
                  <span className="flex-1 text-sm text-ink-500">{v.reference ? "Identité du princeps documentée pour ce dosage." : "Aucune preuve propre à ce dosage pour l'instant."}</span>
                  {!approved && c.variants.length > 1 && (
                    <IconButton label={`Retirer la variante ${v.dosage} ${v.unit}`} onClick={() => cadrageActions.removeVariant(code, v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
            {!approved && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Input aria-label="Nouveau dosage" inputMode="decimal" placeholder="Nouveau dosage" className="w-44" value={newDosage} onChange={(e) => setNewDosage(e.target.value)} />
                <Select aria-label="Unité" options={DOSAGE_UNITS} value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className="w-28" />
                <Button
                  variant="outline"
                  icon={<Plus className="h-4 w-4" />}
                  disabled={!(Number(newDosage.replace(",", ".")) > 0)}
                  onClick={() => {
                    cadrageActions.addVariant(code, newDosage, newUnit);
                    setNewDosage("");
                  }}
                >
                  Ajouter une variante
                </Button>
              </div>
            )}
          </Card>

          {/* Documents */}
          <Card id="documents" className="scroll-mt-24 p-6">
            <SectionTitle
              icon={FileText}
              title="Documents"
              subtitle="Les preuves reçues et leurs versions, puis ce qui est encore attendu."
              aside={
                <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setDialog("document")}>
                  Ajouter un document
                </Button>
              }
            />
            {c.documents.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-subtle px-4 py-5 text-center text-[15px] text-ink-600">
                Aucun document reçu. Importez le RCP ou la notice du princeps : c&apos;est la preuve de l&apos;identité confirmée.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {c.documents.map((d) => {
                  const read = c.data.filter((x) => x.source?.document === `${d.name} (v${d.version})` || x.alternatives?.some((a) => a.source.document === `${d.name} (v${d.version})`));
                  return (
                    <li key={d.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <FileText className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.7} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-ink-900">
                            {d.name} <span className="font-normal text-ink-500">· v{d.version}</span>
                          </p>
                          <p className="text-[13px] text-ink-500">
                            {d.type} · {d.size} · reçu le {formatDateTime(d.receivedAt)}
                          </p>
                        </div>
                        {d.readable && (
                          <span className="text-sm text-ink-600">
                            {read.length} {plural(read.length, "valeur rattachée", "valeurs rattachées")}
                          </span>
                        )}
                        <DocStateBadge state={docState(d, c.data)} />
                      </div>
                      {d.note && <p className="mt-1.5 pl-8 text-[13px] leading-snug text-ink-500">{d.note}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            <h3 className="mt-6 text-[15px] font-bold text-ink-900">Documents attendus</h3>
            <p className="text-sm text-ink-500">Un fichier présent ne vaut pas contenu suffisant : c&apos;est la revue de ses données qui le rend exploitable.</p>
            <div className="mt-2">
              <ExpectedDocuments expected={c.expected} received={receivedTypes(c)} />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          {/* Porte G0 */}
          <Card id="porte-g0" className="scroll-mt-24 p-5">
            <SectionTitle
              icon={Scale}
              title="Porte G0 — Cadrage"
              subtitle="Quel produit et quel marché développons-nous ?"
              aside={<Badge tone={approved ? "success" : readiness.ready ? "info" : "warn"}>{approved ? "Approuvée" : readiness.ready ? "Décision attendue" : "Preuves incomplètes"}</Badge>}
            />
            <ul className="mt-4 space-y-2.5">
              {readiness.checks.map((x) => (
                <li key={x.key} className="flex items-start gap-2.5">
                  {x.ok ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 fill-danger-500 text-white" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink-900">{x.label}</p>
                    <p className={cn("text-[13px] leading-snug", x.ok ? "text-ink-500" : "text-danger-700")}>{x.detail}</p>
                  </div>
                  {!x.ok && (
                    <Button variant="outline" size="sm" className="shrink-0" iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => complete(x.key)}>
                      {COMPLETE_LABEL[x.key] ?? "Compléter"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {readiness.alerts.length > 0 && !approved && (
              <ul className="mt-4 space-y-1.5 rounded-xl bg-warn-50 p-3 text-[13px] leading-snug text-ink-700">
                {readiness.alerts.map((a) => (
                  <li key={a} className="flex gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            )}
            {approved ? (
              <div className="mt-4 rounded-xl border border-success-100 bg-success-50/70 p-3.5 text-sm">
                <p className="font-semibold text-ink-900">
                  Approuvée par {c.g0.decidedBy} — {c.g0.decidedAt && formatDateTime(c.g0.decidedAt)}
                </p>
                <p className="mt-1 text-ink-700">« {c.g0.justification} »</p>
                <p className="mt-2 text-[13px] text-ink-500">Si une preuve change, la décision devra être réexaminée : elle n&apos;est pas rejouée automatiquement.</p>
              </div>
            ) : (
              <>
                <Button className="mt-4 w-full" size="lg" disabled={!readiness.ready} icon={<Scale className="h-5 w-5" />} onClick={() => setDialog("g0")}>
                  Examiner et décider
                </Button>
                <p className="mt-2 text-center text-[13px] text-ink-500">{readiness.ready ? "Décideurs proposés : chef de projet + R&D" : "La décision s'ouvre quand toutes les preuves sont réunies."}</p>
              </>
            )}
          </Card>

          {/* Périmètre & équipe */}
          <Card className="p-5">
            <SectionTitle
              icon={Globe}
              title="Périmètre de marché"
              aside={
                !approved && (
                  <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog("scope")}>
                    Modifier
                  </Button>
                )
              }
            />
            <dl className="mt-3 space-y-2.5 text-[15px]">
              <div>
                <dt className="text-[13px] text-ink-500">Pays de dépôt</dt>
                <dd className="font-semibold text-ink-900">{c.markets.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-ink-500">Procédure</dt>
                <dd className="font-semibold text-ink-900">{c.procedure}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[13px] text-ink-500">Démarrage</dt>
                  <dd className="font-semibold text-ink-900">{c.startDate ? formatLong(c.startDate) : "Dès la création"}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-ink-500">Cible dossier</dt>
                  <dd className={cn("font-semibold", c.targetDate ? "text-ink-900" : "text-ink-400")}>{c.targetDate ? formatLong(c.targetDate) : "Non définie"}</dd>
                </div>
              </div>
            </dl>
            <h3 className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-[15px] font-bold text-ink-900">
              <Users className="h-[18px] w-[18px] text-ink-600" aria-hidden />
              Équipe
            </h3>
            <ul className="mt-2.5 space-y-2">
              {project.team.map((m) => (
                <li key={m.role} className="flex items-center justify-between gap-3 text-[15px]">
                  <span className="text-ink-600">{m.role}</span>
                  <span className={cn("text-right font-semibold", m.person ? "text-ink-900" : "text-ink-400")}>{m.person || "À désigner"}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Inconnues */}
          <Card id="inconnues" className="scroll-mt-24 p-5">
            <SectionTitle icon={CircleHelp} title={`Liste des inconnues (${unknowns.length})`} subtitle="Aucune valeur n'est inventée pour combler un manque." />
            <div className="mt-4">
              <UnknownsList items={unknowns} limit={6} />
            </div>
          </Card>

          {/* Parcours */}
          <Card className="p-5">
            <SectionTitle icon={MapIcon} title="Parcours du projet" subtitle={`Adapté à la forme « ${project.form.toLowerCase()} » — étapes en partie parallèles.`} />
            <div className="mt-4">
              <PathwaySteps family={project.family} current={approved ? 1 : 0} />
            </div>
            <p className="mt-3 text-[13px] text-ink-500">Les étapes 1 et 2 sont ouvertes dans les onglets « Faisabilité » et « Princeps » ; les suivantes le seront dans les prochaines versions.</p>
          </Card>
        </aside>
      </div>

      <ProofDrawer datum={proof} context={`${project.code} • ${project.name}`} onClose={() => setProofKey(null)} />
      {editing && editingDatum && (
        <DatumModal
          key={`${editing.key}-${editing.mode}`}
          datum={editingDatum}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSubmit={(v, note) => {
            if (editing.mode === "resolve") cadrageActions.resolve(code, editing.key, v, note);
            else cadrageActions.correct(code, editing.key, v, note);
            setEditing(null);
          }}
        />
      )}
      {dialog === "document" && <AddDocumentModal code={code} expected={hasIdentityProof(c) ? undefined : RCP_TYPE} onClose={() => setDialog(null)} />}
      {dialog === "scope" && <ScopeModal project={project} cadrage={c} people={people} onClose={() => setDialog(null)} />}
      {dialog === "g0" && <GateModal project={project} onClose={() => setDialog(null)} />}
    </>
  );
}
