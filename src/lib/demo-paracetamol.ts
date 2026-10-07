/**
 * Demonstration project carried to the end of the pathway: a generic of paracetamol 500 mg tablets.
 *
 * The characteristics of the substance and the compendial limits are public knowledge, each with
 * the reference it comes from; they are to be checked against the current texts. The lots, trial
 * results, stability results and internal references are illustrative: no laboratory produced them.
 * The project is built by running the same reducers as the screens, so every gate and every check
 * is really passed.
 */
import { bioequivalence, PROPOSED_CRITERIA } from "./bioequivalence";
import { cadrage, dataFromManual, EXPECTED_DOCUMENTS } from "./cadrage";
import type { DemoState } from "./data";
import { feasibility } from "./feasibility";
import { formulation, formulationOf } from "./formulation";
import { princeps } from "./princeps";
import { quality, qualityOf } from "./quality";
import { NOTICE_TYPE, RCP_TYPE } from "./reference-catalog";
import { stability } from "./stability";
import { stamp } from "./state-utils";
import type { DataNature, Project } from "./types";
import { draftFor, validation, validationOf } from "./validation";

export const PARACETAMOL_CODE = "PA-01";
const CODE = PARACETAMOL_CODE;
const RCP = "RCP_Doliprane_500mg_comprime.pdf (v1)";
const MONO = "Monographie_Paracetamol_PhEur.pdf (v1)";
const PACKAGING = "Plaquettes PVC/aluminium, boîte de 16 comprimés";
const NOTE = "Donnée publique reprise pour la démonstration : à vérifier sur le texte en vigueur.";

const project = (s: DemoState): Project => s.projects.find((p) => p.code === CODE)!;

/** Values of the reference product and of the substance, each with where it is written. */
const FACTS: [key: string, value: string, nature: DataNature, document: string, location: string][] = [
  ["route", "Voie orale", "Fait sourcé", RCP, "Rubrique 4.2 — Posologie et mode d'administration"],
  ["excipients", "Lactose monohydraté, Amidon prégélatinisé, Amidon de blé, Talc, Carboxyméthylamidon sodique (type A), Stéarate de magnésium", "Fait sourcé", RCP, "Rubrique 6.1 — Liste des excipients"],
  ["storage", "Pas de précautions particulières de conservation", "Fait sourcé", RCP, "Rubrique 6.4 — Précautions particulières de conservation"],
  ["packaging", PACKAGING, "Fait sourcé", RCP, "Rubrique 6.5 — Nature et contenu de l'emballage extérieur"],
  ["apiSupplier", "Fabricant de paracétamol titulaire d'un certificat de conformité à la Ph. Eur. (CEP) — fournisseur de démonstration", "Hypothèse", "", ""],
  ["bcs", "Classe III, à la limite de la classe I (solubilité élevée)", "Fait sourcé", "Monographie de dispense — Kalantzi et al., J. Pharm. Sci. 2006", "Conclusion de la monographie"],
  ["solubility", "Environ 14 mg/mL dans l'eau à 25 °C ; assez soluble dans l'eau, facilement soluble dans l'éthanol", "Fait sourcé", MONO, "Caractères"],
  ["pka", "Environ 9,5", "Fait sourcé", "Monographie de dispense — Kalantzi et al., J. Pharm. Sci. 2006", "Propriétés physico-chimiques"],
  ["polymorphism", "Forme I monoclinique (forme commerciale, stable) ; forme II orthorhombique", "Fait sourcé", MONO, "Caractères — polymorphisme"],
  ["psd", "Poudre cristalline ; granulométrie à mesurer sur le lot fournisseur", "Hypothèse", "", ""],
  ["excipientFunctions", "Lactose : diluant ; amidon prégélatinisé : liant ; amidon de blé : diluant / désintégrant ; talc : agent d'écoulement ; carboxyméthylamidon sodique : désintégrant ; stéarate de magnésium : lubrifiant", "Hypothèse", "", ""],
  ["release", "Libération immédiate", "Fait sourcé", RCP, "Rubrique 3 — Forme pharmaceutique"],
  ["handling", "Aucune contrainte particulière de manipulation documentée", "Fait sourcé", "Fiche de données de sécurité du paracétamol", "Sections 7 et 8"],
  ["tests", "Dissolution : Q = 80 % en 30 min (palette, 50 tr/min, tampon phosphate pH 5,8, 900 mL) ; teneur : 90,0 à 110,0 % de la valeur déclarée", "Fait sourcé", "USP — Acetaminophen Tablets", "Dissolution et Assay"],
  ["impurities", "4-aminophénol (impureté K), 4'-chloroacétanilide (impureté J), 4-nitrophénol (impureté F)", "Fait sourcé", MONO, "Substances apparentées"],
  ["methods", "Dosage et substances apparentées par chromatographie liquide ; dissolution avec dosage par spectrophotométrie UV", "Fait sourcé", MONO, "Essai et dosage"],
  ["dissolution", "Plus de 85 % dissous en 15 min dans les milieux pH 1,2, 4,5 et 6,8 (lot de démonstration du princeps)", "Résultat mesuré", "", "Rapport de dissolution comparative RD-PA-03 (démonstration)"],
  ["beInfo", "Libération immédiate, action systémique, pas de marge thérapeutique étroite ; une dispense fondée sur le BCS est envisageable selon ICH M9", "Fait sourcé", "ICH M9 — Dispenses fondées sur le système de classification biopharmaceutique", "Sections 2 et 3"],
];

