/**
 * Étape 0 — Créer et cadrer le projet.
 *
 * Pure functions: how the sourced values of a project are built from the connected source and the
 * documents, how they are confirmed / corrected / resolved, what is still unknown, and whether the
 * gate G0 can be decided. The store binds the reducers of `cadrage` (see `store.ts`).
 */
import { CURRENT_USER, FAMILY_LABEL, FORMS_BY_FAMILY, TEMPLATE_BY_FAMILY, kindForForm } from "./catalog";
import type { DemoState } from "./data";
import { DEMO_TODAY, addDays, plural } from "./format";
import {
  EXTRACTABLE_KEYS,
  NOTICE_TYPE,
  RCP_TYPE,
  REFERENCE_SOURCE_LABEL,
  candidateValue,
  catalogueSource,
  dosageFromFileName,
  findCandidate,
  readFromDocument,
  type ReferenceCandidate,
} from "./reference-catalog";
import { blankPrincepsData } from "./princeps-defs";
import { stamp, uid, withEvent } from "./state-utils";
import type {
  Activity,
  CadrageDatum,
  CadrageDocState,
  CadrageDocument,
  CadrageEntity,
  DataNature,
  DataSource,
  DosageVariant,
  ExpectedDocument,
  Family,
  Project,
  ProjectCadrage,
  TeamMember,
} from "./types";

/* ------------------------------------------------------------------ */
/* Reference lists                                                     */
/* ------------------------------------------------------------------ */

export const PROCEDURE_UNKNOWN = "À déterminer avec les affaires réglementaires";
export const PROCEDURES = [PROCEDURE_UNKNOWN, "Enregistrement national — médicament générique", "Enregistrement national — autre procédure"];

/** Roles of a project (who examines what). Only the project lead is needed to create the project. */
export const CADRAGE_ROLES = [
  { key: "chef", label: "Chef de projet", detail: "Coordonne le projet et prépare les décisions.", required: true },
  { key: "galenique", label: "Galéniste", detail: "Examine les formulations.", required: false },
  { key: "analytique", label: "Responsable analytique", detail: "Examine les méthodes et les résultats.", required: false },
  { key: "reglementaire", label: "Affaires réglementaires", detail: "Détermine l'applicabilité et revoit le dossier.", required: false },
  { key: "qualite", label: "Qualité", detail: "Intervient selon les procédures de l'entreprise.", required: false },
] as const;

export const IDENTITY_KEYS = ["name", "dci", "form", "dosage", "holder", "country"] as const;
export type IdentityKey = (typeof IDENTITY_KEYS)[number];

const DATA_DEFS: { key: string; label: string; entity: CadrageEntity; critical: boolean }[] = [
  { key: "name", label: "Médicament de référence", entity: "Produit de référence", critical: true },
  { key: "dci", label: "Substance active (DCI)", entity: "Produit de référence", critical: true },
  { key: "form", label: "Forme pharmaceutique", entity: "Produit de référence", critical: true },
  { key: "dosage", label: "Dosage", entity: "Produit de référence", critical: true },
  { key: "holder", label: "Titulaire / fabricant", entity: "Produit de référence", critical: true },
  { key: "country", label: "Pays de la référence", entity: "Produit de référence", critical: true },
  { key: "route", label: "Voie d'administration", entity: "Produit de référence", critical: false },
  { key: "excipients", label: "Excipients déclarés", entity: "Produit de référence", critical: false },
  { key: "excipientQty", label: "Proportions des excipients", entity: "Produit de référence", critical: false },
  { key: "storage", label: "Conditions de conservation", entity: "Produit de référence", critical: false },
  { key: "packaging", label: "Conditionnement", entity: "Produit de référence", critical: false },
  { key: "apiSupplier", label: "Fournisseur du principe actif", entity: "Principe actif", critical: false },
  { key: "bcs", label: "Classe BCS", entity: "Principe actif", critical: false },
];

/** Why a value is usually absent at this stage (shown in the list of unknowns). */
const UNKNOWN_HINTS: Record<string, string> = {
  excipientQty: "Une notice déclare les excipients, pas leurs proportions : inconnu jusqu'à obtention d'une preuve ou d'un essai.",
  apiSupplier: "À identifier pendant la faisabilité, avec sa documentation (DMF/CEP, certificat GMP).",
  bcs: "Non établie : une classe BCS n'est jamais déduite d'un nom seul, elle doit être sourcée.",
};

export const EXPECTED_DOCUMENTS: ExpectedDocument[] = [
  { type: RCP_TYPE, why: "Identité, composition qualitative, conservation et conditionnement du princeps.", neededFor: "G0 — Cadrage" },
  { type: NOTICE_TYPE, why: "Excipients déclarés et informations destinées au patient.", neededFor: "G0 — Cadrage" },
  { type: "Rapport public d'évaluation", why: "Éléments publics sur le développement et la qualité du princeps.", neededFor: "G1 — Faisabilité" },
  { type: "Monographie (pharmacopée)", why: "Essais et limites documentés, selon les droits d'accès.", neededFor: "G1 — Faisabilité" },
  { type: "DMF / CEP du principe actif", why: "Qualité du principe actif chez le fournisseur (partie accessible).", neededFor: "G1 — Faisabilité" },
  { type: "Certificat GMP du fournisseur", why: "Conformité du site de fabrication du principe actif.", neededFor: "G1 — Faisabilité" },
  { type: "Certificat d'analyse du principe actif", why: "Résultats du lot fournisseur.", neededFor: "G1 — Faisabilité" },
  { type: "Fiche de données de sécurité (FDS)", why: "Contraintes de manipulation des matières.", neededFor: "G1 — Faisabilité" },
  { type: "Recherche brevets", why: "Documents, territoires et dates à examiner — pas une conclusion de liberté d'exploitation.", neededFor: "G1 — Faisabilité" },
];

export function familyOfForm(form: string): Family {
  return (Object.keys(FORMS_BY_FAMILY) as Family[]).find((f) => FORMS_BY_FAMILY[f].includes(form)) ?? "Sèche";
}

export const ALL_FORMS = Object.values(FORMS_BY_FAMILY).flat();

/* ------------------------------------------------------------------ */
/* Adapted pathway (seven business steps after the cadrage)            */
/* ------------------------------------------------------------------ */

export interface PathwayStep {
  n: number;
  title: string;
  detail: string;
  gate?: string;
}

