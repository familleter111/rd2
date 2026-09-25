/**
 * Guided tour through the mock-ups ("Parcours guidé").
 *
 * Every delivered screen is a step. Going forward (blue numbered circle on the element to
 * click, or the element itself) runs the `prepare` transitions of all the
 * steps up to the target — they are idempotent, so actions already done by hand are
 * kept. "Aller à un écran" resets the demo data and replays the story up to that screen.
 */
import { useSyncExternalStore } from "react";
import { createSeed, type DemoState } from "./data";
import { DECISION_EXAMPLE, REVIEW_EXAMPLE } from "./data-dossier";
import { MIXING_DEVIATION_EXAMPLE, PEOPLE_LAB, defaultTestPlan, mixerReservation } from "./data-lab";
import { dossier, versionEventId } from "./dossier";
import { DEMO_TODAY } from "./format";
import { lab } from "./lab";
import { applyState, replaceState } from "./store";

export interface GuideStep {
  n: number;
  label: string;
  section: string;
  href: string;
  /** What the user does on the previous screen to get here. */
  hint: string;
  prepare?: (s: DemoState) => DemoState;
}

const CS = "CS-01";
const decisionOf = (s: DemoState) => s.formulaDecisions.find((d) => d.projectCode === CS);
const m01 = (s: DemoState) => s.methods.find((m) => m.ref === "M-01");
const lastAnalysis = (s: DemoState) => s.analyses.filter((a) => a.methodRef === "M-01").at(-1);
const lp01 = (s: DemoState) => s.pilotLots.find((l) => l.projectCode === CS && l.lotCode === "LP-01");

/* ------------------------------------------------------------------ */
/* Story transitions                                                   */
/* ------------------------------------------------------------------ */

function decisionUnderReview(s: DemoState) {
  const d = decisionOf(s);
  if (d?.choice === "retenir" && d.formula === "F2" && (d.status === "Approuvée" || (d.status === "Soumise" && d.step === 3))) return s;
  let n = lab.completeFormulaTests(s, CS, "F2");
  n = lab.submitRetainDecision(n, CS, "F2");
  return lab.reviewDecision(n, CS);
}

function decisionApproved(s: DemoState) {
  const n = decisionUnderReview(s);
  return decisionOf(n)?.status === "Approuvée" ? n : lab.approveDecision(n, CS);
}

function protocolDraft(s: DemoState) {
  let n = s;
  if (m01(n)?.reference.applicability !== "Confirmée") n = lab.saveReference(n, "M-01", { applicability: "Confirmée" });
  if (!m01(n)?.protocol) n = lab.createProtocol(n, "M-01");
  return n;
}

function protocolApprovedWithPlan(s: DemoState) {
  let n = protocolDraft(s);
  if (m01(n)?.protocol?.status === "Brouillon") {
    n = lab.prefillCriteria(n, "M-01");
    n = lab.submitProtocol(n, "M-01");
  }
  if (m01(n)?.protocol?.status === "En revue") n = lab.approveProtocol(n, "M-01");
  const method = m01(n);
  if (method && !n.testPlans.some((p) => p.methodRef === "M-01") && !lastAnalysis(n)) n = lab.saveTestPlan(n, defaultTestPlan(method));
  return n;
}

function analysisDraft(s: DemoState) {
  let n = protocolApprovedWithPlan(s);
  if (!lastAnalysis(n)) n = lab.launchTests(n, "M-01");
  const a = lastAnalysis(n);
  if (!a) return n;
  if (a.status === "Brouillon" && a.results.every((r) => !r.value.trim())) {
    const values = ["99,2", "99,5"];
    n = lab.saveAnalysis(n, a.id, a.results.map((r, i) => ({ ...r, value: values[i] ?? "" })));
  }
  if (!a.attachments.length) n = lab.addAnalysisAttachment(n, a.id, { name: "données-brutes.csv", kind: "Fichier de données" });
  return n;
}

function analysisInReview(s: DemoState) {
  let n = analysisDraft(s);
  const a = lastAnalysis(n);
  if (!a || a.status !== "Brouillon") return n;
  n = lab.saveAnalysis(n, a.id, a.results.map((r) => (r.value.trim() ? r : { ...r, value: "99,3" })));
  return lab.submitAnalysis(n, a.id);
}