/** Text of the sections that no project data feeds; the others are drafted from the approved data. */
const SECTION_TEXT: Record<string, string> = {
  "m1-demande": "Lettre de demande et formulaire national d'enregistrement : à établir sur les modèles en vigueur de l'autorité tunisienne à la date du dépôt. Références internes : PA-01-M1-01 (lettre) et PA-01-M1-02 (formulaire).",
  "m1-bpf": "Autorisation de fabrication du site de production et certificat BPF en cours de validité : références internes PA-01-M1-03 et PA-01-M1-04. Certificat de conformité à la Ph. Eur. (CEP) du fabricant du paracétamol : PA-01-M1-05.",
  "m1-rcp": "RCP du princeps : RCP_Doliprane_500mg_comprime.pdf (v1). Projets du médicament développé : RCP PA-01-RCP v1, notice PA-01-NOT v1, maquettes d'étiquetage et de conditionnement PA-01-ETQ v1.",
  "m1-pv": "Résumé du système de pharmacovigilance du demandeur et désignation de la personne responsable : référence interne PA-01-M1-06.",
  "m1-autres": "Mandat du représentant local, certificats et justificatif de paiement des droits : à joindre selon la liste nationale en vigueur. Références internes PA-01-M1-07 à PA-01-M1-09.",
  "m2-nonclinique": "Demande générique : la pharmacologie, la pharmacocinétique et la toxicologie du paracétamol sont bien établies. La synthèse s'appuie sur la littérature publiée et sur les informations publiques du médicament de référence ; aucune étude non clinique nouvelle n'est réalisée.",
  "m2-clinique": "Demande générique : l'efficacité et la sécurité cliniques reposent sur le médicament de référence. La démonstration propre au dossier est l'argumentaire de dispense fondé sur le BCS (ICH M9), appuyé sur la dissolution comparative.",
  "m2-critiques": "Points critiques : maîtrise du 4-aminophénol sur la durée de vie ; similarité des profils de dissolution dans les trois milieux ; comparaison qualitative et quantitative des excipients avec le princeps. Renvois : rapport de développement RD-PA-01, rapport de dissolution comparative RD-PA-03, rapport de stabilité ST-PA-01.",
  "m3-etalons": "Paracétamol : substance chimique de référence de la pharmacopée. 4-aminophénol et 4'-chloroacétanilide : substances de référence pour les impuretés. Les étalons de travail sont qualifiés par rapport à ces références (procédure interne).",
  "m3-annexes": "Rapport de développement pharmaceutique RD-PA-01 ; dossier de lot pilote LP-PA-001 ; rapport de validation de la méthode de dosage VAL-PA-01 ; rapport de dissolution comparative RD-PA-03 ; rapport de stabilité ST-PA-01.",
  nonclinique: "Références bibliographiques sur la pharmacologie et la toxicologie du paracétamol, substance d'usage médical bien établi. Aucun rapport d'étude non clinique propre au dossier.",
  "m4-justification": "Les études non cliniques ne sont pas reproduites : la demande est une demande générique qui se réfère au médicament de référence, et le profil non clinique du paracétamol est bien établi. Les impuretés sont maîtrisées dans les limites de la pharmacopée.",
};

