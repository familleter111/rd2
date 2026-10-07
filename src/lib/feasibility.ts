/**
 * Étape 1 — Sélection et faisabilité (gate G1).
 *
 * The system pre-fills what it can see (documents received, equipment declared in Configuration)
 * without ever turning "file present" into "content sufficient". People take each criterion over.
 * The score is explainable and stays separate from the critical blockers it never compensates.
 */
import { CURRENT_USER } from "./catalog";
import { docState, sync } from "./cadrage";
import type { DemoState } from "./data";
import { formatDateTime, formatLong } from "./format";
import { stamp, uid, withEvent } from "./state-utils";
import type { CriterionStatus, EquipmentNeed, Family, Feasibility, FeasibilityAnswer, FeasibilityChoice, PatentEntry, Project, Resource } from "./types";

export const FEASIBILITY_AXES = ["Documentation", "Disponibilité matière", "Méthode analytique", "Formulation & procédé", "Capacité & délai", "Propriété intellectuelle", "Marché"] as const;
export type FeasibilityAxis = (typeof FEASIBILITY_AXES)[number];

export interface Criterion {
  key: string;
  axis: FeasibilityAxis;
  label: string;
  weight: 1 | 2 | 3;
  /** A critical criterion that is not established can block: a good score never compensates it. */
  critical: boolean;
  /** What to do when it is not established. */
  action: string;
}

/**
 * Proposed grid. It stands in for the 27 weighted criteria of the client's workbook, which are to be
 * loaded from Configuration once confirmed (labels and weights below are a starting proposal).
 */
export const CRITERIA: Criterion[] = [
  { key: "doc-princeps", axis: "Documentation", label: "Documents du princeps exploitables (RCP, notice)", weight: 3, critical: true, action: "Importer le RCP ou la notice et confirmer les données lues" },
  { key: "doc-eval", axis: "Documentation", label: "Rapport public d'évaluation ou littérature disponible", weight: 1, critical: false, action: "Rechercher et importer le rapport public d'évaluation" },
  { key: "doc-mono", axis: "Documentation", label: "Monographie applicable accessible", weight: 2, critical: false, action: "Vérifier l'accès à la monographie et l'importer" },
  { key: "api-source", axis: "Disponibilité matière", label: "Source de principe actif identifiée", weight: 3, critical: true, action: "Identifier au moins un fournisseur de principe actif avec les Achats" },
  { key: "api-docs", axis: "Disponibilité matière", label: "Documentation fournisseur reçue et valide (DMF/CEP, GMP)", weight: 3, critical: false, action: "Demander le DMF/CEP et le certificat GMP, puis vérifier leur validité" },
  { key: "api-coa", axis: "Disponibilité matière", label: "Certificat d'analyse et FDS disponibles", weight: 1, critical: false, action: "Demander le certificat d'analyse et la FDS au fournisseur" },
  { key: "excipients", axis: "Disponibilité matière", label: "Excipients du princeps approvisionnables", weight: 2, critical: false, action: "Confirmer l'approvisionnement des excipients déclarés" },
  { key: "method", axis: "Méthode analytique", label: "Méthode de dosage identifiée", weight: 3, critical: false, action: "Identifier la méthode de dosage applicable (pharmacopée ou interne)" },
  { key: "ana-equipment", axis: "Méthode analytique", label: "Équipements et colonnes analytiques disponibles", weight: 3, critical: true, action: "Confirmer la disponibilité auprès du laboratoire ou déclarer l'équipement dans Configuration" },
  { key: "standards", axis: "Méthode analytique", label: "Substances de référence accessibles", weight: 2, critical: false, action: "Confirmer l'accès aux substances de référence" },
  { key: "know-how", axis: "Formulation & procédé", label: "Forme et procédé maîtrisés en interne", weight: 3, critical: false, action: "Faire évaluer la maîtrise du procédé par le galéniste" },
  { key: "prod-equipment", axis: "Formulation & procédé", label: "Équipements de fabrication disponibles", weight: 3, critical: true, action: "Confirmer la disponibilité auprès de la production ou déclarer l'équipement dans Configuration" },
  { key: "team", axis: "Capacité & délai", label: "Compétences et charge de l'équipe compatibles", weight: 2, critical: false, action: "Faire confirmer la charge par les responsables d'équipe" },
  { key: "delay", axis: "Capacité & délai", label: "Délai cible réaliste", weight: 2, critical: false, action: "Définir ou revoir la cible de calendrier du projet" },
  { key: "ip", axis: "Propriété intellectuelle", label: "Brevets recensés et questions transmises pour examen", weight: 2, critical: false, action: "Recenser les brevets (documents, territoires, dates) et formuler les questions à examiner" },
  { key: "market", axis: "Marché", label: "Intérêt du marché documenté", weight: 1, critical: false, action: "Réunir les informations de marché disponibles" },
];

