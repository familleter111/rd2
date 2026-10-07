/**
 * Excel export of each step: what was entered and decided on the page, one sheet per block,
 * every value with its status and its source.
 */
import { STUDY_FIELDS, beDocuments, beInputs, beOf, beStatus, proposeOrientation, waiverStatus } from "./bioequivalence";
import { CADRAGE_ROLES, allData, cadrageUnknowns, docState, g0Readiness, receivedTypes } from "./cadrage";
import type { DemoState } from "./data";
import { equipmentNeeds, feasibilityRows, feasibilityScore, matchEquipment } from "./feasibility";
import { compare, currentOptions, formulationOf, optionLabel } from "./formulation";
import { formatDateTime, formatNumeric } from "./format";
import { groupOf, natureOf, sheetStats } from "./princeps";
import { checkResult, pilotPrerequisites, qualityOf, specLimit } from "./quality";
import { cellState, evolutions, pointLabel, stabilityOf } from "./stability";
import { COVER_FIELDS, MODULES, PREDEPOSIT_FIELDS, allGaps, consistencyChecks, g4Requirements, sectionFeed, validationOf, validationState } from "./validation";
import type { Sheet } from "./xlsx";
import type { CadrageDatum, Project, ProjectCadrage, TeamMember } from "./types";

const date = (iso?: string) => (iso ? (iso.length > 10 ? formatDateTime(iso) : formatNumeric(iso)) : "");

/** One row per value: where it comes from, what it is, and the last thing a person did to it. */
function dataSheet(name: string, data: CadrageDatum[]): Sheet {
  return {
    name,
    rows: [
      ["Section", "Objet", "Caractéristique", "Valeur", "Statut", "Nature", "Valeur d'identité", "Document source", "Emplacement", "Extrait", "Valeur d'origine", "Valeurs en contradiction", "Dernière action", "Auteur", "Date", "Motif"],
      ...data.map((d) => {
        const last = d.history[d.history.length - 1];
        return [
          groupOf(d),
          d.entity,
          d.label,
          d.value,
          d.status,
          natureOf(d) === "Proposition IA" ? "Proposition du système" : (natureOf(d) ?? ""),
          d.critical ? "Oui" : "Non",
          d.source?.document ?? (d.value ? "Saisie manuelle" : ""),
          d.source?.location ?? "",
          d.source?.excerpt ?? "",
          d.originalValue && d.originalValue !== d.value ? d.originalValue : "",
          (d.alternatives ?? []).map((a) => `${a.value} (${a.source.document})`).join(" ≠ "),
          last?.action ?? "",
          last?.author ?? "",
          date(last?.at),
          last?.note ?? "",
        ];
      }),
    ],
  };
}

interface CadrageLike {
  code: string;
  name: string;
  form: string;
  cadrage: Omit<ProjectCadrage, "g0"> & { g0?: ProjectCadrage["g0"] };
  team: TeamMember[];
}

/** Cadrage (étape 0) — also used by the creation flow before the project exists. */
export function cadrageWorkbook(p: CadrageLike, readiness?: ReturnType<typeof g0Readiness>): Sheet[] {
  const c = p.cadrage;
  const full: ProjectCadrage = { ...c, g0: c.g0 ?? { status: "Attendue" } };
  const received = receivedTypes(full);
  return [
    {
      name: "Projet",
      rows: [
        ["Rubrique", "Valeur"],
        ["Code projet", p.code],
        ["Nom du projet", p.name],
        ["Médicament de référence", c.reference.name],
        ["Titulaire / fabricant", c.reference.holder],
        ["Pays de la référence", c.reference.country],
        ["Source de l'identité", c.reference.sourceLabel],
        ["Forme visée", p.form],
        ["Dosages visés", c.variants.map((v) => `${v.dosage} ${v.unit}`).join(", ")],
        ["Pays de dépôt", c.markets.join(", ")],
        ["Procédure", c.procedure],
        ["Date de démarrage", date(c.startDate)],
        ["Cible — dossier prêt pour validation interne", date(c.targetDate)],
        ...CADRAGE_ROLES.map((r) => [r.label, p.team.find((m) => m.role === r.label)?.person || "À désigner"]),
        ["Porte G0", full.g0.status],
        ["G0 — décidée par", full.g0.decidedBy ?? ""],
        ["G0 — date", date(full.g0.decidedAt)],
        ["G0 — motif", full.g0.justification ?? ""],
      ],
    },
    dataSheet("Fiche d'identité", c.data),
    { name: "Variantes de dosage", rows: [["Dosage", "Unité", "Dosage de la référence"], ...c.variants.map((v) => [Number(v.dosage) || v.dosage, v.unit, v.reference ? "Oui" : "Non"])] },
    {
      name: "Documents",
      rows: [
        ["Document", "Type", "Version", "Taille", "Reçu le", "État", "Remarque"],
        ...c.documents.map((d) => [d.name, d.type, d.version, d.size, date(d.receivedAt), docState(d, c.data), d.note ?? ""]),
      ],
    },
    { name: "Documents attendus", rows: [["Type", "Utilité", "Attendu pour", "État"], ...c.expected.map((e) => [e.type, e.why, e.neededFor, received.has(e.type) ? "Reçu" : "Attendu"])] },
    { name: "Inconnues", rows: [["Nature", "Élément", "Détail"], ...cadrageUnknowns(full, p.team).map((u) => [u.kind, u.label, u.detail])] },
    ...(readiness ? [{ name: "Porte G0", rows: [["Preuve", "Réunie", "Détail"], ...readiness.checks.map((x) => [x.label, x.ok ? "Oui" : "Non", x.detail])] }] : []),
  ];
}

