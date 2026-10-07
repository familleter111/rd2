/**
 * Étape 6 — Stratégie de bioéquivalence / dispense éventuelle.
 *
 * The step gathers what the project already knows, proposes an orientation from what is documented
 * and lets two functions (scientific, regulatory) approve the strategy. A waiver is never "granted"
 * here: the outcome is "Éligibilité à examiner" or "Argumentaire préparé". No sample size is
 * computed: the hypotheses are collected for the specialist.
 */
import { allData, isVerified, sync } from "./cadrage";
import type { DemoState } from "./data";
import { formulationOf, optionLabel } from "./formulation";
import { qualityOf } from "./quality";
import { stamp, uid, withEvent } from "./state-utils";
import type { BeCriterion, BeFile, BeOrientation, BeStudy, CadrageDatum, Project } from "./types";

const EMPTY_STUDY: BeStudy = { test: "", reference: "", lots: "", design: "", hypotheses: "", available: "", open: "", partner: "", sizing: "" };
const EMPTY: BeFile = { referential: "", rationale: "", limits: "", criteria: [], study: EMPTY_STUDY };
export const beOf = (p: Project): BeFile => p.bioequivalence ?? EMPTY;

export const ORIENTATIONS: BeOrientation[] = ["Étude à préparer", "Dispense à examiner", "Données insuffisantes"];
export const ORIENTATION_TONE = { "Étude à préparer": "info", "Dispense à examiner": "warn", "Données insuffisantes": "neutral" } as const;

/* ------------------------------------------------------------------ */
/* Information gathered from the previous steps                        */
/* ------------------------------------------------------------------ */

export interface BeInput {
  key: string;
  label: string;
  value: string;
  /** "Vérifiée", "À confirmer", "Contradictoire" or "Non documentée". */
  state: "Vérifiée" | "À confirmer" | "Contradictoire" | "Non documentée";
  source: string;
  /** Where the value is completed. */
  href: string;
}

const INPUT_KEYS = ["dci", "form", "route", "release", "bcs", "solubility", "excipients", "dissolution", "beInfo"];

const stateOf = (d: CadrageDatum): BeInput["state"] =>
  isVerified(d) ? "Vérifiée" : d.status === "Extraite à confirmer" ? "À confirmer" : d.status === "Contradictoire" ? "Contradictoire" : "Non documentée";

/** Substance, form, release, documented BCS class, excipients, dissolution and market requirements. */
export function beInputs(p: Project): BeInput[] {
  const base = `/projets/${p.slug}`;
  const data = allData(p);
  const rows: BeInput[] = INPUT_KEYS.flatMap((key) => {
    const d = data.find((x) => x.key === key);
    if (!d) return [];
    const inSheet = p.princeps?.data.some((x) => x.key === key);
    return [{ key, label: d.label, value: d.value, state: stateOf(d), source: d.source ? `${d.source.document} — ${d.source.location}` : d.value ? "Saisie sans preuve jointe" : "", href: `${base}/${inSheet ? "princeps" : "cadrage"}` }];
  });
  const markets = p.cadrage?.markets ?? [];
  rows.push({ key: "markets", label: "Marchés visés", value: markets.join(", "), state: markets.length ? "Vérifiée" : "Non documentée", source: markets.length ? "Périmètre du cadrage (porte G0)" : "", href: `${base}/cadrage` });
  return rows;
}

const verified = (rows: BeInput[], key: string) => {
  const r = rows.find((x) => x.key === key);
  return r?.state === "Vérifiée" ? r.value : "";
};

export interface BeProposal {
  orientation: BeOrientation;
  /** Each line is one branch of the tree, with what was read to take it. */
  steps: { question: string; answer: string; ok: boolean | null }[];
  missing: string[];
}

/**
 * Orientation proposed from verified values only. It is a reading aid: the references retained for
 * the market decide, and a person chooses the orientation.
 */
