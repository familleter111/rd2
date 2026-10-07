/**
 * Étape 7 — Préparer le dossier de validation (gates G4 and G5).
 *
 * Sections are fed from approved data only, checked for presence and consistency, reviewed, then
 * frozen in a snapshot that is never modified: a later change opens a new version. The end state
 * is "Prêt pour validation interne"; handing the dossier over is a distinct action. The export is
 * a set of documents organised by CTD module — never called a complete CTD or an eCTD.
 */
import { CURRENT_USER } from "./catalog";
import { allData, isVerified, sync } from "./cadrage";
import type { DemoState } from "./data";
import type { PdfFormSheet, PdfLine } from "./export-files";
import { beDocuments, beOf, isApproved as beApproved, waiverStatus } from "./bioequivalence";
import { formatDateTime } from "./format";
import { compare, currentOptions, formulationOf, optionLabel } from "./formulation";
import { openInvestigations, qualityOf, specLimit } from "./quality";
import { canConclude, pointLabel, stabilityOf } from "./stability";
import { stamp, uid, withEvent } from "./state-utils";
import type { Project, ValidationFile, ValidationSection, ValidationSnapshot, ValidationState } from "./types";

const EMPTY: ValidationFile = { market: "", procedure: "", variants: "", version: 1, sections: [], snapshots: [] };
export const validationOf = (p: Project): ValidationFile => p.validation ?? EMPTY;

const RD_SHEET = "Fiche interne R&D — Formulation et comparaison";
export const MODULES = ["Module 1 — Informations administratives et régionales", "Module 2 — Synthèses", "Module 3 — Qualité", RD_SHEET, "Module 4 — Non clinique", "Module 5 — Clinique"];

export interface DossierField {
  key: string;
  label: string;
  hint?: string;
  long?: boolean;
}

/** Cover sheet: what identifies the dossier beyond the product read at the cadrage. */
export const COVER_FIELDS: DossierField[] = [
  { key: "name", label: "Nom du médicament (nom proposé)", hint: "Nom du médicament développé, distinct de celui du princeps" },
  { key: "presentation", label: "Présentation et conditionnement", hint: "Nombre d'unités et conditionnement" },
  { key: "applicant", label: "Demandeur / futur titulaire et coordonnées" },
  { key: "manufacturers", label: "Fabricant(s), site(s) et responsabilités", long: true },
  { key: "application", label: "Type de demande", hint: "Générique ou autre catégorie à préciser" },
  { key: "code", label: "Code dossier" },
  { key: "owner", label: "Responsable du dossier" },
];

/** Review before filing — an internal approval for filing is not a marketing authorisation. */
export const PREDEPOSIT_FIELDS: DossierField[] = [
  { key: "index", label: "Index des pièces : référence du registre documentaire" },
  { key: "missing", label: "Pièces manquantes, actions, responsables et échéances", long: true, hint: "En complément de la liste « Manques à résoudre » calculée par la plateforme." },
  { key: "regulatory", label: "Revue réglementaire : nom, date et observations", long: true },
  { key: "quality", label: "Revue qualité : nom, date et observations", long: true },
  { key: "decision", label: "Décision interne et réserves éventuelles", long: true },
  { key: "approver", label: "Approbateur : nom, fonction et date", hint: "La signature manuscrite est portée sur le document imprimé." },
];

/** Values proposed for the cover sheet from what the project already knows. */
export function coverDefaults(p: Project): Record<string, string> {
  const packaging = allData(p).find((d) => d.key === "packaging");
  return { name: p.name, presentation: packaging && isVerified(packaging) ? packaging.value : "", code: `${p.code}-AMM`, owner: p.owner };
}

/** Sections proposed to start the list; the list is adjusted for the market and the procedure. */
const PROPOSED: { feed: string; module: number; title: string }[] = [
  { feed: "admin", module: 0, title: "Identité du produit, marché et procédure" },
  { feed: "m1-demande", module: 0, title: "Demande et formulaire national : références des pièces" },
  { feed: "m1-bpf", module: 0, title: "Autorisations de fabrication et justificatifs BPF / GMP" },
  { feed: "m1-rcp", module: 0, title: "RCP, notice et étiquetage : références et versions" },
  { feed: "m1-pv", module: 0, title: "Pharmacovigilance : pièces applicables" },
  { feed: "m1-autres", module: 0, title: "Mandats, certificats et autres justificatifs nationaux" },
  { feed: "m2-intro", module: 1, title: "2.2 — Introduction et présentation du produit" },
  { feed: "m2-qos", module: 1, title: "2.3 — Résumé global de la qualité : référence et conclusion" },
  { feed: "m2-nonclinique", module: 1, title: "2.4 / 2.6 — Synthèses non cliniques : références et conclusion" },
  { feed: "m2-clinique", module: 1, title: "2.5 / 2.7 — Synthèses cliniques : références et conclusion" },
  { feed: "synthese", module: 1, title: "Synthèse du développement et des décisions" },
  { feed: "m2-critiques", module: 1, title: "Points critiques, justifications et renvois aux rapports" },
  { feed: "substance", module: 2, title: "3.2.S — Substance active" },
  { feed: "formule", module: 2, title: "3.2.P.1 / P.2 — Composition et développement pharmaceutique" },
  { feed: "fabrication", module: 2, title: "3.2.P.3 — Fabrication et lot pilote" },
  { feed: "matieres", module: 2, title: "3.2.P.4 — Contrôle des matières premières (excipients)" },
  { feed: "specs", module: 2, title: "3.2.P.5 — Spécifications, méthodes et impuretés" },
  { feed: "m3-etalons", module: 2, title: "3.2.P.6 — Étalons de référence" },
  { feed: "m3-conditionnement", module: 2, title: "3.2.P.7 — Conditionnement" },
  { feed: "stabilite", module: 2, title: "3.2.P.8 — Stabilité" },
  { feed: "m3-annexes", module: 2, title: "Annexes, informations régionales et rapports associés" },
  { feed: "rd-lots", module: 3, title: "Lots expérimentaux et procédés associés" },
  { feed: "rd-ecartees", module: 3, title: "Formules écartées et justification du choix" },
  { feed: "rd-princeps", module: 3, title: "Princeps : nom, dosage, forme, pays, lot et provenance" },
  { feed: "rd-comparaison", module: 3, title: "Comparaison : critères, résultats, écarts et conclusions" },
  { feed: "rd-rapports", module: 3, title: "Rapports de dissolution / bioéquivalence : références" },
  { feed: "nonclinique", module: 4, title: "Module 4 — Bibliographie et rapports non cliniques pertinents" },
  { feed: "m4-justification", module: 4, title: "Module 4 — Justification des données non fournies" },
  { feed: "bioequivalence", module: 5, title: "Module 5 — Études cliniques / bioéquivalence : références" },
  { feed: "m5-dispense", module: 5, title: "Module 5 — Demande de dispense : justification, si applicable" },
  { feed: "m5-conclusion", module: 5, title: "Conclusion scientifique et points restant à résoudre" },
];

/* ------------------------------------------------------------------ */
/* What the project already knows, per section                         */
/* ------------------------------------------------------------------ */

export interface FeedLine {
  text: string;
  /** Where the statement comes from in the project. */
  source: string;
}
export interface Feed {
  lines: FeedLine[];
  gaps: string[];
  /** Step where the gaps are resolved. */
  href: string;
}

function dataLines(p: Project, keys: string[], gaps: string[]): FeedLine[] {
  const data = allData(p);
  return keys.flatMap((key) => {
    const d = data.find((x) => x.key === key);
    if (!d) return [];
    if (!isVerified(d) || !d.value) {
      gaps.push(`${d.label} : ${d.status === "Contradictoire" ? "contradiction non résolue" : d.value ? "valeur non vérifiée" : "non documentée"}`);
      return [];
    }
    return [{ text: `${d.label} : ${d.value}`, source: d.source ? `${d.source.document} — ${d.source.location}` : "Saisie vérifiée, sans document joint" }];
  });
}

