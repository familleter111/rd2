/**
 * Pure state transitions of the lab modules (mock-ups 21 → 41).
 *
 * Every reducer takes the demo state and returns a new one, so the same code runs
 * when a user clicks a button (through `labActions` in the store) and when the
 * guided tour fast-forwards the story to a given screen (`lib/guide.ts`).
 * Reducers are idempotent where it matters and add a traceability event.
 */
import type { DemoState } from "./data";
import { M01_SOURCE_CRITERIA, PEOPLE_LAB, STANDARD_MILESTONES, TABLET_STABILITY_TESTS, m01ProtocolDraft } from "./data-lab";
import { DEMO_TODAY, addDays, addMonths, formatNumeric } from "./format";
import { currentDecision, pendingTests, testsForFormula } from "./selectors";
import { nextNumber, pad2, projectLabel, stamp, uid, withEvent } from "./state-utils";
import type {
  Activity,
  Analysis,
  AnalysisResult,
  CircuitStep,
  Deviation,
  DeviationAction,
  DeviationDraft,
  ExecStep,
  HistoryEvent,
  Labelled,
  LotControl,
  Method,
  MethodProtocol,
  MethodReference,
  Person,
  PilotLot,
  PlanningEvent,
  StabilityAlert,
  StabilityProtocol,
  StabilityResult,
  StabilityStudy,
  TestPlan,
} from "./types";

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

export const nextAnalysisId = (s: DemoState) => `ANA-${pad2(nextNumber(s.analyses.map((a) => a.id), /^ANA-(\d+)$/))}`;
export const nextDeviationId = (s: DemoState) => `DEV-${pad2(nextNumber(s.deviations.map((d) => d.id), /^DEV-(\d+)$/))}`;
export const nextStudyId = (s: DemoState) => `ST-${pad2(nextNumber(s.studies.map((x) => x.id), /^ST-(\d+)$/))}`;
export const nextMethodRef = (s: DemoState) => `M-${pad2(nextNumber(s.methods.map((m) => m.ref), /^M-(\d+)$/))}`;
export const nextActionId = (d: Deviation) => `A-${pad2(nextNumber(d.actions.map((a) => a.id), /^A-(\d+)$/))}`;

