/** Derived rules of the lab modules (statuses, readiness, availability…). */
import type { DemoState } from "./data";
import { fromMinutes, toMinutes } from "./format";
import type { Activity, ActivityState, Analysis, Labelled, Method, PlanningEvent, Tone } from "./types";

/* ------------------------------------------------------------------ */
/* Methods & analyses                                                  */
/* ------------------------------------------------------------------ */

export function analysesOf(s: DemoState, ref: string): Analysis[] {
  return s.analyses.filter((a) => a.methodRef === ref);
}

export function latestAnalysis(s: DemoState, ref: string): Analysis | undefined {
  return analysesOf(s, ref).at(-1);
}

export const ANALYSIS_STATUS: Record<Analysis["status"], Labelled> = {
  Brouillon: { label: "Brouillon", tone: "info" },
  "En revue": { label: "En revue", tone: "warn" },
  "Correction demandée": { label: "Correction demandée", tone: "danger" },
  Validée: { label: "Validée", tone: "success" },
};

/** Status shown on the catalogue card and in the method header. */
export function methodStatus(s: DemoState, m: Method): Labelled {
  if (m.archived) return { label: "Archivée", tone: "neutral" };
  const analysis = latestAnalysis(s, m.ref);
  if (analysis) {
    if (analysis.status === "Brouillon") return { label: "Essais en cours", tone: "info" };
    if (analysis.status === "En revue") return { label: "Résultats à valider", tone: "warn" };
    if (analysis.status === "Correction demandée") return { label: "Correction demandée", tone: "danger" };
    return { label: "Résultats validés", tone: "success" };
  }
  if (!m.lifecycle) return m.status;
  if (!m.protocol) return { label: "Protocole à préparer", tone: "info" };
  if (m.protocol.status === "Brouillon") return { label: "Protocole en préparation", tone: "info" };
  if (m.protocol.status === "En revue") return { label: "Protocole en revue", tone: "warn" };
  return { label: "Approuvé", tone: "success" };
}

export function methodNextAction(s: DemoState, m: Method): { label: string; date?: string } {
  if (!m.lifecycle && !latestAnalysis(s, m.ref)) return m.nextAction;
  const analysis = latestAnalysis(s, m.ref);
  if (analysis?.status === "Brouillon") return { label: "Saisir les résultats", date: analysis.date };
  if (analysis?.status === "En revue") return { label: "Valider les résultats", date: analysis.submittedAt?.slice(0, 10) };
  if (analysis?.status === "Correction demandée") return { label: "Corriger les résultats", date: analysis.correction?.due };
  if (analysis?.status === "Validée") return { label: "Aucune action" };
  if (!m.protocol) return { label: "Préparer le protocole", date: m.nextAction.date };
  if (m.protocol.status === "Brouillon") return { label: "Compléter le protocole", date: m.protocol.updatedAt };
  if (m.protocol.status === "En revue") return { label: "Approbation du protocole", date: m.protocol.submittedAt?.slice(0, 10) };
  return { label: "Préparer les essais", date: m.protocol.approvedAt };
}

/** Entry of the "À traiter" panel (protocols to prepare, results to validate). */
export function methodTodo(s: DemoState, m: Method): { kind: "protocole" | "resultats"; due?: string } | undefined {
  if (m.archived) return undefined;
  if (!m.lifecycle && !latestAnalysis(s, m.ref)) return m.todo;
  const status = methodStatus(s, m).label;
  if (status === "Protocole à préparer" || status === "Protocole en préparation") return { kind: "protocole", due: m.todo?.due ?? m.nextAction.date };
  if (status === "Résultats à valider") return { kind: "resultats", due: m.todo?.due ?? latestAnalysis(s, m.ref)?.submittedAt?.slice(0, 10) };
  return undefined;
}