export const projectCadrageWorkbook = (p: Project): Sheet[] => (p.cadrage ? cadrageWorkbook({ code: p.code, name: p.name, form: p.form, cadrage: p.cadrage, team: p.team }, g0Readiness(p)) : []);

/** Faisabilité (étape 1). */
export function feasibilityWorkbook(s: DemoState, p: Project): Sheet[] {
  const rows = feasibilityRows(s, p);
  const score = feasibilityScore(rows);
  const f = p.feasibility;
  return [
    {
      name: "Synthèse",
      rows: [
        ["Rubrique", "Valeur"],
        ["Projet", `${p.code} • ${p.name}`],
        ["Produit de référence", p.referenceProduct],
        ["Score de la grille (%)", score.value],
        ["Critères établis", score.established],
        ["Critères à compléter", score.toComplete],
        ["Critères non évalués", score.notEvaluated],
        ["Critères bloquants", score.blocking],
        ["Critères critiques non établis", score.criticalOpen],
        ["Dernière décision G1", f?.decisions[0]?.choice ?? "Aucune"],
      ],
    },
    {
      name: "Critères",
      rows: [
        ["Axe", "Critère", "Poids", "Critique", "Statut", "Motif", "Preuve", "Origine", "Évalué par", "Date", "Action proposée"],
        ...rows.map((r) => [r.axis, r.label, r.weight, r.critical ? "Oui" : "Non", r.status, r.note, r.proof, r.prefilled ? "Proposition du système" : r.by ? "Évaluation" : "", r.by ?? "", date(r.updatedAt), r.action]),
      ],
    },
    {
      name: "Équipements",
      rows: [
        ["Équipement requis", "Usage", "Inventaire", "Ressource déclarée"],
        ...equipmentNeeds(p).map((n) => {
          const m = matchEquipment(n, s.resources);
          return [n.name, n.use, m ? "Déclaré" : "Non renseigné", m?.name ?? ""];
        }),
      ],
    },
    { name: "Brevets", rows: [["Référence", "Territoire", "Échéance", "Question à examiner"], ...(f?.patents ?? []).map((x) => [x.reference, x.territory, date(x.expiry), x.question])] },
    {
      name: "Décisions G1",
      rows: [["Date", "Décision", "Décidée par", "Motif", "Hypothèses retenues", "Score (%)", "Critères non établis"], ...(f?.decisions ?? []).map((d) => [date(d.decidedAt), d.choice, d.decidedBy, d.justification, d.hypotheses, d.score, d.open])],
    },
  ];
}