const FORMULATION_DETAIL: Record<Family, string> = {
  Sèche: "Pistes de formulation et de procédé (mélange, granulation, compression ou mise en gélule) comparées au princeps.",
  Liquide: "Pistes de formulation et de procédé (mise en solution ou en suspension, conservation, pH) comparées au princeps.",
  "Semi-solide": "Pistes de formulation et de procédé (homogénéisation, texture, viscosité) comparées au princeps.",
};

const QUALITY_DETAIL: Record<Family, string> = {
  Sèche: "Méthodes, spécifications, impuretés, matières premières et lot pilote ; essais pharmacotechniques de la forme sèche.",
  Liquide: "Méthodes, spécifications, impuretés, matières premières et lot pilote ; contrôles microbiologiques selon le produit.",
  "Semi-solide": "Méthodes, spécifications, impuretés, matières premières et lot pilote ; contrôles microbiologiques selon le produit.",
};

/** Steps shown inside the project. Their order is not a strict sequence: several run in parallel. */
export function pathwayFor(family: Family): PathwayStep[] {
  return [
    { n: 1, title: "Sélection & faisabilité", detail: "Ce qui est établi, ce qui manque, ce qui peut bloquer : lancer, compléter, différer ou arrêter.", gate: "G1" },
    { n: 2, title: "Compréhension du princeps", detail: "Caractéristiques à reproduire ou maîtriser ; commence dès les premiers documents.", gate: "G2" },
    { n: 3, title: "Formulation & essais", detail: FORMULATION_DETAIL[family], gate: "G3" },
    { n: 4, title: "Analytique, qualité & lot pilote", detail: QUALITY_DETAIL[family] },
    { n: 5, title: "Stabilité", detail: "Lots, conditions et échéances décidés pour le dossier visé, selon les référentiels du marché." },
    { n: 6, title: "Bioéquivalence / dispense", detail: "Stratégie examinée tôt, car elle peut modifier les choix de formulation.", gate: "G4" },
    { n: 7, title: "Dossier de validation", detail: "Version cohérente et traçable, prête pour validation interne.", gate: "G5" },
  ];
}

/* ------------------------------------------------------------------ */
/* Building the sourced values                                         */
/* ------------------------------------------------------------------ */

const blankData = (): CadrageDatum[] => DATA_DEFS.map((d) => ({ ...d, value: "", status: "Non documentée", history: [] }));

/** Values of the selected entry of the connected source: read, still to be confirmed. */
export function dataFromCandidate(c: ReferenceCandidate, at: string): CadrageDatum[] {
  return blankData().map((d) => {
    if (!(EXTRACTABLE_KEYS as string[]).includes(d.key)) return d;
    const key = d.key as (typeof EXTRACTABLE_KEYS)[number];
    const value = candidateValue(c, key);
    return {
      ...d,
      value,
      originalValue: value,
      status: "Extraite à confirmer",
      source: catalogueSource(c, key),
      history: [{ at, author: "Système", action: "Extraction", value, note: `Lu dans : ${REFERENCE_SOURCE_LABEL}` }],
    };
  });
}

