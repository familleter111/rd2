/**
 * Demo data of the "Détection IA" series (screens IA-01 → IA-06): the three documents dropped
 * when creating GL-01, what the simulated detection finds in them, and where.
 * The detection is simulated: these results are shown whatever files were dropped.
 */
import type { Family, Tone } from "./types";

/** Screen of the series opened by the guided tour (`/projets/nouveau?ia=…`). */
export type AiStage = "depot" | "analyse" | "donnees" | "ecart" | "parcours" | "applique";
export const AI_STAGES: AiStage[] = ["depot", "analyse", "donnees", "ecart", "parcours", "applique"];

export type AiFileKind = "xlsx" | "pdf" | "docx" | "other";

export const aiFileKind = (name: string): AiFileKind => {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "xlsx" || ext === "pdf" || ext === "docx" ? ext : "other";
};

/** The three documents of the scenario, with what the reading step reports ("2 feuilles"). */
export const AI_FILES = [
  { name: "Formulation_F2.xlsx", size: "1,2 Mo", detail: "2 feuilles" },
  { name: "Cadrage_RD.pdf", size: "0,8 Mo", detail: "6 pages" },
  { name: "Protocole_essais_v1.docx", size: "1,1 Mo", detail: "4 pages" },
];

export const aiFileDetail = (name: string, size: string) => AI_FILES.find((f) => f.name === name)?.detail ?? size;

/** Part of a document shown in "Source sélectionnée": cells of a sheet or lines of a page. */
export interface AiExtract {
  file: string;
  where: string;
  rows: { ref: string; label: string; value: string }[];
}

export const AI_EXTRACTS: AiExtract[] = [
  {
    file: "Formulation_F2.xlsx",
    where: "Feuille : Cibles",
    rows: [
      { ref: "B2", label: "Nom du projet", value: "Gélule 250 mg" },
      { ref: "B3", label: "DCI", value: "Principe actif D" },
      { ref: "B4", label: "Famille", value: "Sèche" },
      { ref: "B5", label: "Forme", value: "Gélule" },
      { ref: "B6", label: "Dosage", value: "250 mg" },
    ],
  },
  {
    file: "Formulation_F2.xlsx",
    where: "Feuille : Composition",
    rows: [
      { ref: "B2", label: "Principe actif D", value: "250,0 mg" },
      { ref: "B3", label: "Lactose monohydraté", value: "120,0 mg" },
      { ref: "B4", label: "Cellulose microcristalline", value: "60,0 mg" },
      { ref: "B5", label: "Stéarate de magnésium", value: "3,0 mg" },
      { ref: "B6", label: "Masse de remplissage", value: "433,0 mg" },
    ],
  },
  {
    file: "Cadrage_RD.pdf",
    where: "Page 1",
    rows: [
      { ref: "p1-objectif", label: "Objectif", value: "Développement d'une gélule orale." },
      { ref: "p1-contexte", label: "Contexte", value: "Nouveau projet de la gamme forme sèche." },
    ],
  },
  {
    file: "Cadrage_RD.pdf",
    where: "Page 2",
    rows: [
      { ref: "p2-pays", label: "Pays cibles", value: "Maroc, Tunisie" },
      { ref: "p2-reference", label: "Produit de référence", value: "Aucun — développement innovant" },
      { ref: "p2-equipe", label: "Équipe projet", value: "À désigner" },
    ],
  },
  {
    file: "Protocole_essais_v1.docx",
    where: "Page 1",
    rows: [
      { ref: "w1-dosage", label: "Dosage cible", value: "200 mg" },
      { ref: "w1-version", label: "Version", value: "Protocole version 1" },
    ],
  },
  {
    file: "Protocole_essais_v1.docx",
    where: "Page 2",
    rows: [
      { ref: "w2-essais", label: "Essais prévus", value: "Uniformité de masse, dosage, dissolution" },
      { ref: "w2-criteres", label: "Critères d'acceptation", value: "À confirmer" },
    ],
  },
];

/** Fields of the form the detection can fill. */
export type AiFieldKey = "name" | "dci" | "family" | "form" | "dosage" | "countries" | "referenceProduct";

/** A line of the "Produit" tab (screen IA-03). `extract` / `ref` point to the source. */
export interface AiDetectedField {
  key: AiFieldKey | "owner";
  label: string;
  value: string;
  source: string;
  status: "ok" | "ecart" | "absent";
  extract?: number;
  ref?: string;
}

export const AI_FIELDS: AiDetectedField[] = [
  { key: "name", label: "Nom du projet", value: "Gélule 250 mg", source: "Excel • Cibles!B2", status: "ok", extract: 0, ref: "B2" },
  { key: "dci", label: "DCI", value: "Principe actif D", source: "Excel • Cibles!B3", status: "ok", extract: 0, ref: "B3" },
  { key: "family", label: "Famille", value: "Sèche", source: "Excel • Cibles!B4", status: "ok", extract: 0, ref: "B4" },
  { key: "form", label: "Forme", value: "Gélule", source: "Excel • Cibles!B5", status: "ok", extract: 0, ref: "B5" },
  { key: "countries", label: "Pays cibles", value: "Maroc, Tunisie", source: "PDF • p.2", status: "ok", extract: 3, ref: "p2-pays" },
  { key: "referenceProduct", label: "Produit de référence", value: "Aucun — développement innovant", source: "PDF • p.2", status: "ok", extract: 3, ref: "p2-reference" },
  { key: "dosage", label: "Dosage", value: "250 mg / 200 mg", source: "Écart entre deux fichiers", status: "ecart", extract: 0, ref: "B6" },
  { key: "owner", label: "Responsable du projet", value: "Non trouvé", source: "À renseigner à l'étape suivante", status: "absent", extract: 3, ref: "p2-equipe" },
];