/** Compréhension du princeps (étape 2). */
export function princepsWorkbook(p: Project): Sheet[] {
  const data = allData(p);
  const stats = sheetStats(p);
  const c = p.cadrage;
  return [
    {
      name: "Synthèse",
      rows: [
        ["Rubrique", "Valeur"],
        ["Projet", `${p.code} • ${p.name}`],
        ["Produit de référence", p.referenceProduct],
        ["Caractéristiques", stats.total],
        ["Données confirmées", stats.established],
        ["À vérifier", stats.toVerify],
        ["Non documentées", stats.missing],
        ["Contradictions", stats.conflicting],
        ["Dernière version validée", p.princeps?.versions[0] ? `v${p.princeps.versions[0].n} — ${p.princeps.versions[0].scope}` : "Aucune"],
      ],
    },
    dataSheet("Fiche princeps", data),
    {
      name: "Essais",
      rows: [
        ["Question expérimentale", "Inconnue à lever", "Objectif", "Responsable", "Créé le"],
        ...(p.princeps?.trials ?? []).map((t) => [t.title, data.find((d) => d.key === t.datumKey)?.label ?? "", t.objective, t.owner, date(t.createdAt)]),
      ],
    },
    {
      name: "Versions G2",
      rows: [
        ["Version", "Portée", "Validée par", "Date", "Stratégie initiale", "Commentaire", "Caractéristiques provisoires"],
        ...(p.princeps?.versions ?? []).map((v) => [`v${v.n}`, v.scope, v.by, date(v.at), v.strategy, v.note, v.provisional.join(", ")]),
      ],
    },
    { name: "Sources", rows: [["Document", "Type", "Version", "Reçu le", "État"], ...(c?.documents ?? []).map((d) => [d.name, d.type, d.version, date(d.receivedAt), docState(d, data)])] },
  ];
}

/** Formulation et essais (étape 3). */
export function formulationWorkbook(p: Project): Sheet[] {
  const f = formulationOf(p);
  const optionOf = (id: string) => f.options.find((o) => o.id === id);
  const current = new Set(currentOptions(f).map((o) => o.id));
  return [
    {
      name: "Pistes",
      rows: [
        ["Piste", "Version", "Version courante", "Intitulé", "Statut", "Origine", "Procédé", "Raisonnement", "Incertitudes", "Risques", "Motif de l'ajustement", "Créée le", "Par"],
        ...f.options.map((o) => [o.code, o.version, current.has(o.id) ? "Oui" : "Non", o.title, o.status, o.origin, o.process, o.rationale, o.uncertainties, o.risks, o.changeReason ?? "", date(o.createdAt), o.by]),
      ],
    },
    {
      name: "Compositions",
      rows: [["Piste", "Composant", "Fonction", "Quantité", "Unité"], ...f.options.flatMap((o) => o.components.map((c) => [optionLabel(o), c.name, c.role, c.qty ? Number(c.qty.replace(",", ".")) || c.qty : "À définir", c.unit]))],
    },
    { name: "Critères cibles", rows: [["Critère", "Unité", "Méthode et conditions", "Valeur du princeps", "Source"], ...f.criteria.map((c) => [c.label, c.unit, c.method, c.reference, c.referenceSource])] },
    {
      name: "Essais",
      rows: [
        ["Essai", "Piste", "Lot", "Date", "Vérifié", "Vérifié par", "Critère", "Résultat", "Unité", "Méthode", "Comparaison au princeps", "Observations"],
        ...f.trials.flatMap((t) => {
          const o = optionOf(t.optionId);
          const head = [t.code, o ? optionLabel(o) : "", t.lot, date(t.date), t.verified ? "Oui" : "Non", t.verifiedBy ?? ""];
          if (!t.results.length) return [[...head, "", "", "", "", "", t.note]];
          return t.results.map((r) => {
            const c = f.criteria.find((x) => x.id === r.criterionId);
            return [...head, c?.label ?? "", r.value, r.unit, r.method, c ? compare(c, r).text : "", t.note];
          });
        }),
      ],
    },
    {
      name: "Décision G3",
      rows: [["Piste retenue", "Intitulé", "Décidée par", "Date", "Justification"], ...(f.decision ? [[optionOf(f.decision.optionId) ? optionLabel(optionOf(f.decision.optionId)!) : "", optionOf(f.decision.optionId)?.title ?? "", f.decision.decidedBy, date(f.decision.decidedAt), f.decision.justification]] : [])],
    },
  ];
}

