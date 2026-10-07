/**
 * Connected documentary source of the prototype: a small catalogue of FICTITIOUS reference products
 * ("Princeps A/B/C"). It stands in for a real search of authorised medicines; no entry describes a
 * marketed product. The same brand deliberately exists in several presentations and countries:
 * a name alone never identifies the product to develop.
 */
import type { DataSource } from "./types";

export const REFERENCE_SOURCE_LABEL = "Catalogue de démonstration (produits fictifs)";

export interface ReferenceCandidate {
  id: string;
  name: string;
  dci: string;
  form: string;
  dosage: string;
  unit: string;
  holder: string;
  country: string;
  route: string;
  excipients: string[];
  storage: string;
  /** Storage condition printed in the SmPC when it differs from the catalogue entry (shows a contradiction). */
  storageInRcp?: string;
  packaging: string;
}

export const REFERENCE_CANDIDATES: ReferenceCandidate[] = [
  {
    id: "ref-a-500-tn",
    name: "Princeps A",
    dci: "Principe actif A",
    form: "Comprimé",
    dosage: "500",
    unit: "mg",
    holder: "Laboratoire Exemple A",
    country: "Tunisie",
    route: "Voie orale",
    excipients: ["Cellulose microcristalline", "Povidone", "Croscarmellose sodique", "Stéarate de magnésium"],
    storage: "À conserver à une température ne dépassant pas 30 °C",
    packaging: "Plaquettes PVC/aluminium, boîte de 20",
  },
  {
    id: "ref-a-1000-tn",
    name: "Princeps A",
    dci: "Principe actif A",
    form: "Comprimé",
    dosage: "1000",
    unit: "mg",
    holder: "Laboratoire Exemple A",
    country: "Tunisie",
    route: "Voie orale",
    excipients: ["Cellulose microcristalline", "Povidone", "Croscarmellose sodique", "Stéarate de magnésium"],
    storage: "À conserver à une température ne dépassant pas 30 °C",
    packaging: "Plaquettes PVC/aluminium, boîte de 10",
  },
  {
    id: "ref-a-500-fr",
    name: "Princeps A",
    dci: "Principe actif A",
    form: "Comprimé",
    dosage: "500",
    unit: "mg",
    holder: "Titulaire Exemple Europe",
    country: "France",
    route: "Voie orale",
    excipients: ["Cellulose microcristalline", "Hypromellose", "Amidon prégélatinisé", "Stéarate de magnésium"],
    storage: "Pas de précautions particulières de conservation",
    packaging: "Plaquettes PVC/PVDC/aluminium, boîte de 16",
  },
  {
    id: "ref-b-20-tn",
    name: "Princeps B",
    dci: "Principe actif B",
    form: "Gélule",
    dosage: "20",
    unit: "mg",
    holder: "Laboratoire Exemple B",
    country: "Tunisie",
    route: "Voie orale",
    excipients: ["Lactose monohydraté", "Amidon de maïs", "Talc", "Gélatine (enveloppe)"],
    storage: "À conserver à une température ne dépassant pas 25 °C",
    storageInRcp: "À conserver à une température ne dépassant pas 30 °C, à l'abri de l'humidité",
    packaging: "Flacon PEHD avec dessicant, boîte de 28",
  },
  {
    id: "ref-b-40-tn",
    name: "Princeps B",
    dci: "Principe actif B",
    form: "Gélule",
    dosage: "40",
    unit: "mg",
    holder: "Laboratoire Exemple B",
    country: "Tunisie",
    route: "Voie orale",
    excipients: ["Lactose monohydraté", "Amidon de maïs", "Talc", "Gélatine (enveloppe)"],
    storage: "À conserver à une température ne dépassant pas 25 °C",
    packaging: "Flacon PEHD avec dessicant, boîte de 28",
  },
  {
    id: "ref-c-50-ma",
    name: "Princeps C",
    dci: "Principe actif C",
    form: "Suspension buvable",
    dosage: "50",
    unit: "mg/mL",
    holder: "Laboratoire Exemple C",
    country: "Maroc",
    route: "Voie orale",
    excipients: ["Saccharose", "Gomme xanthane", "Benzoate de sodium", "Arôme fraise", "Eau purifiée"],
    storage: "À conserver à une température ne dépassant pas 25 °C. Ne pas congeler",
    packaging: "Flacon en verre brun de 100 mL avec seringue doseuse",
  },
];