function correctionRequested(s: DemoState) {
  const n = analysisInReview(s);
  const a = lastAnalysis(n);
  if (!a || a.status !== "En revue") return n;
  return lab.requestAnalysisCorrection(n, a.id, {
    recipient: PEOPLE_LAB.marie,
    reason: "Joindre le chromatogramme de l'échantillon ECH-03.",
    due: "2026-10-02",
    notify: true,
  });
}

function preparationStarted(s: DemoState) {
  const a = s.activities.find((x) => x.id === "act-lp01");
  return a && !a.done && a.state !== "en-cours" ? lab.startActivity(s, "act-lp01") : s;
}

function mixerReserved(s: DemoState) {
  const exists = s.events.some((e) => e.kind === "reservation" && e.resourceIds.includes("MEL-01") && e.lotCode === "LP-01");
  return exists ? s : lab.createEvent(s, mixerReservation());
}

function mixingInProgress(s: DemoState) {
  let n = mixerReserved(decisionApproved(s));
  if (lp01(n)?.status === "Préparation") n = lab.startLot(n, CS, "LP-01");
  const weighing = lp01(n)?.steps[0];
  if (weighing && weighing.status !== "Terminée") {
    n = lab.saveStep(n, CS, "LP-01", "pesee", { start: weighing.start || "08:00", end: "08:50", parameters: "Pesées conformes au mode opératoire." }, true);
    n = lab.completeStep(n, CS, "LP-01", "pesee");
  }
  const mixing = lp01(n)?.steps[1];
  if (mixing?.status === "En cours" && mixing.start !== "09:00") n = lab.saveStep(n, CS, "LP-01", "melange", { start: "09:00" }, true);
  return n;
}

function controlsInProgress(s: DemoState) {
  const lot = lp01(s);
  if (!lot || lot.controls.some((c) => c.status !== "En attente")) return s;
  return lab.setControls(s, CS, "LP-01", {
    "ctl-aspect": { status: "Validé", result: "Conforme", date: DEMO_TODAY },
    "ctl-masse": { status: "Validé", result: "301", date: DEMO_TODAY },
    "ctl-durete": { status: "À saisir", date: DEMO_TODAY },
  });
}

function deviationCreated(s: DemoState) {
  if (s.deviations.some((d) => d.projectCode === CS && d.lotCode === "LP-01")) return s;
  return lab.createDeviation(s, {
    ...MIXING_DEVIATION_EXAMPLE,
    observedAt: `${DEMO_TODAY}T09:15`,
    projectCode: CS,
    lotCode: "LP-01",
    formula: "F2",
    step: "Mélange",
    equipment: "MEL-01",
    equipmentLabel: "Mélangeur",
  });
}

/* ---------------- Documents, dossier, transfer, closure (45–56) ---------------- */

const RF2 = "doc-cs-rf2";
const docOf = (s: DemoState, id: string) => s.documents.find((d) => d.id === id);
const dossierOf = (s: DemoState) => s.dossiers.find((d) => d.projectCode === CS);
const reviewOf = (s: DemoState) => s.dossierReviews.find((r) => r.projectCode === CS);

/** The test report F2 v2 is approved (its v3 comes at screen 46). */
function reportApproved(s: DemoState) {
  const d = docOf(s, RF2);
  return d && d.status !== "Approuvé" && d.version === 2 ? dossier.approveDocument(s, RF2) : s;
}

function reportV3(s: DemoState) {
  const n = reportApproved(s);
  const d = docOf(n, RF2);
  if (!d || d.version >= 3) return n;
  return dossier.addDocumentVersion(n, RF2, {
    file: "rapport-essais-F2-v3.pdf",
    size: "1,2 Mo",
    motif: "Ajout des résultats complémentaires.",
    status: "Brouillon",
    reviewer: "Responsable développement",
    notify: true,
  });
}