export const CRITERION_TONE = { "Non évalué": "neutral", Établi: "success", "À compléter": "warn", Bloquant: "danger" } as const;

/* ------------------------------------------------------------------ */
/* Equipment needs compared with what is really declared               */
/* ------------------------------------------------------------------ */

const need = (name: string, use: EquipmentNeed["use"]): EquipmentNeed => ({ id: `${use}-${name}`, name, use });

/** Needs proposed for a dosage form; the list is edited by the project. */
export function defaultEquipment(family: Family, form: string): EquipmentNeed[] {
  if (family === "Liquide") {
    return [need("Cuve de fabrication avec agitation", "Fabrication"), need("Ligne de remplissage", "Fabrication"), need("HPLC", "Analytique"), need("pH-mètre", "Analytique"), need("Balance analytique", "Analytique")];
  }
  if (family === "Semi-solide") {
    return [need("Mélangeur-homogénéisateur", "Fabrication"), need("Remplisseuse de tubes", "Fabrication"), need("HPLC", "Analytique"), need("Viscosimètre", "Analytique"), need("pH-mètre", "Analytique")];
  }
  return [
    need("Mélangeur", "Fabrication"),
    need(form === "Gélule" ? "Géluleuse" : form === "Poudre orale" ? "Ensacheuse" : "Presse à comprimer", "Fabrication"),
    need("HPLC", "Analytique"),
    need("Appareil de dissolution", "Analytique"),
    need("Balance analytique", "Analytique"),
  ];
}

const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Declared resource that covers a need: its name, type or label contains the main word of the need. */
export function matchEquipment(n: EquipmentNeed, resources: Resource[]): Resource | undefined {
  const words = norm(n.name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !["avec", "appareil", "ligne", "analytique"].includes(w));
  const key = words[0] ?? norm(n.name);
  return resources.find((r) => r.category === "Équipement" && [r.name, r.type, r.label].some((f) => norm(f).includes(key)));
}

export const equipmentNeeds = (p: Project) => p.feasibility?.equipment ?? defaultEquipment(p.family, p.form);

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export interface CriterionRow extends Criterion {
  status: CriterionStatus;
  note: string;
  proof: string;
  /** True while the row shows the system proposal (nobody has evaluated it yet). */
  prefilled: boolean;
  updatedAt?: string;
  by?: string;
}

type Proposal = { status: CriterionStatus; note: string; proof: string };
const NONE: Proposal = { status: "Non évalué", note: "", proof: "" };

/** "File present" is reported as such: its content still has to be examined by a person. */
function presence(p: Project, types: string[]): Proposal {
  const docs = p.cadrage?.documents.filter((d) => types.includes(d.type)) ?? [];
  if (docs.length === types.length) return { status: "À compléter", note: "Fichier présent — contenu à examiner avant de le tenir pour suffisant.", proof: docs.map((d) => d.name).join(", ") };
  const missing = types.filter((t) => !docs.some((d) => d.type === t));
  return { status: "À compléter", note: `Non reçu : ${missing.join(", ")}.`, proof: docs.map((d) => d.name).join(", ") };
}