/** Waiver criteria: the reference of each one and the proof at hand. */
const CRITERIA: [source: string, evidence: string][] = [
  ["ICH M9, section 2.1", "Classe III à la limite de la classe I — monographie de dispense publiée (Kalantzi et al., 2006)."],
  ["ICH M9, section 2.1 — solubilité sur pH 1,2 à 6,8 à 37 °C", "Dose de 500 mg soluble dans moins de 250 mL sur toute la plage de pH (solubilité d'environ 14 mg/mL)."],
  ["ICH M9, section 2.2", "Absorption élevée documentée dans la littérature ; la substance est traitée en classe III par prudence."],
  ["ICH M9, section 3", "Comprimé à libération immédiate, à action systémique (RCP du princeps, rubriques 3 et 5.2)."],
  ["ICH M9, section 3.1 — excipients", "Mêmes excipients que le princeps (RCP, rubrique 6.1) ; quantités de la formule retenue comparées dans le rapport RD-PA-01."],
  ["ICH M9, section 3.2 — dissolution", "Plus de 85 % dissous en 15 min pour le produit test et la référence à pH 1,2, 4,5 et 6,8 — rapport RD-PA-03."],
  ["ICH M9, section 1.2 — champ d'application", "Le paracétamol n'est pas un médicament à marge thérapeutique étroite."],
];