/** Section 3.2.P.2 submitted, consolidated stability report added, synthesis approved. */
function dossierCompleted(s: DemoState) {
  let n = s;
  const section = dossierOf(n)?.modules.flatMap((m) => m.sections).find((x) => x.id === "developpement");
  if (section?.status === "À compléter") n = dossier.submitSection(n, CS, "developpement");
  const stab = dossierOf(n)?.requirements.find((r) => r.id === "req-stab");
  if (stab && !stab.docId) {
    n = dossier.addDossierDocument(n, CS, { sectionId: stab.sectionId, name: stab.docName, type: stab.docType, file: "Rapport_stabilite_consolide_v1.pdf", size: "1,8 Mo", requirementId: stab.id });
  }
  const synth = docOf(n, "doc-cs-synth");
  if (synth && synth.status !== "Approuvé") n = dossier.approveDocument(n, "doc-cs-synth", "Qualité");
  return n;
}

function reviewSubmitted(s: DemoState) {
  const n = dossierCompleted(s);
  return reviewOf(n) ? n : dossier.submitDossierReview(n, CS, { ...REVIEW_EXAMPLE });
}

function reviewDecided(s: DemoState) {
  const n = reviewSubmitted(s);
  const r = reviewOf(n);
  if (!r || r.status !== "En revue") return n;
  return dossier.decideDossierReview(n, r.id, { decision: "reserves", justification: DECISION_EXAMPLE.justification, reserves: [DECISION_EXAMPLE.reserve] });
}

/** Blocking reserve lifted and documents handed over to Production. */
function transferToReceive(s: DemoState) {
  let n = reviewDecided(s);
  for (const r of n.reserves.filter((x) => x.projectCode === CS && x.blocking && x.status === "Ouverte")) {
    n = dossier.liftReserve(n, r.id, "Version approuvée de la synthèse jointe au dossier.");
  }
  const t = n.transfers.find((x) => x.projectCode === CS);
  return t && (t.status === "À préparer" || t.status === "Complément demandé") ? dossier.transmitTransfer(n, CS) : n;
}

