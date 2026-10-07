/**
 * Characteristics of the reference product sheet (étape 2) that are not part of the identity read
 * at the cadrage. They all start unknown: nothing is deduced from a name alone.
 */
import type { CadrageDatum, CadrageEntity } from "./types";

export const PRINCEPS_GROUPS = ["Identité", "Propriétés du principe actif", "Composition", "Produit", "Qualité", "Bioéquivalence"] as const;
export type PrincepsGroup = (typeof PRINCEPS_GROUPS)[number];

/** Section of each value of the identity sheet (cadrage) inside the reference product sheet. */
export const CADRAGE_GROUP: Record<string, PrincepsGroup> = {
  name: "Identité",
  dci: "Identité",
  form: "Identité",
  dosage: "Identité",
  holder: "Identité",
  country: "Identité",
  route: "Identité",
  excipients: "Composition",
  excipientQty: "Composition",
  storage: "Produit",
  packaging: "Produit",
  apiSupplier: "Propriétés du principe actif",
  bcs: "Propriétés du principe actif",
};

const DEFS: { key: string; label: string; entity: CadrageEntity; group: PrincepsGroup }[] = [
  { key: "solubility", label: "Solubilité (selon conditions)", entity: "Principe actif", group: "Propriétés du principe actif" },
  { key: "pka", label: "pKa", entity: "Principe actif", group: "Propriétés du principe actif" },
  { key: "polymorphism", label: "Polymorphisme", entity: "Principe actif", group: "Propriétés du principe actif" },
  { key: "psd", label: "Granulométrie", entity: "Principe actif", group: "Propriétés du principe actif" },
  { key: "excipientFunctions", label: "Fonctions possibles des excipients", entity: "Produit de référence", group: "Composition" },
  { key: "release", label: "Type de libération", entity: "Produit de référence", group: "Produit" },
  { key: "handling", label: "Contraintes de manipulation", entity: "Produit de référence", group: "Produit" },
  { key: "tests", label: "Essais et limites documentés", entity: "Produit de référence", group: "Qualité" },
  { key: "impurities", label: "Impuretés connues", entity: "Produit de référence", group: "Qualité" },
  { key: "methods", label: "Méthodes analytiques disponibles", entity: "Produit de référence", group: "Qualité" },
  { key: "dissolution", label: "Profil de dissolution du princeps", entity: "Produit de référence", group: "Bioéquivalence" },
  { key: "beInfo", label: "Informations utiles à la stratégie de bioéquivalence", entity: "Produit de référence", group: "Bioéquivalence" },
];

export const blankPrincepsData = (): CadrageDatum[] => DEFS.map((d) => ({ ...d, critical: false, value: "", status: "Non documentée", history: [] }));

/** Usual function of common excipients — a proposal to confirm, never a fact about the reference product. */
const EXCIPIENT_FUNCTIONS: [RegExp, string][] = [
  [/cellulose microcristalline/i, "diluant / liant"],
  [/lactose/i, "diluant"],
  [/povidone/i, "liant"],
  [/croscarmellose/i, "désintégrant"],
  [/amidon prégélatinisé/i, "liant / désintégrant"],
  [/amidon/i, "diluant / désintégrant"],
  [/stéarate de magnésium/i, "lubrifiant"],
  [/talc/i, "agent d'écoulement"],
  [/hypromellose/i, "liant ou agent de pelliculage"],
  [/gélatine/i, "enveloppe de la gélule"],
  [/saccharose/i, "édulcorant / agent de charge"],
  [/gomme xanthane/i, "agent de suspension"],
  [/benzoate de sodium/i, "conservateur"],
  [/arôme/i, "aromatisant"],
  [/eau purifiée/i, "véhicule"],
];

/** Usual function of one excipient, when the dictionary knows it. */
export const excipientFunction = (name: string) => EXCIPIENT_FUNCTIONS.find(([re]) => re.test(name))?.[1];

/** "Lactose monohydraté : diluant ; Talc : agent d'écoulement" — unknown excipients are left without a function. */
export function proposeExcipientFunctions(excipients: string): string {
  return excipients
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => `${e} : ${EXCIPIENT_FUNCTIONS.find(([re]) => re.test(e))?.[1] ?? "fonction non proposée"}`)
    .join(" ; ");
}