function build(seed: DemoState): DemoState {
  const at = stamp();
  let s = seed;

  /* Étape 0 — cadrage, porte G0 */
  const identity = { name: "Doliprane 500 mg, comprimé", dci: "Paracétamol", form: "Comprimé", dosage: "500 mg", holder: "Opella Healthcare France SAS", country: "France" };
  const locations: Record<string, string> = { name: "Rubrique 1 — Dénomination du médicament", dci: "Rubrique 2 — Composition qualitative et quantitative", form: "Rubrique 3 — Forme pharmaceutique", dosage: "Rubrique 2 — Composition qualitative et quantitative", holder: "Rubrique 7 — Titulaire de l'autorisation de mise sur le marché", country: "Autorisation nationale française" };
  s = cadrage.create(s, {
    code: CODE,
    name: "Paracétamol 500 mg",
    form: "Comprimé",
    team: { chef: "Chef de projet", galenique: "Galéniste", analytique: "Responsable analytique", reglementaire: "Affaires réglementaires", qualite: "Qualité" },
    cadrage: {
      reference: { name: identity.name, holder: identity.holder, country: identity.country, sourceLabel: "RCP du princeps" },
      data: dataFromManual(identity, at).map((d) => (d.key in locations ? { ...d, source: { document: RCP, location: locations[d.key], excerpt: d.value }, history: [{ at, author: "Chef de projet", action: "Confirmation", value: d.value, note: NOTE }] } : d)),
      markets: ["Tunisie"],
      procedure: "Enregistrement national — médicament générique",
      variants: [{ id: "var-pa-500", dosage: "500", unit: "mg", reference: true }],
      startDate: "2026-03-02",
      targetDate: "2027-03-31",
      documents: [],
      expected: EXPECTED_DOCUMENTS,
    },
  });
  s = cadrage.addDocument(s, CODE, { name: "RCP_Doliprane_500mg_comprime.pdf", size: "412 Ko", type: RCP_TYPE });
  s = cadrage.addDocument(s, CODE, { name: "Notice_Doliprane_500mg_comprime.pdf", size: "286 Ko", type: NOTICE_TYPE });
  s = cadrage.addDocument(s, CODE, { name: "Monographie_Paracetamol_PhEur.pdf", size: "198 Ko", type: "Monographie (pharmacopée)" });
  for (const [key, value, nature, document, location] of FACTS) {
    s = cadrage.correct(s, CODE, key, value, nature === "Hypothèse" ? "Hypothèse de travail de la démonstration, à confirmer." : NOTE, { nature, source: nature === "Hypothèse" ? undefined : { document: document || location, location: document ? location : "Document de démonstration", excerpt: value } });
  }
  s = cadrage.approveG0(s, CODE, "Produit de référence identifié sur son RCP ; marché tunisien, procédure générique nationale, dosage 500 mg.");

  /* Étape 1 — faisabilité, porte G1 */
  s = feasibility.decide(s, CODE, { choice: "Lancer", justification: "Substance bien connue, forme sèche maîtrisée par le site, monographies disponibles et fournisseur de principe actif sous CEP.", hypotheses: "Approvisionnement du principe actif confirmé ; équipements de granulation et de compression disponibles." });

  /* Étape 2 — fiche princeps, porte G2 */
  s = princeps.validate(s, CODE, { strategy: "Reproduire la composition qualitative du princeps ; comparer compression directe et granulation humide ; viser plus de 85 % dissous en 15 min dans les trois milieux pour soutenir une dispense fondée sur le BCS.", note: "Granulométrie et fournisseur du principe actif encore en hypothèse." });

  /* Étape 3 — formulation, porte G3 */
  s = formulation.propose(s, CODE);
  const quantities: Record<string, string> = { "Lactose monohydraté": "30", "Amidon prégélatinisé": "25", "Amidon de blé": "20", Talc: "6", "Carboxyméthylamidon sodique (type A)": "15", "Stéarate de magnésium": "4" };
  for (const option of formulationOf(project(s)).options) {
    s = formulation.newVersion(s, CODE, option.id, { title: option.title, process: option.process, components: option.components.map((c) => ({ ...c, qty: quantities[c.name] ?? c.qty })), rationale: option.rationale, uncertainties: option.uncertainties, risks: option.risks }, "Quantités définies pour le premier essai (masse unitaire de 600 mg).");
  }
  const references: Record<string, [method: string, reference: string]> = {
    Dissolution: ["Palette 50 tr/min, tampon phosphate pH 5,8, 900 mL, 30 min", "96"],
    Dosage: ["Chromatographie liquide", "99,6"],
    Désagrégation: ["Ph. Eur. 2.9.1, eau à 37 °C", "4"],
    "Uniformité de masse": ["Ph. Eur. 2.9.5, écart maximal", "1,2"],
  };
  for (const c of formulationOf(project(s)).criteria) {
    const ref = references[c.label];
    if (ref) s = formulation.saveCriterion(s, CODE, { ...c, method: ref[0], reference: ref[1], referenceSource: "Lot du princeps analysé au laboratoire (démonstration)" });
  }
  const current = () => {
    const f = formulationOf(project(s));
    return ["A", "B"].map((code) => f.options.filter((o) => o.code === code).sort((x, y) => y.version - x.version)[0]);
  };
  const results: Record<string, string>[] = [
    { Dissolution: "78", Dosage: "98,9", Désagrégation: "9", "Uniformité de masse": "2,8" },
    { Dissolution: "95", Dosage: "99,8", Désagrégation: "5", "Uniformité de masse": "1,3" },
  ];
  current().forEach((option, i) => {
    s = formulation.addTrial(s, CODE, { optionId: option.id, lot: `LE-PA-00${i + 1}`, date: i ? "2026-05-12" : "2026-05-05" });
    const f = formulationOf(project(s));
    const trial = f.trials[f.trials.length - 1];
    s = formulation.saveResults(s, CODE, trial.id, f.criteria.map((c) => ({ criterionId: c.id, value: results[i][c.label] ?? "", unit: c.unit, method: c.method })), i ? "Écoulement et compressibilité satisfaisants." : "Écoulement irrégulier du mélange ; dissolution sous la cible.");
    s = formulation.verifyTrial(s, CODE, trial.id);
  });
  s = formulation.decide(s, CODE, current()[1].id, "La granulation humide donne la dissolution et l'uniformité les plus proches du princeps ; la compression directe est écartée pour son écoulement irrégulier.");

  /* Étape 4 — analytique, qualité, lot pilote */
  s = quality.seed(s, CODE);
  s = quality.saveMethod(s, CODE, { name: "Dosage du paracétamol par chromatographie liquide", kind: "Méthode référencée", reference: "Ph. Eur. — monographie Paracétamol ; USP — Acetaminophen Tablets", needs: "Colonne C18, substance de référence", status: "Utilisable" });
  s = quality.saveMethod(s, CODE, { name: "Dissolution à la palette", kind: "Méthode référencée", reference: "USP — Acetaminophen Tablets ; Ph. Eur. 2.9.3", needs: "Appareil à palettes, tampon phosphate pH 5,8", status: "Utilisable" });
  s = quality.saveMethod(s, CODE, { name: "Substances apparentées par chromatographie liquide", kind: "Méthode référencée", reference: "Ph. Eur. — monographie Paracétamol", needs: "Substances de référence des impuretés J et K", status: "Utilisable" });
  const limits: Record<string, [min: string, max: string, origin: string]> = {
    Dissolution: ["80", "", "USP — Acetaminophen Tablets : Q = 80 % en 30 min"],
    Dosage: ["95", "105", "Spécification interne à libération, dans les limites USP de 90,0 à 110,0 %"],
    Désagrégation: ["", "15", "Ph. Eur. 2.9.1 — comprimés non enrobés"],
    "Uniformité de masse": ["", "5", "Ph. Eur. 2.9.5 — comprimés de 250 mg ou plus"],
  };
  for (const spec of qualityOf(project(s)).specs) {
    const limit = limits[spec.test];
    if (!limit) continue;
    s = quality.saveSpec(s, CODE, { ...spec, min: limit[0], max: limit[1], origin: limit[2] });
    s = quality.approveSpec(s, CODE, spec.id);
  }
  s = quality.saveImpurity(s, CODE, { name: "4-aminophénol (impureté K)", reported: true, searched: true, observed: "Inférieur à 0,05 %" });
  s = quality.saveImpurity(s, CODE, { name: "4'-chloroacétanilide (impureté J)", reported: true, searched: true, observed: "Non détecté" });
  qualityOf(project(s)).materials.forEach((m, i) => {
    s = quality.saveMaterial(s, CODE, { ...m, supplierLot: `MP-PA-${String(i + 1).padStart(2, "0")}`, coa: true, sds: true, control: "Résultats revus", decision: "Utilisable" });
  });
  s = quality.setPilot(s, CODE, { lot: "LP-PA-001", batchRecord: true, equipmentChecked: true, deviations: "Aucun écart déclaré." });
  s = quality.authorizePilot(s, CODE);
  s = quality.advancePilot(s, CODE);
  s = quality.advancePilot(s, CODE);
  const t0: Record<string, string> = { Dissolution: "94", Dosage: "99,5", Désagrégation: "5", "Uniformité de masse": "1,4" };
  for (const spec of qualityOf(project(s)).specs) {
    if (t0[spec.test]) s = quality.addControl(s, CODE, { specId: spec.id, lot: "LP-PA-001", sample: "T0", value: t0[spec.test], date: "2026-06-16" });
  }

  /* Étape 5 — stabilité */
  const followed = qualityOf(project(s)).specs.filter((x) => x.test === "Dissolution" || x.test === "Dosage");
  const conditions = ["25 °C / 60 % HR", "40 °C / 75 % HR"];
  s = stability.savePlan(s, CODE, { referential: "ICH Q1A(R2) — essais de stabilité des nouvelles substances et des nouveaux produits", packaging: PACKAGING, lots: ["LP-PA-001"], conditions, points: [{ month: 0, required: true }, { month: 3, required: true }, { month: 6, required: true }, { month: 12, required: false }], specIds: followed.map((x) => x.id) });
  s = stability.approvePlan(s, CODE);
  const series: Record<string, Record<string, string[]>> = {
    "25 °C / 60 % HR": { Dissolution: ["94", "93", "93"], Dosage: ["99,5", "99,3", "99,1"] },
    "40 °C / 75 % HR": { Dissolution: ["94", "92", "90"], Dosage: ["99,5", "98,9", "98,2"] },
  };
  for (const condition of conditions) {
    [0, 3, 6].forEach((month, i) => {
      const cell = { lot: "LP-PA-001", condition, month };
      s = stability.saveCell(s, CODE, cell, followed.map((x) => ({ specId: x.id, value: series[condition][x.test][i], note: "" })));
      s = stability.approveCell(s, CODE, cell, "");
    });
    for (const spec of followed) s = stability.saveEvolutionNote(s, CODE, `${spec.id}|LP-PA-001|${condition}`, spec.test === "Dosage" ? "Baisse faible et régulière, dans la limite." : "Stable sur six mois, au-dessus de la limite.");
  }
  s = stability.conclude(s, CODE, "Résultats conformes à T0, 3 et 6 mois dans les deux conditions, sans tendance préoccupante. L'échéance de 12 mois est attendue et n'est pas requise pour cette version du dossier.");

  /* Étape 6 — bioéquivalence */
  s = bioequivalence.saveStrategy(s, CODE, { referential: "ICH M9 (dispenses fondées sur le BCS) ; ICH M13A (bioéquivalence des formes orales solides à libération immédiate)", orientation: "Dispense à examiner", rationale: "Substance très soluble, forme orale à libération immédiate, mêmes excipients que le princeps et dissolution très rapide des deux produits dans les trois milieux.", limits: "La dispense reste soumise à l'acceptation de l'autorité ; à défaut, une étude de bioéquivalence sera préparée selon ICH M13A." });
  s = bioequivalence.proposeCriteria(s, CODE);
  project(s).bioequivalence!.criteria.forEach((c) => {
    const i = PROPOSED_CRITERIA.indexOf(c.label);
    if (i >= 0) s = bioequivalence.saveCriterion(s, CODE, { id: c.id, label: c.label, source: CRITERIA[i][0], evidence: CRITERIA[i][1], missing: "", state: "Preuve disponible" });
  });
  s = bioequivalence.approve(s, CODE, "scientific", "Galéniste");
  s = bioequivalence.approve(s, CODE, "regulatory", "Affaires réglementaires");
  s = bioequivalence.attach(s, CODE, ["Argumentaire_dispense_BCS_PA-01_v1.pdf", "Rapport_dissolution_comparative_RD-PA-03.pdf"]);
  s = bioequivalence.validate(s, CODE, "Galéniste", "Argumentaire de dispense préparé : tous les critères ICH M9 ont leur preuve. Dissolution comparative jugée similaire (plus de 85 % en 15 min pour les deux produits).");

  /* Étape 7 — dossier, portes G4 et G5 */
  s = validation.decideG4(s, CODE, "Préparer le dossier", "Lot pilote revu, stabilité à six mois conforme et argumentaire de dispense validé : le dossier peut être préparé.");
  s = validation.saveScope(s, CODE, { market: "Tunisie", procedure: "Enregistrement national — médicament générique", variants: "500 mg" });
  s = validation.saveCover(s, CODE, { name: "Paracétamol 500 mg, comprimé", presentation: PACKAGING, applicant: "Laboratoires SIMED — Tunisie", manufacturers: "Laboratoires SIMED — fabrication, conditionnement, contrôle et libération des lots. Fabricant du principe actif : titulaire d'un CEP (démonstration).", application: "Générique — référence : Doliprane 500 mg, comprimé", code: "PA-01-AMM", owner: "Chef de projet" });
  s = validation.proposeSections(s, CODE);
  for (const section of validationOf(project(s)).sections) {
    const content = SECTION_TEXT[section.feed] ?? draftFor(project(s), section);
    s = validation.saveAndApprove(s, CODE, section.id, { content: content || "Sans objet pour cette version.", applicable: true, naReason: "" });
  }
  s = validation.savePreDeposit(s, CODE, {
    index: "Registre documentaire PA-01-REG v1",
    missing: "Aucune pièce manquante. Échéance de stabilité de 12 mois à verser au dossier dès réception.",
    regulatory: "Affaires réglementaires — 24/09/2026 — dossier cohérent avec la procédure générique nationale ; pièces du module 1 à mettre au format de l'autorité avant dépôt.",
    quality: "Qualité — 24/09/2026 — lot pilote, spécifications et stabilité revus sans réserve.",
    decision: "Dépôt approuvé en interne, sous réserve de la mise au format national des pièces administratives.",
    approver: "Direction technique — pharmacien responsable — 24/09/2026",
  });
  return validation.freeze(s, CODE);
}

/** Adds the completed paracetamol project to the demonstration data (never twice). */
export function withParacetamolDemo(seed: DemoState): DemoState {
  if (seed.projects.some((p) => p.code === CODE)) return seed;
  try {
    return build(seed);
  } catch {
    // The demonstration must load even if this project cannot be built.
    return seed;
  }
}