/** End of the project: reception confirmed, every action closed, deliverables approved or archived. */
function readyToClose(s: DemoState) {
  let n = transferToReceive(s);
  if (n.transfers.find((x) => x.projectCode === CS)?.status === "À réceptionner") {
    n = dossier.confirmReception(n, CS, "Documents examinés : dossier de transfert complet.");
  }
  for (const r of n.reserves.filter((x) => x.projectCode === CS && x.status === "Ouverte")) n = dossier.liftReserve(n, r.id, "Réserve traitée avant la clôture du projet.");
  for (const d of n.deviations.filter((x) => x.projectCode === CS && x.status !== "Clôturée")) {
    if (!d.analysis.doneAt) n = lab.saveDeviationAnalysis(n, d.id, { cause: "Équipement", rootCause: "Surcharge du moteur du mélangeur.", impact: "Impact mineur" }, true);
    const current = n.deviations.find((x) => x.id === d.id);
    for (const a of current?.actions.filter((x) => x.status !== "Terminée") ?? []) n = lab.saveDeviationAction(n, d.id, { ...a, status: "Terminée" });
    n = lab.closeDeviation(lab.verifyEffectiveness(n, d.id), d.id);
  }
  n = {
    ...n,
    activities: n.activities.map((a) => (a.projectCode === CS && !a.done ? { ...a, done: true, state: "terminee", status: { label: "Terminée", tone: "success" } } : a)),
  };
  for (const d of n.documents.filter((x) => x.projectCode === CS && !x.archived && x.status !== "Approuvé")) {
    n = d.status === "Brouillon" ? dossier.archiveDocument(n, d.id) : dossier.approveDocument(n, d.id, "Qualité");
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

export const GUIDE_STEPS: GuideStep[] = [
  { n: 1, section: "Vue d'ensemble", label: "Portefeuille", href: "/vue-ensemble", hint: "Menu « Vue d'ensemble »" },
  { n: 2, section: "Vue d'ensemble", label: "Mes priorités", href: "/vue-ensemble/priorites", hint: "Onglet « Mes priorités »" },
  { n: 3, section: "Vue d'ensemble", label: "Revues à préparer", href: "/vue-ensemble/revues", hint: "Onglet « Revues »" },
  { n: 4, section: "Vue d'ensemble", label: "Filtres et vue enregistrée", href: "/vue-ensemble?filtres=1", hint: "Bouton « Filtres » du portefeuille" },
  { n: 5, section: "Vue d'ensemble", label: "Recherche et accès direct", href: "/recherche?q=CS-01", hint: "Rechercher « CS-01 »" },
  { n: 6, section: "Projets", label: "Liste des projets", href: "/projets", hint: "Menu « Projets »" },
  { n: 7, section: "Projets", label: "Créer un projet — Produit", href: "/projets/nouveau", hint: "Bouton « Nouveau projet »" },
  { n: 8, section: "Projets", label: "Créer un projet — Parcours & équipe", href: "/projets/nouveau?demo=parcours", hint: "Bouton « Continuer »" },
  { n: 9, section: "Projets", label: "Créer un projet — Vérification", href: "/projets/nouveau?demo=verification", hint: "Bouton « Continuer »" },
  { n: 10, section: "Projets", label: "Champs manquants et code déjà utilisé", href: "/projets/nouveau?demo=erreurs", hint: "« Continuer » avec un formulaire incomplet" },
  { n: 11, section: "Projet CS-01", label: "Vue d'un projet", href: "/projets/cs-01", hint: "Ouvrir le projet CS-01" },
  { n: 14, section: "Projet CS-01", label: "Demander un document ou une matière", href: "/projets/cr-01/prerequis?demande=pr-cr-2", hint: "Prérequis de CR-01 → « Demander »" },
  { n: 15, section: "Projet CS-01", label: "Documents du projet", href: "/projets/cs-01/documents", hint: "Onglet « Documents »" },
  { n: 16, section: "Projet CS-01", label: "Historique et traçabilité", href: "/projets/cs-01/historique", hint: "Onglet « Historique »" },
  { n: 17, section: "Projet CS-01", label: "Versions de formule", href: "/projets/cs-01/formules", hint: "Onglet « Formules & lots »" },
  { n: 18, section: "Projet CS-01", label: "Éditer une nouvelle formule", href: "/projets/cs-01/formules/nouvelle?parent=F2", hint: "Bouton « Nouvelle version »" },
  { n: 20, section: "Projet CS-01", label: "Décision sur une formule", href: "/projets/cs-01/formules/comparaison?decision=1", hint: "Comparaison → « Préparer la décision »" },
  {
    n: 21,
    section: "Projet CS-01",
    label: "Décision — examen et approbation",
    href: "/projets/cs-01/formules/comparaison?examen=1",
    hint: "« Soumettre pour avis » (les essais F2 se terminent, avis favorable)",
    prepare: decisionUnderReview,
  },
  { n: 22, section: "Méthodes & essais", label: "Méthodes & essais — catalogue", href: "/methodes", hint: "« Approuver la décision »", prepare: decisionApproved },
  { n: 23, section: "Méthodes & essais", label: "Méthode — référence", href: "/methodes/m-01", hint: "Ouvrir la méthode M-01" },
  { n: 24, section: "Méthodes & essais", label: "Méthode — protocole", href: "/methodes/m-01/protocole", hint: "Confirmer l'applicabilité puis « Préparer le protocole »", prepare: protocolDraft },
  {
    n: 25,
    section: "Méthodes & essais",
    label: "Méthode — préparer les essais",
    href: "/methodes/m-01/essais",
    hint: "Compléter les critères, soumettre puis approuver le protocole",
    prepare: protocolApprovedWithPlan,
  },
  { n: 26, section: "Méthodes & essais", label: "Essai — saisir les résultats", href: "/methodes/m-01/analyses/ana-01", hint: "« Lancer les essais »", prepare: analysisDraft },
  {
    n: 27,
    section: "Méthodes & essais",
    label: "Validation — demande de correction",
    href: "/methodes/m-01/validation?correction=1",
    hint: "Saisir le résultat manquant puis « Soumettre pour revue »",
    prepare: analysisInReview,
  },
  { n: 28, section: "Méthodes & essais", label: "Méthode — historique et versions", href: "/methodes/m-01/historique", hint: "« Renvoyer pour correction »", prepare: correctionRequested },
  { n: 29, section: "Mes activités", label: "Mes activités — liste et priorités", href: "/activites", hint: "Menu « Mes activités »" },
  { n: 30, section: "Mes activités", label: "Activité — détails et clôture bloquée", href: "/activites/act-lp01", hint: "« Ouvrir » l'activité « Préparer le lot pilote LP-01 »", prepare: (s) => preparationStarted(decisionApproved(s)) },
  { n: 31, section: "Planning", label: "Planning — agenda de l'équipe", href: "/planning", hint: "« Réserver une ressource » (mélangeur)", prepare: mixerReserved },
  { n: 32, section: "Planning", label: "Planning — ressources et disponibilités", href: "/planning?vue=ressources", hint: "Onglet « Ressources »" },
  {
    n: 33,
    section: "Planning",
    label: "Réserver une ressource",
    href: "/planning/reservation?ressource=HPLC-01&date=2026-10-07&debut=11:00&fin=13:00",
    hint: "Bouton « Réserver » (HPLC-01)",
  },
  {
    n: 34,
    section: "Planning",
    label: "Conflit de réservation",
    href: "/projets/cs-01/planning?jour=2026-10-07&demande=HPLC-01,10:00,12:00",
    hint: "Demander HPLC-01 de 10:00 à 12:00 (créneau déjà pris)",
  },
  { n: 35, section: "Lot pilote LP-01", label: "Lot pilote — préparation", href: "/projets/cs-01/lots/lp-01", hint: "Ouvrir le lot pilote LP-01", prepare: (s) => mixerReserved(decisionApproved(s)) },
  { n: 36, section: "Lot pilote LP-01", label: "Lot pilote — exécution du mélange", href: "/projets/cs-01/lots/lp-01/execution", hint: "« Démarrer le lot »", prepare: mixingInProgress },
  { n: 37, section: "Lot pilote LP-01", label: "Lot pilote — contrôles", href: "/projets/cs-01/lots/lp-01/controles", hint: "Onglet « Contrôles »", prepare: controlsInProgress },
  { n: 38, section: "Lot pilote LP-01", label: "Déclarer une déviation de lot", href: "/projets/cs-01/lots/lp-01/deviations", hint: "Onglet « Déviations »" },
  { n: 39, section: "Lot pilote LP-01", label: "Déviation — actions et efficacité", href: "/projets/cs-01/deviations/dev-01?onglet=actions", hint: "« Créer la déviation »", prepare: deviationCreated },
  { n: 40, section: "Stabilité", label: "Stabilité — études", href: "/stabilite", hint: "Menu « Stabilité »" },
  { n: 41, section: "Stabilité", label: "Stabilité — protocole", href: "/stabilite/st-01", hint: "« Préparer le protocole » de ST-01", prepare: (s) => lab.prepareStudyProtocol(s, "ST-01") },
  {
    n: 45,
    section: "Documents & historique",
    label: "Documents du projet",
    href: "/projets/cs-01/documents?doc=doc-cs-rf2",
    hint: "Onglet « Documents » du projet CS-01 (rapport d'essais F2 v2 approuvé)",
    prepare: reportApproved,
  },
  {
    n: 46,
    section: "Documents & historique",
    label: "Document — importer une nouvelle version",
    href: "/projets/cs-01/documents/doc-cs-rf2?nouvelle-version=exemple",
    hint: "« Nouvelle version » du rapport d'essais F2",
  },
  {
    n: 47,
    section: "Documents & historique",
    label: "Projet — historique",
    href: `/projets/cs-01/historique?evenement=${versionEventId(RF2, 3)}`,
    hint: "« Enregistrer la version » (v3 en brouillon)",
    prepare: reportV3,
  },
  { n: 48, section: "Dossiers & revues", label: "Dossiers & revues — structure CTD", href: "/dossiers/cs-01", hint: "Menu « Dossiers & revues »" },
  { n: 49, section: "Dossiers & revues", label: "Dossier CTD — contenu d'une section", href: "/dossiers/cs-01/sections/developpement", hint: "Section « Développement pharmaceutique »" },
  {
    n: 50,
    section: "Dossiers & revues",
    label: "Préparer une revue de dossier",
    href: "/dossiers/cs-01/revues/nouvelle",
    hint: "« Soumettre la section » (le dossier est ensuite complété)",
    prepare: dossierCompleted,
  },
  { n: 51, section: "Dossiers & revues", label: "Revue — décision et réserves", href: "/dossiers/cs-01/revues/rd-01", hint: "Justification puis « Soumettre la revue »", prepare: reviewSubmitted },
  { n: 52, section: "Dossiers & revues", label: "Exporter le dossier", href: "/dossiers/cs-01/export", hint: "« Confirmer la décision » (approuvée avec réserves)", prepare: reviewDecided },
  {
    n: 53,
    section: "Dossiers & revues",
    label: "Transfert — préparation et réception",
    href: "/dossiers/cs-01/transfert",
    hint: "« Générer l'export » (réserve levée, documents transmis)",
    prepare: transferToReceive,
  },
  { n: 54, section: "Configuration", label: "Configuration — rôles et accès", href: "/configuration", hint: "Menu « Configuration »" },
  { n: 55, section: "Configuration", label: "Configuration — modèles de parcours", href: "/configuration/modeles", hint: "Onglet « Modèles de parcours »" },
  {
    n: 56,
    section: "Clôture du projet",
    label: "Clôture et archivage du projet",
    href: "/projets/cs-01/cloture?confirmer=1",
    hint: "Projet CS-01 → « Clôturer le projet » (transfert réceptionné, actions closes)",
    prepare: readyToClose,
  },
];

export const TOTAL_SCREENS = 56;

export const findStep = (n: number) => GUIDE_STEPS.find((s) => s.n === n);

export function nextStepOf(n: number | null) {
  if (n === null) return undefined;
  const i = GUIDE_STEPS.findIndex((s) => s.n === n);
  return i >= 0 ? GUIDE_STEPS[i + 1] : undefined;
}

export function prevStepOf(n: number | null) {
  if (n === null) return undefined;
  const i = GUIDE_STEPS.findIndex((s) => s.n === n);
  return i > 0 ? GUIDE_STEPS[i - 1] : undefined;
}

/** Runs the story transitions of every step up to `n` (idempotent). */
export function prepareUntil(s: DemoState, n: number) {
  return GUIDE_STEPS.filter((step) => step.n <= n && step.prepare).reduce((acc, step) => step.prepare!(acc), s);
}

/** Moves the story forward to screen `n` (keeps what was done by hand). */
export function advanceTo(n: number) {
  applyState((s) => prepareUntil(s, n));
}

/** Resets the demo data and replays the story up to screen `n`. */
export function replayTo(n: number) {
  replaceState(prepareUntil(createSeed(), n));
}

/* ------------------------------------------------------------------ */
/* Guide UI state (highlight on/off, current screen, panel)            */
/* ------------------------------------------------------------------ */

interface GuideUiState {
  enabled: boolean;
  current: number | null;
  panelOpen: boolean;
  /** Blue circles shown on the page (the floating circle is shown when there is none). */
  dots: number;
  /** How many of them are inside the viewport, and where the others are. */
  dotsInView: number;
  dotSide: "up" | "down";
}

const STORAGE_KEY = "simed-rd-guide";
const SERVER_STATE: GuideUiState = { enabled: true, current: null, panelOpen: false, dots: 0, dotsInView: 0, dotSide: "down" };

function readEnabled() {
  try {
    return typeof window === "undefined" ? true : window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

let ui: GuideUiState = { enabled: readEnabled(), current: null, panelOpen: false, dots: 0, dotsInView: 0, dotSide: "down" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(patch: Partial<GuideUiState>) {
  ui = { ...ui, ...patch };
  emit();
}

export const guideUi = {
  setEnabled(enabled: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
    set({ enabled });
  },
  setCurrent(n: number | null) {
    if (ui.current !== n) set({ current: n });
  },
  clearCurrent(n: number | null) {
    if (ui.current === n) set({ current: null });
  },
  openPanel() {
    set({ panelOpen: true });
  },
  closePanel() {
    set({ panelOpen: false });
  },
  addDot() {
    set({ dots: ui.dots + 1 });
  },
  removeDot() {
    set({ dots: Math.max(0, ui.dots - 1) });
  },
  dotViewChange(delta: -1 | 0 | 1, side: "up" | "down") {
    set({ dotsInView: Math.max(0, ui.dotsInView + delta), dotSide: side });
  },
};

export function useGuideUi() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => ui,
    () => SERVER_STATE,
  );
}

/** True when `step` is the next screen of the tour and the blue circles are on. */
export function useGuideTarget(step: number | undefined) {
  const { enabled, current } = useGuideUi();
  return step !== undefined && enabled && nextStepOf(current)?.n === step;
}