const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Candidates of the connected source whose brand or active substance matches the query. */
export function identifyReference(query: string): ReferenceCandidate[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  return REFERENCE_CANDIDATES.filter((c) => normalize(c.name).includes(q) || q.includes(normalize(c.name)) || normalize(c.dci).includes(q));
}

export const findCandidate = (id?: string) => REFERENCE_CANDIDATES.find((c) => c.id === id);

/** Other presentations of the same brand in the same country (proposed as dosage variants). */
export function siblingDosages(candidate: ReferenceCandidate) {
  return REFERENCE_CANDIDATES.filter((c) => c.id !== candidate.id && c.name === candidate.name && c.country === candidate.country && c.form === candidate.form);
}

export const candidateLabel = (c: ReferenceCandidate) => `${c.name} ${c.dosage} ${c.unit}, ${c.form.toLowerCase()}`;

/** Keys of the values the catalogue and a reference document can provide. */
export type ExtractableKey = "name" | "dci" | "form" | "dosage" | "holder" | "country" | "route" | "excipients" | "storage" | "packaging";

export function candidateValue(c: ReferenceCandidate, key: ExtractableKey): string {
  switch (key) {
    case "dosage":
      return `${c.dosage} ${c.unit}`;
    case "excipients":
      return c.excipients.join(", ");
    default:
      return c[key];
  }
}

/** Source of a value taken from the catalogue entry itself (before any document is read). */
export function catalogueSource(c: ReferenceCandidate, key: ExtractableKey): DataSource {
  return {
    document: REFERENCE_SOURCE_LABEL,
    location: `Fiche ${c.id.toUpperCase()} — ${c.country}`,
    excerpt: `${candidateLabel(c)} — ${c.holder} (${c.country}). ${LABELS[key]} : ${candidateValue(c, key)}.`,
  };
}

const LABELS: Record<ExtractableKey, string> = {
  name: "Dénomination",
  dci: "Substance active",
  form: "Forme pharmaceutique",
  dosage: "Dosage",
  holder: "Titulaire",
  country: "Pays",
  route: "Voie d'administration",
  excipients: "Excipients",
  storage: "Conservation",
  packaging: "Conditionnement",
};

/** Heading of an SmPC (or part of a leaflet) where each value is printed, with the simulated excerpt. */
const SECTIONS: Record<ExtractableKey, { rcp: string; notice: string; text: (c: ReferenceCandidate, v: string) => string }> = {
  name: { rcp: "Rubrique 1 — Dénomination du médicament · page 1", notice: "En-tête de la notice · page 1", text: (c, v) => `${v} ${c.dosage} ${c.unit}, ${c.form.toLowerCase()}` },
  dci: { rcp: "Rubrique 2 — Composition qualitative et quantitative · page 1", notice: "Que contient cette notice ? · page 1", text: (c, v) => `Chaque ${c.form.toLowerCase()} contient ${c.dosage} ${c.unit} de ${v.toLowerCase()}.` },
  form: { rcp: "Rubrique 3 — Forme pharmaceutique · page 1", notice: "Aspect et contenu de l'emballage · page 4", text: (_c, v) => `${v}.` },
  dosage: { rcp: "Rubrique 2 — Composition qualitative et quantitative · page 1", notice: "Que contient cette notice ? · page 1", text: (c, v) => `Chaque ${c.form.toLowerCase()} contient ${v} de ${c.dci.toLowerCase()}.` },
  holder: { rcp: "Rubrique 7 — Titulaire de l'autorisation de mise sur le marché · page 6", notice: "Titulaire et fabricant · page 4", text: (_c, v) => `${v}.` },
  country: { rcp: "Rubrique 8 — Numéro d'autorisation de mise sur le marché · page 6", notice: "Titulaire et fabricant · page 4", text: (_c, v) => `Autorisation délivrée pour : ${v}.` },
  route: { rcp: "Rubrique 4.2 — Posologie et mode d'administration · page 2", notice: "Comment prendre ce médicament ? · page 2", text: (_c, v) => `${v}.` },
  excipients: { rcp: "Rubrique 6.1 — Liste des excipients · page 5", notice: "Les autres composants sont · page 4", text: (_c, v) => `${v}. (Liste qualitative : les quantités ne sont pas indiquées.)` },
  storage: { rcp: "Rubrique 6.4 — Précautions particulières de conservation · page 5", notice: "Comment conserver ce médicament ? · page 4", text: (_c, v) => `${v}.` },
  packaging: { rcp: "Rubrique 6.5 — Nature et contenu de l'emballage extérieur · page 6", notice: "Aspect et contenu de l'emballage · page 4", text: (_c, v) => `${v}.` },
};