/** Values written in the form by "Appliquer au formulaire" (the dosage comes from the confirmed choice). */
export const AI_PREFILL: { name: string; dci: string; family: Family; form: string; countries: string[]; referenceProduct: string } = {
  name: "Gélule 250 mg",
  dci: "Principe actif D",
  family: "Sèche",
  form: "Gélule",
  countries: ["Maroc", "Tunisie"],
  referenceProduct: "Aucun (développement innovant)",
};

/** The two values of the dosage found in the documents (screen IA-04). */
export const AI_DOSAGE_OPTIONS = [
  {
    value: "250",
    label: "250 mg",
    file: "Formulation_F2.xlsx",
    location: "Feuille Cibles · cellule B6",
    document: "Formule F2 — document de travail",
    extract: 0,
    ref: "B6",
    source: "Excel • Cibles!B6",
  },
  {
    value: "200",
    label: "200 mg",
    file: "Protocole_essais_v1.docx",
    location: "Page 1 · Dosage cible",
    document: "Protocole version 1",
    extract: 4,
    ref: "w1-dosage",
    source: "Word • p.1",
  },
];

export const AI_DOSAGE_REASON = "La cible retenue est de 250 mg. Le protocole v1 doit être mis à jour.";

/** "Éléments détectés" of the "Parcours R&D" tab (screen IA-05). */
export const AI_ELEMENTS = [
  { title: "Formule candidate F2", detail: "Formule de composition identifiée pour la gélule 250 mg.", file: "Formulation_F2.xlsx", source: "Excel", where: "Composition", extract: 1 },
  { title: "Essais prévus", detail: "Uniformité de masse, Dosage, Dissolution", file: "Protocole_essais_v1.docx", source: "Word", where: "p. 2", extract: 5 },
  { title: "Objectif", detail: "Développement d'une gélule orale.", file: "Cadrage_RD.pdf", source: "PDF", where: "p. 1", extract: 2 },
];

export type AiActivityKey = "formule" | "essais" | "stabilite" | "dosage";

export interface AiActivity {
  key: AiActivityKey;
  title: string;
  detail: string;
  /** Line under the title in the "N activités proposées" card of the form (screen IA-06). */
  summary: string;
  file?: string;
  source?: string;
  where?: string;
  extract?: number;
  tag?: { label: string; tone: Tone };
}

/** Activities proposed from the documents. */
export const AI_ACTIVITIES: AiActivity[] = [
  {
    key: "formule",
    title: "Revoir la formule F2",
    detail: "Analyser et valider la formule candidate pour la gélule 250 mg.",
    summary: "Analyser la formulation et valider son adéquation",
    file: "Formulation_F2.xlsx",
    source: "Excel",
    where: "Composition",
    extract: 1,
  },
  {
    key: "essais",
    title: "Préparer les essais prévus",
    detail: "Planifier les essais d'uniformité de masse, dosage et dissolution.",
    summary: "Planifier les essais et définir les méthodes",
    file: "Protocole_essais_v1.docx",
    source: "Word",
    where: "p. 2",
    extract: 5,
  },
  {
    key: "stabilite",
    title: "Définir le protocole de stabilité",
    detail: "Élaborer le protocole de stabilité pour la gélule 250 mg.",
    summary: "Initialiser le suivi de stabilité",
    tag: { label: "Donnée absente", tone: "info" },
  },
];

/** Activity proposed by the dosage choice (screen IA-04): update the document that keeps the other value. */
export function dosageActivity(value: string): AiActivity & { check: string } {
  return value === "200"
    ? {
        key: "dosage",
        title: "Mettre à jour la formule F2 à 200 mg",
        detail: "Adapter la formule de travail au dosage de 200 mg.",
        summary: "Résoudre l'écart avec la formule F2",
        check: "Préparer une activité : mettre à jour le dosage dans la formule F2",
        tag: { label: "Écart résolu", tone: "success" },
      }
    : {
        key: "dosage",
        title: "Mettre à jour le protocole à 250 mg",
        detail: "Adapter le protocole existant au dosage de 250 mg.",
        summary: "Résoudre l'écart avec le protocole v1",
        check: "Préparer une activité : mettre à jour le dosage dans le protocole",
        tag: { label: "Écart résolu", tone: "success" },
      };
}

/** "Prérequis à compléter": pieces the documents do not contain (added to the project's prerequisites). */
export const AI_MISSING: { name: string; detail: string; status: string; tone: Tone }[] = [
  { name: "Certificat d'analyse PA", detail: "Non trouvé dans les documents fournis.", status: "Non trouvé", tone: "danger" },
  { name: "Critères d'acceptation", detail: "À confirmer dans les documents.", status: "À confirmer", tone: "warn" },
  { name: "Conditions de stabilité", detail: "Non trouvées dans les documents fournis.", status: "Non trouvé", tone: "danger" },
];