/** Minimal identity typed by the user when no candidate matches: confirmed by its author, without document proof yet. */
export function dataFromManual(fields: Record<IdentityKey, string>, at: string, author = CURRENT_USER): CadrageDatum[] {
  return blankData().map((d) => {
    const value = (fields as Record<string, string | undefined>)[d.key]?.trim();
    if (!value) return d;
    return { ...d, value, status: "Confirmée", history: [{ at, author, action: "Saisie", value, note: "Saisie manuelle — preuve documentaire à rattacher" }] };
  });
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const docLabel = (doc: { name: string; version: number }) => `${doc.name} (v${doc.version})`;
export const isIdentityProof = (type: string) => type === RCP_TYPE || type === NOTICE_TYPE;

/** A document is read automatically only when it is the SmPC or leaflet of a product of the connected source. */
export function isReadable(candidate: ReferenceCandidate | undefined, type: string) {
  return Boolean(candidate) && isIdentityProof(type);
}

const MANUAL_SOURCE = { document: "Saisie manuelle", location: "Sans document", excerpt: "Valeur saisie à la création du projet, sans preuve rattachée." };

/**
 * Reads a document into the values: fills what was unknown, strengthens the proof of a value it
 * confirms, and keeps BOTH values when it disagrees (never a silent replacement).
 */
export function applyDocument(data: CadrageDatum[], candidate: ReferenceCandidate | undefined, doc: CadrageDocument, at: string): CadrageDatum[] {
  if (!isReadable(candidate, doc.type) || !candidate) {
    const found = dosageFromFileName(doc.name);
    if (!found) return data;
    const value = `${found.dosage} ${found.unit}`;
    return data.map((d) =>
      d.key === "dosage" && !d.value
        ? {
            ...d,
            value,
            originalValue: value,
            status: "Extraite à confirmer",
            source: { document: docLabel(doc), location: "Nom du fichier", excerpt: doc.name },
            history: [...d.history, { at, author: "Système", action: "Extraction", value, note: "Lu dans le nom du fichier" }],
          }
        : d,
    );
  }
  return data.map((d) => {
    if (!(EXTRACTABLE_KEYS as string[]).includes(d.key)) return d;
    const read = readFromDocument(candidate, d.key as (typeof EXTRACTABLE_KEYS)[number], doc);
    if (!d.value) {
      return {
        ...d,
        value: read.value,
        originalValue: read.value,
        status: "Extraite à confirmer",
        source: read.source,
        history: [...d.history, { at, author: "Système", action: "Extraction", value: read.value, note: `Lu dans : ${read.source.document}` }],
      };
    }
    if (d.status === "Contradictoire") {
      const known = d.alternatives?.some((a) => same(a.value, read.value) && a.source.document === read.source.document);
      return known ? d : { ...d, alternatives: [...(d.alternatives ?? []), read] };
    }
    if (same(d.value, read.value)) {
      // Same value: the document becomes the proof (stronger than a catalogue entry or a manual entry).
      const weaker = !d.source || d.source.document === REFERENCE_SOURCE_LABEL;
      return weaker ? { ...d, source: read.source, history: [...d.history, { at, author: "Système", action: "Extraction", value: read.value, note: `Valeur retrouvée dans : ${read.source.document}` }] } : d;
    }
    return {
      ...d,
      status: "Contradictoire",
      alternatives: [{ value: d.value, source: d.source ?? MANUAL_SOURCE }, read],
      history: [...d.history, { at, author: "Système", action: "Extraction", value: read.value, note: `Valeur différente lue dans : ${read.source.document}` }],
    };
  });
}

/* ------------------------------------------------------------------ */
/* Reviewing a value                                                   */
/* ------------------------------------------------------------------ */

export const needsReview = (d: CadrageDatum) => d.status === "Extraite à confirmer" || d.status === "Contradictoire";
export const isVerified = (d: CadrageDatum) => d.status === "Confirmée" || d.status === "Corrigée";

export function confirmDatum(d: CadrageDatum, at: string, author = CURRENT_USER): CadrageDatum {
  if (d.status !== "Extraite à confirmer") return d;
  const proposal = d.nature === "Proposition IA";
  return {
    ...d,
    status: "Confirmée",
    // An accepted system proposal becomes a development assumption — it is still not a fact.
    nature: proposal ? "Hypothèse" : d.nature,
    history: [...d.history, { at, author, action: "Confirmation", value: d.value, note: proposal ? "Proposition acceptée comme hypothèse de développement" : undefined }],
  };
}

/** A correction never edits the source file: it creates a new version of the value. */
export function correctDatum(d: CadrageDatum, value: string, note: string, at: string, author = CURRENT_USER, extra?: { nature?: DataNature; source?: DataSource }): CadrageDatum {
  const typed = d.status === "Non documentée";
  return {
    ...d,
    // In the reference product sheet the author states what the value is; its proof replaces the previous one.
    ...(extra ? { nature: extra.nature, source: extra.source } : {}),
    value: value.trim(),
    originalValue: d.originalValue ?? (typed ? undefined : d.value),
    status: typed ? "Confirmée" : "Corrigée",
    alternatives: undefined,
    history: [...d.history, { at, author, action: typed ? "Saisie" : "Correction", value: value.trim(), note: note.trim() || undefined }],
  };
}

/** The responsible person chooses the applicable value of a contradiction, with a justification. */
export function resolveDatum(d: CadrageDatum, value: string, note: string, at: string, author = CURRENT_USER): CadrageDatum {
  const chosen = d.alternatives?.find((a) => a.value === value);
  if (!chosen) return d;
  const rejected = (d.alternatives ?? []).filter((a) => a !== chosen).map((a) => `« ${a.value} » (${a.source.document})`);
  return {
    ...d,
    value: chosen.value,
    source: chosen.source,
    status: "Confirmée",
    alternatives: undefined,
    history: [...d.history, { at, author, action: "Résolution", value: chosen.value, note: `${note.trim()} — valeur écartée : ${rejected.join(", ")}` }],
  };
}

/* ------------------------------------------------------------------ */
/* Reading a cadrage                                                   */
/* ------------------------------------------------------------------ */

export function docState(doc: CadrageDocument, data: CadrageDatum[]): CadrageDocState {
  if (!doc.readable) return "Reçu";
  const label = docLabel(doc);
  const pending = data.some((d) => needsReview(d) && (d.source?.document === label || d.alternatives?.some((a) => a.source.document === label)));
  return pending ? "À revoir" : "Exploitable";
}

export const hasIdentityProof = (c: ProjectCadrage) => c.documents.some((d) => isIdentityProof(d.type));
export const receivedTypes = (c: ProjectCadrage) => new Set(c.documents.map((d) => d.type));
export const missingRoles = (team: TeamMember[]) => CADRAGE_ROLES.filter((r) => !team.find((m) => m.role === r.label)?.person);

export interface InfoQuality {
  total: number;
  verified: number;
  toConfirm: number;
  conflicting: number;
  missing: number;
}

/** Quality of the information: verified / to confirm / contradictory / missing values. */
export function infoQuality(data: CadrageDatum[]): InfoQuality {
  return {
    total: data.length,
    verified: data.filter(isVerified).length,
    toConfirm: data.filter((d) => d.status === "Extraite à confirmer").length,
    conflicting: data.filter((d) => d.status === "Contradictoire").length,
    missing: data.filter((d) => d.status === "Non documentée").length,
  };
}

export interface Unknown {
  id: string;
  kind: "Donnée" | "Document" | "Équipe" | "Périmètre";
  label: string;
  detail: string;
}

/** Everything the project does not know yet: nothing is filled with a made-up value. */
export function cadrageUnknowns(c: ProjectCadrage, team: TeamMember[]): Unknown[] {
  const list: Unknown[] = [];
  for (const d of c.data) {
    if (d.status === "Non documentée") {
      list.push({ id: `d-${d.key}`, kind: "Donnée", label: d.label, detail: UNKNOWN_HINTS[d.key] ?? "Non documenté dans les sources disponibles." });
    } else if (d.status === "Contradictoire") {
      list.push({ id: `c-${d.key}`, kind: "Donnée", label: d.label, detail: "Deux sources divergent : la valeur applicable reste à choisir, avec justification." });
    } else if (d.critical && !d.source) {
      list.push({ id: `m-${d.key}`, kind: "Donnée", label: d.label, detail: "Saisie manuelle : preuve documentaire à rattacher." });
    }
  }
  const received = receivedTypes(c);
  for (const e of c.expected) {
    if (!received.has(e.type)) list.push({ id: `e-${e.type}`, kind: "Document", label: e.type, detail: `Attendu pour ${e.neededFor}. ${e.why}` });
  }
  for (const r of missingRoles(team)) list.push({ id: `r-${r.key}`, kind: "Équipe", label: r.label, detail: `À désigner. ${r.detail}` });
  if (c.procedure === PROCEDURE_UNKNOWN) list.push({ id: "p-procedure", kind: "Périmètre", label: "Procédure d'enregistrement", detail: "À déterminer avec les affaires réglementaires, selon le marché." });
  if (!c.targetDate) list.push({ id: "p-target", kind: "Périmètre", label: "Cible de calendrier", detail: "Aucune date cible définie pour le dossier prêt pour validation interne." });
  return list;
}

export interface GateCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/** Proofs the gate G0 relies on: confirmed identity, scope, first documents. */
export function g0Readiness(p: Project): { ready: boolean; checks: GateCheck[]; alerts: string[] } {
  const c = p.cadrage!;
  const critical = c.data.filter((d) => d.critical);
  const confirmed = critical.filter(isVerified).length;
  const conflicts = c.data.filter((d) => d.status === "Contradictoire");
  const lead = p.team.find((m) => m.role === "Chef de projet")?.person;
  const checks: GateCheck[] = [
    { key: "identite", label: "Identité confirmée", ok: confirmed === critical.length, detail: `${confirmed} / ${critical.length} valeurs d'identité confirmées` },
    {
      key: "contradictions",
      label: "Aucune contradiction non résolue",
      ok: conflicts.length === 0,
      detail: conflicts.length ? `À résoudre : ${conflicts.map((d) => d.label.toLowerCase()).join(", ")}` : "Les sources disponibles concordent",
    },
    { key: "preuve", label: "Document d'identité du princeps", ok: hasIdentityProof(c), detail: hasIdentityProof(c) ? "RCP ou notice reçu" : "RCP ou notice du princeps à importer" },
    { key: "marche", label: "Périmètre de marché", ok: c.markets.length > 0, detail: c.markets.length ? c.markets.join(", ") : "Pays de dépôt à préciser" },
    { key: "variantes", label: "Dosages visés", ok: c.variants.length > 0, detail: c.variants.length ? c.variants.map((v) => `${v.dosage} ${v.unit}`).join(", ") : "Aucun dosage visé" },
    { key: "chef", label: "Chef de projet désigné", ok: Boolean(lead), detail: lead || "À désigner" },
  ];
  const alerts: string[] = [];
  const pending = c.data.filter((d) => d.status === "Extraite à confirmer").length;
  if (pending) alerts.push(`${pending} ${plural(pending, "donnée extraite reste", "données extraites restent")} à confirmer (hors identité).`);
  const roles = missingRoles(p.team).filter((r) => !r.required);
  if (roles.length) alerts.push(`À désigner : ${roles.map((r) => r.label.toLowerCase()).join(", ")}.`);
  if (c.procedure === PROCEDURE_UNKNOWN) alerts.push("La procédure d'enregistrement reste à déterminer avec les affaires réglementaires.");
  return { ready: checks.every((x) => x.ok), checks, alerts };
}

export type NextCardKey = "documents" | "cadrage" | "g0" | "faisabilite" | "attente" | "princeps" | "suite" | "confirmation" | "dossier";

export interface NextCard {
  key: NextCardKey;
  title: string;
  detail: string;
  action: string;
  href: string;
  /** Phase of the project and the gate it is heading to. */
  phase: string;
  gate: string;
  question: string;
}

/** After G3: pilot lot, controls and stability are documented in parallel, towards the gate G4. */
function confirmationCard(p: Project, base: string): NextCard {
  const g4 = { phase: "Confirmation", gate: "G4 — Confirmation", question: "Les résultats requis permettent-ils de préparer le dossier ?" };
  const pilot = p.quality?.pilot.status ?? "À préparer";
  if (pilot !== "Revu") {
    return { ...g4, key: "confirmation", title: "Lot pilote et contrôles à documenter", detail: `La formule est retenue. Méthodes, spécifications, matières premières et lot pilote (${pilot.toLowerCase()}) alimentent la confirmation.`, action: "Ouvrir qualité & lot pilote", href: `${base}/qualite` };
  }
  if (!p.stability?.conclusion) {
    return { ...g4, key: "confirmation", title: p.stability?.approvedAt ? "Résultats de stabilité à réunir" : "Plan de stabilité à approuver", detail: "Le lot pilote est revu. Les échéances requises pour le dossier doivent être approuvées avant de conclure.", action: "Ouvrir la stabilité", href: `${base}/stabilite` };
  }
  const be = p.bioequivalence;
  if (!be?.scientific || !be.regulatory) {
    return {
      ...g4,
      key: "confirmation",
      title: be?.orientation ? "Stratégie de bioéquivalence à faire approuver" : "Stratégie de bioéquivalence à préparer",
      detail: "Lot pilote revu et conclusion de stabilité approuvée. Quelle stratégie démonstrative est pertinente, et quelles preuves manquent pour la soutenir ?",
      action: "Ouvrir la bioéquivalence",
      href: `${base}/bioequivalence`,
    };
  }
  if (!be.validated) {
    return { ...g4, key: "confirmation", title: be.orientation === "Dispense à examiner" ? "Argumentaire de dispense à valider" : "Étude de bioéquivalence à valider", detail: "La stratégie est approuvée. Validez l'étude, avec sa conclusion, pour passer à la préparation du dossier.", action: "Valider l'étude", href: `${base}/bioequivalence` };
  }
  const v = p.validation;
  const href = `${base}/dossier`;
  if (v?.g4?.choice !== "Préparer le dossier") {
    return { ...g4, key: "confirmation", title: v?.g4 ? "Compléments demandés à la porte G4" : "Confirmation à décider (porte G4)", detail: v?.g4 ? `Décision : « ${v.g4.justification} »` : "Lot pilote, stabilité et stratégie de bioéquivalence sont réunis. Les résultats requis permettent-ils de préparer le dossier ?", action: "Ouvrir le dossier", href };
  }
  const g5 = { phase: "Dossier", gate: "G5 — Dossier", question: "Peut-on transmettre une version cohérente et traçable pour validation interne ?", key: "dossier" as const, href };
  if (v.snapshots[0]?.version === v.version) {
    return { ...g5, title: v.transmittedAt ? "Dossier transmis pour validation interne" : "Dossier prêt pour validation interne", detail: `La version ${v.version} est figée : sections, contrôles et décisions sont conservés tels quels.`, action: "Voir le dossier" };
  }
  return { ...g5, title: v.reviewStartedAt ? "Dossier en revue" : "Dossier de validation à constituer", detail: v.reviewStartedAt ? "Les sections sont à approuver ; les commentaires sont à traiter avant de figer la version." : "Sections requises, brouillons, contrôles de cohérence puis revue interne.", action: "Ouvrir le dossier" };
}

/** First card of the project: what the user should look at now, and where. */
export function nextCard(p: Project): NextCard {
  const c = p.cadrage!;
  const base = `/projets/${p.slug}`;
  if (c.g0.status === "Approuvée") {
    const last = p.feasibility?.decisions[0];
    if (last?.choice === "Lancer") {
      const version = p.princeps?.versions[0];
      if (version && p.formulation?.decision) return confirmationCard(p, base);
      if (version) {
        const trials = p.formulation?.trials.length ?? 0;
        return {
          key: "suite",
          title: "Formule à sélectionner (porte G3)",
          detail: trials
            ? `${trials} essai(s) enregistré(s). Comparez les résultats vérifiés aux caractéristiques cibles, puis retenez une formule et un procédé.`
            : `La fiche princeps v${version.n} est validée. Préparez les pistes de formulation et le plan d'essais.`,
          action: "Ouvrir la formulation",
          href: `${base}/formulation`,
          phase: "Formulation",
          gate: "G3 — Sélection",
          question: "Quelle formule et quel procédé poursuivre ?",
        };
      }
      return {
        key: "princeps",
        title: "Fiche princeps à valider (porte G2)",
        detail: "Quelles caractéristiques devons-nous reproduire ou maîtriser, et lesquelles restent inconnues ?",
        action: "Ouvrir la fiche princeps",
        href: `${base}/princeps`,
        phase: "Compréhension du princeps",
        gate: "G2 — Stratégie",
        question: "Quelles formulations et quels essais explorer ?",
      };
    }
    if (last?.choice === "Différer" || last?.choice === "Arrêter") {
      const stopped = last.choice === "Arrêter";
      return {
        key: "attente",
        title: stopped ? "Projet arrêté à la faisabilité" : "Projet différé à la faisabilité",
        detail: `Décision du comité : « ${last.justification} »`,
        action: "Voir la décision",
        href: `${base}/faisabilite`,
        phase: stopped ? "Arrêté" : "Différé",
        gate: "G1 — Faisabilité",
        question: "Lancer, compléter, différer ou arrêter ?",
      };
    }
    return {
      key: "faisabilite",
      title: last ? "Faisabilité à compléter" : "Faisabilité à préparer",
      detail: last
        ? `Le comité a demandé des compléments : « ${last.justification} »`
        : "Le cadrage est validé. Le projet mérite-t-il d'être engagé avec nos capacités, nos délais et les informations disponibles ?",
      action: "Ouvrir la faisabilité",
      href: `${base}/faisabilite`,
      phase: "Faisabilité",
      gate: "G1 — Faisabilité",
      question: "Lancer, compléter, différer ou arrêter ?",
    };
  }
  const g0 = { href: `${base}/cadrage`, phase: "Cadrage", gate: "G0 — Cadrage", question: "Quel produit et quel marché développons-nous ?" };
  const review = c.data.filter(needsReview).length;
  if (review) {
    return { ...g0, key: "documents", title: "Documents à examiner", detail: `${review} ${plural(review, "donnée lue dans les documents attend", "données lues dans les documents attendent")} votre confirmation, extrait source à l'appui.`, action: "Examiner les données" };
  }
  const { ready, checks } = g0Readiness(p);
  if (!ready) {
    return { ...g0, key: "cadrage", title: "Cadrage à compléter", detail: `Il manque : ${checks.filter((x) => !x.ok).map((x) => x.label.toLowerCase()).join(", ")}.`, action: "Compléter le cadrage" };
  }
  return { ...g0, key: "g0", title: "Cadrage à valider (porte G0)", detail: "Les preuves sont réunies : identité confirmée, périmètre et documents initiaux. Le produit et le marché peuvent être décidés.", action: "Examiner et décider" };
}

/* ------------------------------------------------------------------ */
/* Activities derived from the pathway                                 */
/* ------------------------------------------------------------------ */

interface Task {
  task: string;
  title: string;
  detail: string;
  done: boolean;
  icon: Activity["icon"];
  tag: string;
  href: string;
}

/** A task exists because an information is missing or a decision is to be applied — nothing else. */
function desiredTasks(p: Project): Task[] {
  const c = p.cadrage!;
  const base = `/projets/${p.slug}`;
  const pending = allData(p).filter((d) => d.status === "Extraite à confirmer");
  const conflicts = allData(p).filter((d) => d.status === "Contradictoire");
  const roles = missingRoles(p.team);
  const cadrageTask = { tag: "Cadrage", href: `${base}/cadrage` };
  const tasks: Task[] = [
    { ...cadrageTask, task: "donnees", title: "Vérifier les données extraites", detail: pending.length ? `${pending.length} ${plural(pending.length, "valeur")} à confirmer avec son extrait source` : "Toutes les valeurs extraites sont confirmées", done: pending.length === 0, icon: "doc" },
    { ...cadrageTask, task: "contradiction", title: "Résoudre une contradiction entre sources", detail: conflicts.length ? `Choisir la valeur applicable : ${conflicts.map((d) => d.label.toLowerCase()).join(", ")}` : "Aucune contradiction en attente", done: conflicts.length === 0, icon: "review" },
    { ...cadrageTask, task: "preuve-identite", title: "Obtenir le RCP ou la notice du princeps", detail: "Document d'identité attendu pour la porte G0", done: hasIdentityProof(c), icon: "doc" },
    { ...cadrageTask, task: "equipe", title: "Désigner les responsables manquants", detail: roles.length ? roles.map((r) => r.label).join(", ") : "L'équipe est complète", done: roles.length === 0, icon: "review" },
    { ...cadrageTask, task: "g0", title: "Valider le cadrage (porte G0)", detail: "Quel produit et quel marché développons-nous ?", done: c.g0.status === "Approuvée", icon: "review" },
  ];
  if (c.g0.status !== "Approuvée") return tasks;
  const last = p.feasibility?.decisions[0];
  tasks.push({ task: "faisabilite", title: "Décider de la faisabilité (porte G1)", detail: "Lancer, compléter, différer ou arrêter — avec ce qui est établi, ce qui manque et ce qui peut bloquer", done: Boolean(last && last.choice !== "Compléter"), icon: "review", tag: "Faisabilité", href: `${base}/faisabilite` });
  if (last?.choice === "Lancer") {
    tasks.push({ task: "princeps", title: "Valider la fiche princeps (porte G2)", detail: "Caractéristiques cibles, inconnues restantes et stratégie initiale", done: Boolean(p.princeps?.versions.length), icon: "review", tag: "Princeps", href: `${base}/princeps` });
    if (p.princeps?.versions.length) {
      tasks.push({ task: "formulation", title: "Retenir une formule et un procédé (porte G3)", detail: "Pistes, essais vérifiés et comparaison aux caractéristiques cibles", done: Boolean(p.formulation?.decision), icon: "flask", tag: "Formulation", href: `${base}/formulation` });
      if (p.formulation?.decision) {
        tasks.push({ task: "pilote", title: "Fabriquer et revoir le lot pilote", detail: "Prérequis, autorisation interne, fabrication, écarts et revue du lot", done: p.quality?.pilot.status === "Revu", icon: "box", tag: "Qualité", href: `${base}/qualite` });
        tasks.push({ task: "stabilite", title: "Approuver la conclusion de stabilité", detail: "Plan approuvé, échéances requises approuvées, conclusion scientifique", done: Boolean(p.stability?.conclusion), icon: "review", tag: "Stabilité", href: `${base}/stabilite` });
        tasks.push({ task: "bioequivalence", title: "Approuver la stratégie et valider l'étude de bioéquivalence", detail: "Stratégie approuvée par les responsables scientifique et réglementaire, puis étude validée avec sa conclusion", done: Boolean(p.bioequivalence?.scientific && p.bioequivalence.regulatory && p.bioequivalence.validated), icon: "review", tag: "Bioéquivalence", href: `${base}/bioequivalence` });
        const v = p.validation;
        tasks.push({ task: "g4", title: "Décider la confirmation (porte G4)", detail: "Les résultats requis permettent-ils de préparer le dossier ?", done: v?.g4?.choice === "Préparer le dossier", icon: "review", tag: "Dossier", href: `${base}/dossier` });
        if (v?.g4?.choice === "Préparer le dossier") {
          tasks.push({ task: "dossier", title: "Préparer le dossier pour validation interne (porte G5)", detail: "Sections, contrôles de cohérence, revue puis version figée", done: v.snapshots[0]?.version === v.version, icon: "doc", tag: "Dossier", href: `${base}/dossier` });
        }
      }
    }
  }
  return tasks;
}

/** Re-aligns the activities, the phase and the next action of a project with where it stands in the pathway. */
export function sync(s: DemoState, code: string): DemoState {
  const p = s.projects.find((x) => x.code === code);
  if (!p?.cadrage) return s;
  let activities = s.activities;
  for (const t of desiredTasks(p)) {
    const existing = activities.find((a) => a.projectCode === code && a.cadrageTask === t.task);
    const look = t.done
      ? { done: true, state: "terminee" as const, status: { label: "Terminée", tone: "success" as const } }
      : { done: false, state: "a-faire" as const, status: { label: "À faire", tone: "warn" as const } };
    if (existing) {
      activities = activities.map((a) => (a === existing ? { ...a, ...look, detail: t.detail } : a));
    } else if (!t.done) {
      activities = [
        ...activities,
        { id: uid("act"), projectCode: code, title: t.title, detail: t.detail, tags: [code, t.tag], due: p.cadrage.startDate || DEMO_TODAY, owner: p.owner, icon: t.icon, kind: "standard", href: t.href, cadrageTask: t.task, ...look },
      ];
    }
  }
  const card = nextCard(p);
  const paused = card.key === "attente";
  const next: Project = {
    ...p,
    stage: { label: card.phase, icon: card.key === "confirmation" || card.key === "dossier" ? "chart" : card.key === "princeps" || card.key === "suite" ? "flask" : "compass" },
    phase: card.phase,
    phaseTone: paused ? "warn" : "info",
    track: { label: card.phase, tone: card.phase === "Cadrage" ? "neutral" : "info" },
    globalStatus: paused ? "En attente" : "En cours",
    journeyStep: card.key === "dossier" ? 4 : card.key === "confirmation" ? 3 : card.key === "princeps" || card.key === "suite" ? 2 : 1,
    objective: { title: card.title, detail: `Porte ${card.gate}` },
    nextAction: { date: p.cadrage.startDate || p.createdAt, label: card.title },
    nextStep: card.title,
    milestone: { ...p.milestone, title: card.gate, detail: card.question },
    portfolioAction: { label: card.action, href: card.href, variant: "primary" },
  };
  return { ...s, activities, projects: s.projects.map((x) => (x.code === code ? next : x)) };
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

export interface CadrageInput {
  code: string;
  name: string;
  /** Pharmaceutical form of the product to develop. */
  form: string;
  cadrage: Omit<ProjectCadrage, "g0">;
  /** Person per role key of `CADRAGE_ROLES`. */
  team: Record<string, string>;
}

function patch(s: DemoState, code: string, update: (c: ProjectCadrage, p: Project) => ProjectCadrage): DemoState {
  return { ...s, projects: s.projects.map((p) => (p.code === code && p.cadrage ? { ...p, cadrage: update(p.cadrage, p) } : p)) };
}

/** Applies a change to the values of both sheets: identity (cadrage) and reference product (étape 2). */
function patchData(s: DemoState, code: string, update: (d: CadrageDatum) => CadrageDatum): DemoState {
  return {
    ...s,
    projects: s.projects.map((p) =>
      p.code === code && p.cadrage
        ? { ...p, cadrage: { ...p.cadrage, data: p.cadrage.data.map(update) }, princeps: p.princeps && { ...p.princeps, data: p.princeps.data.map(update) } }
        : p,
    ),
  };
}

/** Every sourced value of a project: identity sheet first, then the reference product sheet. */
export const allData = (p: Project): CadrageDatum[] => [...(p.cadrage?.data ?? []), ...(p.princeps?.data ?? [])];
const sheetHref = (s: DemoState, code: string, key: string) =>
  `/projets/${slugOf(code)}/${s.projects.find((p) => p.code === code)?.princeps?.data.some((d) => d.key === key) ? "princeps" : "cadrage"}`;

const label = (s: DemoState, code: string) => {
  const p = s.projects.find((x) => x.code === code);
  return p ? `${p.code} • ${p.name}` : code;
};
const slugOf = (code: string) => code.toLowerCase();
const datumOf = (s: DemoState, code: string, key: string) => {
  const p = s.projects.find((x) => x.code === code);
  return p ? allData(p).find((d) => d.key === key) : undefined;
};

export const cadrage = {
  /** Creates the project space: identity sheet, market scope, team, variants, first documents, unknowns. */
  create(s: DemoState, input: CadrageInput): DemoState {
    const code = input.code.trim().toUpperCase();
    const slug = slugOf(code);
    const family = familyOfForm(input.form);
    const c: ProjectCadrage = { ...input.cadrage, g0: { status: "Attendue" } };
    const start = c.startDate || DEMO_TODAY;
    const lead = input.team.chef || CURRENT_USER;
    const dosages = c.variants.map((v) => `${v.dosage} ${v.unit}`).join(" / ");
    const dci = c.data.find((d) => d.key === "dci")?.value ?? "";
    const project: Project = {
      code,
      slug,
      name: input.name.trim(),
      kind: kindForForm(input.form),
      family,
      form: input.form,
      formLabel: FAMILY_LABEL[family],
      portfolioSubtitle: `Générique de ${c.reference.name} — ${input.form.toLowerCase()} ${dosages}`,
      description: `Développement d'un générique de ${c.reference.name} (${c.reference.country})`,
      dci,
      dosage: dosages,
      countries: c.markets,
      referenceProduct: `${c.reference.name} — ${c.reference.holder} (${c.reference.country})`,
      template: TEMPLATE_BY_FAMILY[family],
      stage: { label: "Cadrage", icon: "compass" },
      phase: "Cadrage",
      phaseTone: "info",
      track: { label: "Cadrage", tone: "neutral" },
      objective: { title: "Cadrage à valider", detail: "Porte G0 — Cadrage" },
      nextAction: { date: start, label: "Cadrage à valider" },
      nextStep: "Cadrage à valider",
      targetDate: c.targetDate || addDays(start, 365),
      globalStatus: "En cours",
      owner: lead,
      team: CADRAGE_ROLES.map((r) => ({ role: r.label, person: input.team[r.key] ?? "" })),
      createdAt: DEMO_TODAY,
      updatedAt: DEMO_TODAY,
      journeyStep: 1,
      milestone: { title: "G0 — Cadrage", detail: "Quel produit et quel marché développons-nous ?", date: addDays(start, 14), owner: lead },
      portfolioAction: { label: "Ouvrir le cadrage", href: `/projets/${slug}/cadrage`, variant: "primary" },
      archived: false,
      cadrage: c,
      feasibility: { answers: [], patents: [], decisions: [] },
      princeps: { data: blankPrincepsData(), trials: [], versions: [] },
    };
    const q = infoQuality(c.data);
    let next: DemoState = { ...s, projects: [...s.projects, project] };
    next = withEvent(next, {
      projectCode: code,
      title: "Projet créé et cadré",
      context: `${code} • ${project.name}`,
      object: "Projet",
      objectLabel: `${code} • ${project.name}`,
      type: "Création",
      description: `Référence : ${project.referenceProduct}. Marché visé : ${c.markets.join(", ")}. ${c.variants.length} ${plural(c.variants.length, "variante")} de dosage, ${c.documents.length} ${plural(c.documents.length, "document")} initial${c.documents.length > 1 ? "aux" : ""}. Données : ${q.verified} vérifiées, ${q.toConfirm} à confirmer, ${q.conflicting} contradictoires, ${q.missing} non documentées.`,
      icon: "folder",
      href: `/projets/${slug}/cadrage`,
    });
    return sync(next, code);
  },

  confirm(s: DemoState, code: string, keys: string[]): DemoState {
    const at = stamp();
    const targets = keys.map((k) => datumOf(s, code, k)).filter((d): d is CadrageDatum => d?.status === "Extraite à confirmer");
    if (!targets.length) return s;
    let next = patchData(s, code, (d) => (keys.includes(d.key) ? confirmDatum(d, at) : d));
    next = withEvent(next, {
      projectCode: code,
      title: targets.length > 1 ? `${targets.length} données confirmées` : `Donnée confirmée — ${targets[0].label}`,
      context: label(s, code),
      object: "Projet",
      objectLabel: `${label(s, code)} • Fiche produit`,
      type: "Approbation",
      description: targets.map((d) => `${d.label} : ${d.value} (${d.source?.document ?? "saisie"})`).join(" · "),
      icon: "check",
      href: `/projets/${slugOf(code)}/cadrage`,
    });
    return sync(next, code);
  },

  correct(s: DemoState, code: string, key: string, value: string, note: string, extra?: { nature?: DataNature; source?: DataSource }): DemoState {
    const before = datumOf(s, code, key);
    if (!before || !value.trim()) return s;
    let next = patchData(s, code, (d) => (d.key === key ? correctDatum(d, value, note, stamp(), CURRENT_USER, extra) : d));
    next = withEvent(next, {
      projectCode: code,
      title: before.value ? `Donnée corrigée — ${before.label}` : `Donnée renseignée — ${before.label}`,
      context: label(s, code),
      object: "Projet",
      objectLabel: `${label(s, code)} • Fiche produit`,
      type: before.value ? "Correction" : "Ajout",
      field: before.label,
      oldValue: before.value || "Non documentée",
      newValue: value.trim(),
      motif: note.trim() || undefined,
      icon: "edit",
      href: sheetHref(s, code, key),
    });
    return sync(next, code);
  },

  resolve(s: DemoState, code: string, key: string, value: string, note: string): DemoState {
    const before = datumOf(s, code, key);
    if (!before || before.status !== "Contradictoire") return s;
    let next = patchData(s, code, (d) => (d.key === key ? resolveDatum(d, value, note, stamp()) : d));
    next = withEvent(next, {
      projectCode: code,
      title: `Contradiction résolue — ${before.label}`,
      context: label(s, code),
      object: "Décision",
      objectLabel: `${label(s, code)} • ${before.label}`,
      type: "Approbation",
      field: before.label,
      oldValue: (before.alternatives ?? []).map((a) => a.value).join(" ≠ "),
      newValue: value,
      motif: note.trim(),
      icon: "check",
      href: `/projets/${slugOf(code)}/cadrage`,
    });
    return sync(next, code);
  },

  /** Receives a document: the original is kept, then read into the values when it can be. */
  addDocument(s: DemoState, code: string, file: { name: string; size: string; type: string }): DemoState {
    const p = s.projects.find((x) => x.code === code);
    if (!p?.cadrage) return s;
    const at = stamp();
    const candidate = findCandidate(p.cadrage.candidateId);
    const version = p.cadrage.documents.filter((d) => d.name === file.name).length + 1;
    const readable = isReadable(candidate, file.type);
    const doc: CadrageDocument = { id: uid("cdoc"), ...file, version, receivedAt: at, readable, note: readable ? undefined : unreadNote(file.type) };
    const before = infoQuality(p.cadrage.data);
    let next = patch(s, code, (c) => ({ ...c, documents: [...c.documents, doc], data: applyDocument(c.data, candidate, doc, at) }));
    const after = infoQuality(next.projects.find((x) => x.code === code)!.cadrage!.data);
    next = withEvent(next, {
      projectCode: code,
      title: `Document reçu — ${file.type}`,
      context: label(s, code),
      object: "Document",
      objectLabel: `${label(s, code)} • ${file.name}`,
      type: "Ajout",
      description: readable
        ? `${file.name} (v${version}) lu : ${Math.max(0, before.missing - after.missing)} valeur(s) renseignée(s), ${Math.max(0, after.conflicting - before.conflicting)} contradiction(s) détectée(s). Les valeurs approuvées ne sont jamais remplacées silencieusement.`
        : `${file.name} (v${version}) conservé comme preuve à examiner.`,
      icon: "doc",
      href: `/projets/${slugOf(code)}/cadrage`,
    });
    return sync(next, code);
  },

  addVariant(s: DemoState, code: string, dosage: string, unit: string): DemoState {
    const value = dosage.trim().replace(",", ".");
    const p = s.projects.find((x) => x.code === code);
    if (!p?.cadrage || !value || p.cadrage.variants.some((v) => v.dosage === value && v.unit === unit)) return s;
    let next = patch(s, code, (c) => ({ ...c, variants: [...c.variants, { id: uid("var"), dosage: value, unit, reference: false }] }));
    next = { ...next, projects: next.projects.map((x) => (x.code === code ? { ...x, dosage: x.cadrage!.variants.map((v) => `${v.dosage} ${v.unit}`).join(" / ") } : x)) };
    next = withEvent(next, {
      projectCode: code,
      title: `Variante de dosage ajoutée — ${value} ${unit}`,
      context: label(s, code),
      object: "Projet",
      objectLabel: `${label(s, code)} • Variantes de dosage`,
      type: "Ajout",
      description: "Les preuves communes sont partagées ; aucune conclusion d'un autre dosage n'est étendue automatiquement à cette variante.",
      icon: "edit",
      href: `/projets/${slugOf(code)}/cadrage`,
    });
    return sync(next, code);
  },

  removeVariant(s: DemoState, code: string, id: string): DemoState {
    const p = s.projects.find((x) => x.code === code);
    const variant = p?.cadrage?.variants.find((v) => v.id === id);
    if (!p?.cadrage || !variant || p.cadrage.variants.length < 2) return s;
    let next = patch(s, code, (c) => ({ ...c, variants: c.variants.filter((v) => v.id !== id) }));
    next = { ...next, projects: next.projects.map((x) => (x.code === code ? { ...x, dosage: x.cadrage!.variants.map((v) => `${v.dosage} ${v.unit}`).join(" / ") } : x)) };
    next = withEvent(next, {
      projectCode: code,
      title: `Variante de dosage retirée — ${variant.dosage} ${variant.unit}`,
      context: label(s, code),
      object: "Projet",
      objectLabel: `${label(s, code)} • Variantes de dosage`,
      type: "Suppression",
      icon: "edit",
      href: `/projets/${slugOf(code)}/cadrage`,
    });
    return sync(next, code);
  },

  updateScope(s: DemoState, code: string, scope: { markets: string[]; procedure: string; startDate: string; targetDate: string; team: Record<string, string> }): DemoState {
    const p = s.projects.find((x) => x.code === code);
    if (!p?.cadrage) return s;
    const team = CADRAGE_ROLES.map((r) => ({ role: r.label, person: scope.team[r.key] ?? "" }));
    let next = patch(s, code, (c) => ({ ...c, markets: scope.markets, procedure: scope.procedure, startDate: scope.startDate, targetDate: scope.targetDate }));
    next = {
      ...next,
      projects: next.projects.map((x) => (x.code === code ? { ...x, countries: scope.markets, team, owner: scope.team.chef || x.owner, targetDate: scope.targetDate || x.targetDate } : x)),
    };
    next = withEvent(next, {
      projectCode: code,
      title: "Périmètre et équipe modifiés",
      context: label(s, code),
      object: "Projet",
      objectLabel: `${label(s, code)} • Périmètre`,
      type: "Modification",
      description: `Marché visé : ${scope.markets.join(", ") || "à préciser"}. Procédure : ${scope.procedure}. Équipe : ${team.filter((m) => m.person).map((m) => `${m.role} — ${m.person}`).join(", ") || "à désigner"}.`,
      icon: "edit",
      href: `/projets/${slugOf(code)}/cadrage`,
    });
    return sync(next, code);
  },

  /** Gate G0: the decision keeps its author, date, reason — and is refused while a proof is missing. */
  approveG0(s: DemoState, code: string, justification: string): DemoState {
    const p = s.projects.find((x) => x.code === code);
    if (!p?.cadrage || p.cadrage.g0.status === "Approuvée" || !g0Readiness(p).ready || !justification.trim()) return s;
    let next = patch(s, code, (c) => ({ ...c, g0: { status: "Approuvée", decidedAt: stamp(), decidedBy: CURRENT_USER, justification: justification.trim() } }));
    next = withEvent(next, {
      projectCode: code,
      title: "Porte G0 approuvée — cadrage validé",
      context: label(s, code),
      object: "Décision",
      objectLabel: `${label(s, code)} • G0 — Cadrage`,
      type: "Approbation",
      field: "G0 — Cadrage",
      oldValue: "Attendue",
      newValue: "Approuvée",
      motif: justification.trim(),
      description: `Produit : ${p.referenceProduct}, ${p.form.toLowerCase()} ${p.dosage}. Marché : ${p.cadrage.markets.join(", ")}.`,
      icon: "check",
      href: `/projets/${slugOf(code)}/cadrage`,
    });
    return sync(next, code);
  },
};

export function unreadNote(type: string) {
  return isIdentityProof(type)
    ? "Lecture automatique non connectée pour ce produit dans cette version : le fichier est conservé comme preuve, les valeurs restent à saisir et à confirmer."
    : "Type de document non lu automatiquement dans cette version : il est conservé comme preuve à examiner.";
}

export type { DosageVariant };