/** Lines available for a section and what is missing, read from approved or verified data only. */
export function sectionFeed(p: Project, feed: string): Feed {
  const base = `/projets/${p.slug}`;
  const v = validationOf(p);
  const gaps: string[] = [];
  const lines: FeedLine[] = [];
  const add = (text: string, source: string) => lines.push({ text, source });
  const written = (f: string) => Boolean(v.sections.find((x) => x.feed === f)?.content.trim());
  switch (feed) {
    case "admin": {
      lines.push(...dataLines(p, ["name", "dci", "form", "dosage", "route", "holder", "country"], gaps));
      if (v.market) add(`Marché du dossier : ${v.market}`, "Périmètre du dossier");
      else gaps.push("Marché du dossier à choisir");
      if (v.procedure) add(`Procédure : ${v.procedure}`, "Périmètre du dossier");
      else gaps.push("Procédure à renseigner");
      if (v.variants) add(`Variantes couvertes : ${v.variants}`, "Périmètre du dossier");
      for (const f of COVER_FIELDS) {
        const value = v.cover?.[f.key]?.trim();
        if (value) add(`${f.label} : ${value}`, "Fiche de couverture du dossier");
        else if (f.key === "applicant" || f.key === "manufacturers" || f.key === "application") gaps.push(`${f.label} : à renseigner dans la fiche de couverture`);
      }
      return { lines, gaps, href: `${base}/dossier` };
    }
    case "synthese": {
      const decisions = decisionLines(p);
      decisions.done.forEach((d) => add(d, "Historique des décisions du projet"));
      gaps.push(...decisions.missing);
      return { lines, gaps, href: `${base}/historique` };
    }
    case "substance":
      lines.push(...dataLines(p, ["dci", "apiSupplier", "bcs", "solubility", "pka", "polymorphism", "psd"], gaps));
      return { lines, gaps, href: `${base}/princeps` };
    case "formule": {
      const f = formulationOf(p);
      const kept = f.options.find((o) => o.id === f.decision?.optionId);
      if (!kept || !f.decision) return { lines, gaps: ["Aucune formule retenue (porte G3)"], href: `${base}/formulation` };
      const src = `Décision G3 du ${formatDateTime(f.decision.decidedAt)}`;
      add(`Formule retenue : ${optionLabel(kept)} — ${kept.title}`, src);
      add(`Procédé : ${kept.process}`, src);
      kept.components.forEach((c) => {
        if (c.qty.trim()) add(`${c.name} (${c.role}) : ${c.qty} ${c.unit}`.trim(), `${optionLabel(kept)}`);
        else gaps.push(`Quantité de « ${c.name} » non définie dans la formule retenue`);
      });
      add(`Justification de la sélection : ${f.decision.justification}`, src);
      const verified = f.trials.filter((t) => t.optionId === kept.id && t.verified);
      if (verified.length) add(`Essais vérifiés : ${verified.map((t) => `${t.code} (lot ${t.lot})`).join(", ")}`, "Étape Formulation");
      return { lines, gaps, href: `${base}/formulation` };
    }
    case "fabrication": {
      const pilot = qualityOf(p).pilot;
      if (!pilot.lot) return { lines, gaps: ["Lot pilote non identifié"], href: `${base}/qualite` };
      add(`Lot pilote : ${pilot.lot} — ${pilot.status.toLowerCase()}`, "Étape Qualité & lot pilote");
      if (pilot.authorizedAt) add(`Lancement autorisé par ${pilot.authorizedBy} le ${formatDateTime(pilot.authorizedAt)}`, "Autorisation interne du lot pilote");
      if (pilot.deviations.trim()) add(`Écarts déclarés : ${pilot.deviations}`, "Revue du lot pilote");
      if (pilot.status !== "Revu") gaps.push("Lot pilote non revu");
      return { lines, gaps, href: `${base}/qualite` };
    }
    case "matieres": {
      const materials = qualityOf(p).materials;
      if (!materials.length) gaps.push("Aucune matière première enregistrée");
      materials.forEach((m) => {
        if (m.decision === "Utilisable") add(`${m.name}${m.supplierLot ? ` — lot fournisseur ${m.supplierLot}` : ""} : utilisable (${m.control.toLowerCase()})`, "Décision de libération");
        else gaps.push(`${m.name} : décision ${m.decision.toLowerCase()}`);
      });
      return { lines, gaps, href: `${base}/qualite` };
    }
    case "specs": {
      const q = qualityOf(p);
      if (!q.specs.length) gaps.push("Aucune spécification enregistrée");
      q.specs.forEach((s) => {
        if (s.approved) add(`${s.test} : ${specLimit(s)}${s.method ? ` — ${s.method}` : ""}`, `Spécification approuvée${s.approvedBy ? ` par ${s.approvedBy}` : ""} · origine : ${s.origin}`);
        else gaps.push(`Spécification « ${s.test} » non approuvée`);
      });
      q.methods.forEach((m) => (m.status === "Utilisable" ? add(`Méthode ${m.name} (${m.kind.toLowerCase()})`, m.reference || "Étape Qualité") : gaps.push(`Méthode « ${m.name} » : ${m.status.toLowerCase()}`)));
      q.impurities.forEach((i) => add(`Impureté ${i.name} — rapportée : ${i.reported ? "oui" : "non"}, recherchée : ${i.searched ? "oui" : "non"}, observée : ${i.observed || "non renseigné"}`, "Étape Qualité"));
      const open = openInvestigations(q).length;
      if (open) gaps.push(`${open} investigation(s) de résultat hors limite non clôturée(s)`);
      return { lines, gaps, href: `${base}/qualite` };
    }
    case "stabilite": {
      const st = stabilityOf(p);
      if (!st.approvedAt) return { lines, gaps: ["Plan de stabilité non approuvé"], href: `${base}/stabilite` };
      const src = `Plan approuvé par ${st.approvedBy} le ${formatDateTime(st.approvedAt)}`;
      add(`Référentiel appliqué : ${st.referential}`, src);
      add(`Lots : ${st.lots.join(", ")} · conditionnement : ${st.packaging || "non précisé"}`, src);
      add(`Conditions : ${st.conditions.join(" ; ")}`, src);
      add(`Échéances requises pour ce dossier : ${st.points.filter((x) => x.required).map((x) => pointLabel(x.month)).join(", ") || "aucune"} · encore attendues : ${st.points.filter((x) => !x.required).map((x) => pointLabel(x.month)).join(", ") || "aucune"}`, src);
      if (st.conclusion) add(`Conclusion${st.conclusion.partial ? " intermédiaire" : ""} (${st.conclusion.progress ?? "échéances requises approuvées"}) : ${st.conclusion.text}`, `Approuvée par ${st.conclusion.by} le ${formatDateTime(st.conclusion.at)}`);
      if (!st.conclusion) gaps.push(canConclude(st) ? "Conclusion de stabilité à approuver" : "Échéances requises non approuvées");
      else if (st.conclusion.partial) gaps.push("Conclusion intermédiaire : des échéances requises ne sont pas encore approuvées");
      return { lines, gaps, href: `${base}/stabilite` };
    }
    case "bioequivalence": {
      const be = beOf(p);
      if (!beApproved(be)) return { lines, gaps: ["Stratégie de bioéquivalence non approuvée"], href: `${base}/bioequivalence` };
      const src = `Approuvée par ${be.scientific!.by} et ${be.regulatory!.by}`;
      add(`Stratégie : ${be.orientation}${be.orientation === "Dispense à examiner" ? ` — ${waiverStatus(be).toLowerCase()}` : ""}`, src);
      add(`Référentiels : ${be.referential}`, src);
      add(`Justification : ${be.rationale}`, src);
      if (be.limits) add(`Limites et inconnues : ${be.limits}`, src);
      if (be.validated) add(`Conclusion de l'étude : ${be.validated.conclusion}`, `Validée par ${be.validated.by} le ${formatDateTime(be.validated.at)}`);
      else gaps.push("Étude non validée");
      if (be.deliverable) add(`${be.deliverable.kind} : ${beDocuments(be).map((d) => d.name).join(", ")}`, "Documents rattachés");
      else gaps.push(be.orientation === "Dispense à examiner" ? "Argumentaire de dispense non rattaché" : "Rapport d'étude non rattaché");
      return { lines, gaps, href: `${base}/bioequivalence` };
    }
    case "m1-rcp": {
      const docs = (p.cadrage?.documents ?? []).filter((d) => /rcp|notice|étiquet|etiquet/i.test(d.type));
      docs.forEach((d) => add(`${d.type} : ${d.name} (v${d.version})`, `Document du projet reçu le ${formatDateTime(d.receivedAt)}`));
      if (!written("m1-rcp")) gaps.push("Projets de RCP, de notice et d'étiquetage du médicament développé : références et versions à renseigner");
      return { lines, gaps, href: `${base}/dossier` };
    }
    case "m2-intro": {
      lines.push(...dataLines(p, ["name", "dci", "form", "dosage", "route"], gaps));
      const ref = p.cadrage?.reference;
      if (ref?.name) add(`Médicament de référence : ${ref.name}${ref.holder ? ` — ${ref.holder}` : ""}${ref.country ? ` (${ref.country})` : ""}`, ref.sourceLabel || "Cadrage du projet");
      return { lines, gaps, href: `${base}/cadrage` };
    }
    case "m2-qos": {
      const f = formulationOf(p);
      const kept = f.options.find((o) => o.id === f.decision?.optionId);
      const q = qualityOf(p);
      const st = stabilityOf(p);
      if (kept) add(`Formule retenue : ${optionLabel(kept)} — ${kept.title} ; procédé : ${kept.process}`, "Décision G3");
      else gaps.push("Formule non retenue (porte G3)");
      if (q.pilot.lot) add(`Lot pilote ${q.pilot.lot} — ${q.pilot.status.toLowerCase()}`, "Étape Qualité & lot pilote");
      add(`${q.specs.filter((s) => s.approved).length} spécification(s) approuvée(s) sur ${q.specs.length} ; ${q.methods.filter((m) => m.status === "Utilisable").length} méthode(s) utilisable(s) sur ${q.methods.length}`, "Étape Qualité & lot pilote");
      if (st.conclusion) add(`Stabilité — conclusion${st.conclusion.partial ? " intermédiaire" : ""} : ${st.conclusion.text}`, `Approuvée par ${st.conclusion.by}`);
      else gaps.push("Conclusion de stabilité non approuvée");
      return { lines, gaps, href: `${base}/qualite` };
    }
    case "m3-conditionnement": {
      lines.push(...dataLines(p, ["packaging", "storage"], gaps));
      const st = stabilityOf(p);
      if (st.packaging) add(`Conditionnement étudié en stabilité : ${st.packaging}`, "Plan de stabilité");
      return { lines, gaps, href: `${base}/cadrage` };
    }
    case "rd-lots": {
      const f = formulationOf(p);
      if (!f.trials.length) gaps.push("Aucun essai enregistré");
      f.trials.forEach((t) => {
        const o = f.options.find((x) => x.id === t.optionId);
        add(`${t.code} — lot ${t.lot} — ${o ? `${optionLabel(o)} : ${o.process}` : "piste supprimée"}${t.verified ? "" : " (non vérifié)"}`, t.verified ? `Essai vérifié par ${t.verifiedBy ?? "—"}` : "Étape Formulation");
      });
      const pilot = qualityOf(p).pilot;
      if (pilot.lot) add(`Lot pilote ${pilot.lot} — ${pilot.status.toLowerCase()}`, "Étape Qualité & lot pilote");
      return { lines, gaps, href: `${base}/formulation` };
    }
    case "rd-ecartees": {
      const f = formulationOf(p);
      if (!f.decision) return { lines, gaps: ["Aucune formule retenue : le choix n'est pas encore justifié (porte G3)"], href: `${base}/formulation` };
      add(`Motif de la sélection : ${f.decision.justification}`, `Décision G3 du ${formatDateTime(f.decision.decidedAt)}`);
      currentOptions(f)
        .filter((o) => o.id !== f.decision!.optionId)
        .forEach((o) => add(`${optionLabel(o)} — ${o.title} : ${o.status.toLowerCase()}. Risques relevés : ${o.risks || "non renseignés"}`, "Étape Formulation"));
      return { lines, gaps, href: `${base}/formulation` };
    }
    case "rd-princeps": {
      lines.push(...dataLines(p, ["name", "dosage", "form", "holder", "country"], gaps));
      (p.princeps?.trials ?? []).forEach((t) => add(`Essai demandé sur le princeps : ${t.title} — ${t.objective}`, `Fiche princeps · responsable : ${t.owner}`));
      if (!written("rd-princeps")) gaps.push("Lot et provenance du princeps utilisé pour la comparaison : à renseigner");
      return { lines, gaps, href: `${base}/princeps` };
    }
    case "rd-comparaison": {
      const f = formulationOf(p);
      const kept = f.options.find((o) => o.id === f.decision?.optionId);
      const trials = f.trials.filter((t) => t.verified && (!kept || t.optionId === kept.id));
      if (!trials.length) gaps.push("Aucun essai vérifié à comparer au princeps");
      for (const t of trials) {
        for (const c of f.criteria) {
          const r = t.results.find((x) => x.criterionId === c.id);
          if (!r?.value.trim()) continue;
          add(`${c.label} — princeps : ${c.reference ? `${c.reference} ${c.unit}` : "non mesuré"} ; ${t.code} : ${r.value} ${r.unit} — ${compare(c, r).text}`, `Essai ${t.code}, lot ${t.lot}${c.referenceSource ? ` · référence : ${c.referenceSource}` : ""}`);
        }
      }
      f.criteria.filter((c) => !c.reference.trim()).forEach((c) => gaps.push(`${c.label} : valeur du princeps non mesurée`));
      return { lines, gaps, href: `${base}/formulation` };
    }
    case "rd-rapports": {
      const be = beOf(p);
      beDocuments(be).forEach((d) => add(`${be.deliverable?.kind ?? "Document"} : ${d.name}`, `Rattaché le ${formatDateTime(d.at)}`));
      lines.push(...dataLines(p, ["dissolution"], gaps));
      if (!beDocuments(be).length) gaps.push("Aucun rapport de dissolution ou de bioéquivalence rattaché");
      return { lines, gaps, href: `${base}/bioequivalence` };
    }
    case "m5-dispense": {
      const be = beOf(p);
      if (be.orientation !== "Dispense à examiner") {
        if (be.orientation) add(`Stratégie retenue : ${be.orientation} — aucune dispense n'est demandée`, "Étape Bioéquivalence");
        return { lines, gaps, href: `${base}/bioequivalence` };
      }
      add(`Résultat : ${waiverStatus(be).toLowerCase()} (jamais « dispense accordée »)`, "Étape Bioéquivalence");
      be.criteria.forEach((c) => (c.state === "Preuve disponible" ? add(`${c.label} — preuve : ${c.evidence}`, c.source || "Référence à préciser") : gaps.push(`${c.label} : ${c.state.toLowerCase()}${c.missing ? ` — ${c.missing}` : ""}`)));
      return { lines, gaps, href: `${base}/bioequivalence` };
    }
    case "m5-conclusion": {
      const be = beOf(p);
      const st = stabilityOf(p);
      if (be.validated) add(`Conclusion de l'étude de bioéquivalence : ${be.validated.conclusion}`, `Validée par ${be.validated.by}`);
      else gaps.push("Étude de bioéquivalence non validée");
      if (be.limits) add(`Limites et inconnues : ${be.limits}`, "Stratégie de bioéquivalence");
      if (st.conclusion) add(`Conclusion de stabilité${st.conclusion.partial ? " intermédiaire" : ""} : ${st.conclusion.text}`, `Approuvée par ${st.conclusion.by}`);
      return { lines, gaps, href: `${base}/bioequivalence` };
    }
    case "nonclinique":
      return { lines, gaps: [], href: `${base}/dossier` };
    default:
      return { lines, gaps: [], href: `${base}/dossier` };
  }
}