function equipmentProposal(s: DemoState, p: Project, use: EquipmentNeed["use"]): Proposal {
  const needs = equipmentNeeds(p).filter((n) => n.use === use);
  if (!needs.length) return NONE;
  const missing = needs.filter((n) => !matchEquipment(n, s.resources));
  const found = needs.map((n) => matchEquipment(n, s.resources)?.name).filter(Boolean);
  if (missing.length) return { status: "À compléter", note: `Non renseigné dans l'inventaire : ${missing.map((n) => n.name.toLowerCase()).join(", ")}.`, proof: found.join(", ") };
  return { status: "Établi", note: "Tous les équipements requis sont déclarés dans l'inventaire (qualification à vérifier au lancement).", proof: found.join(", ") };
}

/** What the system can propose for a criterion from the project data — or nothing. */
function propose(s: DemoState, p: Project, key: string): Proposal {
  const c = p.cadrage;
  if (!c) return NONE;
  switch (key) {
    case "doc-princeps": {
      const docs = c.documents.filter((d) => d.type === "RCP du princeps" || d.type === "Notice du princeps");
      if (!docs.length) return { status: "À compléter", note: "Aucun RCP ni notice reçu.", proof: "" };
      const usable = docs.filter((d) => docState(d, c.data) === "Exploitable");
      return usable.length
        ? { status: "Établi", note: "Document lu et données revues.", proof: usable.map((d) => d.name).join(", ") }
        : { status: "À compléter", note: "Fichier présent — ses données restent à lire ou à confirmer.", proof: docs.map((d) => d.name).join(", ") };
    }
    case "doc-eval":
      return presence(p, ["Rapport public d'évaluation"]);
    case "doc-mono":
      return presence(p, ["Monographie (pharmacopée)"]);
    case "api-docs":
      return presence(p, ["DMF / CEP du principe actif", "Certificat GMP du fournisseur"]);
    case "api-coa":
      return presence(p, ["Certificat d'analyse du principe actif", "Fiche de données de sécurité (FDS)"]);
    case "api-source": {
      const supplier = c.data.find((d) => d.key === "apiSupplier");
      return supplier?.value ? { status: "À compléter", note: `Fournisseur renseigné : ${supplier.value} — capacité et documentation à confirmer.`, proof: supplier.source?.document ?? "" } : NONE;
    }
    case "ana-equipment":
      return equipmentProposal(s, p, "Analytique");
    case "prod-equipment":
      return equipmentProposal(s, p, "Fabrication");
    case "delay":
      return c.targetDate ? NONE : { status: "À compléter", note: "Aucune cible de calendrier définie au cadrage.", proof: "" };
    case "ip": {
      const patents = p.feasibility?.patents ?? [];
      return patents.length
        ? { status: "À compléter", note: `${patents.length} document(s) recensé(s) — questions à faire examiner : une recherche n'est pas une conclusion de liberté d'exploitation.`, proof: patents.map((x) => x.reference).join(", ") }
        : { status: "À compléter", note: "Aucun brevet recensé pour l'instant.", proof: "" };
    }
    default:
      return NONE;
  }
}

/** The grid as shown: a person's evaluation wins; otherwise the system proposal, labelled as such. */
export function feasibilityRows(s: DemoState, p: Project): CriterionRow[] {
  return CRITERIA.map((c) => {
    const answer = p.feasibility?.answers.find((a) => a.key === c.key);
    if (answer) return { ...c, status: answer.status, note: answer.note, proof: answer.proof, prefilled: false, updatedAt: answer.updatedAt, by: answer.by };
    const proposal = propose(s, p, c.key);
    return { ...c, ...proposal, prefilled: proposal.status !== "Non évalué" };
  });
}

export interface FeasibilityScore {
  /** Established weight over total weight, in percent. */
  value: number;
  established: number;
  toComplete: number;
  notEvaluated: number;
  blocking: number;
  /** Critical criteria that are not established. */
  criticalOpen: number;
}