/** Formula and lot the method is currently used for. */
export function methodContext(s: DemoState, m: Method) {
  const analysis = latestAnalysis(s, m.ref);
  const plan = s.testPlans.find((p) => p.methodRef === m.ref);
  const lotCode = analysis?.lotCode ?? plan?.lotCode ?? (m.projectCode === "CS-01" ? "E-02" : "");
  const lot = s.lots.find((l) => l.projectCode === m.projectCode && l.code === lotCode);
  return {
    formula: analysis?.formula ?? plan?.formula ?? lot?.formula ?? "",
    lotCode,
    lotLabel: lot ? `${lot.type === "Pilote" ? "Lot pilote" : lot.type === "Essai" ? "Lot d'essai" : "Lot"} ${lot.code}` : lotCode ? `Lot ${lotCode}` : "",
  };
}

/** Parses "99,3" → 99.3 (NaN when not a number). */
export function parseValue(v: string) {
  return Number(v.replace(",", ".").replace(/\s/g, ""));
}

/** Acceptance range of a criterion ("95,0 – 105,0", "≤ 2,0", "≥ 50"). */
export function inSpec(value: string, spec: string) {
  if (!value.trim()) return undefined;
  const x = parseValue(value);
  if (Number.isNaN(x)) return undefined;
  const range = /([\d,.]+)\s*[–-]\s*([\d,.]+)/.exec(spec);
  if (range) return x >= parseValue(range[1]) && x <= parseValue(range[2]);
  const le = /≤\s*([\d,.]+)/.exec(spec);
  if (le) return x <= parseValue(le[1]);
  const ge = /≥\s*([\d,.]+)/.exec(spec);
  if (ge) return x >= parseValue(ge[1]);
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Activities                                                          */
/* ------------------------------------------------------------------ */

export function activityState(a: Activity): ActivityState {
  return a.done ? "terminee" : (a.state ?? "a-faire");
}

export interface PrepStep {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  date?: string;
  /** Where the work of the step is done. */
  href?: string;
  action?: string;
}

/**
 * Work to carry out for an activity created with the project: the steps are read from what
 * has really been done in the project (scoping sheet, formulas, lots, methods…), so the
 * activity is closed by doing the work, not by ticking a box.
 */
export function workSteps(s: DemoState, a: Activity): PrepStep[] {
  const code = a.projectCode;
  const slug = code.toLowerCase();
  const project = s.projects.find((p) => p.code === code);
  if (!project) return [];
  const many = (n: number) => (n > 1 ? "s" : "");

  if (a.kind === "cadrage") {
    const prerequisites = s.prerequisites.filter((p) => p.projectCode === code);
    const verified = prerequisites.filter((p) => p.status === "Vérifié").length;
    const review = s.reviews.find((r) => r.projectCode === code);
    const day = (d: string) => d.split("-").reverse().join("/");
    return [
      {
        key: "fiche",
        title: "Fiche de cadrage renseignée",
        detail: project.scope ? `Objectif, périmètre et marchés enregistrés — ${project.scope.strategy}.` : "Décrire l'objectif, le périmètre, les marchés visés et la stratégie réglementaire.",
        done: Boolean(project.scope),
        date: project.scope?.savedAt.slice(0, 10),
        action: project.scope ? "Modifier la fiche" : "Renseigner la fiche",
      },
      {
        key: "prerequis",
        title: "Prérequis identifiés",
        detail: prerequisites.length
          ? `${prerequisites.length} prérequis listé${many(prerequisites.length)}, dont ${verified} vérifié${many(verified)}.`
          : "Lister les documents, matières et ressources nécessaires au projet.",
        done: prerequisites.length > 0,
        href: `/projets/${slug}/prerequis`,
        action: prerequisites.length ? "Voir les prérequis" : "Ajouter un prérequis",
      },
      {
        key: "revue",
        title: "Revue de lancement planifiée",
        detail: review ? `« ${review.title} » prévue le ${day(review.date)}.` : "Planifier la revue qui valide le cadrage avec l'équipe.",
        done: Boolean(review),
        date: review?.date,
        href: review ? "/vue-ensemble/revues" : `/vue-ensemble/revues?planifier=${slug}`,
        action: review ? "Voir la revue" : "Planifier la revue",
      },
    ];
  }

  if (a.kind === "plan-galenique") {
    const formulas = s.formulas.filter((f) => f.projectCode === code && f.status !== "Référence" && f.status !== "Archivée");
    const lots = s.lots.filter((l) => l.projectCode === code && l.type === "Essai");
    const tests = s.tests.filter((t) => t.projectCode === code && t.lotCode !== "REF");
    return [
      {
        key: "formule",
        title: "Formule candidate créée",
        detail: formulas.length ? `${formulas.map((f) => f.code).join(", ")} — composition enregistrée.` : "Saisir la composition d'une première formule candidate.",
        done: formulas.length > 0,
        href: formulas.length ? `/projets/${slug}/formules` : `/projets/${slug}/formules/nouvelle`,
        action: formulas.length ? "Voir les formules" : "Créer une formule",
      },
      {
        key: "lot",
        title: "Lot d'essai créé",
        detail: lots.length ? `${lots.map((l) => l.code).join(", ")} — lot${many(lots.length)} de formulation.` : "Créer le lot d'essai à fabriquer à partir de la formule.",
        done: lots.length > 0,
        href: lots.length ? `/projets/${slug}/formules/lots` : `/projets/${slug}/formules/lots?creer=1`,
        action: lots.length ? "Voir les lots" : "Créer un lot",
      },
      {
        key: "analyses",
        title: "Analyses demandées sur le lot",
        detail: tests.length ? `${tests.length} analyse${many(tests.length)} demandée${many(tests.length)}.` : "Demander les contrôles du lot (aspect, masse, dissolution…).",
        done: tests.length > 0,
        href: lots[0] ? `/projets/${slug}/formules/lots?lot=${lots[0].code}&onglet=analyses` : `/projets/${slug}/formules/lots`,
        action: tests.length ? "Voir les analyses" : "Demander des analyses",
      },
    ];
  }

  if (a.kind === "plan-analytique") {
    const methods = s.methods.filter((m) => m.projectCode === code && !m.archived);
    const confirmed = methods.filter((m) => m.reference.applicability === "Confirmée");
    const requests = s.analysisRequests.filter((r) => r.projectCode === code);
    const first = methods[0];
    return [
      {
        key: "methode",
        title: "Méthode d'analyse créée",
        detail: methods.length ? `${methods.map((m) => `${m.ref} ${m.name}`).join(", ")}.` : "Créer la première méthode (dosage, dissolution…) du projet.",
        done: methods.length > 0,
        href: `/methodes?projet=${slug}`,
        action: methods.length ? "Voir les méthodes" : "Créer une méthode",
      },
      {
        key: "applicabilite",
        title: "Applicabilité confirmée",
        detail: confirmed.length ? `Applicabilité confirmée pour ${confirmed.map((m) => m.ref).join(", ")}.` : "Confirmer que la méthode s'applique au produit avant de rédiger le protocole.",
        done: confirmed.length > 0,
        href: first ? `/methodes/${first.ref.toLowerCase()}` : `/methodes?projet=${slug}`,
        action: confirmed.length ? "Ouvrir la méthode" : "Confirmer l'applicabilité",
      },
      {
        key: "demande",
        title: "Demande d'analyse créée",
        detail: requests.length ? `${requests.map((r) => r.ref).join(", ")} — transmise au laboratoire.` : "Demander une première analyse sur un lot du projet.",
        done: requests.length > 0,
        href: requests.length ? `/methodes?projet=${slug}&onglet=demandes` : `/methodes?projet=${slug}&onglet=demandes&nouvelle=1`,
        action: requests.length ? "Voir les demandes" : "Créer une demande",
      },
    ];
  }
  return [];
}

/** Steps of an activity, whatever its kind (pilot-lot conditions or work done in the project). */
export function activitySteps(s: DemoState, a: Activity): PrepStep[] {
  if (a.kind === "preparation-lot" && a.lotCode) return lotConditions(s, a.projectCode, a.lotCode);
  return workSteps(s, a);
}

/** Conditions of a pilot lot (screen 35) — also the steps of its preparation activity (screen 30). */
export function lotConditions(s: DemoState, projectCode: string, lotCode: string): PrepStep[] {
  const lot = s.pilotLots.find((l) => l.projectCode === projectCode && l.lotCode === lotCode);
  if (!lot) return [];
  const decision = s.formulaDecisions.find((d) => d.projectCode === projectCode && d.formula === lot.formula);
  const formulaOk = decision?.status === "Approuvée" && decision.choice === "retenir";
  const materialsOk = lot.materials.every((m) => m.verified);
  const reservation = s.events.find(
    (e) => e.kind === "reservation" && e.resourceIds.includes(lot.equipment) && e.projectCode === projectCode && e.lotCode === lotCode,
  );
  return [
    {
      key: "formule",
      title: `Formule ${lot.formula} approuvée`,
      detail: formulaOk ? "La formule est approuvée pour la fabrication du lot pilote." : "La décision de formule doit être approuvée par le pharmacien responsable.",
      done: formulaOk,
      date: formulaOk ? decision?.approvedAt?.slice(0, 10) : undefined,
    },
    {
      key: "matieres",
      title: "Matières disponibles",
      detail: materialsOk ? "Toutes les matières nécessaires sont disponibles." : "Des matières restent à vérifier en stock.",
      done: materialsOk,
      date: materialsOk ? lot.materials.map((m) => m.verifiedAt).sort().at(-1) : undefined,
    },
    {
      key: "mode-operatoire",
      title: "Mode opératoire approuvé",
      detail: lot.mo.status === "Approuvé" ? "Le mode opératoire de fabrication est approuvé." : "Le mode opératoire doit être approuvé.",
      done: lot.mo.status === "Approuvé",
      date: lot.mo.status === "Approuvé" ? lot.mo.approvedAt : undefined,
    },
    {
      key: "reservation",
      title: "Réservation équipement",
      detail: reservation
        ? `Mélangeur réservé le ${reservation.date.split("-").reverse().join("/")} de ${reservation.start} à ${reservation.end}.`
        : "Réserver le mélangeur pour la période de fabrication.",
      done: Boolean(reservation),
      date: reservation?.date,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

export const DAY_START = 8 * 60;
export const DAY_END = 18 * 60;

export const EVENT_STYLE: Record<PlanningEvent["kind"], { label: string; tone: Tone; card: string; bar: string; dot: string }> = {
  activite: { label: "Activité", tone: "info", card: "bg-brand-50 text-ink-800", bar: "border-l-brand-600", dot: "bg-brand-600" },
  reservation: { label: "Réservation", tone: "success", card: "bg-success-50 text-ink-800", bar: "border-l-success-500", dot: "bg-success-500" },
  revue: { label: "Revue", tone: "neutral", card: "bg-violet-50 text-ink-800", bar: "border-l-violet-500", dot: "bg-violet-500" },
  maintenance: { label: "Indisponible", tone: "neutral", card: "bg-slate-200/80 text-ink-700", bar: "border-l-slate-500", dot: "bg-slate-400" },
};

export function eventsOn(s: DemoState, date: string, resourceId?: string) {
  return s.events
    .filter((e) => e.date === date && (!resourceId || e.resourceIds.includes(resourceId)))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

export function findConflicts(s: DemoState, resourceId: string, date: string, start: string, end: string, excludeId?: string) {
  return eventsOn(s, date, resourceId).filter((e) => e.id !== excludeId && overlaps(start, end, e.start, e.end));
}

/** First free slot of `duration` minutes on a resource, at or after `from`. */
export function nextFreeSlot(s: DemoState, resourceId: string, date: string, duration: number, from: string) {
  const busy = eventsOn(s, date, resourceId);
  for (let t = Math.max(toMinutes(from), DAY_START); t + duration <= DAY_END; t += 30) {
    const start = fromMinutes(t);
    const end = fromMinutes(t + duration);
    if (!busy.some((e) => overlaps(start, end, e.start, e.end))) return { start, end };
  }
  return undefined;
}

/** "Prochaine disponibilité" of a resource on a day (from the start of the working day, 09:00). */
export function nextAvailability(s: DemoState, resourceId: string, date: string) {
  return nextFreeSlot(s, resourceId, date, 60, "09:00")?.start;
}