export const EXTRACTABLE_KEYS = Object.keys(SECTIONS) as ExtractableKey[];

/**
 * Simulated reading of an SmPC or a leaflet of a catalogue product: the value printed in the document
 * and where. The SmPC of "Princeps B 20 mg" gives another storage condition than the catalogue entry.
 */
export function readFromDocument(c: ReferenceCandidate, key: ExtractableKey, doc: { name: string; version: number; type: string }): { value: string; source: DataSource } {
  const isRcp = doc.type === RCP_TYPE;
  const value = key === "storage" && isRcp && c.storageInRcp ? c.storageInRcp : candidateValue(c, key);
  const section = SECTIONS[key];
  return {
    value,
    source: {
      document: `${doc.name} (v${doc.version})`,
      location: isRcp ? section.rcp : section.notice,
      excerpt: section.text(c, value),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Document types                                                      */
/* ------------------------------------------------------------------ */

export const RCP_TYPE = "RCP du princeps";
export const NOTICE_TYPE = "Notice du princeps";

export const DOCUMENT_TYPES = [
  RCP_TYPE,
  NOTICE_TYPE,
  "Rapport public d'évaluation",
  "Monographie (pharmacopée)",
  "DMF / CEP du principe actif",
  "Certificat GMP du fournisseur",
  "Certificat d'analyse du principe actif",
  "Fiche de données de sécurité (FDS)",
  "Recherche brevets",
  "Autre document",
];

/** Type proposed from the file name; the user confirms or changes it. */
export function guessDocumentType(fileName: string): string {
  const n = normalize(fileName);
  if (/rcp|smpc|caracteristiques/.test(n)) return RCP_TYPE;
  if (/notice|pil|leaflet/.test(n)) return NOTICE_TYPE;
  if (/epar|par\b|evaluation/.test(n)) return "Rapport public d'évaluation";
  if (/monograph|pharmacop/.test(n)) return "Monographie (pharmacopée)";
  if (/dmf|cep|asmf/.test(n)) return "DMF / CEP du principe actif";
  if (/gmp|bpf/.test(n)) return "Certificat GMP du fournisseur";
  if (/coa|certificat.?d.?analyse|bulletin/.test(n)) return "Certificat d'analyse du principe actif";
  if (/fds|msds|sds/.test(n)) return "Fiche de données de sécurité (FDS)";
  if (/brevet|patent/.test(n)) return "Recherche brevets";
  return "Autre document";
}

/** Dosage written in a file name ("Notice_X_500mg.pdf" → { dosage: "500", unit: "mg" }). */
export function dosageFromFileName(fileName: string) {
  const m = fileName.match(/(\d+(?:[.,]\d+)?)\s?(mg\/ml|mg|g|ui|%)/i);
  if (!m) return null;
  const unit = m[2].toLowerCase() === "mg/ml" ? "mg/mL" : m[2].toLowerCase() === "ui" ? "UI" : m[2].toLowerCase();
  return { dosage: m[1].replace(",", "."), unit };
}