/** Circuit of a formula decision right after its submission by the project manager. */
export function decisionCircuit(date: string): CircuitStep[] {
  return [
    { role: "Chef de projet", detail: "Prépare et soumet la décision", status: "Soumis", date },
    { role: "Responsable développement", detail: "Examine et valide", status: "À examiner" },
    { role: "Pharmacien responsable", detail: "Approbation finale", status: "En attente" },
  ];
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

/** Simulated reviewer: the fictitious person in the demonstration, the function alone in a blank workspace. */
const actor = (s: DemoState, p: Person): Person => (s.demo ? p : { name: p.role, role: p.role });

const who = (p: Person) => ({ author: p.name, authorRole: p.role });

function notify(s: DemoState, n: { title: string; detail: string; href: string; tone: "info" | "warn" | "danger" | "success" }): DemoState {
  return { ...s, notifications: [{ id: uid("n"), when: "À l'instant", read: false, ...n }, ...s.notifications] };
}

function mapMethod(s: DemoState, ref: string, fn: (m: Method) => Method): DemoState {
  return { ...s, methods: s.methods.map((m) => (m.ref === ref ? fn(m) : m)) };
}

function methodEvent(
  s: DemoState,
  m: Method,
  e: {
    title: string;
    type: HistoryEvent["type"];
    by?: Person;
    description?: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    motif?: string;
    version?: Labelled;
    icon?: HistoryEvent["icon"];
    analysisId?: string;
    href?: string;
  },
): DemoState {
  return withEvent(s, {
    projectCode: m.projectCode,
    title: e.title,
    context: `${m.projectCode} • ${m.ref} • ${m.name}`,
    object: e.analysisId ? "Essai" : "Méthode",
    objectLabel: e.analysisId ? `${m.projectCode} • Essai ${e.analysisId}` : `${m.projectCode} • Méthode ${m.ref}`,
    type: e.type,
    ...(e.by ? who(e.by) : {}),
    description: e.description,
    field: e.field,
    oldValue: e.oldValue,
    newValue: e.newValue,
    motif: e.motif,
    version: e.version,
    icon: e.icon ?? "flask",
    href: e.href ?? `/methodes/${m.ref.toLowerCase()}/historique`,
    methodRef: m.ref,
    analysisId: e.analysisId,
  });
}

const findMethod = (s: DemoState, ref: string) => s.methods.find((m) => m.ref === ref);
const findAnalysis = (s: DemoState, id: string) => s.analyses.find((a) => a.id === id);

function mapAnalysis(s: DemoState, id: string, fn: (a: Analysis) => Analysis): DemoState {
  return { ...s, analyses: s.analyses.map((a) => (a.id === id ? fn(a) : a)) };
}

function mapActivity(s: DemoState, id: string, fn: (a: Activity) => Activity): DemoState {
  return { ...s, activities: s.activities.map((a) => (a.id === id ? fn(a) : a)) };
}

function mapPilot(s: DemoState, projectCode: string, lotCode: string, fn: (l: PilotLot) => PilotLot): DemoState {
  return { ...s, pilotLots: s.pilotLots.map((l) => (l.projectCode === projectCode && l.lotCode === lotCode ? fn(l) : l)) };
}

function mapDeviation(s: DemoState, id: string, fn: (d: Deviation) => Deviation): DemoState {
  return { ...s, deviations: s.deviations.map((d) => (d.id === id ? fn(d) : d)) };
}

function mapStudy(s: DemoState, id: string, fn: (x: StabilityStudy) => StabilityStudy): DemoState {
  return { ...s, studies: s.studies.map((x) => (x.id === id ? fn(x) : x)) };
}

const findPilot = (s: DemoState, projectCode: string, lotCode: string) =>
  s.pilotLots.find((l) => l.projectCode === projectCode && l.lotCode === lotCode);

const DONE_STATUS: Labelled = { label: "Terminée", tone: "success" };

/* Shared by several reducers (declared first to keep `lab` typed). */

function addAnalysisAttachment(s: DemoState, id: string, file: { name: string; kind: string }): DemoState {
    const a = findAnalysis(s, id);
    const m = a && findMethod(s, a.methodRef);
    if (!a || !m || a.attachments.some((x) => x.name === file.name)) return s;
    let next = mapAnalysis(s, id, (x) => ({ ...x, attachments: [...x.attachments, { id: uid("att"), ...file, date: DEMO_TODAY }] }));
    next = methodEvent(next, m, {
      title: "Fichier source ajouté",
      type: "Ajout",
      by: a.analyst,
      description: `Ajout du fichier ${file.name} (${file.kind.toLowerCase()}).`,
      version: { label: `${id} • ${a.status}`, tone: "info" },
      icon: "doc",
      analysisId: id,
    });
    return next;
  }

function submitAnalysis(s: DemoState, id: string): DemoState {
    const a = findAnalysis(s, id);
    const m = a && findMethod(s, a.methodRef);
    if (!a || !m || (a.status !== "Brouillon" && a.status !== "Correction demandée") || a.results.some((r) => !r.value.trim())) return s;
    const at = stamp();
    let next = mapAnalysis(s, id, (x) => ({
      ...x,
      status: "En revue",
      submittedAt: at,
      periodTo: DEMO_TODAY,
      circuit: [
        { ...x.circuit[0], status: "Soumis", date: at },
        { ...x.circuit[1], status: "À examiner", date: undefined },
        { ...x.circuit[2], status: "En attente", date: undefined },
      ],
    }));
    next = methodEvent(next, m, {
      title: a.status === "Correction demandée" ? "Résultats resoumis" : "Résultat soumis",
      type: "Soumission",
      by: a.analyst,
      description: `Soumission des résultats de l'essai ${id} (${a.results.length} échantillons) pour revue.`,
      version: { label: `${id} • En revue`, tone: "warn" },
      icon: "send",
      analysisId: id,
      href: `/methodes/${m.ref.toLowerCase()}/validation`,
    });
    return next;
  }

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

/** Specification of a stability analysis (used to raise an out-of-specification alert). */
export function stabilitySpec(analysis: string): { label: string; ok: (v: number) => boolean } | undefined {
  if (analysis.startsWith("Dosage")) return { label: "95,0 – 105,0 %", ok: (v) => v >= 95 && v <= 105 };
  if (analysis.startsWith("Dissolution")) return { label: "≥ 80 % en 30 min", ok: (v) => v >= 80 };
  return undefined;
}

export const lab = {
  /* ---------------- Formula decision (screen 21) ---------------- */

  /** Pending results of a formula arrive (they are all compliant in the demo story). */
  completeFormulaTests(s: DemoState, projectCode: string, formula: string): DemoState {
    const pending = pendingTests(testsForFormula(s, projectCode, formula));
    if (!pending.length) return s;
    const lotCode = pending[0].lotCode;
    const values: Record<string, string> = { Friabilité: "0,4 %", Dissolution: "90 % en 30 min" };
    const ids = new Set(pending.map((t) => t.id));
    let next: DemoState = {
      ...s,
      tests: s.tests.map((t) => (ids.has(t.id) ? { ...t, status: "Conforme", result: values[t.criterion] ?? "Conforme", date: DEMO_TODAY } : t)),
      lots: s.lots.map((l) => (l.projectCode === projectCode && l.code === lotCode ? { ...l, status: "Disponible" } : l)),
      formulas: s.formulas.map((f) =>
        f.projectCode === projectCode && f.code === formula && f.status === "Essais en cours" ? { ...f, status: "Essais terminés" } : f,
      ),
      analysisRequests: s.analysisRequests.map((r) =>
        r.projectCode === projectCode && r.lotCode === lotCode && pending.some((t) => t.method === r.method)
          ? { ...r, status: { label: "Terminée", tone: "success" } }
          : r,
      ),
      activities: s.activities.map((a) =>
        a.projectCode === projectCode && !a.done && !a.kind && (a.tags.includes(formula) || a.tags.includes(lotCode))
          ? { ...a, done: true, state: "terminee", status: DONE_STATUS }
          : a,
      ),
      reviews: s.reviews.map((r) =>
        r.projectCode === projectCode
          ? { ...r, checklist: r.checklist.map((c) => (c.label.includes(`Résultats ${formula}`) ? { ...c, state: "done" } : c)) }
          : r,
      ),
    };
    next = withEvent(next, {
      projectCode,
      title: `Essais ${formula} terminés`,
      context: `${projectCode} • Lot ${lotCode} • ${formula}`,
      object: "Lot",
      objectLabel: `${projectCode} • Lot ${lotCode}`,
      type: "Modification",
      author: "Responsable analytique",
      description: `${pending.map((t) => t.criterion).join(", ")} : résultats conformes sur le lot ${lotCode}.`,
      icon: "check",
      href: `/projets/${projectCode.toLowerCase()}/essais`,
      lotCode,
    });
    return next;
  },

  /** The project manager submits "retain the formula" (scenario of screen 21). */
  submitRetainDecision(s: DemoState, projectCode: string, formula: string): DemoState {
    const lotCode = testsForFormula(s, projectCode, formula)[0]?.lotCode ?? "";
    const pilot = s.lots.find((l) => l.projectCode === projectCode && l.type === "Pilote" && l.formula === formula)?.code ?? "";
    const synthesisId = `doc-${projectCode.toLowerCase()}-synthese`;
    const documents = s.documents.some((d) => d.id === synthesisId)
      ? s.documents
      : [
          {
            id: synthesisId,
            projectCode,
            category: "Formulation" as const,
            name: "Synthèse de comparaison F1-F2",
            type: "Analyse et recommandation",
            version: 1,
            owner: "Chef de projet",
            updatedAt: stamp(),
            status: "Approuvé" as const,
            size: "540 Ko",
            fileType: "PDF" as const,
            formula,
            versions: [{ version: 1, date: stamp(), author: "Chef de projet", note: "Création du document" }],
          },
          ...s.documents,
        ];
    const report = s.documents.find((d) => d.projectCode === projectCode && d.formula === formula && d.type === "Rapport d'essais");
    const justification = `Les résultats des essais de la formule ${formula} sont conformes aux critères d'acceptation. La formule ${formula} est retenue pour la préparation du lot pilote ${pilot || "à venir"}.`;
    let next: DemoState = {
      ...s,
      documents,
      formulaDecisions: [
        ...s.formulaDecisions.filter((d) => d.projectCode !== projectCode || d.formula !== formula),
        {
          projectCode,
          formula,
          choice: "retenir",
          justification,
          attachments: [...(report ? [report.id] : []), synthesisId],
          status: "Soumise",
          step: 2,
          updatedAt: stamp(),
          lot: lotCode,
          circuit: decisionCircuit(DEMO_TODAY),
        },
      ],
      decisions: s.decisions.map((d) =>
        d.projectCode === projectCode && d.href.includes("/formules") ? { ...d, status: { label: "Soumise pour avis", tone: "info" } } : d,
      ),
    };
    next = withEvent(next, {
      projectCode,
      title: "Décision soumise pour avis",
      context: `${projectCode} • Décision : formule ${formula}`,
      object: "Décision",
      objectLabel: `${projectCode} • Décision : formule ${formula}`,
      type: "Soumission",
      description: justification,
      icon: "send",
      href: `/projets/${projectCode.toLowerCase()}/formules/comparaison?examen=1`,
    });
    return next;
  },

  /** Current reviewer of the circuit gives a favourable opinion (step 2 → 3). */
  reviewDecision(s: DemoState, projectCode: string, formula?: string): DemoState {
    const d = currentDecision(s, projectCode, formula);
    if (!d || d.status !== "Soumise" || d.step !== 2 || !d.circuit) return s;
    const circuit = d.circuit.map((c, i) =>
      i === 1 ? { ...c, status: "Avis favorable" as const, date: DEMO_TODAY } : i === 2 ? { ...c, status: "À examiner" as const } : c,
    );
    let next: DemoState = {
      ...s,
      formulaDecisions: s.formulaDecisions.map((x) => (x === d ? { ...x, step: 3, circuit, updatedAt: stamp() } : x)),
      decisions: s.decisions.map((x) =>
        x.projectCode === projectCode && x.href.includes("/formules") ? { ...x, status: { label: "À approuver", tone: "warn" } } : x,
      ),
    };
    next = withEvent(next, {
      projectCode,
      title: "Avis favorable du responsable développement",
      context: `${projectCode} • Décision : formule ${d.formula}`,
      object: "Décision",
      objectLabel: `${projectCode} • Décision : formule ${d.formula}`,
      type: "Approbation",
      ...who(actor(s, PEOPLE_LAB.claireM)),
      description: "Décision transmise au pharmacien responsable pour approbation finale.",
      icon: "check",
      href: `/projets/${projectCode.toLowerCase()}/formules/comparaison?examen=1`,
    });
    return next;
  },

  /** Final approval by the qualified person: the retained formula can go to the pilot lot. */
  approveDecision(s: DemoState, projectCode: string, formula?: string): DemoState {
    const d = currentDecision(s, projectCode, formula);
    if (!d || d.status !== "Soumise") return s;
    const circuit = (d.circuit ?? decisionCircuit(DEMO_TODAY)).map((c, i) =>
      i === 1 && c.status !== "Avis favorable" ? { ...c, status: "Avis favorable" as const, date: DEMO_TODAY } : i === 2 ? { ...c, status: "Approuvé" as const, date: DEMO_TODAY } : c,
    );
    const pilot = s.lots.find((l) => l.projectCode === projectCode && l.type === "Pilote" && l.formula === d.formula)?.code;
    let next: DemoState = {
      ...s,
      formulaDecisions: s.formulaDecisions.map((x) =>
        x === d ? { ...x, status: "Approuvée", step: 3, circuit, approvedAt: stamp(), updatedAt: stamp() } : x,
      ),
      // « Retenir » retains the formula; « revoir » sends it back to formulation: a new version or new trials follow.
      formulas:
        d.choice === "retenir"
          ? s.formulas.map((f) => (f.projectCode === projectCode && f.code === d.formula ? { ...f, status: "Retenue" } : f))
          : d.choice === "revoir"
            ? s.formulas.map((f) => (f.projectCode === projectCode && f.code === d.formula && f.status !== "Retenue" ? { ...f, status: "À améliorer" } : f))
            : s.formulas,
      decisions: s.decisions.map((x) =>
        x.projectCode === projectCode && x.href.includes("/formules") ? { ...x, status: { label: "Approuvée", tone: "success" } } : x,
      ),
      projects:
        d.choice === "retenir" && pilot
          ? s.projects.map((p) =>
              p.code === projectCode
                ? {
                    ...p,
                    objective: { title: `Fabriquer le lot pilote ${pilot}`, detail: `Formule ${d.formula} retenue` },
                    nextAction: { date: "2026-10-05", label: `Préparer le lot pilote ${pilot}` },
                    nextStep: `Fabriquer le lot pilote ${pilot}`,
                    milestone: { ...p.milestone, blocker: undefined },
                  }
                : p,
            )
          : s.projects,
    };
    next = notify(next, {
      title: "Décision approuvée",
      detail: `${projectLabel(s, projectCode)} — formule ${d.formula} ${d.choice === "retenir" ? "retenue" : d.choice === "revoir" ? ": hypothèses à revoir" : ": essais à poursuivre"}`,
      href: `/projets/${projectCode.toLowerCase()}/formules/comparaison`,
      tone: "success",
    });
    next = withEvent(next, {
      projectCode,
      title: "Décision approuvée",
      context: `${projectCode} • Décision : formule ${d.formula}`,
      object: "Décision",
      objectLabel: `${projectCode} • Décision : formule ${d.formula}`,
      type: "Approbation",
      ...who(actor(s, PEOPLE_LAB.paul)),
      description: pilot
        ? `Formule ${d.formula} retenue : la préparation du lot pilote ${pilot} est autorisée.`
        : d.choice === "retenir"
          ? `Formule ${d.formula} retenue.`
          : d.choice === "revoir"
            ? `Hypothèses à revoir pour la formule ${d.formula} : une nouvelle version ou de nouveaux essais peuvent être préparés, puis une nouvelle décision.`
            : `Essais à poursuivre sur la formule ${d.formula} : une nouvelle décision sera préparée une fois les résultats disponibles.`,
      icon: "check",
      href: `/projets/${projectCode.toLowerCase()}/formules/comparaison`,
    });
    return next;
  },

  /** The current reviewer sends the decision back to the project manager. */
  requestDecisionCorrection(s: DemoState, projectCode: string, reason: string, formula?: string): DemoState {
    const d = currentDecision(s, projectCode, formula);
    if (!d || d.status !== "Soumise" || !d.circuit) return s;
    const index = d.step - 1;
    const reviewer = index === 2 ? actor(s, PEOPLE_LAB.paul) : actor(s, PEOPLE_LAB.claireM);
    const circuit = d.circuit.map((c, i) => (i === index ? { ...c, status: "Correction demandée" as const, date: DEMO_TODAY } : c));
    let next: DemoState = {
      ...s,
      formulaDecisions: s.formulaDecisions.map((x) =>
        x === d ? { ...x, status: "Correction demandée", circuit, correction: reason, updatedAt: stamp() } : x,
      ),
      decisions: s.decisions.map((x) =>
        x.projectCode === projectCode && x.href.includes("/formules") ? { ...x, status: { label: "Correction demandée", tone: "danger" } } : x,
      ),
    };
    next = withEvent(next, {
      projectCode,
      title: "Correction demandée sur la décision",
      context: `${projectCode} • Décision : formule ${d.formula}`,
      object: "Décision",
      objectLabel: `${projectCode} • Décision : formule ${d.formula}`,
      type: "Correction",
      ...who(reviewer),
      motif: reason,
      description: "La décision est renvoyée au chef de projet pour correction.",
      icon: "edit",
      href: `/projets/${projectCode.toLowerCase()}/formules/comparaison`,
    });
    return next;
  },

  /* ---------------- Methods: reference & protocol (23–24) ---------------- */

  saveReference(s: DemoState, ref: string, patch: Partial<MethodReference>): DemoState {
    const m = findMethod(s, ref);
    if (!m) return s;
    const reference = { ...m.reference, ...patch };
    let next = mapMethod(s, ref, (x) => ({ ...x, reference }));
    if (patch.applicability && patch.applicability !== m.reference.applicability) {
      next = methodEvent(next, m, {
        title: patch.applicability === "Confirmée" ? "Applicabilité confirmée" : "Applicabilité modifiée",
        type: "Modification",
        by: m.owner,
        field: "Applicabilité",
        oldValue: m.reference.applicability,
        newValue: patch.applicability,
        version: { label: "Référence v1", tone: "neutral" },
        icon: "check",
      });
    }
    const labels: Record<string, string> = {
      dossier: "Dossier source",
      reference: "Référence",
      edition: "Édition",
      title: "Titre",
      description: "Description",
      equipment: "Équipement",
      column: "Colonne",
      reagents: "Réactifs principaux",
    };
    const changed = Object.keys(labels).filter((k) => k in patch && patch[k as keyof MethodReference] !== m.reference[k as keyof MethodReference]);
    if (changed.length) {
      next = methodEvent(next, m, {
        title: "Référence mise à jour",
        type: "Modification",
        by: m.owner,
        description: `Champs modifiés : ${changed.map((k) => labels[k]).join(", ")}.`,
        version: { label: "Référence v1", tone: "neutral" },
        icon: "edit",
      });
    }
    return next;
  },

  replaceSourceDocument(s: DemoState, ref: string, name: string): DemoState {
    const m = findMethod(s, ref);
    if (!m) return s;
    const sourceDoc = { name, folder: m.reference.sourceDoc?.folder ?? "Dossier interne", date: DEMO_TODAY };
    let next = mapMethod(s, ref, (x) => ({
      ...x,
      reference: { ...x.reference, sourceDoc },
      documents: x.documents.map((d) => (d.id === "d-source" ? { ...d, file: name, date: DEMO_TODAY, status: "Disponible" } : d)),
    }));
    next = methodEvent(next, m, {
      title: "Document source remplacé",
      type: "Modification",
      by: m.owner,
      field: "Document source",
      oldValue: m.reference.sourceDoc?.name ?? "Aucun",
      newValue: name,
      version: { label: "Référence v1", tone: "neutral" },
      icon: "doc",
    });
    return next;
  },

  createProtocol(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m || m.protocol || m.reference.applicability !== "Confirmée") return s;
    const protocol: MethodProtocol =
      m.ref === "M-01"
        ? m01ProtocolDraft(DEMO_TODAY)
        : {
            ...m01ProtocolDraft(DEMO_TODAY),
            objective: `Définir les conditions de l'analyse « ${m.name} » pour le projet ${m.projectCode}.`,
            preparation: "",
            params: { ...m01ProtocolDraft(DEMO_TODAY).params, equipment: m.equipment.code, column: "", mobilePhase: "" },
            criteria: [
              { id: "c1", label: `Critère principal (${m.name})`, value: "", unit: "%" },
              { id: "c2", label: "Répétabilité (RSD)", value: "", unit: "%" },
            ],
          };
    let next = mapMethod(s, ref, (x) => ({
      ...x,
      protocol,
      versions: [{ version: "v1", status: "Brouillon", date: stamp(), by: x.owner.name, note: "Création du protocole" }, ...x.versions],
    }));
    next = methodEvent(next, m, {
      title: "Protocole v1 créé",
      type: "Création",
      by: m.owner,
      description: "Brouillon du protocole analytique créé à partir de la fiche de référence.",
      version: { label: "Protocole v1 • Brouillon", tone: "info" },
      href: `/methodes/${ref.toLowerCase()}/protocole`,
    });
    return next;
  },

  updateProtocol(s: DemoState, ref: string, patch: Partial<MethodProtocol>, silent = false): DemoState {
    const m = findMethod(s, ref);
    if (!m?.protocol) return s;
    const protocol = { ...m.protocol, ...patch, updatedAt: DEMO_TODAY };
    let next = mapMethod(s, ref, (x) => ({ ...x, protocol }));
    if (!silent) {
      const filled = protocol.criteria.filter((c) => c.value.trim()).length;
      next = methodEvent(next, m, {
        title: "Brouillon du protocole enregistré",
        type: "Modification",
        by: m.owner,
        description: `Critères d'acceptation définis : ${filled} / ${protocol.criteria.length}.`,
        version: { label: `Protocole ${protocol.version} • ${protocol.status}`, tone: "info" },
        icon: "edit",
        href: `/methodes/${ref.toLowerCase()}/protocole`,
      });
    }
    return next;
  },

  /** Pre-fills the empty acceptance criteria with the values of the source dossier. */
  prefillCriteria(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m?.protocol) return s;
    const criteria = m.protocol.criteria.map((c) => (c.value.trim() ? c : { ...c, value: M01_SOURCE_CRITERIA[c.id] ?? "Selon Pharmacopée" }));
    return mapMethod(s, ref, (x) => ({ ...x, protocol: x.protocol && { ...x.protocol, criteria } }));
  },

  submitProtocol(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m?.protocol || m.protocol.status !== "Brouillon" || m.protocol.criteria.some((c) => !c.value.trim())) return s;
    let next = mapMethod(s, ref, (x) => ({ ...x, protocol: x.protocol && { ...x.protocol, status: "En revue", submittedAt: stamp() } }));
    next = methodEvent(next, m, {
      title: "Protocole soumis en revue",
      type: "Soumission",
      by: m.owner,
      description: `Soumis aux relecteurs : ${m.protocol.reviewers.map((r) => r.name).join(", ")}.`,
      version: { label: `Protocole ${m.protocol.version} • En revue`, tone: "warn" },
      icon: "send",
      href: `/methodes/${ref.toLowerCase()}/protocole`,
    });
    return next;
  },

  /** Reviewers approve the protocol (simulated in the demo). */
  approveProtocol(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m?.protocol || m.protocol.status !== "En revue") return s;
    const version = m.protocol.version;
    let next = mapMethod(s, ref, (x) => ({
      ...x,
      protocol: x.protocol && {
        ...x.protocol,
        status: "Approuvé",
        approvedAt: DEMO_TODAY,
        reviewers: x.protocol.reviewers.map((r) => ({ ...r, status: "Approuvé", date: DEMO_TODAY })),
      },
      versions: x.versions.map((v) => (v.version === version ? { ...v, status: "Approuvé", date: stamp(), by: actor(s, PEOPLE_LAB.paul).name, note: "Protocole approuvé" } : v.status === "Approuvé" ? { ...v, status: "Remplacée" } : v)),
      documents: x.documents.map((d) => (d.id === "d-protocol" ? { ...d, status: "Disponible", file: `protocole-${version}.pdf`, date: DEMO_TODAY } : d)),
    }));
    next = methodEvent(next, m, {
      title: "Protocole approuvé",
      type: "Approbation",
      by: actor(s, PEOPLE_LAB.paul),
      description: `Approbation de la version ${version} du protocole.`,
      version: { label: `${version} • Approuvé`, tone: "success" },
      icon: "check",
      href: `/methodes/${ref.toLowerCase()}/protocole`,
    });
    return next;
  },

  addReviewer(s: DemoState, ref: string, person: Person): DemoState {
    return mapMethod(s, ref, (x) =>
      x.protocol && !x.protocol.reviewers.some((r) => r.name === person.name)
        ? { ...x, protocol: { ...x.protocol, reviewers: [...x.protocol.reviewers, { ...person, status: "En attente" }] } }
        : x,
    );
  },

  newMethodVersion(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m) return s;
    const version = `v${m.versions.length + 1}`;
    let next = mapMethod(s, ref, (x) => ({
      ...x,
      versions: [{ version, status: "Brouillon", date: stamp(), by: "Chef de projet", note: "Nouvelle version en brouillon" }, ...x.versions],
    }));
    next = methodEvent(next, m, {
      title: `Nouvelle version ${version} créée`,
      type: "Création",
      description: `Version ${version} de la méthode ouverte en brouillon.`,
      version: { label: `${version} • Brouillon`, tone: "info" },
      icon: "doc",
    });
    return next;
  },

  duplicateMethod(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m) return s;
    const newRef = nextMethodRef(s);
    const copy: Method = {
      ...m,
      ref: newRef,
      name: `${m.name} (copie)`,
      status: { label: "Protocole à préparer", tone: "info" },
      nextAction: { label: "Préparer le protocole" },
      todo: undefined,
      lifecycle: true,
      reference: { ...m.reference, reference: `REF-${newRef.replace("-", "")}`, applicability: "À confirmer" },
      documents: m.documents.map((d) => (d.id === "d-source" ? d : { ...d, status: d.id === "d-protocol" ? "À créer" : "À venir", file: undefined, date: undefined })),
      protocol: undefined,
      versions: [],
      archived: false,
    };
    let next: DemoState = { ...s, methods: [...s.methods, copy] };
    next = methodEvent(next, copy, {
      title: `Méthode dupliquée depuis ${m.ref}`,
      type: "Création",
      description: `${newRef} créée à partir de ${m.ref} • ${m.name}.`,
      version: { label: "Référence v1", tone: "neutral" },
    });
    return next;
  },

  archiveMethod(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m) return s;
    let next = mapMethod(s, ref, (x) => ({ ...x, archived: true }));
    next = methodEvent(next, m, { title: "Méthode archivée", type: "Modification", field: "Statut", oldValue: "Active", newValue: "Archivée", icon: "folder" });
    return next;
  },

  restoreMethod(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    if (!m) return s;
    let next = mapMethod(s, ref, (x) => ({ ...x, archived: false }));
    next = methodEvent(next, m, { title: "Méthode restaurée", type: "Modification", field: "Statut", oldValue: "Archivée", newValue: "Active", icon: "folder" });
    return next;
  },

  addMethod(
    s: DemoState,
    input: { name: string; technique: string; description: string; analysis: string; type: Method["type"]; origin: Method["origin"]; projectCode: string; equipmentCode: string; equipmentLabel: string; owner: Person },
  ): DemoState {
    const ref = nextMethodRef(s);
    const method: Method = {
      ref,
      name: input.name,
      technique: input.technique,
      description: input.description,
      subtitle: input.description,
      analysis: input.analysis,
      type: input.type,
      origin: input.origin,
      projectCode: input.projectCode,
      equipment: { code: input.equipmentCode, label: input.equipmentLabel },
      owner: input.owner,
      status: { label: "Protocole à préparer", tone: "info" },
      nextAction: { label: "Confirmer l'applicabilité" },
      lifecycle: true,
      reference: {
        dossier: input.origin === "Pharmacopée" ? "Pharmacopée" : "Interne",
        reference: `REF-${ref.replace("-", "")}`,
        edition: "v1",
        title: input.name,
        description: input.description,
        applicability: "À confirmer",
        equipment: input.equipmentCode,
        column: "",
        reagents: "",
      },
      documents: [
        { id: "d-source", name: "Document source", status: "À venir" },
        { id: "d-protocol", name: "Protocole interne", status: "À créer" },
        { id: "d-report", name: "Rapport de validation", status: "À venir" },
      ],
      versions: [],
      archived: false,
    };
    let next: DemoState = { ...s, methods: [...s.methods, method] };
    next = methodEvent(next, method, {
      title: "Fiche méthode créée",
      type: "Création",
      by: input.owner,
      description: `Méthode ${ref} ajoutée au catalogue (${input.technique}).`,
      version: { label: "Référence v1", tone: "neutral" },
    });
    return next;
  },

  /* ---------------- Tests & analyses (25–28) ---------------- */

  saveTestPlan(s: DemoState, plan: TestPlan): DemoState {
    return { ...s, testPlans: [...s.testPlans.filter((p) => p.methodRef !== plan.methodRef), { ...plan, updatedAt: stamp() }] };
  },

  launchTests(s: DemoState, ref: string): DemoState {
    const m = findMethod(s, ref);
    const plan = s.testPlans.find((p) => p.methodRef === ref);
    if (!m || !plan || m.protocol?.status !== "Approuvé" || !plan.samples.length) return s;
    const id = nextAnalysisId(s);
    const lot = s.lots.find((l) => l.projectCode === plan.projectCode && l.code === plan.lotCode);
    const analysis: Analysis = {
      id,
      methodRef: ref,
      projectCode: plan.projectCode,
      lotCode: plan.lotCode,
      formula: plan.formula,
      protocolVersion: m.protocol.version,
      protocolApprovedAt: m.protocol.approvedAt ?? DEMO_TODAY,
      lotMadeAt: lot?.createdAt ?? DEMO_TODAY,
      date: DEMO_TODAY,
      periodFrom: DEMO_TODAY,
      periodTo: DEMO_TODAY,
      status: "Brouillon",
      unit: m.protocol.criteria[0]?.unit && m.protocol.criteria[0].unit !== "–" ? m.protocol.criteria[0].unit : "%",
      repetitions: plan.repetitions,
      analyst: plan.analyst,
      results: plan.samples.map((sample, i) => ({ sample, description: `Prélèvement ${i + 1}`, value: "", comment: "", date: DEMO_TODAY })),
      attachments: [],
      circuit: [
        { role: "Analyse laboratoire", detail: "Saisie et soumission des résultats", status: "En attente" },
        { role: "Relecteur", detail: "Examine les résultats", status: "En attente" },
        { role: "Approbateur", detail: "Approbation finale", status: "En attente" },
      ],
      comments: [],
    };
    let next: DemoState = { ...s, analyses: [...s.analyses, analysis], testPlans: s.testPlans.filter((p) => p.methodRef !== ref) };
    next = methodEvent(next, m, {
      title: `Essais lancés — ${id}`,
      type: "Création",
      by: plan.analyst,
      description: `${plan.samples.length} échantillons du lot ${plan.lotCode} (${plan.repetitions} répétitions) — formule ${plan.formula}.`,
      version: { label: `${id} • Brouillon`, tone: "info" },
      analysisId: id,
      href: `/methodes/${ref.toLowerCase()}/analyses/${id.toLowerCase()}`,
    });
    return next;
  },

  saveAnalysis(s: DemoState, id: string, results: AnalysisResult[]): DemoState {
    const a = findAnalysis(s, id);
    const m = a && findMethod(s, a.methodRef);
    if (!a || !m) return s;
    const changes = results
      .map((r) => ({ r, before: a.results.find((x) => x.sample === r.sample) }))
      .filter(({ r, before }) => before && before.value.trim() !== r.value.trim());
    let next = mapAnalysis(s, id, (x) => ({ ...x, results }));
    if (!changes.length) return next;
    const [first, ...others] = changes;
    const wasEmpty = !first.before?.value.trim();
    next = methodEvent(next, m, {
      title: wasEmpty ? "Résultat saisi" : "Valeur modifiée",
      type: "Modification",
      by: a.analyst,
      field: `${first.r.sample}`,
      oldValue: wasEmpty ? "Non renseigné" : `${first.before?.value} ${a.unit}`,
      newValue: first.r.value.trim() ? `${first.r.value.trim()} ${a.unit}` : "Non renseigné",
      motif: wasEmpty ? "Saisie du résultat manquant." : "Correction de la valeur saisie.",
      description: others.length
        ? `Autres modifications : ${others.map(({ r }) => `${r.sample} → ${r.value.trim() || "—"} ${a.unit}`).join(", ")}.`
        : wasEmpty
          ? "Saisie d'un résultat d'essai."
          : "Modification d'une valeur de résultat.",
      version: { label: `${id} • ${a.status}`, tone: "info" },
      analysisId: id,
      href: `/methodes/${m.ref.toLowerCase()}/analyses/${id.toLowerCase()}`,
    });
    return next;
  },

  addAnalysisAttachment,

  removeAnalysisAttachment(s: DemoState, id: string, attachmentId: string): DemoState {
    return mapAnalysis(s, id, (x) => ({ ...x, attachments: x.attachments.filter((f) => f.id !== attachmentId) }));
  },

  submitAnalysis,

  requestAnalysisCorrection(s: DemoState, id: string, input: { recipient: Person; reason: string; due: string; notify: boolean }): DemoState {
    const a = findAnalysis(s, id);
    const m = a && findMethod(s, a.methodRef);
    if (!a || !m || a.status !== "En revue") return s;
    const at = stamp();
    const sample = /ECH-\d+/.exec(input.reason)?.[0];
    const activityId = `act-corr-${id.toLowerCase()}`;
    const activity: Activity = {
      id: activityId,
      projectCode: a.projectCode,
      title: sample && /chromatogramme/i.test(input.reason) ? `Joindre le chromatogramme ${sample}` : `Corriger les résultats ${id}`,
      detail: input.reason,
      tags: [a.projectCode, sample ?? id],
      status: { label: "Correction demandée", tone: "danger" },
      due: input.due,
      owner: input.recipient.name,
      ownerRole: input.recipient.role,
      icon: "doc",
      done: false,
      state: "a-faire",
      urgent: true,
      context: `Essai ${sample ?? id}`,
      description: `${input.reason.replace(/\.$/, "")} suite à la correction demandée par le relecteur.`,
      priority: "Haute",
      lotCode: a.lotCode,
      methodRef: m.ref,
      analysisId: id,
      kind: "correction",
      prerequisiteNote: sample
        ? { title: `Le rapport d'acquisition ${sample} doit être disponible.`, detail: "Ajoutez le chromatogramme au dossier de l'essai pour pouvoir finaliser cette activité." }
        : { title: "Les résultats corrigés doivent être saisis.", detail: "Complétez l'essai puis resoumettez-le pour revue." },
      documents: sample ? [{ name: `Rapport ${sample} v1.pdf`, type: "Rapport d'essais", date: DEMO_TODAY }] : [],
      comments: [],
      href: `/methodes/${m.ref.toLowerCase()}/analyses/${id.toLowerCase()}`,
    };
    let next: DemoState = {
      ...mapAnalysis(s, id, (x) => ({
        ...x,
        status: "Correction demandée",
        correction: { ...input, recipient: input.recipient.name, at },
        circuit: x.circuit.map((c, i) => (i === 1 ? { ...c, status: "Correction demandée", date: at } : i === 0 ? { ...c, status: "En attente" } : c)),
      })),
    };
    next = { ...next, activities: [activity, ...next.activities.filter((x) => x.id !== activityId)] };
    if (input.notify) {
      next = notify(next, {
        title: `Correction demandée — ${id}`,
        detail: `${input.recipient.name} • échéance ${formatNumeric(input.due)}`,
        href: `/activites?activite=${activityId}`,
        tone: "danger",
      });
    }
    next = methodEvent(next, m, {
      title: "Demande de correction",
      type: "Correction",
      by: actor(s, PEOPLE_LAB.claireM),
      description: "Une correction a été demandée sur les résultats de la méthode.",
      motif: input.reason,
      field: "Destinataire",
      oldValue: "—",
      newValue: `${input.recipient.name} (échéance ${formatNumeric(input.due)})`,
      version: { label: `${id} • Correction`, tone: "danger" },
      icon: "edit",
      analysisId: id,
    });
    return next;
  },

  validateAnalysis(s: DemoState, id: string): DemoState {
    const a = findAnalysis(s, id);
    const m = a && findMethod(s, a.methodRef);
    if (!a || !m || a.status !== "En revue") return s;
    const at = stamp();
    let next = mapAnalysis(s, id, (x) => ({
      ...x,
      status: "Validée",
      circuit: x.circuit.map((c, i) => (i === 0 ? c : { ...c, status: "Approuvé", date: at })),
    }));
    next = methodEvent(next, m, {
      title: "Résultats validés",
      type: "Approbation",
      by: actor(s, PEOPLE_LAB.paul),
      description: `Les résultats de l'essai ${id} sont validés.`,
      version: { label: `${id} • Validé`, tone: "success" },
      icon: "check",
      analysisId: id,
    });
    return next;
  },

  addAnalysisComment(s: DemoState, id: string, text: string): DemoState {
    return mapAnalysis(s, id, (x) => ({ ...x, comments: [...x.comments, { id: uid("c"), author: "Chef de projet", text, at: stamp() }] }));
  },

  /* ---------------- Activities (29–30) ---------------- */

  startActivity(s: DemoState, id: string): DemoState {
    const a = s.activities.find((x) => x.id === id);
    if (!a || a.done || a.state === "en-cours") return s;
    let next = mapActivity(s, id, (x) => ({ ...x, state: "en-cours", status: x.kind === "correction" ? x.status : { label: "En cours", tone: "info" } }));
    next = withEvent(next, {
      projectCode: a.projectCode,
      title: "Activité démarrée",
      context: `${a.projectCode} • ${a.title}`,
      object: "Activité",
      objectLabel: `${a.projectCode} • Activité : ${a.title}`,
      type: "Modification",
      author: a.owner,
      authorRole: a.ownerRole,
      field: "Statut",
      oldValue: a.status.label,
      newValue: "En cours",
      icon: "check",
      href: `/activites/${a.id}`,
      activityId: a.id,
    });
    return next;
  },

  completeActivity(s: DemoState, id: string): DemoState {
    const a = s.activities.find((x) => x.id === id);
    if (!a || a.done) return s;
    let next = mapActivity(s, id, (x) => ({ ...x, done: true, state: "terminee", status: DONE_STATUS }));
    if (a.kind === "cadrage") {
      next = {
        ...next,
        projects: next.projects.map((p) =>
          p.code === a.projectCode
            ? {
                ...p,
                scope: p.scope ? { ...p.scope, validatedAt: stamp() } : p.scope,
                phase: p.phase === "Cadrage" ? "Faisabilité" : p.phase,
                stage: p.stage.label === "Cadrage" ? { ...p.stage, label: "Faisabilité" } : p.stage,
                track: p.track.label === "Cadrage" ? { label: "Faisabilité", tone: "info" } : p.track,
                objective: { title: "Tenir la revue de lancement", detail: "Cadrage validé" },
                nextAction: { date: p.milestone.date, label: p.milestone.title },
                nextStep: "Lever les prérequis et lancer le développement",
              }
            : p,
        ),
      };
    }
    if (a.kind === "correction" && a.analysisId) {
      const analysis = findAnalysis(next, a.analysisId);
      const sample = /ECH-\d+/.exec(a.title)?.[0];
      if (analysis && analysis.status === "Correction demandée") {
        if (sample) next = addAnalysisAttachment(next, analysis.id, { name: `Chromatogramme ${sample}.pdf`, kind: "Chromatogramme" });
        next = submitAnalysis(next, analysis.id);
      }
    }
    next = withEvent(next, {
      projectCode: a.projectCode,
      title: "Activité terminée",
      context: `${a.projectCode} • ${a.title}`,
      object: "Activité",
      objectLabel: `${a.projectCode} • Activité : ${a.title}`,
      type: "Modification",
      author: a.owner,
      authorRole: a.ownerRole,
      field: "Statut",
      oldValue: a.status.label,
      newValue: "Terminée",
      icon: "check",
      href: `/activites/${a.id}`,
      activityId: a.id,
    });
    return next;
  },

  reassignActivity(s: DemoState, id: string, owner: string, ownerRole?: string): DemoState {
    const a = s.activities.find((x) => x.id === id);
    if (!a || a.owner === owner) return s;
    let next = mapActivity(s, id, (x) => ({ ...x, owner, ownerRole }));
    next = withEvent(next, {
      projectCode: a.projectCode,
      title: "Activité réaffectée",
      context: `${a.projectCode} • ${a.title}`,
      object: "Activité",
      objectLabel: `${a.projectCode} • Activité : ${a.title}`,
      type: "Modification",
      field: "Responsable",
      oldValue: a.owner,
      newValue: owner,
      icon: "edit",
      href: `/activites/${a.id}`,
      activityId: a.id,
    });
    return next;
  },

  addActivityComment(s: DemoState, id: string, text: string): DemoState {
    return mapActivity(s, id, (x) => ({ ...x, comments: [...(x.comments ?? []), { id: uid("c"), author: "Chef de projet", text, at: stamp() }] }));
  },

  addActivityDocument(s: DemoState, id: string, doc: { name: string; type: string }): DemoState {
    const a = s.activities.find((x) => x.id === id);
    if (!a) return s;
    let next = mapActivity(s, id, (x) => ({ ...x, documents: [...(x.documents ?? []), { ...doc, date: DEMO_TODAY }] }));
    next = withEvent(next, {
      projectCode: a.projectCode,
      title: "Document ajouté à l'activité",
      context: `${a.projectCode} • ${a.title}`,
      object: "Activité",
      objectLabel: `${a.projectCode} • Activité : ${a.title}`,
      type: "Ajout",
      description: `${doc.name} (${doc.type}).`,
      icon: "doc",
      href: `/activites/${a.id}`,
      activityId: a.id,
    });
    return next;
  },

  createActivity(
    s: DemoState,
    input: { id: string; projectCode: string; title: string; description: string; owner: string; ownerRole?: string; due: string; context?: string; priority: "Normale" | "Haute" },
  ): DemoState {
    const activity: Activity = {
      id: input.id,
      projectCode: input.projectCode,
      title: input.title,
      detail: input.description,
      tags: [input.projectCode],
      status: { label: "À faire", tone: "info" },
      due: input.due,
      owner: input.owner,
      ownerRole: input.ownerRole,
      icon: "doc",
      done: false,
      state: "a-faire",
      context: input.context,
      description: input.description,
      priority: input.priority,
      urgent: input.priority === "Haute",
      documents: [],
      comments: [],
      kind: "standard",
    };
    let next: DemoState = { ...s, activities: [activity, ...s.activities] };
    next = withEvent(next, {
      projectCode: input.projectCode,
      title: "Activité créée",
      context: `${input.projectCode} • ${input.title}`,
      object: "Activité",
      objectLabel: `${input.projectCode} • Activité : ${input.title}`,
      type: "Création",
      description: `Affectée à ${input.owner} — échéance ${formatNumeric(input.due)}.`,
      icon: "check",
      href: `/activites/${activity.id}`,
      activityId: activity.id,
    });
    return next;
  },

  /* ---------------- Planning (31–34) ---------------- */

  createEvent(s: DemoState, input: Omit<PlanningEvent, "status" | "createdBy"> & { createdBy?: string }): DemoState {
    const event: PlanningEvent = { status: input.kind === "reservation" ? "Confirmée" : "Planifiée", createdBy: "Chef de projet", ...input };
    let next: DemoState = {
      ...s,
      events: [...s.events, event],
      activities: s.activities.map((a) =>
        !a.done &&
        a.kind === "reservation" &&
        a.reservationFor &&
        event.kind === "reservation" &&
        event.resourceIds.includes(a.reservationFor) &&
        a.projectCode === event.projectCode
          ? { ...a, done: true, state: "terminee", status: DONE_STATUS }
          : a,
      ),
    };
    if (event.projectCode) {
      const resource = s.resources.find((r) => r.id === event.resourceIds[0]);
      next = withEvent(next, {
        projectCode: event.projectCode,
        title: event.kind === "reservation" ? "Réservation confirmée" : "Activité planifiée",
        context: `${event.projectCode} • ${event.title}`,
        object: "Réservation",
        objectLabel: `${event.projectCode} • ${resource ? resource.name : event.title}`,
        type: "Création",
        description: `${resource ? `${resource.name} réservé` : event.title} le ${formatNumeric(event.date)} de ${event.start} à ${event.end}${event.lotCode ? ` (lot ${event.lotCode})` : ""}.`,
        icon: "calendar",
        href: `/planning?semaine=${event.date}&evenement=${event.id}`,
        lotCode: event.lotCode,
      });
    }
    return next;
  },

  updateEvent(s: DemoState, id: string, patch: Partial<PlanningEvent>): DemoState {
    const e = s.events.find((x) => x.id === id);
    if (!e) return s;
    let next: DemoState = { ...s, events: s.events.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
    if (e.projectCode) {
      next = withEvent(next, {
        projectCode: e.projectCode,
        title: "Planification modifiée",
        context: `${e.projectCode} • ${e.title}`,
        object: "Réservation",
        objectLabel: `${e.projectCode} • ${e.title}`,
        type: "Modification",
        field: "Créneau",
        oldValue: `${formatNumeric(e.date)} ${e.start}–${e.end}`,
        newValue: `${formatNumeric(patch.date ?? e.date)} ${patch.start ?? e.start}–${patch.end ?? e.end}`,
        icon: "calendar",
        href: `/planning?semaine=${patch.date ?? e.date}&evenement=${e.id}`,
      });
    }
    return next;
  },

  /* ---------------- Pilot lot (35–37) ---------------- */

  updatePreparation(s: DemoState, projectCode: string, lotCode: string, patch: { plannedDate?: string; responsible?: string; equipment?: string }): DemoState {
    const lot = findPilot(s, projectCode, lotCode);
    if (!lot) return s;
    let next = mapPilot(s, projectCode, lotCode, (l) => ({ ...l, ...patch }));
    next = withEvent(next, {
      projectCode,
      title: "Préparation du lot modifiée",
      context: `${projectCode} • Lot pilote ${lotCode}`,
      object: "Lot",
      objectLabel: `${projectCode} • Lot ${lotCode}`,
      type: "Modification",
      description: [
        patch.plannedDate && patch.plannedDate !== lot.plannedDate ? `date prévue ${formatNumeric(patch.plannedDate)}` : "",
        patch.responsible && patch.responsible !== lot.responsible ? `responsable ${patch.responsible}` : "",
      ]
        .filter(Boolean)
        .join(", ")
        .replace(/^./, (c) => c.toUpperCase()) || "Préparation mise à jour.",
      icon: "box",
      href: `/projets/${projectCode.toLowerCase()}/lots/${lotCode.toLowerCase()}`,
      lotCode,
    });
    return next;
  },

  startLot(s: DemoState, projectCode: string, lotCode: string): DemoState {
    const lot = findPilot(s, projectCode, lotCode);
    if (!lot || lot.status !== "Préparation") return s;
    const at = stamp();
    let next = mapPilot(s, projectCode, lotCode, (l) => ({
      ...l,
      status: "En fabrication",
      startedAt: at,
      lastSave: { at, by: l.steps[0]?.owner ?? "Production" },
      steps: l.steps.map((st, i) => (i === 0 ? { ...st, status: "En cours", start: "08:00" } : st)),
    }));
    next = {
      ...next,
      lots: next.lots.map((l) => (l.projectCode === projectCode && l.code === lotCode ? { ...l, status: "En cours" } : l)),
      activities: next.activities.map((a) =>
        a.kind === "preparation-lot" && a.lotCode === lotCode && a.projectCode === projectCode && !a.done
          ? { ...a, done: true, state: "terminee", status: DONE_STATUS }
          : a,
      ),
    };
    next = withEvent(next, {
      projectCode,
      title: `Fabrication du lot ${lotCode} démarrée`,
      context: `${projectCode} • Lot pilote ${lotCode} • ${lot.formula}`,
      object: "Lot",
      objectLabel: `${projectCode} • Lot ${lotCode}`,
      type: "Modification",
      field: "Statut",
      oldValue: "Prêt à démarrer",
      newValue: "En fabrication",
      icon: "box",
      href: `/projets/${projectCode.toLowerCase()}/lots/${lotCode.toLowerCase()}/execution`,
      lotCode,
    });
    return next;
  },

  saveStep(s: DemoState, projectCode: string, lotCode: string, key: string, patch: Partial<ExecStep>, silent = false): DemoState {
    const lot = findPilot(s, projectCode, lotCode);
    const step = lot?.steps.find((x) => x.key === key);
    if (!lot || !step) return s;
    let next = mapPilot(s, projectCode, lotCode, (l) => ({
      ...l,
      lastSave: { at: stamp(), by: step.owner },
      steps: l.steps.map((x) => (x.key === key ? { ...x, ...patch } : x)),
    }));
    if (!silent) {
      next = withEvent(next, {
        projectCode,
        title: `Étape « ${step.title} » enregistrée`,
        context: `${projectCode} • Lot pilote ${lotCode}`,
        object: "Lot",
        objectLabel: `${projectCode} • Lot ${lotCode}`,
        type: "Modification",
        author: step.owner,
        description: "Saisie de l'exécution enregistrée.",
        icon: "edit",
        href: `/projets/${projectCode.toLowerCase()}/lots/${lotCode.toLowerCase()}/execution`,
        lotCode,
      });
    }
    return next;
  },

  togglePauseStep(s: DemoState, projectCode: string, lotCode: string, key: string): DemoState {
    const step = findPilot(s, projectCode, lotCode)?.steps.find((x) => x.key === key);
    if (!step || (step.status !== "En cours" && step.status !== "En pause")) return s;
    const status = step.status === "En cours" ? "En pause" : "En cours";
    let next = mapPilot(s, projectCode, lotCode, (l) => ({ ...l, steps: l.steps.map((x) => (x.key === key ? { ...x, status } : x)) }));
    next = withEvent(next, {
      projectCode,
      title: status === "En pause" ? `Étape « ${step.title} » mise en pause` : `Étape « ${step.title} » reprise`,
      context: `${projectCode} • Lot pilote ${lotCode}`,
      object: "Lot",
      objectLabel: `${projectCode} • Lot ${lotCode}`,
      type: "Modification",
      author: step.owner,
      field: "Statut de l'étape",
      oldValue: step.status,
      newValue: status,
      icon: "box",
      href: `/projets/${projectCode.toLowerCase()}/lots/${lotCode.toLowerCase()}/execution`,
      lotCode,
    });
    return next;
  },

  completeStep(s: DemoState, projectCode: string, lotCode: string, key: string): DemoState {
    const lot = findPilot(s, projectCode, lotCode);
    const index = lot?.steps.findIndex((x) => x.key === key) ?? -1;
    if (!lot || index < 0) return s;
    const step = lot.steps[index];
    if (!step.end || step.status === "Terminée") return s;
    const last = index === lot.steps.length - 1;
    let next = mapPilot(s, projectCode, lotCode, (l) => ({
      ...l,
      status: last ? "Fabriqué" : l.status,
      lastSave: { at: stamp(), by: step.owner },
      steps: l.steps.map((x, i) => (i === index ? { ...x, status: "Terminée" } : i === index + 1 ? { ...x, status: "En cours", start: step.end } : x)),
      controls: last ? l.controls.map((c) => (c.status === "En attente" ? { ...c, status: "À saisir" } : c)) : l.controls,
    }));
    if (last) {
      next = { ...next, lots: next.lots.map((l) => (l.projectCode === projectCode && l.code === lotCode ? { ...l, status: "Disponible" } : l)) };
    }
    next = withEvent(next, {
      projectCode,
      title: last ? `Fabrication du lot ${lotCode} terminée` : `Étape « ${step.title} » terminée`,
      context: `${projectCode} • Lot pilote ${lotCode}`,
      object: "Lot",
      objectLabel: `${projectCode} • Lot ${lotCode}`,
      type: "Modification",
      author: step.owner,
      description: `${step.title} réalisée de ${step.start || "—"} à ${step.end} (${step.equipment}).`,
      icon: "check",
      href: `/projets/${projectCode.toLowerCase()}/lots/${lotCode.toLowerCase()}/execution`,
      lotCode,
    });
    return next;
  },

  saveControl(s: DemoState, projectCode: string, lotCode: string, id: string, patch: Partial<LotControl>): DemoState {
    const control = findPilot(s, projectCode, lotCode)?.controls.find((c) => c.id === id);
    if (!control) return s;
    const result = patch.result ?? control.result;
    const status = result.trim() && control.status !== "Validé" ? "Saisi" : control.status;
    let next = mapPilot(s, projectCode, lotCode, (l) => ({
      ...l,
      controls: l.controls.map((c) => (c.id === id ? { ...c, ...patch, status } : c)),
    }));
    if (result !== control.result) {
      next = withEvent(next, {
        projectCode,
        title: `Résultat de contrôle saisi — ${control.name}`,
        context: `${projectCode} • Lot pilote ${lotCode}`,
        object: "Lot",
        objectLabel: `${projectCode} • Lot ${lotCode}`,
        type: "Modification",
        field: control.name,
        oldValue: control.result ? `${control.result} ${control.unit}`.trim() : "Non renseigné",
        newValue: `${result} ${control.unit}`.trim(),
        icon: "edit",
        href: `/projets/${projectCode.toLowerCase()}/lots/${lotCode.toLowerCase()}/controles`,
        lotCode,
      });
    }
    return next;
  },

  setControls(s: DemoState, projectCode: string, lotCode: string, values: Record<string, Partial<LotControl>>): DemoState {
    return mapPilot(s, projectCode, lotCode, (l) => ({ ...l, controls: l.controls.map((c) => (values[c.id] ? { ...c, ...values[c.id] } : c)) }));
  },

  submitControls(s: DemoState, projectCode: string, lotCode: string): DemoState {
    const lot = findPilot(s, projectCode, lotCode);
    if (!lot || lot.controls.some((c) => !c.result.trim())) return s;
    let next = mapPilot(s, projectCode, lotCode, (l) => ({
      ...l,
      controlsSubmittedAt: stamp(),
      controls: l.controls.map((c) => (c.status === "Validé" ? c : { ...c, status: "En revue" })),
    }));
    next = withEvent(next, {
      projectCode,
      title: "Contrôles soumis pour revue",
      context: `${projectCode} • Lot pilote ${lotCode}`,
      object: "Lot",
      objectLabel: `${projectCode} • Lot ${lotCode}`,
      type: "Soumission",
      description: `${lot.controls.length} contrôles soumis au contrôle qualité.`,
      icon: "send",
      href: `/projets/${projectCode.toLowerCase()}/lots/${lotCode.toLowerCase()}/controles`,
      lotCode,
    });
    return next;
  },

  /* ---------------- Deviations (38–39) ---------------- */

  saveDeviationDraft(s: DemoState, projectCode: string, lotCode: string, draft: DeviationDraft): DemoState {
    return mapPilot(s, projectCode, lotCode, (l) => ({ ...l, deviationDraft: draft }));
  },

  createDeviation(
    s: DemoState,
    input: DeviationDraft & { projectCode: string; lotCode: string; formula: string; step: string; equipment: string; equipmentLabel: string },
  ): DemoState {
    const id = nextDeviationId(s);
    const lot = input.lotCode;
    const actions: DeviationAction[] = [];
    if (input.securingAction) {
      actions.push({
        id: "A-01",
        title: `Vérifier le ${input.equipmentLabel.toLowerCase()}`,
        owner: "Service Maintenance",
        category: "Maintenance",
        group: "Maintenance",
        status: "En cours",
        due: addDays(DEMO_TODAY, 8),
        description: `Faire intervenir la maintenance pour vérifier le ${input.equipmentLabel.toLowerCase()} suite à l'arrêt survenu pendant l'étape de ${input.step.toLowerCase()} du lot ${lot}.`,
        steps: ["Planifier l'intervention maintenance", "Vérifier les causes de l'arrêt", "Contrôler le bon fonctionnement avant redémarrage"],
        proofs: `Compte-rendu d'intervention et résultats des vérifications du ${input.equipmentLabel.toLowerCase()}.`,
      });
    }
    if (input.criticality === "À évaluer") {
      actions.push({
        id: `A-${pad2(actions.length + 1)}`,
        title: "Évaluer l'impact sur le lot",
        owner: "Assurance qualité",
        category: "Qualité",
        group: "Qualité",
        status: "À faire",
        due: addDays(DEMO_TODAY, 10),
        description: `Évaluer l'impact de la déviation sur la qualité du lot ${lot} et proposer la décision de libération.`,
        steps: ["Analyser les données de fabrication", "Évaluer l'impact qualité", "Proposer la décision de libération"],
        proofs: "Rapport d'évaluation d'impact signé par l'assurance qualité.",
      });
    }
    const deviation: Deviation = {
      id,
      projectCode: input.projectCode,
      lotCode: input.lotCode,
      formula: input.formula,
      step: input.step,
      equipment: input.equipment,
      equipmentLabel: input.equipmentLabel,
      title: input.title.replace(/imprévue /i, ""),
      observedAt: input.observedAt,
      category: input.category,
      criticality: input.criticality,
      description: input.description,
      immediateAction: input.immediateAction,
      attachments: input.attachments,
      informed: input.informed,
      securingAction: input.securingAction,
      status: "Analyse en cours",
      createdAt: stamp(),
      createdBy: "Chef de projet",
      analysis: { cause: "", rootCause: "", impact: "À évaluer" },
      actions,
    };
    let next: DemoState = {
      ...s,
      deviations: [...s.deviations, deviation],
      pilotLots: s.pilotLots.map((l) =>
        l.projectCode === input.projectCode && l.lotCode === input.lotCode
          ? {
              ...l,
              deviationDraft: undefined,
              steps: l.steps.map((st) => (st.title === input.step && st.status === "En cours" && /pause/i.test(input.immediateAction) ? { ...st, status: "En pause" } : st)),
            }
          : l,
      ),
    };
    next = notify(next, {
      title: `Déviation créée • ${id}`,
      detail: `${input.projectCode} • Lot ${lot} — impact à évaluer`,
      href: `/projets/${input.projectCode.toLowerCase()}/deviations/${id.toLowerCase()}`,
      tone: "warn",
    });
    next = withEvent(next, {
      projectCode: input.projectCode,
      title: `Déviation ${id} créée`,
      context: `${input.projectCode} • Lot pilote ${lot} • ${input.step}`,
      object: "Déviation",
      objectLabel: `${input.projectCode} • Déviation ${id}`,
      type: "Création",
      description: `${input.title} — ${input.description}`,
      motif: input.immediateAction,
      icon: "alert",
      href: `/projets/${input.projectCode.toLowerCase()}/deviations/${id.toLowerCase()}`,
      deviationId: id,
      lotCode: lot,
    });
    return next;
  },

  saveDeviationAnalysis(s: DemoState, id: string, analysis: { cause: string; rootCause: string; impact: string }, complete: boolean): DemoState {
    const d = s.deviations.find((x) => x.id === id);
    if (!d) return s;
    let next = mapDeviation(s, id, (x) => ({
      ...x,
      analysis: { ...analysis, doneAt: complete ? stamp() : x.analysis.doneAt },
      status: complete && x.status === "Analyse en cours" ? "Actions en cours" : x.status,
    }));
    next = withEvent(next, {
      projectCode: d.projectCode,
      title: complete ? "Analyse de la déviation terminée" : "Analyse de la déviation enregistrée",
      context: `${d.projectCode} • Déviation ${d.id}`,
      object: "Déviation",
      objectLabel: `${d.projectCode} • Déviation ${d.id}`,
      type: "Modification",
      description: `Cause : ${analysis.cause || "à préciser"} — impact : ${analysis.impact}.`,
      icon: "edit",
      href: `/projets/${d.projectCode.toLowerCase()}/deviations/${d.id.toLowerCase()}?onglet=analyse`,
      deviationId: d.id,
      lotCode: d.lotCode,
    });
    return next;
  },

  saveDeviationAction(s: DemoState, id: string, action: DeviationAction): DemoState {
    const d = s.deviations.find((x) => x.id === id);
    if (!d) return s;
    const exists = d.actions.some((a) => a.id === action.id);
    const actions = exists ? d.actions.map((a) => (a.id === action.id ? action : a)) : [...d.actions, action];
    const allDone = actions.length > 0 && actions.every((a) => a.status === "Terminée");
    let next = mapDeviation(s, id, (x) => ({
      ...x,
      actions,
      status: allDone && x.status === "Actions en cours" ? "Efficacité à vérifier" : x.status,
    }));
    next = withEvent(next, {
      projectCode: d.projectCode,
      title: exists ? `Action ${action.id} mise à jour` : `Action ${action.id} ajoutée`,
      context: `${d.projectCode} • Déviation ${d.id}`,
      object: "Déviation",
      objectLabel: `${d.projectCode} • Déviation ${d.id}`,
      type: exists ? "Modification" : "Création",
      description: `${action.title} — ${action.owner}, statut ${action.status.toLowerCase()}, échéance ${formatNumeric(action.due)}.`,
      icon: "edit",
      href: `/projets/${d.projectCode.toLowerCase()}/deviations/${d.id.toLowerCase()}?onglet=actions`,
      deviationId: d.id,
      lotCode: d.lotCode,
    });
    return next;
  },

  verifyEffectiveness(s: DemoState, id: string): DemoState {
    const d = s.deviations.find((x) => x.id === id);
    if (!d || !d.actions.length || d.actions.some((a) => a.status !== "Terminée")) return s;
    let next = mapDeviation(s, id, (x) => ({
      ...x,
      effectivenessAt: stamp(),
      status: "Efficacité à vérifier",
      actions: x.actions.map((a) => ({ ...a, effective: true })),
    }));
    next = withEvent(next, {
      projectCode: d.projectCode,
      title: "Efficacité des actions vérifiée",
      context: `${d.projectCode} • Déviation ${d.id}`,
      object: "Déviation",
      objectLabel: `${d.projectCode} • Déviation ${d.id}`,
      type: "Approbation",
      ...who(actor(s, PEOPLE_LAB.marieL)),
      description: `${d.actions.length} action(s) jugée(s) efficace(s).`,
      icon: "check",
      href: `/projets/${d.projectCode.toLowerCase()}/deviations/${d.id.toLowerCase()}?onglet=efficacite`,
      deviationId: d.id,
      lotCode: d.lotCode,
    });
    return next;
  },

  closeDeviation(s: DemoState, id: string): DemoState {
    const d = s.deviations.find((x) => x.id === id);
    if (!d || !d.effectivenessAt || d.status === "Clôturée") return s;
    let next = mapDeviation(s, id, (x) => ({ ...x, status: "Clôturée", closedAt: stamp() }));
    next = withEvent(next, {
      projectCode: d.projectCode,
      title: `Déviation ${d.id} clôturée`,
      context: `${d.projectCode} • Déviation ${d.id}`,
      object: "Déviation",
      objectLabel: `${d.projectCode} • Déviation ${d.id}`,
      type: "Approbation",
      ...who(actor(s, PEOPLE_LAB.marieL)),
      description: "Déviation clôturée après vérification de l'efficacité des actions.",
      icon: "check",
      href: `/projets/${d.projectCode.toLowerCase()}/deviations/${d.id.toLowerCase()}`,
      deviationId: d.id,
      lotCode: d.lotCode,
    });
    return next;
  },

  /* ---------------- Stability (40–44) ---------------- */

  createStudy(s: DemoState, input: { id: string; projectCode: string; lotCode: string; lotLabel: string; formula: string; dosage: string; owner: string }): DemoState {
    const study: StabilityStudy = {
      ...input,
      status: "À préparer",
      nextTask: { title: "Préparer le protocole", detail: "Rédiger et finaliser le protocole de l'étude de stabilité." },
      results: [],
      alerts: [],
    };
    let next: DemoState = { ...s, studies: [...s.studies, study] };
    next = withEvent(next, {
      projectCode: input.projectCode,
      title: `Étude de stabilité ${input.id} créée`,
      context: `${input.projectCode} • ${input.lotLabel}`,
      object: "Stabilité",
      objectLabel: `${input.projectCode} • Étude ${input.id}`,
      type: "Création",
      description: `Étude sur le lot ${input.lotLabel} — responsable ${input.owner}.`,
      icon: "chart",
      href: `/stabilite?etude=${input.id}`,
      studyId: input.id,
    });
    return next;
  },

  prepareStudyProtocol(s: DemoState, id: string): DemoState {
    const study = s.studies.find((x) => x.id === id);
    if (!study || study.protocol) return s;
    const tablet = study.projectCode === "CS-01";
    const protocol: StabilityProtocol = {
      status: "Brouillon",
      responsible: actor(s, PEOPLE_LAB.marie).name,
      formula: study.formula,
      lot: study.lotCode,
      startDate: "",
      storage: "",
      packaging: tablet ? "Blister de démonstration" : "Flacon verre type I",
      tests: tablet
        ? TABLET_STABILITY_TESTS()
        : [
            { id: "t-aspect", name: "Aspect", method: "Examen visuel", equipment: "—", description: "Conforme / Non conforme", selected: true },
            { id: "t-dosage", name: "Dosage", method: "M-10 • Dosage PA (solution)", equipment: "HPLC-02", description: "Dosage du principe actif", selected: true },
            { id: "t-ph", name: "pH", method: "M-11 • pH", equipment: "PHM-01", description: "Mesure du pH", selected: true },
          ],
      milestones: STANDARD_MILESTONES(),
      documents: [],
      updatedAt: stamp(),
    };
    let next = mapStudy(s, id, (x) => ({
      ...x,
      protocol,
      status: "Protocole en cours",
      nextTask: { title: "Compléter le protocole", detail: "Renseigner la condition de stockage puis soumettre le protocole." },
    }));
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: `Protocole de stabilité ${id} créé`,
      context: `${study.projectCode} • ${study.lotLabel}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${id}`,
      type: "Création",
      description: "Brouillon du protocole de stabilité créé.",
      icon: "chart",
      href: `/stabilite/${id.toLowerCase()}`,
      studyId: id,
    });
    return next;
  },

  saveStudyProtocol(s: DemoState, id: string, patch: Partial<StabilityProtocol>, silent = false): DemoState {
    const study = s.studies.find((x) => x.id === id);
    if (!study?.protocol) return s;
    let next = mapStudy(s, id, (x) => ({ ...x, protocol: x.protocol && { ...x.protocol, ...patch, updatedAt: stamp() } }));
    if (!silent) {
      next = withEvent(next, {
        projectCode: study.projectCode,
        title: "Brouillon du protocole de stabilité enregistré",
        context: `${study.projectCode} • Étude ${id}`,
        object: "Stabilité",
        objectLabel: `${study.projectCode} • Étude ${id}`,
        type: "Modification",
        description: "Protocole de stabilité mis à jour.",
        icon: "edit",
        href: `/stabilite/${id.toLowerCase()}`,
        studyId: id,
      });
    }
    return next;
  },

  /** Sampling dates are computed from T0; the points are planned when the schedule is activated. */
  submitStudyProtocol(s: DemoState, id: string): DemoState {
    const study = s.studies.find((x) => x.id === id);
    const p = study?.protocol;
    if (!study || !p || p.status !== "Brouillon" || !p.storage) return s;
    const milestones = p.milestones.map((m) => (p.startDate && !m.date ? { ...m, date: addMonths(p.startDate, m.months) } : m));
    let next = mapStudy(s, id, (x) => ({
      ...x,
      status: "Protocole soumis",
      protocol: { ...p, status: "Soumis", milestones, submittedAt: stamp(), updatedAt: stamp() },
      nextTask: { title: "Faire approuver le protocole", detail: "L'échéancier pourra être activé une fois le protocole approuvé." },
      alerts: x.alerts.map((a) => (a.origin === "Documentation" && a.status === "Ouverte" ? { ...a, tag: "En approbation" } : a)),
    }));
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: `Protocole de stabilité ${id} soumis`,
      context: `${study.projectCode} • Étude ${id}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${id}`,
      type: "Soumission",
      description: `Condition ${p.storage}, conditionnement ${p.packaging}, ${p.tests.filter((t) => t.selected).length} essais, ${p.milestones.length} échéances.`,
      icon: "send",
      href: `/stabilite/${id.toLowerCase()}`,
      studyId: id,
    });
    return next;
  },

  /** Approval by quality assurance (simulated): resolves the "incomplete protocol" alert. */
  approveStudyProtocol(s: DemoState, id: string): DemoState {
    const study = s.studies.find((x) => x.id === id);
    const p = study?.protocol;
    if (!study || !p || p.status !== "Soumis") return s;
    const approver = actor(s, PEOPLE_LAB.marieL);
    let next = mapStudy(s, id, (x) => ({
      ...x,
      status: "Protocole approuvé",
      protocol: { ...p, status: "Approuvé", approvedAt: stamp(), approvedBy: approver.name, updatedAt: stamp() },
      nextTask: { title: "Activer l'échéancier", detail: "Le protocole est approuvé : activez l'échéancier des prélèvements." },
      alerts: x.alerts.map((a) => (a.origin === "Documentation" && a.status !== "Résolue" ? { ...a, status: "Résolue", tag: "Protocole approuvé" } : a)),
    }));
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: `Protocole de stabilité ${id} approuvé`,
      context: `${study.projectCode} • Étude ${id}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${id}`,
      type: "Approbation",
      author: approver.name,
      authorRole: approver.role,
      description: "Protocole approuvé : l'échéancier des prélèvements peut être activé.",
      icon: "check",
      href: `/stabilite/${id.toLowerCase()}?onglet=echeancier`,
      studyId: id,
    });
    return next;
  },

  /** Draft of the schedule (screen 42): T0, storage condition, responsible and sampling points. */
  saveStudySchedule(s: DemoState, id: string, patch: Pick<StabilityProtocol, "startDate" | "storage" | "responsible" | "milestones">): DemoState {
    const study = s.studies.find((x) => x.id === id);
    if (!study?.protocol || study.protocol.scheduleActivatedAt) return s;
    let next = mapStudy(s, id, (x) => ({ ...x, protocol: x.protocol && { ...x.protocol, ...patch, updatedAt: stamp() } }));
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: "Brouillon de l'échéancier enregistré",
      context: `${study.projectCode} • Étude ${id}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${id}`,
      type: "Modification",
      description: `T0 ${patch.startDate ? formatNumeric(patch.startDate) : "à définir"} — ${patch.storage || "condition à définir"} — ${patch.milestones.map((m) => m.code).join(", ")}.`,
      icon: "calendar",
      href: `/stabilite/${id.toLowerCase()}?onglet=echeancier`,
      studyId: id,
    });
    return next;
  },

  activateStudySchedule(s: DemoState, id: string): DemoState {
    const study = s.studies.find((x) => x.id === id);
    const p = study?.protocol;
    if (!study || !p || p.status !== "Approuvé" || p.scheduleActivatedAt || !p.startDate || !p.storage) return s;
    const milestones = p.milestones.map((m) => ({ ...m, status: "Planifiée" as const, date: m.date ?? addMonths(p.startDate, m.months) }));
    const analyses = p.tests.filter((t) => t.selected && /^M-\d+/.test(t.method));
    const results: StabilityResult[] = milestones.flatMap((m) =>
      analyses.map((t) => ({
        id: `res-${id.toLowerCase()}-${m.code.toLowerCase()}-${t.id}`,
        point: m.code,
        method: t.method.split(" • ")[0],
        analysis: t.method.split(" • ")[1] ?? t.name,
        storage: p.storage,
        status: m.code === "T0" ? ("À saisir" as const) : ("À venir" as const),
        value: "",
        unit: "%",
        source: "",
        comment: "",
        attachments: [],
      })),
    );
    let next = mapStudy(s, id, (x) => ({
      ...x,
      status: "En cours",
      protocol: { ...p, milestones, scheduleActivatedAt: stamp(), updatedAt: stamp() },
      results: x.results.length ? x.results : results,
      nextTask: { title: "Prélèvement T0", detail: `Mise en stabilité le ${formatNumeric(p.startDate)} (${p.storage}).` },
    }));
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: `Échéancier ${id} activé`,
      context: `${study.projectCode} • Étude ${id}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${id}`,
      type: "Modification",
      description: `${milestones.length} prélèvements planifiés (${milestones.map((m) => `${m.code} ${formatNumeric(m.date)}`).join(", ")}).`,
      icon: "calendar",
      href: `/stabilite/${id.toLowerCase()}?onglet=echeancier`,
      studyId: id,
    });
    return next;
  },

  /** Result entry (screen 43): a draft can be incomplete; submitting needs the value, the source and a supporting file. */
  saveStabilityResult(
    s: DemoState,
    studyId: string,
    resultId: string,
    input: Pick<StabilityResult, "value" | "unit" | "source" | "comment" | "attachments">,
    submit: boolean,
  ): DemoState {
    const study = s.studies.find((x) => x.id === studyId);
    const r = study?.results.find((x) => x.id === resultId);
    if (!study || !r || r.status === "Validé" || r.status === "Soumis") return s;
    if (submit && (!input.value.trim() || !input.source || !input.attachments.length)) return s;
    const spec = stabilitySpec(r.analysis);
    const outOfSpec = submit && spec ? !spec.ok(Number(input.value.replace(",", "."))) : false;
    let next = mapStudy(s, studyId, (x) => ({
      ...x,
      results: x.results.map((y) => (y.id === resultId ? { ...y, ...input, status: submit ? "Soumis" : "Brouillon", updatedAt: stamp() } : y)),
      alerts: outOfSpec
        ? [
            {
              id: `al-${resultId}`,
              title: `Résultat hors spécification (${r.point})`,
              description: `${r.analysis} au point ${r.point} : ${input.value} ${input.unit} pour une spécification ${spec?.label}. Une investigation est à ouvrir.`,
              origin: "Résultats" as const,
              tag: "Hors spécification",
              level: "Élevé" as const,
              status: "Ouverte" as const,
              due: addDays(DEMO_TODAY, 2),
              responsible: study.owner,
              date: DEMO_TODAY,
            },
            ...x.alerts,
          ]
        : x.alerts,
    }));
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: submit ? `Résultat ${r.point} soumis` : `Brouillon du résultat ${r.point} enregistré`,
      context: `${study.projectCode} • Étude ${studyId} • ${r.analysis}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${studyId}`,
      type: submit ? "Soumission" : "Modification",
      description: `${r.method} — ${r.analysis} : ${input.value ? `${input.value} ${input.unit}` : "résultat à saisir"}${input.source ? ` (${input.source})` : ""}. ${input.attachments.length} pièce(s) justificative(s).`,
      icon: submit ? "send" : "edit",
      href: `/stabilite/${studyId.toLowerCase()}?onglet=resultats&point=${resultId}`,
      studyId,
    });
    return next;
  },

  /** Review of a submitted result (simulated reviewer). */
  validateStabilityResult(s: DemoState, studyId: string, resultId: string): DemoState {
    const study = s.studies.find((x) => x.id === studyId);
    const r = study?.results.find((x) => x.id === resultId);
    if (!study || !r || r.status !== "Soumis") return s;
    const reviewer = actor(s, PEOPLE_LAB.marieL);
    let next = mapStudy(s, studyId, (x) => ({
      ...x,
      results: x.results.map((y) => (y.id === resultId ? { ...y, status: "Validé", report: `Rapport ${r.point}`, updatedAt: stamp() } : y)),
    }));
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: `Résultat ${r.point} validé`,
      context: `${study.projectCode} • Étude ${studyId} • ${r.analysis}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${studyId}`,
      type: "Approbation",
      author: reviewer.name,
      authorRole: reviewer.role,
      description: `${r.analysis} : ${r.value} ${r.unit} — rapport ${r.point} disponible.`,
      icon: "check",
      href: `/stabilite/${studyId.toLowerCase()}?onglet=resultats&point=${resultId}`,
      studyId,
    });
    return next;
  },

  /** Alert follow-up (screen 44): assign, take charge, resolve or reopen. */
  updateStabilityAlert(s: DemoState, studyId: string, alertId: string, patch: Partial<Pick<StabilityAlert, "status" | "responsible">>): DemoState {
    const study = s.studies.find((x) => x.id === studyId);
    const a = study?.alerts.find((x) => x.id === alertId);
    if (!study || !a) return s;
    let next = mapStudy(s, studyId, (x) => ({ ...x, alerts: x.alerts.map((y) => (y.id === alertId ? { ...y, ...patch } : y)) }));
    const field = patch.responsible ? "Responsable" : "Statut";
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: patch.responsible ? "Alerte de stabilité assignée" : patch.status === "Prise en charge" ? "Alerte de stabilité prise en charge" : `Alerte de stabilité ${patch.status?.toLowerCase()}`,
      context: `${study.projectCode} • Étude ${studyId} • ${a.title}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${studyId}`,
      type: "Modification",
      field,
      oldValue: patch.responsible ? a.responsible : a.status,
      newValue: patch.responsible ?? patch.status,
      icon: "alert",
      href: `/stabilite?onglet=alertes&alerte=${alertId}`,
      studyId,
    });
    return next;
  },

  /** "Créer une activité": the alert becomes a task of "Mes activités". */
  createAlertActivity(s: DemoState, studyId: string, alertId: string): DemoState {
    const study = s.studies.find((x) => x.id === studyId);
    const a = study?.alerts.find((x) => x.id === alertId);
    if (!study || !a || a.activityId) return s;
    const id = `act-${alertId}`;
    const activity: Activity = {
      id,
      projectCode: study.projectCode,
      title: a.title,
      detail: `${studyId} • ${study.lotCode} — ${a.description}`,
      tags: [study.projectCode, "Stabilité"],
      status: { label: "À faire", tone: "warn" },
      due: a.due ?? addDays(DEMO_TODAY, 7),
      owner: a.responsible,
      icon: "flask",
      done: false,
      state: "a-faire",
      context: `Étude ${studyId} • Lot ${study.lotCode}`,
      description: a.description,
      priority: a.level === "Élevé" ? "Haute" : "Normale",
      lotCode: study.lotCode,
      kind: "standard",
      href: `/stabilite/${studyId.toLowerCase()}`,
    };
    let next: DemoState = {
      ...mapStudy(s, studyId, (x) => ({ ...x, alerts: x.alerts.map((y) => (y.id === alertId ? { ...y, activityId: id } : y)) })),
      activities: [...s.activities, activity],
    };
    next = withEvent(next, {
      projectCode: study.projectCode,
      title: "Activité créée depuis une alerte de stabilité",
      context: `${study.projectCode} • Étude ${studyId} • ${a.title}`,
      object: "Stabilité",
      objectLabel: `${study.projectCode} • Étude ${studyId}`,
      type: "Création",
      description: `Activité « ${a.title} » assignée à ${a.responsible}.`,
      icon: "calendar",
      href: `/activites/${id}`,
      studyId,
      activityId: id,
    });
    return next;
  },
};