export function proposeOrientation(p: Project): BeProposal {
  const rows = beInputs(p);
  const need = ["form", "route", "release", "bcs", "dissolution"];
  const missing = need.filter((k) => !verified(rows, k)).map((k) => rows.find((r) => r.key === k)?.label ?? k);
  const form = verified(rows, "form");
  const route = verified(rows, "route");
  const release = verified(rows, "release");
  const bcs = verified(rows, "bcs");
  const oralSolid = /comprim|gélule|gelule|poudre orale/i.test(form) && (!route || /oral/i.test(route));
  const immediate = /imm[ée]diate/i.test(release);
  const bcsClass = /\b(I{1,3}V?|IV|[1-4])\b/.exec(bcs.replace(/classe/i, "").trim())?.[1]?.toUpperCase() ?? "";
  const lowRisk = ["I", "III", "1", "3"].includes(bcsClass);
  const steps: BeProposal["steps"] = [
    { question: "La forme et la voie sont-elles vérifiées ?", answer: form ? `${form}${route ? ` — ${route}` : ""}` : "Non vérifiée", ok: form ? oralSolid : null },
    { question: "Le type de libération est-il vérifié ?", answer: release || "Non vérifié", ok: release ? immediate : null },
    { question: "La classe BCS est-elle documentée et vérifiée ?", answer: bcs || "Non documentée", ok: bcs ? lowRisk : null },
    { question: "Un profil de dissolution du princeps est-il disponible ?", answer: verified(rows, "dissolution") || "Non disponible", ok: verified(rows, "dissolution") ? true : null },
  ];
  if (missing.length) return { orientation: "Données insuffisantes", steps, missing };
  return { orientation: oralSolid && immediate && lowRisk ? "Dispense à examiner" : "Étude à préparer", steps, missing };
}

/** Criteria usually examined for a waiver argument — a proposal; each one needs its reference and its proof. */
export const PROPOSED_CRITERIA = [
  "Classe BCS de la substance active documentée",
  "Solubilité démontrée sur la plage de pH requise",
  "Perméabilité ou absorption documentée",
  "Forme orale à libération immédiate et action systémique",
  "Excipients comparés à ceux du produit de référence",
  "Dissolution comparative in vitro du produit test et de la référence",
  "Absence de marge thérapeutique étroite documentée",
];

/* ------------------------------------------------------------------ */
/* Readiness                                                           */
/* ------------------------------------------------------------------ */

export const STUDY_FIELDS: { key: keyof BeStudy; label: string; required: boolean; hint?: string }[] = [
  { key: "test", label: "Produit test (formule et procédé)", required: true },
  { key: "reference", label: "Produit de référence (lot, origine)", required: true },
  { key: "lots", label: "Lots proposés pour l'étude", required: true },
  { key: "design", label: "Plan d'étude envisagé", required: true, hint: "Schéma, population, conditions d'administration — à confirmer par le spécialiste." },
  { key: "hypotheses", label: "Hypothèses statistiques et leur origine", required: true, hint: "Variabilité, rapport attendu, puissance visée : chaque hypothèse avec sa source. Le nom de la molécule ne suffit pas." },
  { key: "available", label: "Données disponibles", required: false },
  { key: "open", label: "Points à préciser", required: false },
  { key: "partner", label: "Spécialiste / CRO", required: false },
  { key: "sizing", label: "Dimensionnement retenu et revue", required: false, hint: "Résultat du calcul, méthode utilisée et personne compétente qui l'a revu. Aucun effectif n'est calculé par la plateforme." },
];

export const studyMissing = (be: BeFile) => STUDY_FIELDS.filter((f) => f.required && !be.study[f.key].trim()).map((f) => f.label);

/** "Éligibilité à examiner" until every criterion has its reference and its proof — never "Dispense accordée". */
export function waiverStatus(be: BeFile): "Éligibilité à examiner" | "Argumentaire préparé" | "Critère non satisfait" {
  if (be.criteria.some((c) => c.state === "Non satisfait")) return "Critère non satisfait";
  return be.criteria.length > 0 && be.criteria.every((c) => c.state === "Preuve disponible" && c.source.trim() && c.evidence.trim()) ? "Argumentaire préparé" : "Éligibilité à examiner";
}

/** What still prevents the strategy from being approved. */
export function strategyBlocks(be: BeFile): string[] {
  const blocks: string[] = [];
  if (!be.referential.trim()) blocks.push("Référentiels applicables à renseigner (texte et version)");
  if (!be.orientation) blocks.push("Orientation à choisir");
  if (be.orientation === "Données insuffisantes") blocks.push("Les données sont insuffisantes : complétez la fiche princeps avant de retenir une stratégie");
  if (!be.rationale.trim()) blocks.push("Justification de la stratégie à rédiger");
  if (be.orientation === "Dispense à examiner") {
    const w = waiverStatus(be);
    if (w === "Critère non satisfait") blocks.push("Un critère de dispense n'est pas satisfait : la stratégie est à revoir");
    else if (w !== "Argumentaire préparé") blocks.push("Chaque critère de dispense doit avoir sa référence et sa preuve");
  }
  if (be.orientation === "Étude à préparer") blocks.push(...studyMissing(be).map((l) => `Étude — ${l.toLowerCase()} à renseigner`));
  return blocks;
}