/** Mandatory decisions of the pathway: those taken, and those missing. */
function decisionLines(p: Project): { done: string[]; missing: string[] } {
  const done: string[] = [];
  const missing: string[] = [];
  const c = p.cadrage!;
  if (c.g0.status === "Approuvée") done.push(`G0 — Cadrage approuvé par ${c.g0.decidedBy ?? "—"} : ${c.g0.justification ?? ""}`);
  else missing.push("G0 — Cadrage non approuvé");
  const g1 = p.feasibility?.decisions[0];
  if (g1?.choice === "Lancer") done.push(`G1 — Faisabilité : lancer. ${g1.justification}`);
  else missing.push("G1 — Décision de lancement absente");
  const g2 = p.princeps?.versions[0];
  if (g2) done.push(`G2 — Fiche princeps v${g2.n} validée (${g2.scope.toLowerCase()}). Stratégie : ${g2.strategy}`);
  else missing.push("G2 — Fiche princeps non validée");
  const f = formulationOf(p);
  const kept = f.options.find((o) => o.id === f.decision?.optionId);
  if (kept && f.decision) done.push(`G3 — ${optionLabel(kept)} retenue. ${f.decision.justification}`);
  else missing.push("G3 — Formule non retenue");
  const g4 = validationOf(p).g4;
  if (g4?.choice === "Préparer le dossier") done.push(`G4 — Confirmation par ${g4.by} : ${g4.justification}`);
  else missing.push("G4 — Confirmation non décidée");
  return { done, missing };
}

/* ------------------------------------------------------------------ */
/* Gate G4                                                             */
/* ------------------------------------------------------------------ */

export interface Requirement {
  label: string;
  ok: boolean;
  detail: string;
  href: string;
}

/** "Les résultats requis permettent-ils de préparer le dossier ?" */
export function g4Requirements(p: Project): Requirement[] {
  const base = `/projets/${p.slug}`;
  const q = qualityOf(p);
  const st = stabilityOf(p);
  const be = beOf(p);
  const open = openInvestigations(q).length;
  return [
    { label: "Formule et procédé retenus (G3)", ok: Boolean(p.formulation?.decision), detail: p.formulation?.decision ? "Décision enregistrée" : "Aucune formule retenue", href: `${base}/formulation` },
    { label: "Lot pilote revu", ok: q.pilot.status === "Revu", detail: q.pilot.lot ? `Lot ${q.pilot.lot} — ${q.pilot.status.toLowerCase()}` : "Lot non identifié", href: `${base}/qualite` },
    { label: "Aucune investigation ouverte", ok: open === 0, detail: open ? `${open} résultat(s) hors limite à investiguer` : "Aucune", href: `${base}/qualite` },
    { label: "Conclusion de stabilité approuvée", ok: Boolean(st.conclusion), detail: st.conclusion ? `${st.conclusion.partial ? `Intermédiaire (${st.conclusion.progress}) — par` : "Par"} ${st.conclusion.by}` : st.approvedAt ? "Étude en cours" : "Plan non approuvé", href: `${base}/stabilite` },
    { label: "Stratégie de bioéquivalence approuvée", ok: beApproved(be), detail: beApproved(be) ? String(be.orientation) : "Deux approbations attendues", href: `${base}/bioequivalence` },
    { label: "Étude de bioéquivalence validée", ok: beApproved(be) && Boolean(be.validated), detail: be.validated && beApproved(be) ? `Par ${be.validated.by}` : "Validation de l'étude attendue", href: `${base}/bioequivalence` },
  ];
}