/** Analytique, qualité et lot pilote (étape 4). */
export function qualityWorkbook(p: Project): Sheet[] {
  const q = qualityOf(p);
  const specOf = (id: string) => q.specs.find((s) => s.id === id);
  return [
    { name: "Méthodes", rows: [["Méthode", "Nature", "Référence", "État", "Besoins"], ...q.methods.map((m) => [m.name, m.kind, m.reference, m.status, m.needs])] },
    {
      name: "Spécifications",
      rows: [["Essai", "Méthode / version", "Limite basse", "Limite haute", "Unité", "Limite", "Origine de la limite", "Approuvée", "Approuvée par"], ...q.specs.map((s) => [s.test, s.method, s.min, s.max, s.unit, specLimit(s), s.origin, s.approved ? "Oui" : "Non", s.approvedBy ?? ""])],
    },
    { name: "Impuretés", rows: [["Impureté", "Rapportée dans les sources", "Recherchée au laboratoire", "Observée"], ...q.impurities.map((i) => [i.name, i.reported ? "Oui" : "Non", i.searched ? "Oui" : "Non", i.observed || "Non observée"])] },
    {
      name: "Matières premières",
      rows: [["Matière", "Lot fournisseur", "Certificat d'analyse", "FDS", "Contrôle", "Décision d'utilisation"], ...q.materials.map((m) => [m.name, m.supplierLot, m.coa ? "Reçu" : "Attendu", m.sds ? "Reçue" : "Attendue", m.control, m.decision])],
    },
    {
      name: "Lot pilote",
      rows: [
        ["Rubrique", "Valeur"],
        ["Lot", q.pilot.lot],
        ["Statut", q.pilot.status],
        ["Autorisé par", q.pilot.authorizedBy ?? ""],
        ["Autorisé le", date(q.pilot.authorizedAt)],
        ["Revu le", date(q.pilot.reviewedAt)],
        ["Résultats et écarts", q.pilot.deviations],
        ...pilotPrerequisites(p).map((x) => [`Prérequis — ${x.label}`, `${x.ok ? "Satisfait" : "Manquant"} : ${x.detail}`]),
      ],
    },
    {
      name: "Contrôles",
      rows: [
        ["Essai", "Lot", "Échantillon", "Date", "Résultat", "Unité", "Limite approuvée", "Verdict", "Motif", "Investigation", "Clôturée le"],
        ...q.controls.map((c) => {
          const spec = specOf(c.specId);
          const r = checkResult(spec, c.value);
          return [spec?.test ?? "", c.lot, c.sample, date(c.date), c.value, spec?.unit ?? "", spec ? specLimit(spec) : "", r.verdict, r.reason, c.investigation ? c.investigation.note || "Ouverte" : "", date(c.investigation?.closedAt)];
        }),
      ],
    },
  ];
}

/** Stabilité (étape 5). */
export function stabilityWorkbook(p: Project): Sheet[] {
  const st = stabilityOf(p);
  const specs = qualityOf(p).specs;
  return [
    {
      name: "Plan",
      rows: [
        ["Rubrique", "Valeur"],
        ["Référentiel appliqué", st.referential],
        ["Conditionnement", st.packaging],
        ["Lots", st.lots.join(", ")],
        ["Conditions", st.conditions.join(" ; ")],
        ["Échéances", st.points.map((x) => pointLabel(x.month)).join(", ")],
        ["Échéances requises pour le dossier", st.points.filter((x) => x.required).map((x) => pointLabel(x.month)).join(", ")],
        ["Analyses suivies", specs.filter((s) => st.specIds.includes(s.id)).map((s) => s.test).join(", ")],
        ["Plan approuvé par", st.approvedBy ?? ""],
        ["Plan approuvé le", date(st.approvedAt)],
        ["Conclusion", st.conclusion?.text ?? ""],
        ["Conclusion approuvée par", st.conclusion?.by ?? ""],
        ["Conclusion approuvée le", date(st.conclusion?.at)],
      ],
    },
    {
      name: "Matrice",
      rows: [
        ["Lot", "Condition", ...st.points.map((x) => `${pointLabel(x.month)}${x.required ? " (requise)" : ""}`)],
        ...st.lots.flatMap((lot) => st.conditions.map((condition) => [lot, condition, ...st.points.map((x) => cellState(st, lot, condition, x.month))])),
      ],
    },
    {
      name: "Résultats",
      rows: [
        ["Lot", "Condition", "Échéance", "Mois", "Analyse", "Résultat", "Unité", "Limite approuvée", "Verdict", "État", "Remarque", "Saisi le"],
        ...st.entries.map((e) => {
          const spec = specs.find((s) => s.id === e.specId);
          return [e.lot, e.condition, pointLabel(e.month), e.month, spec?.test ?? "", e.value, spec?.unit ?? "", spec ? specLimit(spec) : "", checkResult(spec, e.value).verdict, e.status, e.note, date(e.enteredAt)];
        }),
      ],
    },
    {
      name: "Évolution",
      rows: [
        ["Analyse", "Lot", "Condition", ...st.points.map((x) => pointLabel(x.month)), "Écart premier → dernier", "Commentaire"],
        ...evolutions(st).map((ev) => [specs.find((x) => x.id === ev.specId)?.test ?? "", ev.lot, ev.condition, ...ev.series.map((x) => x.value ?? ""), ev.change ?? "", ev.note]),
      ],
    },
  ];
}