/** Documents attached to the approved strategy (study report, waiver argument and their annexes). */
export const beDocuments = (be: BeFile) => be.documents ?? (be.deliverable ? [{ name: be.deliverable.name, at: be.deliverable.at }] : []);

export const isApproved = (be: BeFile) => Boolean(be.scientific && be.regulatory);

export const isValidated = (be: BeFile) => isApproved(be) && Boolean(be.validated);

export type BeStatus = "À ouvrir" | "En préparation" | "Prête à approuver" | "Approbation en cours" | "Stratégie approuvée" | "Étude validée";
export function beStatus(be: BeFile): BeStatus {
  if (isValidated(be)) return "Étude validée";
  if (isApproved(be)) return "Stratégie approuvée";
  if (be.scientific || be.regulatory) return "Approbation en cours";
  if (!be.orientation && !be.referential && !be.rationale) return "À ouvrir";
  return strategyBlocks(be).length ? "En préparation" : "Prête à approuver";
}
export const BE_TONE = { "À ouvrir": "neutral", "En préparation": "info", "Prête à approuver": "warn", "Approbation en cours": "warn", "Stratégie approuvée": "info", "Étude validée": "success" } as const;

/** Product, formula and lot already known to the project, proposed for the study elements. */
export function studyDefaults(p: Project): Partial<BeStudy> {
  const f = formulationOf(p);
  const kept = f.options.find((o) => o.id === f.decision?.optionId);
  const lot = qualityOf(p).pilot.lot;
  const ref = p.cadrage?.reference;
  return {
    test: kept ? `${p.name} ${p.dosage} — ${optionLabel(kept)} (${kept.process})` : "",
    reference: ref ? `${ref.name}${ref.holder ? ` — ${ref.holder}` : ""}${ref.country ? ` (${ref.country})` : ""}` : "",
    lots: lot ? `Lot pilote ${lot}` : "",
  };
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

const find = (s: DemoState, code: string) => s.projects.find((p) => p.code === code && p.cadrage);
const labelOf = (p: Project) => `${p.code} • ${p.name}`;
const hrefOf = (p: Project) => `/projets/${p.slug}/bioequivalence`;
/** Any change of content withdraws the approvals: the two functions approved a precise strategy. */
const patch = (s: DemoState, code: string, update: (be: BeFile, p: Project) => BeFile, keepApprovals = false): DemoState => ({
  ...s,
  projects: s.projects.map((p) => {
    if (p.code !== code || !p.cadrage) return p;
    const next = update(beOf(p), p);
    return { ...p, bioequivalence: keepApprovals ? next : { ...next, scientific: undefined, regulatory: undefined, validated: undefined } };
  }),
});
const event = (s: DemoState, p: Project, title: string, type: "Ajout" | "Modification" | "Approbation", description?: string) =>
  withEvent(s, { projectCode: p.code, title, context: labelOf(p), object: "Décision", objectLabel: `${labelOf(p)} • Bioéquivalence`, type, description, icon: type === "Approbation" ? "check" : "edit", href: hrefOf(p) });

export type StrategyInput = Pick<BeFile, "referential" | "orientation" | "rationale" | "limits">;

export const bioequivalence = {
  saveStrategy(s: DemoState, code: string, input: StrategyInput): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const before = beOf(p);
    const next = patch(s, code, (be, project) => ({
      ...be,
      ...input,
      referential: input.referential.trim(),
      rationale: input.rationale.trim(),
      limits: input.limits.trim(),
      // First time a study is retained: what the project already knows is proposed, never overwritten.
      study: input.orientation === "Étude à préparer" ? { ...be.study, ...Object.fromEntries(Object.entries(studyDefaults(project)).filter(([k, v]) => v && !be.study[k as keyof BeStudy])) } : be.study,
    }));
    return sync(event(next, p, before.orientation === input.orientation ? "Stratégie de bioéquivalence modifiée" : `Orientation retenue : ${input.orientation ?? "à choisir"}`, "Modification", input.rationale.trim() || undefined), code);
  },

  /** Adds the usual criteria of a waiver argument that are not listed yet, as proposals to document. */
  proposeCriteria(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const have = new Set(beOf(p).criteria.map((c) => c.label));
    const added: BeCriterion[] = PROPOSED_CRITERIA.filter((l) => !have.has(l)).map((label) => ({ id: uid("bec"), label, source: "", evidence: "", missing: "", state: "À documenter", origin: "Proposition du système" }));
    if (!added.length) return s;
    return sync(event(patch(s, code, (be) => ({ ...be, criteria: [...be.criteria, ...added] })), p, `${added.length} critères de dispense proposés`, "Ajout", "Proposition du système : chaque critère reste à rattacher à sa référence et à sa preuve."), code);
  },

  saveCriterion(s: DemoState, code: string, input: Omit<BeCriterion, "id" | "origin"> & { id?: string }): DemoState {
    const p = find(s, code);
    if (!p || !input.label.trim()) return s;
    const clean = { label: input.label.trim(), source: input.source.trim(), evidence: input.evidence.trim(), missing: input.missing.trim(), state: input.state };
    const next = patch(s, code, (be) => ({
      ...be,
      criteria: input.id ? be.criteria.map((c) => (c.id === input.id ? { ...c, ...clean } : c)) : [...be.criteria, { id: uid("bec"), origin: "Saisie", ...clean }],
    }));
    return sync(event(next, p, `Critère de dispense ${input.id ? "mis à jour" : "ajouté"} — ${clean.label}`, input.id ? "Modification" : "Ajout", `${clean.state}${clean.missing ? `. Manque : ${clean.missing}` : ""}`), code);
  },

  removeCriterion(s: DemoState, code: string, id: string): DemoState {
    return sync(patch(s, code, (be) => ({ ...be, criteria: be.criteria.filter((c) => c.id !== id) })), code);
  },

  saveStudy(s: DemoState, code: string, study: BeStudy): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const clean = Object.fromEntries(Object.entries(study).map(([k, v]) => [k, v.trim()])) as unknown as BeStudy;
    return sync(event(patch(s, code, (be) => ({ ...be, study: clean })), p, "Éléments de l'étude de bioéquivalence enregistrés", "Modification"), code);
  },

  /** One of the two approvals; the strategy is approved once both functions have signed. */
  approve(s: DemoState, code: string, role: "scientific" | "regulatory", by: string): DemoState {
    const p = find(s, code);
    if (!p || !by.trim() || strategyBlocks(beOf(p)).length) return s;
    const next = patch(s, code, (be) => ({ ...be, [role]: { by: by.trim(), at: stamp() } }), true);
    const be = beOf(next.projects.find((x) => x.code === code)!);
    return sync(event(next, p, `Stratégie de bioéquivalence approuvée — ${role === "scientific" ? "responsable scientifique" : "affaires réglementaires"}`, "Approbation", `${be.orientation}. Par ${by.trim()}.${isApproved(be) ? " Les deux approbations sont réunies." : ""}`), code);
  },

  attach(s: DemoState, code: string, names: string[]): DemoState {
    const p = find(s, code);
    const added = names.map((n) => n.trim()).filter(Boolean);
    if (!p || !isApproved(beOf(p)) || !added.length) return s;
    const kind = beOf(p).orientation === "Dispense à examiner" ? "Argumentaire de dispense" : "Rapport d'étude";
    const at = stamp();
    const next = patch(s, code, (be) => {
      const documents = [...beDocuments(be).filter((d) => !added.includes(d.name)), ...added.map((name) => ({ name, at }))];
      return { ...be, documents, deliverable: { kind, name: documents[0].name, at: documents[0].at } };
    }, true);
    return sync(event(next, p, added.length > 1 ? `${added.length} documents rattachés` : `${kind} rattaché`, "Ajout", added.join(", ")), code);
  },

  /** Validates the study (or the waiver argument): the step is closed and the dossier can be prepared. */
  validate(s: DemoState, code: string, by: string, conclusion: string): DemoState {
    const p = find(s, code);
    if (!p || !isApproved(beOf(p)) || !by.trim() || !conclusion.trim()) return s;
    const waiver = beOf(p).orientation === "Dispense à examiner";
    const next = patch(s, code, (be) => ({ ...be, validated: { by: by.trim(), at: stamp(), conclusion: conclusion.trim() } }), true);
    return sync(event(next, p, waiver ? "Argumentaire de dispense validé" : "Étude de bioéquivalence validée", "Approbation", `${conclusion.trim()} — par ${by.trim()}.`), code);
  },

  /** Reopens the validation (new result, document replaced…): the conclusion stays in the history. */
  reopen(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    if (!p || !beOf(p).validated) return s;
    return sync(event(patch(s, code, (be) => ({ ...be, validated: undefined }), true), p, "Validation de l'étude rouverte", "Modification", `Conclusion précédente : ${beOf(p).validated!.conclusion}`), code);
  },

  detach(s: DemoState, code: string, name: string): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const next = patch(s, code, (be) => {
      const documents = beDocuments(be).filter((d) => d.name !== name);
      return { ...be, documents, deliverable: documents.length && be.deliverable ? { ...be.deliverable, name: documents[0].name, at: documents[0].at } : undefined };
    }, true);
    return sync(event(next, p, "Document retiré", "Modification", name), code);
  },
};