/* ------------------------------------------------------------------ */
/* Consistency checks and gaps                                         */
/* ------------------------------------------------------------------ */

export type Impact = "Bloquant" | "Majeur" | "Mineur";
export const IMPACT_TONE = { Bloquant: "danger", Majeur: "warn", Mineur: "neutral" } as const;

export interface Check {
  label: string;
  ok: boolean;
  detail: string;
  impact: Impact;
  /** What to do, and where. */
  action: string;
  href: string;
}

const isUsed = (p: Project, feed: string) => validationOf(p).sections.some((s) => s.feed === feed && s.applicable);

export function consistencyChecks(p: Project): Check[] {
  const base = `/projets/${p.slug}`;
  const data = allData(p);
  const q = qualityOf(p);
  const st = stabilityOf(p);
  const f = formulationOf(p);
  const v = validationOf(p);
  const identity = data.filter((d) => d.critical);
  const unverified = identity.filter((d) => !isVerified(d));
  const conflicts = data.filter((d) => d.status === "Contradictoire");
  const kept = f.options.find((o) => o.id === f.decision?.optionId);
  const decisions = decisionLines(p);
  const packaging = data.find((d) => d.key === "packaging")?.value ?? "";
  const followed = q.specs.filter((s) => st.specIds.includes(s.id));
  const notApproved = q.specs.filter((s) => !s.approved);
  const na = v.sections.filter((s) => !s.applicable);
  const naOpen = na.filter((s) => !s.naReason.trim() || !s.naApprovedBy);
  const dosage = data.find((d) => d.key === "dosage")?.value ?? "";
  const checks: Check[] = [
    {
      label: "Identité du produit et dosage vérifiés",
      ok: unverified.length === 0 && identity.length > 0,
      detail: unverified.length ? `Non vérifié : ${unverified.map((d) => d.label.toLowerCase()).join(", ")}` : `${p.name} — ${dosage || p.dosage}`,
      impact: "Bloquant",
      action: "Vérifier les valeurs d'identité",
      href: `${base}/cadrage`,
    },
    {
      label: "Aucune contradiction entre sources non résolue",
      ok: conflicts.length === 0,
      detail: conflicts.length ? conflicts.map((d) => d.label).join(", ") : "Aucune",
      impact: "Bloquant",
      action: "Résoudre la contradiction",
      href: `${base}/princeps`,
    },
    {
      label: "Décisions obligatoires approuvées (G0 à G4)",
      ok: decisions.missing.length === 0,
      detail: decisions.missing.length ? decisions.missing.join(" · ") : "Toutes les décisions sont enregistrées",
      impact: "Bloquant",
      action: "Prendre la décision manquante",
      href: decisions.missing[0]?.startsWith("G4") ? `${base}/dossier` : decisions.missing[0]?.startsWith("G3") ? `${base}/formulation` : decisions.missing[0]?.startsWith("G2") ? `${base}/princeps` : decisions.missing[0]?.startsWith("G1") ? `${base}/faisabilite` : `${base}/cadrage`,
    },
    {
      label: "Même formule retenue dans les sections concernées",
      ok: Boolean(kept) && kept!.components.every((c) => c.qty.trim()),
      detail: !kept ? "Aucune formule retenue" : kept.components.some((c) => !c.qty.trim()) ? `${optionLabel(kept)} : quantités non définies pour ${kept.components.filter((c) => !c.qty.trim()).map((c) => c.name).join(", ")}` : `${optionLabel(kept)} — composition complète`,
      impact: "Majeur",
      action: "Compléter la composition retenue",
      href: `${base}/formulation`,
    },
    {
      label: "Méthodes et spécifications dans leur version approuvée",
      ok: q.specs.length > 0 && notApproved.length === 0,
      detail: !q.specs.length ? "Aucune spécification" : notApproved.length ? `Non approuvées : ${notApproved.map((s) => s.test).join(", ")}` : `${q.specs.length} spécification(s) approuvée(s)`,
      impact: "Bloquant",
      action: "Approuver les spécifications",
      href: `${base}/qualite`,
    },
    {
      label: "Synthèses compatibles avec les résultats détaillés",
      ok: openInvestigations(q).length === 0 && !st.entries.some((e) => e.status === "À investiguer"),
      detail: openInvestigations(q).length || st.entries.some((e) => e.status === "À investiguer") ? "Des résultats hors limite restent à investiguer" : "Aucun résultat hors limite en attente",
      impact: "Bloquant",
      action: "Clôturer les investigations",
      href: openInvestigations(q).length ? `${base}/qualite` : `${base}/stabilite`,
    },
  ];
  if (isUsed(p, "stabilite")) {
    checks.push(
      {
        label: "Même lot entre le lot pilote et la stabilité",
        ok: Boolean(q.pilot.lot) && st.lots.includes(q.pilot.lot),
        detail: !q.pilot.lot ? "Lot pilote non identifié" : st.lots.includes(q.pilot.lot) ? `Lot ${q.pilot.lot} suivi en stabilité` : `Lot pilote ${q.pilot.lot} absent du plan de stabilité (${st.lots.join(", ") || "aucun lot"})`,
        impact: "Majeur",
        action: "Aligner les lots du plan de stabilité",
        href: `${base}/stabilite`,
      },
      {
        label: "Même conditionnement entre le cadrage et la stabilité",
        ok: Boolean(packaging && st.packaging) && packaging.trim().toLowerCase() === st.packaging.trim().toLowerCase(),
        detail: !packaging || !st.packaging ? "Conditionnement non renseigné des deux côtés" : packaging.trim().toLowerCase() === st.packaging.trim().toLowerCase() ? st.packaging : `Cadrage : « ${packaging} » · stabilité : « ${st.packaging} »`,
        impact: "Mineur",
        action: "Vérifier le conditionnement étudié",
        href: `${base}/stabilite`,
      },
      {
        label: "Analyses de stabilité rattachées à des spécifications approuvées",
        ok: followed.length > 0 && followed.every((s) => s.approved),
        detail: !followed.length ? "Aucune analyse suivie" : followed.every((s) => s.approved) ? `${followed.length} analyse(s)` : `Non approuvées : ${followed.filter((s) => !s.approved).map((s) => s.test).join(", ")}`,
        impact: "Majeur",
        action: "Approuver les spécifications suivies",
        href: `${base}/qualite`,
      },
      { label: "Preuve de stabilité disponible", ok: Boolean(st.conclusion) && !st.conclusion?.partial, detail: !st.conclusion ? "Conclusion non approuvée" : st.conclusion.partial ? `Conclusion intermédiaire seulement (${st.conclusion.progress}) : approuvez les échéances requises ou retirez-les des échéances requises du plan` : "Conclusion approuvée", impact: "Bloquant", action: "Approuver la conclusion de stabilité", href: `${base}/stabilite` },
    );
  }
  if (isUsed(p, "bioequivalence")) {
    const be = beOf(p);
    checks.push({ label: "Preuve de bioéquivalence disponible", ok: beApproved(be) && Boolean(be.deliverable), detail: !beApproved(be) ? "Stratégie non approuvée" : be.deliverable ? `${be.deliverable.kind} : ${be.deliverable.name}` : "Stratégie approuvée, document non rattaché", impact: "Bloquant", action: "Rattacher le rapport ou l'argumentaire", href: `${base}/bioequivalence` });
  }
  checks.push({
    label: "Sections non applicables justifiées et approuvées",
    ok: naOpen.length === 0,
    detail: !na.length ? "Aucune section déclarée non applicable" : naOpen.length ? `À justifier ou approuver : ${naOpen.map((s) => s.title).join(", ")}` : `${na.length} justification(s) approuvée(s)`,
    impact: "Bloquant",
    action: "Justifier et faire approuver",
    href: `${base}/dossier`,
  });
  return checks;
}

export interface Gap {
  /** Stable identity of the gap, used to record that it was handled with a justification. */
  key: string;
  label: string;
  detail: string;
  impact: Impact;
  action: string;
  href: string;
  /** Handled on the page by a person, with a justification: it no longer blocks, and stays visible. */
  handled?: { by: string; at: string; reason: string; details?: { label: string; value: string }[] };
}

export interface GapForm {
  title: string;
  /** What is concerned (prefilled with the finding), what is retained for it, and who answers for it. */
  subject: string;
  value: string;
  valueHint: string;
  person: string;
  reason: string;
}