export function feasibilityScore(rows: CriterionRow[]): FeasibilityScore {
  const total = rows.reduce((n, r) => n + r.weight, 0);
  const got = rows.filter((r) => r.status === "Établi").reduce((n, r) => n + r.weight, 0);
  return {
    value: Math.round((got / total) * 100),
    established: rows.filter((r) => r.status === "Établi").length,
    toComplete: rows.filter((r) => r.status === "À compléter").length,
    notEvaluated: rows.filter((r) => r.status === "Non évalué").length,
    blocking: rows.filter((r) => r.status === "Bloquant").length,
    criticalOpen: rows.filter((r) => r.critical && r.status !== "Établi").length,
  };
}

export interface Alert {
  key: string;
  /** Reason of the alert. */
  title: string;
  detail: string;
  proof: string;
  action: string;
  critical: boolean;
}

/** « Ce qui est établi », « Ce qui manque », « Ce qui peut bloquer » — each alert with reason, proof and proposed action. */
export function feasibilityBlocks(rows: CriterionRow[]): { established: Alert[]; missing: Alert[]; blocking: Alert[] } {
  const alert = (r: CriterionRow): Alert => ({
    key: r.key,
    title: r.label,
    detail: r.note || (r.status === "Non évalué" ? "Pas encore évalué." : ""),
    proof: r.proof,
    action: r.action,
    critical: r.critical,
  });
  return {
    established: rows.filter((r) => r.status === "Établi").map(alert),
    missing: rows.filter((r) => !r.critical && (r.status === "À compléter" || r.status === "Non évalué")).map(alert),
    blocking: rows.filter((r) => r.status === "Bloquant" || (r.critical && r.status !== "Établi")).map(alert),
  };
}

