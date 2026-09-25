/**
 * In-memory demonstration store.
 *
 * A tiny external store read through `useSyncExternalStore`: state survives
 * client-side navigation, resets on reload (or via "Réinitialiser la démo").
 * Actions are plain functions so they can return created identifiers synchronously.
 */
import { useSyncExternalStore } from "react";
import { FAMILY_LABEL, PREREQUISITE_TEMPLATES, TEAM_ROLES, kindForForm } from "./catalog";
import { createSeed, type DemoState } from "./data";
import { DEMO_TODAY, addDays } from "./format";
import { decisionCircuit, lab } from "./lab";
import { nextNumber, pad2, projectLabel, stamp, uid, withEvent } from "./state-utils";
import type {
  Activity,
  DecisionChoice,
  DocCategory,
  Formula,
  LotType,
  OverviewFilters,
  PrerequisiteStatus,
  Project,
  ProjectDocument,
  ProjectDraft,
  RequestType,
  ReviewParticipant,
  Sample,
} from "./types";

let state: DemoState = createSeed();
const initialState = state;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return initialState;
}

function commit(next: DemoState) {
  state = next;
  listeners.forEach((l) => l());
}

export function useDemo() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getDemoState() {
  return state;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Next formula code of a project (F1, F2 → F3). */
function nextFormulaCode(projectCode: string) {
  const codes = state.formulas.filter((f) => f.projectCode === projectCode).map((f) => f.code);
  return `F${nextNumber(codes, /^F(\d+)$/)}`;
}

/** Next lot code of a project for a lot type (E-02 → E-03, LP-01 → LP-02). */
function nextLotCode(projectCode: string, type: LotType) {
  const prefix = type === "Essai" ? "E" : type === "Pilote" ? "LP" : "EC";
  const codes = state.lots.filter((l) => l.projectCode === projectCode).map((l) => l.code);
  return `${prefix}-${pad2(nextNumber(codes, new RegExp(`^${prefix}-(\\d+)$`)))}`;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export const actions = {
  reset() {
    commit(createSeed());
  },

  /* Notifications */
  readNotification(id: string) {
    commit({ ...state, notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
  },
  readAllNotifications() {
    commit({ ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) });
  },

  /* Overview filters & saved views */
  setFilters(filters: OverviewFilters) {
    commit({ ...state, filters });
  },
  saveView(name: string, shared: boolean, filters: OverviewFilters) {
    const view = { id: uid("view"), name, shared, filters };
    commit({ ...state, filters, savedViews: [...state.savedViews, view] });
    return view;
  },

  /* Projects */
  archiveProject(code: string) {
    const s = { ...state, projects: state.projects.map((p) => (p.code === code ? { ...p, archived: true } : p)) };
    commit(
      withEvent(s, {
        projectCode: code,
        title: "Projet archivé",
        context: projectLabel(s, code),
        object: "Projet",
        objectLabel: projectLabel(s, code),
        type: "Modification",
        field: "Statut",
        oldValue: "Actif",
        newValue: "Archivé",
        icon: "folder",
        href: `/projets/${code.toLowerCase()}`,
      }),
    );
  },
  restoreProject(code: string) {
    const s = { ...state, projects: state.projects.map((p) => (p.code === code ? { ...p, archived: false } : p)) };
    commit(
      withEvent(s, {
        projectCode: code,
        title: "Projet restauré",
        context: projectLabel(s, code),
        object: "Projet",
        objectLabel: projectLabel(s, code),
        type: "Modification",
        field: "Statut",
        oldValue: "Archivé",
        newValue: "Actif",
        icon: "folder",
        href: `/projets/${code.toLowerCase()}`,
      }),
    );
  },
  updateProject(code: string, patch: Partial<Project>, changes: string) {
    const s = { ...state, projects: state.projects.map((p) => (p.code === code ? { ...p, ...patch } : p)) };
    commit(
      withEvent(s, {
        projectCode: code,
        title: "Configuration du projet modifiée",
        context: projectLabel(s, code),
        object: "Projet",
        objectLabel: projectLabel(s, code),
        type: "Modification",
        description: changes,
        icon: "edit",
        href: `/projets/${code.toLowerCase()}`,
      }),
    );
  },
  saveDraft(draft: ProjectDraft) {
    commit({ ...state, draft, draftBannerDismissed: false });
  },
  clearDraft() {
    commit({ ...state, draft: null });
  },
  dismissDraftBanner() {
    commit({ ...state, draftBannerDismissed: true });
  },
  createProject(draft: ProjectDraft) {
    const code = draft.code.trim().toUpperCase();
    const slug = code.toLowerCase();
    const dosage = `${draft.dosage} ${draft.dosageUnit}`.trim();
    const start = draft.startDate || DEMO_TODAY;
    const chef = draft.team.chef || "Chef de projet";
    const project: Project = {
      code,
      slug,
      name: draft.name.trim(),
      kind: kindForForm(draft.form),
      family: draft.family,
      form: draft.form,
      formLabel: FAMILY_LABEL[draft.family],
      portfolioSubtitle: `${FAMILY_LABEL[draft.family]} – ${draft.form}`,
      description: `Développement — ${draft.form.toLowerCase()} ${dosage}`,
      dci: draft.dci.trim(),
      dosage,
      countries: draft.countries,
      referenceProduct: draft.referenceProduct,
      template: draft.template,
      stage: { label: "Cadrage", icon: "compass" },
      phase: "Cadrage",
      phaseTone: "info",
      track: { label: "Cadrage", tone: "neutral" },
      objective: { title: "Compléter les prérequis", detail: "Cadrage du projet" },
      nextAction: { date: start, label: "Lancer le cadrage du projet" },
      nextStep: "Valider les prérequis",
      targetDate: draft.targetDate || addDays(start, 180),
      globalStatus: "En cours",
      owner: chef,
      team: TEAM_ROLES.map((r) => ({ role: r.label, person: draft.team[r.key] ?? "" })),
      createdAt: DEMO_TODAY,
      updatedAt: DEMO_TODAY,
      journeyStep: 1,
      milestone: {
        title: "Revue de lancement",
        detail: "Validation du cadrage et des prérequis",
        date: addDays(start, 14),
        owner: chef,
      },
      portfolioAction: { label: "Ouvrir le projet", href: `/projets/${slug}`, variant: "primary" },
      archived: false,
    };

    const prerequisites = PREREQUISITE_TEMPLATES.filter((t) => draft.prerequisites.includes(t.name)).map((t) => ({
      id: uid("pr"),
      projectCode: code,
      name: t.name,
      detail: t.detail,
      source: t.source,
      icon: t.icon,
      status: "À planifier" as const,
    }));

    const documents: ProjectDocument[] = draft.files.map((f) => ({
      id: uid("doc"),
      projectCode: code,
      category: "Références",
      name: f.name.replace(/\.[^.]+$/, ""),
      type: "Rapport d'étude",
      version: 1,
      owner: chef,
      updatedAt: stamp(),
      status: "Brouillon",
      size: f.size,
      fileType: (f.name.split(".").pop()?.toUpperCase() as ProjectDocument["fileType"]) ?? "PDF",
      versions: [{ version: 1, date: stamp(), author: chef, note: "Pièce initiale du projet" }],
    }));

    const activity = (title: string, detail: string, tag: string, due: string, icon: Activity["icon"]): Activity => ({
      id: uid("act"),
      projectCode: code,
      title,
      detail,
      tags: [code, tag],
      status: { label: "À faire", tone: "warn" },
      due,
      owner: chef,
      icon,
      done: false,
    });
    const activities: Activity[] = [
      activity("Lancer le cadrage", "Valider le périmètre et les prérequis du projet", "Cadrage", start, "doc"),
      ...(draft.galenic
        ? [activity("Planifier le développement galénique", "Créer les activités et jalons associés", "Galénique", addDays(start, 7), "flask")]
        : []),
      ...(draft.analytic
        ? [activity("Planifier le développement analytique", "Planifier les méthodes et essais", "Analytique", addDays(start, 7), "flask")]
        : []),
    ];

    let s: DemoState = {
      ...state,
      projects: [...state.projects, project],
      prerequisites: [...state.prerequisites, ...prerequisites],
      documents: [...state.documents, ...documents],
      activities: [...state.activities, ...activities],
      draft: null,
    };
    s = withEvent(s, {
      projectCode: code,
      title: "Projet créé",
      context: `${code} • ${project.name}`,
      object: "Projet",
      objectLabel: `${code} • ${project.name}`,
      type: "Création",
      description: `Projet créé à partir du ${draft.template.toLowerCase()}${
        draft.sourceProject ? ` (structure reprise de ${draft.sourceProject})` : ""
      }.`,
      icon: "folder",
      href: `/projets/${slug}`,
    });
    commit(s);
    return slug;
  },

  /* Priorities */
  togglePriority(id: string): { ok: true } | { ok: false; reason: string } {
    const item = state.priorities.find((p) => p.id === id);
    if (!item) return { ok: false, reason: "Activité introuvable." };
    if (!item.done && item.requiresDecision) {
      const decision = state.formulaDecisions.find((d) => d.projectCode === item.projectCode);
      if (!decision || (decision.status !== "Soumise" && decision.status !== "Approuvée")) {
        return { ok: false, reason: "Cette activité ne peut pas être clôturée sans document de décision associé." };
      }
    }
    commit({ ...state, priorities: state.priorities.map((p) => (p.id === id ? { ...p, done: !p.done } : p)) });
    return { ok: true };
  },
  remindPriority(id: string) {
    const item = state.priorities.find((p) => p.id === id);
    if (!item) return;
    commit(
      withEvent(state, {
        projectCode: item.projectCode,
        title: "Relance envoyée",
        context: `${item.projectCode} • ${item.detail.prerequisite.label}`,
        object: "Prérequis",
        objectLabel: `${item.projectCode} • Prérequis : ${item.detail.prerequisite.label}`,
        type: "Relance",
        description: `Relance envoyée aux Achats : ${item.title.toLowerCase()}.`,
        icon: "send",
        href: `/projets/${item.projectCode.toLowerCase()}/prerequis`,
      }),
    );
  },

  /* Reviews */
  toggleReviewItem(reviewId: string, itemId: string) {
    commit({
      ...state,
      reviews: state.reviews.map((r) =>
        r.id !== reviewId
          ? r
          : {
              ...r,
              checklist: r.checklist.map((c) =>
                c.id === itemId ? { ...c, state: c.state === "done" ? "todo" : "done" } : c,
              ),
            },
      ),
    });
  },
  submitReview(id: string) {
    const review = state.reviews.find((r) => r.id === id);
    if (!review) return;
    const s: DemoState = {
      ...state,
      reviews: state.reviews.map((r) =>
        r.id === id
          ? { ...r, status: "en-cours", submittedAt: DEMO_TODAY, badge: { label: "Soumise", tone: "info" } }
          : r,
      ),
    };
    commit(
      withEvent(s, {
        projectCode: review.projectCode,
        title: `Revue « ${review.title} » soumise`,
        context: `${review.projectCode} • ${review.type}`,
        object: "Revue",
        objectLabel: `${review.projectCode} • Revue : ${review.title}`,
        type: "Soumission",
        description: `Revue soumise aux participants (${review.participants.map((p) => p.role).join(", ")}).`,
        icon: "send",
        href: "/vue-ensemble/revues",
      }),
    );
  },
  addReview(input: { projectCode: string; title: string; type: string; date: string; participants: string[] }) {
    const review = {
      id: uid("rev"),
      projectCode: input.projectCode,
      title: input.title,
      type: input.type,
      status: "a-preparer" as const,
      date: input.date,
      preparedBy: "Chef de projet",
      participants: input.participants.map(
        (role, i): ReviewParticipant => ({ role, part: i === 0 ? "Organise" : "Contribue" }),
      ),
      badge: { label: "À préparer", tone: "info" as const },
      cta: { label: "Préparer la revue" },
      icon: "doc" as const,
      checklist: [
        { id: "c1", label: "Résultats disponibles", detail: "Rassembler les résultats nécessaires.", state: "todo" as const },
        { id: "c2", label: "Justification à rédiger", detail: "Rédiger la justification de la proposition.", state: "todo" as const },
        { id: "c3", label: "Décisions à consigner", detail: "Préparer la synthèse des décisions.", state: "todo" as const },
      ],
    };
    const s = { ...state, reviews: [review, ...state.reviews] };
    commit(
      withEvent(s, {
        projectCode: input.projectCode,
        title: `Revue « ${input.title} » planifiée`,
        context: `${input.projectCode} • ${input.type}`,
        object: "Revue",
        objectLabel: `${input.projectCode} • Revue : ${input.title}`,
        type: "Création",
        description: `Revue planifiée le ${input.date.split("-").reverse().join("/")}.`,
        icon: "doc",
        href: "/vue-ensemble/revues",
      }),
    );
    return review.id;
  },
  setReviewParticipants(id: string, participants: ReviewParticipant[]) {
    commit({ ...state, reviews: state.reviews.map((r) => (r.id === id ? { ...r, participants } : r)) });
  },

  /* Activities */
  addActivity(input: {
    projectCode: string;
    title: string;
    detail: string;
    tag: string;
    due: string;
    owner: string;
    icon: Activity["icon"];
  }) {
    const activity: Activity = {
      id: uid("act"),
      projectCode: input.projectCode,
      title: input.title,
      detail: input.detail,
      tags: [input.projectCode, input.tag],
      status: { label: "À faire", tone: "warn" },
      due: input.due,
      owner: input.owner,
      icon: input.icon,
      done: false,
    };
    commit({ ...state, activities: [...state.activities, activity] });
  },
  toggleActivity(id: string) {
    commit({ ...state, activities: state.activities.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) });
  },

  /* Prerequisites & supply requests */
  createRequest(input: {
    projectCode: string;
    type: RequestType;
    object: string;
    recipient: string;
    supplier: string;
    wishedDate: string;
    justification: string;
    prerequisiteId?: string;
  }) {
    const ref = `DEM-${pad2(nextNumber(state.requests.map((r) => r.ref), /^DEM-(\d+)$/))}`;
    let s: DemoState = {
      ...state,
      requests: [...state.requests, { ...input, ref, status: "À traiter", createdAt: DEMO_TODAY }],
      prerequisites: state.prerequisites.map((p) =>
        p.id === input.prerequisiteId ? { ...p, status: "Demandé", requestRef: ref } : p,
      ),
    };
    s = withEvent(s, {
      projectCode: input.projectCode,
      title: `Demande ${ref} créée`,
      context: `${input.projectCode} • ${input.object}`,
      object: "Prérequis",
      objectLabel: `${input.projectCode} • Demande : ${input.object}`,
      type: "Création",
      description: `Demande de ${input.type.toLowerCase()} adressée à : ${input.recipient} (${input.supplier}). ${input.justification}`,
      icon: "send",
      href: `/projets/${input.projectCode.toLowerCase()}/prerequis`,
    });
    commit(s);
    return ref;
  },
  setPrerequisiteStatus(id: string, status: PrerequisiteStatus) {
    const prereq = state.prerequisites.find((p) => p.id === id);
    if (!prereq) return;
    const s = { ...state, prerequisites: state.prerequisites.map((p) => (p.id === id ? { ...p, status } : p)) };
    commit(
      withEvent(s, {
        projectCode: prereq.projectCode,
        title: status === "Satisfait" ? "Prérequis satisfait" : "Statut de prérequis modifié",
        context: `${prereq.projectCode} • ${prereq.name}`,
        object: "Prérequis",
        objectLabel: `${prereq.projectCode} • Prérequis : ${prereq.name}`,
        type: "Modification",
        field: "Statut",
        oldValue: prereq.status,
        newValue: status,
        icon: "check",
        href: `/projets/${prereq.projectCode.toLowerCase()}/prerequis`,
      }),
    );
  },

  /* Documents */
  addDocument(input: {
    projectCode: string;
    category: DocCategory;
    name: string;
    type: string;
    size: string;
    fileType: ProjectDocument["fileType"];
    lot?: string;
  }) {
    const doc: ProjectDocument = {
      id: uid("doc"),
      ...input,
      version: 1,
      owner: "Chef de projet",
      updatedAt: stamp(),
      status: "Brouillon",
      versions: [{ version: 1, date: stamp(), author: "Chef de projet", note: "Création du document" }],
    };
    const s = { ...state, documents: [doc, ...state.documents] };
    commit(
      withEvent(s, {
        projectCode: input.projectCode,
        title: "Document importé",
        context: `${input.projectCode} • ${input.name}`,
        object: "Document",
        objectLabel: `${input.projectCode} • Document : ${input.name}`,
        type: "Ajout",
        description: `Document importé dans « ${input.category} » (${input.type}).`,
        icon: "doc",
        href: `/projets/${input.projectCode.toLowerCase()}/documents?doc=${doc.id}`,
      }),
    );
    return doc;
  },
  renameDocument(id: string, name: string) {
    const doc = state.documents.find((d) => d.id === id);
    if (!doc) return;
    const s = { ...state, documents: state.documents.map((d) => (d.id === id ? { ...d, name } : d)) };
    commit(
      withEvent(s, {
        projectCode: doc.projectCode,
        title: "Document renommé",
        context: `${doc.projectCode} • ${name}`,
        object: "Document",
        objectLabel: `${doc.projectCode} • Document : ${name}`,
        type: "Modification",
        field: "Nom du document",
        oldValue: doc.name,
        newValue: name,
        icon: "edit",
        href: `/projets/${doc.projectCode.toLowerCase()}/documents?doc=${id}`,
      }),
    );
  },
  moveDocument(id: string, category: DocCategory) {
    const doc = state.documents.find((d) => d.id === id);
    if (!doc) return;
    const s = { ...state, documents: state.documents.map((d) => (d.id === id ? { ...d, category } : d)) };
    commit(
      withEvent(s, {
        projectCode: doc.projectCode,
        title: "Document déplacé",
        context: `${doc.projectCode} • ${doc.name}`,
        object: "Document",
        objectLabel: `${doc.projectCode} • Document : ${doc.name}`,
        type: "Modification",
        field: "Catégorie",
        oldValue: doc.category,
        newValue: category,
        icon: "folder",
        href: `/projets/${doc.projectCode.toLowerCase()}/documents?doc=${id}`,
      }),
    );
  },
  deleteDocument(id: string) {
    const doc = state.documents.find((d) => d.id === id);
    if (!doc || doc.status !== "Brouillon") return;
    const s = { ...state, documents: state.documents.filter((d) => d.id !== id) };
    commit(
      withEvent(s, {
        projectCode: doc.projectCode,
        title: "Brouillon supprimé",
        context: `${doc.projectCode} • ${doc.name}`,
        object: "Document",
        objectLabel: `${doc.projectCode} • Document : ${doc.name}`,
        type: "Suppression",
        description: `Brouillon « ${doc.name} » (v${doc.version}) supprimé.`,
        icon: "doc",
      }),
    );
  },
  newDocumentVersion(id: string) {
    const doc = state.documents.find((d) => d.id === id);
    if (!doc) return 0;
    const version = doc.version + 1;
    const updated: ProjectDocument = {
      ...doc,
      version,
      status: "Brouillon",
      updatedAt: stamp(),
      owner: "Chef de projet",
      versions: [
        { version, date: stamp(), author: "Chef de projet", note: "Version actuelle" },
        ...doc.versions.map((v) => (v.version === doc.version ? { ...v, note: "Version remplacée" } : v)),
      ],
    };
    const s = { ...state, documents: state.documents.map((d) => (d.id === id ? updated : d)) };
    commit(
      withEvent(s, {
        projectCode: doc.projectCode,
        title: `Nouvelle version v${version} créée`,
        context: `${doc.projectCode} • ${doc.name}`,
        object: "Document",
        objectLabel: `${doc.projectCode} • Document : ${doc.name}`,
        type: "Création",
        field: "Version",
        oldValue: `v${doc.version} (${doc.status})`,
        newValue: `v${version} (Brouillon)`,
        icon: "doc",
        href: `/projets/${doc.projectCode.toLowerCase()}/documents?doc=${id}`,
      }),
    );
    return version;
  },

  /* Formulas */
  nextFormulaCode,
  createFormula(input: {
    projectCode: string;
    parent?: string;
    composition: Formula["composition"];
    process: string[];
    motif: string;
    sources: string[];
  }) {
    const code = nextFormulaCode(input.projectCode);
    const formula: Formula = {
      id: uid("f"),
      projectCode: input.projectCode,
      code,
      revision: "0.1",
      status: "Brouillon",
      label: "Nouvelle version",
      description: input.motif,
      parent: input.parent,
      createdAt: DEMO_TODAY,
      createdBy: "Chef de projet",
      composition: input.composition,
      process: input.process,
      motif: input.motif,
      sources: input.sources,
    };
    const s = { ...state, formulas: [...state.formulas, formula] };
    commit(
      withEvent(s, {
        projectCode: input.projectCode,
        title: input.parent ? `Formule ${code} créée depuis ${input.parent}` : `Formule ${code} créée`,
        context: `${input.projectCode} • ${code}`,
        object: "Formule",
        objectLabel: `${input.projectCode} • Formule ${code}`,
        type: "Création",
        motif: input.motif,
        description: `Brouillon de la formule ${code} enregistré (${input.composition.length} composants).`,
        icon: "flask",
        href: `/projets/${input.projectCode.toLowerCase()}/formules`,
      }),
    );
    return code;
  },
  archiveFormula(id: string) {
    const formula = state.formulas.find((f) => f.id === id);
    if (!formula) return;
    const s = { ...state, formulas: state.formulas.map((f) => (f.id === id ? { ...f, status: "Archivée" as const } : f)) };
    commit(
      withEvent(s, {
        projectCode: formula.projectCode,
        title: `Formule ${formula.code} archivée`,
        context: `${formula.projectCode} • ${formula.code}`,
        object: "Formule",
        objectLabel: `${formula.projectCode} • Formule ${formula.code}`,
        type: "Modification",
        field: "Statut",
        oldValue: formula.status,
        newValue: "Archivée",
        icon: "flask",
        href: `/projets/${formula.projectCode.toLowerCase()}/formules`,
      }),
    );
  },

  /* Lots & samples */
  nextLotCode,
  createLot(
    input: {
      projectCode: string;
      type: LotType;
      formula: string;
      quantity: number;
      unit: string;
      date: string;
      owner: string;
      comment: string;
    },
    plan: { type: Sample["type"]; quantity: number }[],
  ) {
    const code = nextLotCode(input.projectCode, input.type);
    const lot = {
      id: uid("lot"),
      projectCode: input.projectCode,
      code,
      type: input.type,
      formula: input.formula,
      quantity: input.quantity,
      unit: input.unit,
      status: "Planifié" as const,
      createdAt: input.date,
      owner: input.owner,
      comment: input.comment,
    };
    const samples: Sample[] = plan.map((p, i) => ({
      id: uid("s"),
      projectCode: input.projectCode,
      lotCode: code,
      code: `ECH-${pad2(i + 1)}`,
      type: p.type,
      quantity: p.quantity,
      unit: input.unit,
      date: input.date,
      status: "Planifié",
      analyses: 0,
    }));
    const s = { ...state, lots: [...state.lots, lot], samples: [...state.samples, ...samples] };
    commit(
      withEvent(s, {
        projectCode: input.projectCode,
        title: `Lot ${code} créé`,
        context: `${input.projectCode} • Lot ${input.type.toLowerCase()} • ${input.formula}`,
        object: "Lot",
        objectLabel: `${input.projectCode} • Lot ${code}`,
        type: "Création",
        description: `Lot ${input.type.toLowerCase()} de ${input.quantity} ${input.unit} à partir de la formule ${input.formula}${
          samples.length ? ` — ${samples.length} prélèvement(s) planifié(s)` : ""
        }.`,
        icon: "box",
        href: `/projets/${input.projectCode.toLowerCase()}/formules/lots?lot=${code}`,
      }),
    );
    return code;
  },
  addSample(input: {
    projectCode: string;
    lotCode: string;
    type: Sample["type"];
    quantity: number;
    unit: string;
    date: string;
    analyses: number;
  }) {
    const codes = state.samples.filter((x) => x.projectCode === input.projectCode && x.lotCode === input.lotCode).map((x) => x.code);
    const code = `ECH-${pad2(nextNumber(codes, /^ECH-(\d+)$/))}`;
    const sample: Sample = { id: uid("s"), ...input, code, status: "Prélevé" };
    const s = { ...state, samples: [...state.samples, sample] };
    commit(
      withEvent(s, {
        projectCode: input.projectCode,
        title: `Prélèvement ${code} enregistré`,
        context: `${input.projectCode} • Lot ${input.lotCode}`,
        object: "Lot",
        objectLabel: `${input.projectCode} • Lot ${input.lotCode}`,
        type: "Ajout",
        description: `${input.quantity} ${input.unit} prélevés (${input.type.toLowerCase()}).`,
        icon: "box",
        href: `/projets/${input.projectCode.toLowerCase()}/formules/lots?lot=${input.lotCode}`,
      }),
    );
    return code;
  },
  deleteSample(id: string) {
    commit({ ...state, samples: state.samples.filter((x) => x.id !== id) });
  },

  /* Formula decision */
  saveDecision(
    input: { projectCode: string; formula: string; choice: DecisionChoice; justification: string; attachments: string[] },
    submit: boolean,
  ) {
    const previous = state.formulaDecisions.find((d) => d.projectCode === input.projectCode);
    const decision = {
      ...input,
      status: submit ? ("Soumise" as const) : ("Brouillon" as const),
      step: submit ? (2 as const) : (1 as const),
      updatedAt: stamp(),
      circuit: submit ? decisionCircuit(DEMO_TODAY) : undefined,
    };
    let s: DemoState = {
      ...state,
      formulaDecisions: [...state.formulaDecisions.filter((d) => d.projectCode !== input.projectCode), decision],
      decisions: submit
        ? state.decisions.map((d) =>
            d.projectCode === input.projectCode && d.href.includes("/formules")
              ? { ...d, status: { label: "Soumise pour avis", tone: "info" as const } }
              : d,
          )
        : state.decisions,
    };
    const justificationChanged = previous && previous.justification !== input.justification;
    s = withEvent(s, {
      projectCode: input.projectCode,
      title: submit
        ? "Décision soumise pour avis"
        : previous
          ? "Décision modifiée"
          : "Décision enregistrée en brouillon",
      context: `${input.projectCode} • Décision : formule ${input.formula}`,
      object: "Décision",
      objectLabel: `${input.projectCode} • Décision : formule ${input.formula}`,
      type: submit ? "Soumission" : previous ? "Modification" : "Création",
      ...(justificationChanged
        ? { field: "Justification de la décision", oldValue: previous.justification, newValue: input.justification }
        : { description: input.justification }),
      icon: submit ? "send" : "edit",
      href: `/projets/${input.projectCode.toLowerCase()}/formules/comparaison`,
    });
    commit(s);
  },

  /* Methods */
  addAnalysisRequest(input: {
    projectCode: string;
    lotCode: string;
    analysis: string;
    method: string;
    due: string;
    comment?: string;
  }) {
    const ref = `DA-${pad2(nextNumber(state.analysisRequests.map((r) => r.ref), /^DA-(\d+)$/))}`;
    commit({
      ...state,
      analysisRequests: [
        { ...input, ref, requester: "Chef de projet", status: { label: "À planifier", tone: "neutral" } },
        ...state.analysisRequests,
      ],
    });
    return ref;
  },
};

/* ------------------------------------------------------------------ */
/* Lab modules (screens 21 → 41)                                       */
/* ------------------------------------------------------------------ */

type Reducers = typeof lab;
type Bound = {
  [K in keyof Reducers]: Reducers[K] extends (s: DemoState, ...args: infer A) => DemoState ? (...args: A) => void : never;
};

/** Store-bound versions of the pure lab reducers (`labActions.startLot("CS-01", "LP-01")`). */
export const labActions = Object.fromEntries(
  Object.entries(lab).map(([key, fn]) => [key, (...args: unknown[]) => commit((fn as (s: DemoState, ...a: unknown[]) => DemoState)(state, ...args))]),
) as Bound;

/** Applies an arbitrary state transition (used by the guided tour). */
export function applyState(transform: (s: DemoState) => DemoState) {
  commit(transform(state));
}

/** Replaces the whole state (guided tour: reset then replay up to a screen). */
export function replaceState(next: DemoState) {
  commit(next);
}