/** Wording of the form that handles a gap, in the vocabulary of what the gap is about. */
export function gapForm(gap: Pick<Gap, "key" | "label">): GapForm {
  const text = `${gap.key} ${gap.label}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => text.includes(w));
  if (has("vide|")) return { title: "Traiter la section vide", subject: "Section concernée", value: "Contenu prévu ou renvoi vers un autre document", valueHint: "Ex. renvoi au module ou au rapport qui porte ce contenu", person: "Rédacteur responsable de la section", reason: "Pourquoi la section peut rester ainsi dans cette version" };
  if (has("bioéquivalence", "bioequivalence")) return { title: "Traiter la preuve de bioéquivalence", subject: "Étude ou argumentaire concerné", value: "Rapport d'étude ou argumentaire retenu (référence, version)", valueHint: "Ex. rapport du CRO, référence et date", person: "Responsable bioéquivalence", reason: "Justification scientifique et réglementaire" };
  if (has("stabilit", "échéance")) return { title: "Traiter le point de stabilité", subject: "Lot, condition ou échéance concernés", value: "Résultats ou rapport de stabilité retenus", valueHint: "Ex. T0 et M3 approuvés, rapport de stabilité v1", person: "Responsable stabilité", reason: "Justification des données de stabilité retenues" };
  if (has("méthode", "methode", "spécification", "specs|", "impureté", "investigation")) return { title: "Traiter la méthode ou la spécification", subject: "Méthode ou spécification concernée", value: "Version approuvée de la méthode / limite retenue et son origine", valueHint: "Ex. méthode interne M-012 v2 ; limite ≥ 80 % (pharmacopée)", person: "Responsable analytique qui approuve", reason: "Justification analytique" };
  if (has("matière", "matieres|")) return { title: "Traiter la matière première", subject: "Matière première et lot fournisseur concernés", value: "Décision de libération et contrôle réalisé", valueHint: "Ex. utilisable — certificat et résultats revus", person: "Responsable contrôle qualité", reason: "Justification de la décision" };
  if (has("formule", "composition", "quantité", "formule|")) return { title: "Traiter la formule", subject: "Composant ou paramètre de la formule concerné", value: "Quantité ou valeur retenue", valueHint: "Ex. 95 mg par unité, selon l'essai E-02", person: "Responsable formulation", reason: "Justification galénique" };
  if (has("lot", "conditionnement", "fabrication")) return { title: "Traiter le lot ou le conditionnement", subject: "Lot ou conditionnement concerné", value: "Lot ou conditionnement retenu pour le dossier", valueHint: "Ex. lot pilote LP-001, plaquettes PVC/aluminium", person: "Responsable production ou qualité", reason: "Justification de la cohérence entre les étapes" };
  if (has("décision", "g0", "g1", "g2", "g3", "g4", "synthese|")) return { title: "Traiter la décision manquante", subject: "Décision concernée", value: "Référence de la décision (comité, date, compte rendu)", valueHint: "Ex. comité du 12/09, compte rendu CR-08", person: "Décideur", reason: "Conditions et réserves de la décision" };
  if (has("non applicable")) return { title: "Traiter la non-applicabilité", subject: "Section concernée", value: "Motif de non-applicabilité retenu", valueHint: "Ex. non requis pour un générique sur ce marché", person: "Responsable réglementaire qui approuve", reason: "Référence réglementaire de la justification" };
  if (has("contradiction")) return { title: "Traiter la contradiction entre sources", subject: "Donnée en contradiction", value: "Valeur retenue et document qui fait foi", valueHint: "Ex. valeur du RCP en vigueur, rubrique 6.4", person: "Personne qui tranche", reason: "Pourquoi cette source prévaut" };
  return { title: "Traiter la donnée manquante", subject: "Donnée concernée", value: "Valeur retenue et sa source (document, emplacement)", valueHint: "Ex. classe BCS I — monographie, section 3", person: "Personne qui a vérifié la donnée", reason: "Justification" };
}

/** Everything that is missing, by impact: failed checks, empty sections and gaps of the data feeding them. */
export function allGaps(p: Project): Gap[] {
  const v = validationOf(p);
  const list: Gap[] = consistencyChecks(p)
    .filter((c) => !c.ok)
    .map((c) => ({ key: c.label, label: c.label, detail: c.detail, impact: c.impact, action: c.action, href: c.href }));
  for (const s of v.sections.filter((x) => x.applicable)) {
    if (!s.content.trim()) list.push({ key: `vide|${s.id}`, label: `Section vide — ${s.title}`, detail: "Aucun contenu rédigé", impact: "Bloquant", action: "Rédiger ou générer le brouillon", href: `/projets/${p.slug}/dossier` });
    const feed = sectionFeed(p, s.feed);
    feed.gaps.forEach((g) => list.push({ key: `${s.feed}|${g}`, label: `${s.title} — donnée manquante`, detail: g, impact: "Majeur", action: "Compléter à la source", href: feed.href }));
  }
  const order = { Bloquant: 0, Majeur: 1, Mineur: 2 };
  return list.map((g) => ({ ...g, handled: v.overrides?.[g.key] })).sort((a, b) => order[a.impact] - order[b.impact]);
}

/** Gaps still open: those handled with a justification no longer count. */
export const gaps = (p: Project): Gap[] => allGaps(p).filter((g) => !g.handled);

/** The review is open once the dossier is submitted or as soon as one section has been validated. */
export const reviewOpen = (v: ValidationFile) => Boolean(v.reviewStartedAt) || v.sections.some((s) => s.applicable && s.review !== "À revoir");

export const isFrozen = (v: ValidationFile) => v.snapshots[0]?.version === v.version;

export function validationState(p: Project): ValidationState {
  const v = validationOf(p);
  if (isFrozen(v)) return "Prêt pour validation interne";
  if (!v.sections.length) return "En constitution";
  const blocking = gaps(p).some((g) => g.impact === "Bloquant");
  if (reviewOpen(v)) {
    if (v.sections.some((s) => s.applicable && s.review === "À corriger")) return "À corriger";
    return blocking ? "Incomplet" : "En revue";
  }
  return blocking ? "Incomplet" : "Prêt pour revue";
}
export const STATE_TONE = { "En constitution": "neutral", Incomplet: "warn", "Prêt pour revue": "info", "En revue": "info", "À corriger": "danger", "Prêt pour validation interne": "success" } as const;

export const canSubmit = (p: Project) => validationState(p) === "Prêt pour revue";
export function canFreeze(p: Project) {
  const v = validationOf(p);
  const applicable = v.sections.filter((s) => s.applicable);
  return !isFrozen(v) && applicable.length > 0 && applicable.every((s) => s.review === "Approuvée") && !gaps(p).some((g) => g.impact === "Bloquant");
}

/** Narrative draft of a section: one sentence per established fact, each with its proof. */
export function draftFor(p: Project, s: ValidationSection): string {
  const feed = sectionFeed(p, s.feed);
  if (!feed.lines.length) return "";
  return feed.lines.map((l) => `${l.text} [source : ${l.source}]`).join("\n");
}

/** Characters the PDF font cannot draw, written with plain equivalents. */
const pdfText = (t: string) => t.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/→/g, "->").replace(/×/g, "x").replace(/★/g, "*").replace(/[\u2000-\u200a\u202f]/g, " ");

/** Dossier organised by CTD module, as the lines of a PDF: scope, decisions, sections, checks and completeness report. */
export function dossierPdf(p: Project): PdfLine[] {
  const v = validationOf(p);
  const frozen = isFrozen(v) ? v.snapshots[0] : undefined;
  const lines: PdfLine[] = [
    { text: "Dossier de validation", size: 20, bold: true },
    { text: `${p.code} • ${p.name}${p.name.includes(p.dosage) ? "" : ` ${p.dosage}`}`, size: 14, bold: true, gap: 4 },
    { text: `Version ${v.version} — ${validationState(p)}`, gap: 10 },
    { text: `Marché : ${v.market || "à choisir"}` },
    { text: `Procédure : ${v.procedure || "à renseigner"}` },
    ...(v.variants ? [{ text: `Variantes couvertes : ${v.variants}` }] : []),
    ...COVER_FIELDS.filter((f) => v.cover?.[f.key]).map((f) => ({ text: `${f.label} : ${v.cover![f.key]}` })),
    ...(frozen ? [{ text: `Version figée par ${frozen.by} le ${formatDateTime(frozen.at)}` }] : []),
    ...(v.transmittedAt ? [{ text: `Transmis pour validation interne par ${v.transmittedBy} le ${formatDateTime(v.transmittedAt)}` }] : []),
    { text: "Documents organisés selon les modules du CTD. Ce n'est ni un CTD complet tant que des éléments restent requis, ni un eCTD : aucun format électronique réglementaire n'est produit ni vérifié.", size: 9, gap: 10 },
    { text: "Décisions du parcours", size: 14, bold: true, gap: 18 },
    ...decisionLines(p).done.map((d) => ({ text: `• ${d}`, gap: 3 })),
    ...decisionLines(p).missing.map((d) => ({ text: `• À décider : ${d}`, gap: 3 })),
  ];
  for (const m of MODULES) {
    const sections = v.sections.filter((s) => s.module === m);
    if (!sections.length) continue;
    lines.push({ text: m, size: 14, bold: true, gap: 20 });
    for (const s of sections) {
      lines.push({ text: `${s.title} — ${s.applicable ? s.review : "non applicable"}`, size: 12, bold: true, gap: 12 });
      if (!s.applicable) lines.push({ text: `Motif : ${s.naReason || "à justifier"}${s.naApprovedBy ? ` — approuvé par ${s.naApprovedBy}` : " — approbation attendue"}`, gap: 3 });
      else if (!s.content.trim()) lines.push({ text: "Section vide.", gap: 3 });
      else s.content.split("\n").filter((x) => x.trim()).forEach((x) => lines.push({ text: x, gap: 3 }));
      if (s.comment) lines.push({ text: `Commentaire de revue : ${s.comment}`, size: 9, gap: 3 });
    }
  }
  lines.push({ text: "Contrôles de cohérence", size: 14, bold: true, gap: 20 });
  for (const c of consistencyChecks(p)) {
    const handled = v.overrides?.[c.label];
    lines.push({ text: `${c.ok ? "[Conforme]" : handled ? "[Traité avec justification]" : `[À traiter — ${c.impact}]`} ${c.label}`, bold: true, gap: 6 });
    lines.push({ text: c.detail });
    if (!c.ok && handled) lines.push({ text: `${[...(handled.details ?? []).map((d) => `${d.label} : ${d.value}`), handled.reason].join(" · ")} — ${handled.by}` });
  }
  const every = allGaps(p);
  lines.push({ text: "Rapport de complétude", size: 14, bold: true, gap: 20 });
  if (!every.length) lines.push({ text: "Aucun manque relevé par les contrôles." });
  for (const g of every) {
    lines.push({ text: `${g.handled ? "[Traité]" : `[${g.impact}]`} ${g.label}`, bold: true, gap: 6 });
    lines.push({ text: g.detail });
    lines.push({ text: g.handled ? `${[...(g.handled.details ?? []).map((d) => `${d.label} : ${d.value}`), g.handled.reason].join(" · ")} — ${g.handled.by}` : `Action : ${g.action}` });
  }
  lines.push({ text: "Revue avant dépôt", size: 14, bold: true, gap: 20 });
  for (const f of PREDEPOSIT_FIELDS) {
    lines.push({ text: f.label, bold: true, gap: 6 });
    lines.push({ text: v.preDeposit?.[f.key] || "À renseigner" });
  }
  lines.push({ text: "L'approbation interne pour dépôt ne constitue pas une AMM. Vérifier les exigences nationales et les modalités de soumission avant dépôt.", size: 9, gap: 10 });
  return lines.map((l) => ({ ...l, text: pdfText(l.text) }));
}

/**
 * The dossier laid out like the AMM working form: seven sheets (cover, modules 1 to 5, R&D sheet,
 * review before filing) then the checks. A field takes the content of its section when it is written,
 * otherwise what the project already establishes — said as such — and stays empty when nothing is known.
 */
export function dossierForm(p: Project): PdfFormSheet[] {
  const v = validationOf(p);
  const data = allData(p);
  const value = (key: string) => {
    const d = data.find((x) => x.key === key);
    return d && isVerified(d) ? d.value : "";
  };
  const join = (...parts: string[]) => parts.filter((x) => x.trim()).join(" — ");
  /** Content of the sections fed by these feeds, in order. */
  const from = (...feeds: string[]) =>
    feeds
      .map((feed) => {
        const s = v.sections.find((x) => x.feed === feed);
        if (s && !s.applicable) return `Non applicable : ${s.naReason || "motif à renseigner"}${s.naApprovedBy ? ` (approuvé par ${s.naApprovedBy})` : " (approbation attendue)"}`;
        if (s?.content.trim()) return `${s.content.trim()}${s.review === "Approuvée" ? "" : "\n(section non validée)"}`;
        const lines = sectionFeed(p, feed).lines;
        return lines.length ? `${lines.map((l) => l.text).join("\n")}\n(repris du projet — section à rédiger et à valider)` : "";
      })
      .filter(Boolean)
      .join("\n");
  const f = formulationOf(p);
  const kept = f.options.find((o) => o.id === f.decision?.optionId);
  const frozen = isFrozen(v) ? v.snapshots[0] : undefined;
  const cover = v.cover ?? {};
  const na = v.sections.filter((s) => !s.applicable);
  const open = gaps(p);
  const handled = allGaps(p).filter((g) => g.handled);
  const sheets: PdfFormSheet[] = [
    {
      title: "Identification du médicament",
      subtitle: "01 / Fiche de couverture",
      notes: ["Joindre les rapports et pièces justificatives : cette fiche ne remplace pas le dossier CTD."],
      fields: [
        { label: "Nom du médicament", value: cover.name || p.name },
        { label: "Substance active (DCI) et dosage", value: join(value("dci") || p.dci, value("dosage") || p.dosage) },
        { label: "Forme pharmaceutique et voie d'administration", value: join(value("form") || p.form, value("route")) },
        { label: "Présentation et conditionnement", value: cover.presentation ?? "" },
        { label: "Demandeur / futur titulaire et coordonnées", value: cover.applicant ?? "" },
        { label: "Fabricant(s), site(s) et responsabilités", value: cover.manufacturers ?? "" },
        { label: "Pays de dépôt et type de demande", value: join(v.market, cover.application ?? "", v.procedure) },
        { label: "Code dossier, version, date et responsable", value: join(cover.code ?? "", `version ${v.version}`, frozen ? `figée le ${formatDateTime(frozen.at)}` : validationState(p), cover.owner ?? "") },
      ],
    },
    {
      title: "Pièces administratives",
      subtitle: "02 / Module 1 - Exigences nationales",
      fields: [
        { label: "Demande et formulaire national : références des pièces", value: from("m1-demande") },
        { label: "Autorisations de fabrication et justificatifs BPF / GMP", value: from("m1-bpf") },
        { label: "RCP, notice et étiquetage : références et versions", value: from("m1-rcp") },
        { label: "Pharmacovigilance : pièces applicables", value: from("m1-pv") },
        { label: "Mandats, certificats et autres justificatifs nationaux", value: from("m1-autres") },
        { label: "Documents manquants / non-applicabilité justifiée", value: [...na.map((s) => `${s.title} — non applicable : ${s.naReason || "motif à renseigner"}`), ...open.filter((g) => g.label.startsWith("Section vide")).map((g) => g.label)].join("\n") },
      ],
    },
    {
      title: "Synthèses du dossier",
      subtitle: "03 / Module 2 - Résumés et vues d'ensemble",
      fields: [
        { label: "2.2 - Introduction et présentation du produit", value: from("m2-intro") },
        { label: "2.3 - Résumé global de la qualité : référence et conclusion", value: from("m2-qos") },
        { label: "2.4 / 2.6 - Synthèses non cliniques : références et conclusion", value: from("m2-nonclinique") },
        { label: "2.5 / 2.7 - Synthèses cliniques : références et conclusion", value: from("m2-clinique") },
        { label: "Points critiques, justifications et renvois aux rapports", value: from("m2-critiques", "synthese") },
      ],
    },
    {
      title: "Qualité pharmaceutique",
      subtitle: "04 / Module 3 - Substance active et produit fini",
      fields: [
        { label: "3.2.S - Substance active : fabricant, contrôles et stabilité", value: from("substance") },
        { label: "3.2.P.1 / P.2 - Composition et développement pharmaceutique", value: from("formule") },
        { label: "3.2.P.3 - Fabrication, contrôles en cours et validation", value: from("fabrication") },
        { label: "3.2.P.4 à P.6 - Excipients, produit fini et étalons", value: from("matieres", "specs", "m3-etalons") },
        { label: "3.2.P.7 / P.8 - Conditionnement et stabilité", value: from("m3-conditionnement", "stabilite") },
        { label: "Annexes, informations régionales et rapports associés", value: from("m3-annexes") },
      ],
    },
    {
      title: "Formulation et comparaison",
      subtitle: "05 / Fiche interne R&D - Pièces justificatives à joindre",
      fields: [
        { label: "Formule retenue : code, version, composition et unités", value: kept ? [`${optionLabel(kept)} — ${kept.title}`, ...kept.components.map((c) => `${c.name} (${c.role}) : ${c.qty.trim() ? `${c.qty} ${c.unit}` : "quantité à définir"}`)].join("\n") : "" },
        { label: "Lots expérimentaux et procédés associés", value: from("rd-lots") },
        { label: "Formules écartées et justification du choix", value: from("rd-ecartees") },
        { label: "Princeps : nom, dosage, forme, pays, lot et provenance", value: from("rd-princeps") },
        { label: "Comparaison : critères, résultats, écarts et conclusions", value: from("rd-comparaison") },
        { label: "Rapports de dissolution / bioéquivalence : références", value: from("rd-rapports") },
      ],
    },
    {
      title: "Données non cliniques et cliniques",
      subtitle: "06 / Modules 4 et 5 - Selon la base réglementaire",
      notes: ["Pour un générique, documenter les données pertinentes et les dispenses justifiées.", "La comparaison in vitro ne remplace pas automatiquement une étude de bioéquivalence."],
      fields: [
        { label: "Module 4 - Bibliographie et rapports non cliniques pertinents", value: from("nonclinique") },
        { label: "Module 4 - Justification des données non fournies", value: from("m4-justification") },
        { label: "Module 5 - Études cliniques / bioéquivalence : références", value: from("bioequivalence") },
        { label: "Module 5 - Demande de dispense : justification, si applicable", value: from("m5-dispense") },
        { label: "Conclusion scientifique et points restant à résoudre", value: from("m5-conclusion") },
      ],
    },
    {
      title: "Revue avant dépôt",
      subtitle: "07 / Contrôle interne et approbation",
      fields: PREDEPOSIT_FIELDS.map((field) => ({
        label: field.key === "approver" ? "Approbateur : nom, fonction, date et signature manuscrite" : field.label,
        value: field.key === "missing" ? [v.preDeposit?.missing ?? "", ...open.map((g) => `[${g.impact}] ${g.label} — ${g.detail}. Action : ${g.action}`)].filter(Boolean).join("\n") : (v.preDeposit?.[field.key] ?? ""),
      })),
      closing: ["L'approbation interne pour dépôt ne constitue pas une AMM.", "Structure de référence : ICH CTD - https://www.ich.org/page/ctd", "Vérifier les exigences nationales et les modalités de soumission avant dépôt."],
    },
    {
      title: "Contrôles de cohérence",
      subtitle: "Annexe / Contrôles de la plateforme et manques traités",
      notes: ["Documents organisés selon les modules du CTD. Ce n'est ni un CTD complet tant que des éléments restent requis, ni un eCTD."],
      fields: [
        ...consistencyChecks(p).map((c) => {
          const done = v.overrides?.[c.label];
          return { label: `${c.ok ? "[Conforme]" : done ? "[Traité avec justification]" : `[À traiter - ${c.impact}]`} ${c.label}`, value: !c.ok && done ? `${c.detail}\n${[...(done.details ?? []).map((d) => `${d.label} : ${d.value}`), done.reason].join(" · ")} — ${done.by}` : c.detail };
        }),
        ...handled.filter((g) => !consistencyChecks(p).some((c) => c.label === g.key)).map((g) => ({ label: `[Traité] ${g.label}`, value: `${g.detail}\n${[...(g.handled!.details ?? []).map((d) => `${d.label} : ${d.value}`), g.handled!.reason].join(" · ")} — ${g.handled!.by}` })),
      ],
    },
  ];
  return sheets.map((s) => ({ ...s, title: pdfText(s.title), subtitle: pdfText(s.subtitle), fields: s.fields.map((x) => ({ label: pdfText(x.label), value: pdfText(x.value) })) }));
}

/** Dossier organised by CTD module, as text. */
export function dossierText(p: Project): string {
  const v = validationOf(p);
  const state = validationState(p);
  const out = [
    `# Dossier de validation — ${p.code} • ${p.name} ${p.dosage}`,
    "",
    `Version ${v.version} · état : ${state} · marché : ${v.market || "à choisir"} · procédure : ${v.procedure || "à renseigner"}`,
    "",
    "> Documents organisés selon les modules du CTD. Ce n'est ni un CTD complet tant que des éléments restent requis, ni un eCTD : aucun format électronique réglementaire n'est produit ni vérifié.",
    "",
  ];
  for (const m of MODULES) {
    const sections = v.sections.filter((s) => s.module === m);
    if (!sections.length) continue;
    out.push(`## ${m}`, "");
    for (const s of sections) {
      out.push(`### ${s.title}`, "");
      out.push(s.applicable ? s.content || "_Section vide._" : `_Non applicable._ Motif : ${s.naReason || "à justifier"}${s.naApprovedBy ? ` — approuvé par ${s.naApprovedBy}` : " — approbation attendue"}`, "");
    }
  }
  const open = gaps(p);
  out.push("## Rapport de complétude", "");
  out.push(...(open.length ? open.map((g) => `- [${g.impact}] ${g.label} — ${g.detail}. Action : ${g.action}.`) : ["- Aucun manque relevé par les contrôles."]));
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