/** Stratégie de bioéquivalence (étape 6). */
export function bioequivalenceWorkbook(p: Project): Sheet[] {
  const be = beOf(p);
  const proposal = proposeOrientation(p);
  return [
    {
      name: "Stratégie",
      rows: [
        ["Rubrique", "Valeur"],
        ["État", beStatus(be)],
        ["Référentiels applicables", be.referential],
        ["Orientation proposée par le système", proposal.orientation],
        ["Orientation retenue", be.orientation ?? ""],
        ["Justification", be.rationale],
        ["Limites et inconnues", be.limits],
        ...(be.orientation === "Dispense à examiner" ? [["Résultat de la dispense", waiverStatus(be)]] : []),
        ["Approbation scientifique", be.scientific ? `${be.scientific.by} — ${date(be.scientific.at)}` : ""],
        ["Approbation réglementaire", be.regulatory ? `${be.regulatory.by} — ${date(be.regulatory.at)}` : ""],
        ["Validation de l'étude", be.validated ? `${be.validated.by} — ${date(be.validated.at)}` : ""],
        ["Conclusion de l'étude", be.validated?.conclusion ?? ""],
        ["Document rattaché", be.deliverable ? `${be.deliverable.kind} : ${beDocuments(be).map((d) => `${d.name} (${date(d.at)})`).join(" ; ")}` : ""],
      ],
    },
    { name: "Informations réunies", rows: [["Information", "Valeur", "État", "Source"], ...beInputs(p).map((r) => [r.label, r.value, r.state, r.source])] },
    { name: "Arbre de décision", rows: [["Question", "Lecture", "Résultat"], ...proposal.steps.map((x) => [x.question, x.answer, x.ok === null ? "Non évaluable" : x.ok ? "Oui" : "Non"])] },
    { name: "Critères de dispense", rows: [["Critère", "Référence", "Preuve disponible", "Information manquante", "État", "Origine"], ...be.criteria.map((c) => [c.label, c.source, c.evidence, c.missing, c.state, c.origin])] },
    { name: "Éléments de l'étude", rows: [["Élément", "Valeur", "Requis"], ...STUDY_FIELDS.map((f) => [f.label, be.study[f.key], f.required ? "Oui" : "Non"])] },
  ];
}