/** Whether the committee can launch: a criterion declared blocking must first be lifted or re-qualified. */
export function canLaunch(rows: CriterionRow[]) {
  return rows.every((r) => r.status !== "Bloquant");
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

/** Feasibility report (Markdown): evaluation, sources and retained assumptions. */
export function feasibilityReport(s: DemoState, p: Project): string {
  const rows = feasibilityRows(s, p);
  const score = feasibilityScore(rows);
  const f = p.feasibility;
  const c = p.cadrage!;
  const lines: string[] = [
    `# Rapport de faisabilité — ${p.code} • ${p.name}`,
    "",
    `Produit de référence : ${p.referenceProduct}`,
    `Produit développé : ${p.form}, ${p.dosage} — marché visé : ${c.markets.join(", ")}`,
    `Édité le ${formatDateTime(stamp())}`,
    "",
    "## Synthèse",
    `Score documentaire : ${score.value} % du poids des critères établi (${score.established} établis, ${score.toComplete} à compléter, ${score.notEvaluated} non évalués, ${score.blocking} bloquants).`,
    `Critères critiques non établis : ${score.criticalOpen}. Le score ne compense pas un prérequis bloquant.`,
    "",
  ];
  for (const axis of FEASIBILITY_AXES) {
    lines.push(`## ${axis}`);
    for (const r of rows.filter((x) => x.axis === axis)) {
      lines.push(`- ${r.label} (poids ${r.weight}${r.critical ? ", critique" : ""}) — ${r.status}${r.prefilled ? " [proposition du système, non revue]" : ""}`);
      if (r.note) lines.push(`  Motif : ${r.note}`);
      if (r.proof) lines.push(`  Preuve : ${r.proof}`);
    }
    lines.push("");
  }
  lines.push("## Équipements requis");
  for (const n of equipmentNeeds(p)) {
    const r = matchEquipment(n, s.resources);
    lines.push(`- ${n.name} (${n.use.toLowerCase()}) — ${r ? `déclaré : ${r.name}` : "non renseigné dans l'inventaire"}`);
  }
  lines.push("", "## Brevets à examiner", "Une recherche ne constitue pas une conclusion de liberté d'exploitation.");
  if (!f?.patents.length) lines.push("- Aucun document recensé.");
  for (const x of f?.patents ?? []) lines.push(`- ${x.reference} — ${x.territory}${x.expiry ? ` — échéance ${formatLong(x.expiry)}` : ""} — question : ${x.question}`);
  lines.push("", "## Sources");
  if (!c.documents.length) lines.push("- Aucun document reçu.");
  for (const d of c.documents) lines.push(`- ${d.name} (v${d.version}) — ${d.type} — ${docState(d, c.data)}`);
  lines.push("", "## Décisions");
  if (!f?.decisions.length) lines.push("- Aucune décision enregistrée.");
  for (const d of f?.decisions ?? []) {
    lines.push(`- ${formatDateTime(d.decidedAt)} — ${d.choice} — ${d.decidedBy} (score ${d.score} %, ${d.open} point(s) ouvert(s))`);
    lines.push(`  Motif : ${d.justification}`);
    if (d.hypotheses) lines.push(`  Hypothèses retenues : ${d.hypotheses}`);
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

const EMPTY: Feasibility = { answers: [], patents: [], decisions: [] };

function patch(s: DemoState, code: string, update: (f: Feasibility, p: Project) => Feasibility): DemoState {
  return { ...s, projects: s.projects.map((p) => (p.code === code && p.cadrage ? { ...p, feasibility: update(p.feasibility ?? EMPTY, p) } : p)) };
}

const find = (s: DemoState, code: string) => s.projects.find((p) => p.code === code && p.cadrage);
const labelOf = (p: Project) => `${p.code} • ${p.name}`;
const hrefOf = (p: Project) => `/projets/${p.slug}/faisabilite`;

/** Activity asked to lift one open criterion (one per criterion, never duplicated). */
function withTask(s: DemoState, p: Project, row: CriterionRow): DemoState {
  const task = `faisabilite-${row.key}`;
  if (s.activities.some((a) => a.projectCode === p.code && a.cadrageTask === task && !a.done)) return s;
  return {
    ...s,
    activities: [
      ...s.activities,
      {
        id: uid("act"),
        projectCode: p.code,
        title: row.action,
        detail: `Critère de faisabilité : ${row.label}${row.note ? ` — ${row.note}` : ""}`,
        tags: [p.code, "Faisabilité"],
        status: { label: "À faire", tone: "warn" },
        state: "a-faire",
        due: p.cadrage?.startDate || p.createdAt,
        owner: p.owner,
        icon: "doc",
        done: false,
        kind: "standard",
        href: hrefOf(p),
        cadrageTask: task,
      },
    ],
  };
}

export const feasibility = {
  /** A person evaluates a criterion: their answer replaces the system proposal. */
  evaluate(s: DemoState, code: string, key: string, input: { status: CriterionStatus; note: string; proof: string }): DemoState {
    const p = find(s, code);
    const criterion = CRITERIA.find((c) => c.key === key);
    if (!p || !criterion) return s;
    const before = feasibilityRows(s, p).find((r) => r.key === key)!;
    const answer: FeasibilityAnswer = { key, status: input.status, note: input.note.trim(), proof: input.proof, updatedAt: stamp(), by: CURRENT_USER };
    let next = patch(s, code, (f) => ({ ...f, answers: [...f.answers.filter((a) => a.key !== key), answer] }));
    // An established criterion closes the activity that was asked to lift it.
    if (input.status === "Établi") {
      next = { ...next, activities: next.activities.map((a) => (a.projectCode === code && a.cadrageTask === `faisabilite-${key}` ? { ...a, done: true, state: "terminee", status: { label: "Terminée", tone: "success" } } : a)) };
    }
    return withEvent(next, {
      projectCode: code,
      title: `Critère de faisabilité évalué — ${criterion.label}`,
      context: labelOf(p),
      object: "Projet",
      objectLabel: `${labelOf(p)} • Faisabilité`,
      type: "Modification",
      field: criterion.label,
      oldValue: `${before.status}${before.prefilled ? " (proposition du système)" : ""}`,
      newValue: input.status,
      motif: input.note.trim() || undefined,
      icon: "edit",
      href: hrefOf(p),
    });
  },

  /** Back to the system proposal. */
  resetCriterion(s: DemoState, code: string, key: string): DemoState {
    return patch(s, code, (f) => ({ ...f, answers: f.answers.filter((a) => a.key !== key) }));
  },

  addEquipment(s: DemoState, code: string, name: string, use: EquipmentNeed["use"]): DemoState {
    const p = find(s, code);
    if (!p || !name.trim()) return s;
    return patch(s, code, (f) => ({ ...f, equipment: [...equipmentNeeds(p), { id: uid("eq"), name: name.trim(), use }] }));
  },
  removeEquipment(s: DemoState, code: string, id: string): DemoState {
    const p = find(s, code);
    if (!p) return s;
    return patch(s, code, (f) => ({ ...f, equipment: equipmentNeeds(p).filter((n) => n.id !== id) }));
  },

  addPatent(s: DemoState, code: string, input: Omit<PatentEntry, "id">): DemoState {
    const p = find(s, code);
    if (!p || !input.reference.trim()) return s;
    const next = patch(s, code, (f) => ({ ...f, patents: [...f.patents, { ...input, id: uid("pat"), reference: input.reference.trim(), question: input.question.trim() }] }));
    return withEvent(next, {
      projectCode: code,
      title: `Brevet recensé — ${input.reference.trim()}`,
      context: labelOf(p),
      object: "Projet",
      objectLabel: `${labelOf(p)} • Propriété intellectuelle`,
      type: "Ajout",
      description: `Territoire : ${input.territory}. Question à examiner : ${input.question.trim() || "à formuler"}. Ce recensement n'est pas une conclusion de liberté d'exploitation.`,
      icon: "doc",
      href: hrefOf(p),
    });
  },
  removePatent(s: DemoState, code: string, id: string): DemoState {
    return patch(s, code, (f) => ({ ...f, patents: f.patents.filter((x) => x.id !== id) }));
  },

  /** Creates the activity that lifts one open criterion. */
  createTask(s: DemoState, code: string, key: string): DemoState {
    const p = find(s, code);
    const row = p && feasibilityRows(s, p).find((r) => r.key === key);
    return p && row ? withTask(s, p, row) : s;
  },

  /** Gate G1: the committee launches, asks for complements, defers or stops — with its reason. */
  decide(s: DemoState, code: string, input: { choice: FeasibilityChoice; justification: string; hypotheses: string }): DemoState {
    const p = find(s, code);
    if (!p || p.cadrage?.g0.status !== "Approuvée" || !input.justification.trim()) return s;
    const rows = feasibilityRows(s, p);
    if (input.choice === "Lancer" && !canLaunch(rows)) return s;
    const score = feasibilityScore(rows);
    const open = rows.filter((r) => r.status !== "Établi");
    let next = patch(s, code, (f) => ({
      ...f,
      decisions: [
        { choice: input.choice, justification: input.justification.trim(), hypotheses: input.hypotheses.trim(), decidedAt: stamp(), decidedBy: CURRENT_USER, score: score.value, open: open.length },
        ...f.decisions,
      ],
    }));
    // « Compléter » only generates the activities needed to lift the unknowns.
    if (input.choice === "Compléter") for (const r of open) next = withTask(next, p, r);
    next = withEvent(next, {
      projectCode: code,
      title: `Porte G1 — décision : ${input.choice}`,
      context: labelOf(p),
      object: "Décision",
      objectLabel: `${labelOf(p)} • G1 — Faisabilité`,
      type: "Approbation",
      field: "G1 — Faisabilité",
      oldValue: p.feasibility?.decisions[0]?.choice ?? "Attendue",
      newValue: input.choice,
      motif: input.justification.trim(),
      description: `Score ${score.value} %, ${open.length} critère(s) non établi(s) dont ${score.criticalOpen} critique(s).${input.hypotheses.trim() ? ` Hypothèses retenues : ${input.hypotheses.trim()}` : ""}${input.choice === "Compléter" ? ` ${open.length} activité(s) créée(s) pour lever les inconnues.` : ""}`,
      icon: "check",
      href: hrefOf(p),
    });
    return sync(next, code);
  },
};