const find = (s: DemoState, code: string) => s.projects.find((p) => p.code === code && p.cadrage);
const labelOf = (p: Project) => `${p.code} • ${p.name}`;
const hrefOf = (p: Project) => `/projets/${p.slug}/dossier`;
const patch = (s: DemoState, code: string, update: (v: ValidationFile, p: Project) => ValidationFile): DemoState => ({
  ...s,
  projects: s.projects.map((p) => (p.code === code && p.cadrage ? { ...p, validation: update(validationOf(p), p) } : p)),
});
const event = (s: DemoState, p: Project, title: string, type: "Ajout" | "Modification" | "Approbation" | "Soumission" | "Création", description?: string) =>
  withEvent(s, { projectCode: p.code, title, context: labelOf(p), object: "Dossier", objectLabel: `${labelOf(p)} • Dossier de validation`, type, description, icon: type === "Approbation" ? "check" : type === "Soumission" ? "send" : "doc", href: hrefOf(p) });
/** A frozen version is intact: nothing is written to it. */
const editable = (s: DemoState, code: string) => {
  const p = find(s, code);
  return p && !isFrozen(validationOf(p)) ? p : undefined;
};

export const validation = {
  decideG4(s: DemoState, code: string, choice: "Préparer le dossier" | "Compléter", justification: string): DemoState {
    const p = find(s, code);
    if (!p || !justification.trim()) return s;
    // With a requirement missing, the decision is conditional: its justification states the conditions.
    const missing = g4Requirements(p).filter((r) => !r.ok).map((r) => r.label);
    const conditional = choice === "Préparer le dossier" && missing.length > 0;
    const next = patch(s, code, (v) => ({ ...v, g4: { choice, justification: justification.trim(), at: stamp(), by: CURRENT_USER, conditional: conditional || undefined } }));
    return sync(event(next, p, `Porte G4 — ${choice === "Préparer le dossier" ? (conditional ? "préparation du dossier décidée sous conditions" : "préparation du dossier décidée") : "compléments demandés"}`, "Approbation", `${justification.trim()}${conditional ? ` — Reste à réunir : ${missing.join(", ")}.` : ""}`), code);
  },

  saveScope(s: DemoState, code: string, scope: { market: string; procedure: string; variants: string }): DemoState {
    const p = editable(s, code);
    if (!p) return s;
    const next = patch(s, code, (v) => ({ ...v, market: scope.market.trim(), procedure: scope.procedure.trim(), variants: scope.variants.trim() }));
    return sync(event(next, p, "Périmètre du dossier enregistré", "Modification", `Marché : ${scope.market || "à choisir"} · procédure : ${scope.procedure || "à renseigner"}`), code);
  },

  saveCover(s: DemoState, code: string, cover: Record<string, string>): DemoState {
    const p = editable(s, code);
    if (!p) return s;
    const clean = Object.fromEntries(Object.entries(cover).map(([k, x]) => [k, x.trim()]));
    return sync(event(patch(s, code, (v) => ({ ...v, cover: clean })), p, "Fiche de couverture du dossier enregistrée", "Modification", COVER_FIELDS.filter((f) => clean[f.key]).map((f) => `${f.label} : ${clean[f.key]}`).join(" · ") || undefined), code);
  },

  /** Review before filing: recorded even on a frozen version, since it is held on that version. */
  savePreDeposit(s: DemoState, code: string, values: Record<string, string>): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const clean = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()]));
    return sync(event(patch(s, code, (v) => ({ ...v, preDeposit: clean })), p, "Revue avant dépôt enregistrée", "Modification", clean.decision ? `Décision interne : ${clean.decision}` : undefined), code);
  },

  /** Adds the proposed sections that are not in the list yet. */
  proposeSections(s: DemoState, code: string): DemoState {
    const p = editable(s, code);
    if (!p) return s;
    const have = new Set(validationOf(p).sections.map((x) => x.feed));
    const added: ValidationSection[] = PROPOSED.filter((x) => !have.has(x.feed)).map((x) => ({ id: uid("vs"), feed: x.feed, module: MODULES[x.module], title: x.title, applicable: true, naReason: "", content: "", review: "À revoir", comment: "" }));
    if (!added.length) return s;
    const next = patch(s, code, (v) => ({ ...v, sections: [...v.sections, ...added] }));
    return sync(event(next, p, `${added.length} sections proposées pour le dossier`, "Ajout", "Liste à ajuster selon le marché et la procédure ; chaque section non applicable doit être justifiée."), code);
  },

  addSection(s: DemoState, code: string, input: { module: string; title: string }): DemoState {
    const p = editable(s, code);
    if (!p || !input.title.trim()) return s;
    const next = patch(s, code, (v) => ({ ...v, sections: [...v.sections, { id: uid("vs"), feed: "libre", module: input.module, title: input.title.trim(), applicable: true, naReason: "", content: "", review: "À revoir", comment: "" }] }));
    return sync(event(next, p, `Section ajoutée — ${input.title.trim()}`, "Ajout", input.module), code);
  },

  removeSection(s: DemoState, code: string, id: string): DemoState {
    if (!editable(s, code)) return s;
    return sync(patch(s, code, (v) => ({ ...v, sections: v.sections.filter((x) => x.id !== id) })), code);
  },

  /** A change of content sends the section back to review. */
  saveSection(s: DemoState, code: string, id: string, input: { content: string; applicable: boolean; naReason: string }): DemoState {
    const p = editable(s, code);
    const before = p && validationOf(p).sections.find((x) => x.id === id);
    if (!p || !before) return s;
    const changedNa = before.applicable !== input.applicable || before.naReason !== input.naReason.trim();
    const next = patch(s, code, (v) => ({
      ...v,
      sections: v.sections.map((x) => (x.id === id ? { ...x, content: input.content.trim(), applicable: input.applicable, naReason: input.applicable ? "" : input.naReason.trim(), naApprovedBy: changedNa ? undefined : x.naApprovedBy, review: "À revoir" } : x)),
    }));
    return sync(event(next, p, `Section mise à jour — ${before.title}`, "Modification", input.applicable ? undefined : `Déclarée non applicable : ${input.naReason.trim() || "motif à renseigner"}`), code);
  },

  /** Saves the content and validates the section in one action. */
  saveAndApprove(s: DemoState, code: string, id: string, input: { content: string; applicable: boolean; naReason: string }): DemoState {
    if (!input.applicable || !input.content.trim()) return s;
    return validation.reviewSection(validation.saveSection(s, code, id, input), code, id, "Approuvée", "");
  },

  /** Fills the section with the facts established in the project, each with its proof. */
  generateDraft(s: DemoState, code: string, id: string): DemoState {
    const p = editable(s, code);
    const section = p && validationOf(p).sections.find((x) => x.id === id);
    if (!p || !section) return s;
    const draft = draftFor(p, section);
    if (!draft) return s;
    const next = patch(s, code, (v) => ({ ...v, sections: v.sections.map((x) => (x.id === id ? { ...x, content: draft, review: "À revoir" } : x)) }));
    return sync(event(next, p, `Brouillon généré — ${section.title}`, "Modification", "Brouillon construit à partir des données approuvées du projet ; à relire avant la revue."), code);
  },

  approveNa(s: DemoState, code: string, id: string, by: string): DemoState {
    const p = editable(s, code);
    const section = p && validationOf(p).sections.find((x) => x.id === id);
    if (!p || !section || section.applicable || !section.naReason.trim() || !by.trim()) return s;
    const next = patch(s, code, (v) => ({ ...v, sections: v.sections.map((x) => (x.id === id ? { ...x, naApprovedBy: by.trim() } : x)) }));
    return sync(event(next, p, `Non-applicabilité approuvée — ${section.title}`, "Approbation", `${section.naReason} — par ${by.trim()}`), code);
  },

  submitReview(s: DemoState, code: string): DemoState {
    const p = editable(s, code);
    if (!p || !canSubmit(p)) return s;
    const next = patch(s, code, (v) => ({ ...v, reviewStartedAt: stamp() }));
    return sync(event(next, p, `Dossier v${validationOf(p).version} soumis à la revue`, "Soumission", `${validationOf(p).sections.filter((x) => x.applicable).length} section(s) à revoir.`), code);
  },

  reviewSection(s: DemoState, code: string, id: string, verdict: "Approuvée" | "À corriger", comment: string): DemoState {
    const p = editable(s, code);
    const section = p && validationOf(p).sections.find((x) => x.id === id);
    if (!p || !section || !section.applicable) return s;
    if (verdict === "À corriger" && !comment.trim()) return s;
    if (verdict === "Approuvée" && !section.content.trim()) return s;
    // Validating a section opens the review when the dossier was not submitted first.
    const next = patch(s, code, (v) => ({ ...v, reviewStartedAt: v.reviewStartedAt ?? stamp(), sections: v.sections.map((x) => (x.id === id ? { ...x, review: verdict, comment: comment.trim() } : x)) }));
    return sync(event(next, p, `Section ${verdict === "Approuvée" ? "approuvée" : "à corriger"} — ${section.title}`, verdict === "Approuvée" ? "Approbation" : "Modification", comment.trim() || undefined), code);
  },

  /** Freezes data, sources, documents and decisions of the version: the dossier is ready for internal validation. */
  freeze(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    if (!p || !canFreeze(p)) return s;
    const v = validationOf(p);
    const snapshot: ValidationSnapshot = {
      version: v.version,
      at: stamp(),
      by: CURRENT_USER,
      scope: `${v.market} · ${v.procedure}${v.variants ? ` · ${v.variants}` : ""}`,
      sections: v.sections.map((x) => ({ module: x.module, title: x.title, status: x.applicable ? x.review : "Non applicable", content: x.applicable ? x.content : `Non applicable : ${x.naReason} (approuvé par ${x.naApprovedBy})` })),
      checks: consistencyChecks(p).map((c) => {
        const handled = v.overrides?.[c.label];
        return { label: c.label, ok: c.ok || Boolean(handled), detail: !c.ok && handled ? `Traité par ${handled.by} : ${[...(handled.details ?? []).map((d) => `${d.label} : ${d.value}`), handled.reason].join(" · ")} (constat : ${c.detail})` : c.detail };
      }),
      decisions: decisionLines(p).done,
    };
    const next = patch(s, code, (x) => ({ ...x, snapshots: [snapshot, ...x.snapshots] }));
    return sync(event(next, p, `Dossier v${v.version} figé — prêt pour validation interne`, "Approbation", "Instantané des sections, contrôles et décisions conservé. Une modification ouvrira une nouvelle version."), code);
  },

  /** Opens the next version: the frozen one stays intact, reviews start again. */
  newVersion(s: DemoState, code: string, reason: string): DemoState {
    const p = find(s, code);
    if (!p || !isFrozen(validationOf(p)) || !reason.trim()) return s;
    const next = patch(s, code, (v) => ({ ...v, version: v.version + 1, reviewStartedAt: undefined, transmittedAt: undefined, transmittedBy: undefined, sections: v.sections.map((x) => ({ ...x, review: "À revoir", comment: "" })) }));
    return sync(event(next, p, `Dossier v${validationOf(p).version + 1} ouvert`, "Création", `Motif : ${reason.trim()}. La version ${validationOf(p).version} reste figée.`), code);
  },

  /** Reopens the gate G4 to decide again (the earlier decision stays in the history). */
  reopenG4(s: DemoState, code: string): DemoState {
    const p = editable(s, code);
    if (!p || !validationOf(p).g4) return s;
    return sync(event(patch(s, code, (v) => ({ ...v, g4: undefined })), p, "Porte G4 rouverte", "Modification", `Décision précédente : ${validationOf(p).g4!.choice} — ${validationOf(p).g4!.justification}`), code);
  },

  /** A person handles a gap on the page, with a justification: traceable, visible, and no longer blocking. */
  handleGap(s: DemoState, code: string, key: string, label: string, by: string, reason: string, details: { label: string; value: string }[] = []): DemoState {
    const p = editable(s, code);
    if (!p || !by.trim() || !reason.trim()) return s;
    const kept = details.map((d) => ({ label: d.label, value: d.value.trim() })).filter((d) => d.value);
    const next = patch(s, code, (v) => ({ ...v, overrides: { ...v.overrides, [key]: { by: by.trim(), at: stamp(), reason: reason.trim(), details: kept.length ? kept : undefined } } }));
    return sync(event(next, p, `Manque traité avec justification — ${label}`, "Approbation", `${kept.map((d) => `${d.label} : ${d.value}`).join(" · ")}${kept.length ? " · " : ""}${reason.trim()} — ${by.trim()}.`), code);
  },

  reopenGap(s: DemoState, code: string, key: string, label: string): DemoState {
    const p = editable(s, code);
    if (!p || !validationOf(p).overrides?.[key]) return s;
    const next = patch(s, code, (v) => ({ ...v, overrides: Object.fromEntries(Object.entries(v.overrides ?? {}).filter(([k]) => k !== key)) }));
    return sync(event(next, p, `Manque rouvert — ${label}`, "Modification"), code);
  },

  /** Distinct, authorised action: handing the frozen version over for internal validation. */
  transmit(s: DemoState, code: string, by: string): DemoState {
    const p = find(s, code);
    if (!p || !isFrozen(validationOf(p)) || validationOf(p).transmittedAt || !by.trim()) return s;
    const next = patch(s, code, (v) => ({ ...v, transmittedAt: stamp(), transmittedBy: by.trim() }));
    return sync(event(next, p, `Dossier v${validationOf(p).version} transmis pour validation interne`, "Soumission", `Transmis par ${by.trim()}.`), code);
  },
};