/** Dossier de validation (étape 7) : périmètre, sections, contrôles, manques et versions figées. */
export function validationWorkbook(p: Project): Sheet[] {
  const v = validationOf(p);
  return [
    {
      name: "Dossier",
      rows: [
        ["Rubrique", "Valeur"],
        ["État", validationState(p)],
        ["Version", v.version],
        ["Marché", v.market],
        ["Procédure", v.procedure],
        ["Variantes", v.variants],
        ...COVER_FIELDS.map((f) => [f.label, v.cover?.[f.key] ?? ""]),
        ["Porte G4", v.g4 ? `${v.g4.choice} — ${v.g4.by}, ${date(v.g4.at)}` : "Non décidée"],
        ["Justification G4", v.g4?.justification ?? ""],
        ["Soumis à la revue le", date(v.reviewStartedAt)],
        ["Transmis pour validation interne", v.transmittedAt ? `${v.transmittedBy} — ${date(v.transmittedAt)}` : ""],
        ["Nature de l'export", "Documents organisés par module du CTD — ni CTD complet, ni eCTD"],
      ],
    },
    { name: "Revue avant dépôt", rows: [["Rubrique", "Valeur"], ...PREDEPOSIT_FIELDS.map((f) => [f.label, v.preDeposit?.[f.key] ?? ""])] },
    { name: "Porte G4", rows: [["Prérequis", "Réuni", "Détail"], ...g4Requirements(p).map((r) => [r.label, r.ok ? "Oui" : "Non", r.detail])] },
    {
      name: "Sections",
      rows: [
        ["Module", "Section", "Applicable", "Motif de non-applicabilité", "Approuvé par", "Revue", "Commentaire", "Contenu"],
        ...MODULES.flatMap((m) => v.sections.filter((s) => s.module === m)).map((s) => [s.module, s.title, s.applicable ? "Oui" : "Non", s.naReason, s.naApprovedBy ?? "", s.applicable ? s.review : "", s.comment, s.content]),
      ],
    },
    {
      name: "Preuves",
      rows: [["Section", "Élément repris", "Source"], ...v.sections.filter((s) => s.applicable).flatMap((s) => sectionFeed(p, s.feed).lines.map((l) => [s.title, l.text, l.source]))],
    },
    { name: "Contrôles", rows: [["Contrôle", "Résultat", "Impact", "Détail"], ...consistencyChecks(p).map((c) => [c.label, c.ok ? "Conforme" : "À traiter", c.impact, c.detail])] },
    { name: "Manques", rows: [["Impact", "Manque", "Détail", "Action de résolution", "État", "Traité par", "Justification"], ...allGaps(p).map((g) => [g.impact, g.label, g.detail, g.action, g.handled ? "Traité avec justification" : "Ouvert", g.handled?.by ?? "", [...(g.handled?.details ?? []).map((d) => `${d.label} : ${d.value}`), g.handled?.reason ?? ""].filter(Boolean).join(" · ")])] },
    {
      name: "Versions figées",
      rows: [["Version", "Figée le", "Par", "Périmètre", "Module", "Section", "État", "Contenu"], ...v.snapshots.flatMap((s) => s.sections.map((x) => [s.version, date(s.at), s.by, s.scope, x.module, x.title, x.status, x.content]))],
    },
  ];
}

/** Sheet names are unique and at most 31 characters in a workbook. */
function named(sheets: Sheet[]): Sheet[] {
  const used = new Set<string>();
  return sheets.map((sheet) => {
    const base = sheet.name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
    used.add(name.toLowerCase());
    return { ...sheet, name };
  });
}

/** Every step of a project in one workbook; the sheets of a step are prefixed with its number. */
export function projectWorkbook(s: DemoState, p: Project): Sheet[] {
  const steps: [string, Sheet[]][] = [
    ["0", projectCadrageWorkbook(p)],
    ["1", feasibilityWorkbook(s, p)],
    ["2", princepsWorkbook(p)],
    ["3", formulationWorkbook(p)],
    ["4", qualityWorkbook(p)],
    ["5", stabilityWorkbook(p)],
    ["6", bioequivalenceWorkbook(p)],
    ["7", validationWorkbook(p)],
  ];
  const history: Sheet = {
    name: "Historique",
    rows: [["Date", "Auteur", "Type", "Objet", "Événement", "Détail", "Ancienne valeur", "Nouvelle valeur"], ...s.history.filter((h) => h.projectCode === p.code).map((h) => [date(h.at), h.author, h.type, h.objectLabel, h.title, h.description ?? h.motif ?? "", h.oldValue ?? "", h.newValue ?? ""])],
  };
  return named([...steps.flatMap(([n, sheets]) => sheets.map((sheet) => ({ ...sheet, name: `${n}-${sheet.name}` }))), history]);
}

const cell = (v: unknown): string | number => (v === null || v === undefined ? "" : typeof v === "number" ? v : typeof v === "string" ? v : typeof v === "boolean" ? (v ? "Oui" : "Non") : JSON.stringify(v));

/** One sheet per list of the workspace (projects, activities, documents, lots, methods…), as recorded. */
export function workspaceWorkbook(s: DemoState): Sheet[] {
  const sheets: Sheet[] = [];
  for (const [key, value] of Object.entries(s)) {
    if (!Array.isArray(value) || !value.length || typeof value[0] !== "object") continue;
    const rows = value as Record<string, unknown>[];
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    sheets.push({ name: key, rows: [columns, ...rows.map((r) => columns.map((c) => cell(r[c])))] });
  }
  return named(sheets.length ? sheets : [{ name: "Espace", rows: [["Aucune donnée enregistrée"]] }]);
}
