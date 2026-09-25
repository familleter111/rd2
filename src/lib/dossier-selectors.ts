/** Derived rules of the documentation, dossier, transfer and closure screens (45 → 56). */
import type { DemoState } from "./data";
import type {
  DocStatus,
  Dossier,
  DossierModule,
  DossierProof,
  DossierRequirement,
  DossierReview,
  DossierSection,
  ProjectDocument,
  ReviewDraft,
  SectionStatus,
  Tone,
} from "./types";

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type DocFamily = "Protocoles" | "Rapports" | "Certificats" | "Autres";
export const DOC_FAMILIES: DocFamily[] = ["Protocoles", "Rapports", "Certificats", "Autres"];

/** Family shown in the "Catégorie" column of the documents list (screen 45). */
export function docFamily(doc: ProjectDocument): DocFamily {
  if (/^(Rapport|Étude de stabilité)/.test(doc.type)) return "Rapports";
  if (["Protocole", "Procédure", "Méthode analytique"].includes(doc.type)) return "Protocoles";
  if (doc.type === "Certificat") return "Certificats";
  return "Autres";
}

const ascii = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(d'|l')/gi, "")
    .replace(/\b(de|du|des|la|le|les)\b/gi, " ")
    .replace(/[—–•:]/g, " ")
    .trim()
    .replace(/\s+/g, "_");

/** File name of the current version ("Rapport_essais_F2_v2.pdf"). */
export function docFileName(doc: ProjectDocument) {
  return doc.fileName ?? `${ascii(doc.name)}_v${doc.version}.${doc.fileType.toLowerCase()}`;
}

/** Approved version still in force (v2 while v3 is a draft), if any. */
export function versionInForce(doc: ProjectDocument) {
  return doc.status === "Approuvé" ? doc.version : doc.approvedVersion;
}

/** Date of the approval in force, else of the last update. */
export function docDate(doc: ProjectDocument) {
  const inForce = versionInForce(doc);
  const v = doc.versions.find((x) => x.version === inForce);
  return v?.approvedAt ?? v?.date ?? doc.updatedAt;
}

export const DOC_STATUS_DOT: Record<DocStatus, Tone> = {
  Brouillon: "neutral",
  Approuvé: "success",
  "À revoir": "warn",
  "En revue": "warn",
};

/* ------------------------------------------------------------------ */
/* Dossier                                                             */
/* ------------------------------------------------------------------ */

export function findDossier(s: DemoState, slug: string) {
  const project = s.projects.find((p) => p.slug === slug.toLowerCase());
  const dossier = project ? s.dossiers.find((d) => d.projectCode === project.code) : undefined;
  return { project, dossier };
}

export function allSections(dossier: Dossier) {
  return dossier.modules.flatMap((m) => m.sections.map((section) => ({ module: m, section })));
}

export function findSection(dossier: Dossier, sectionId: string) {
  return allSections(dossier).find((x) => x.section.id === sectionId);
}

export const SECTION_TONE: Record<SectionStatus, Tone> = {
  "À compléter": "warn",
  "En revue": "info",
  Approuvée: "success",
  "À évaluer": "neutral",
};

export function moduleStatus(m: DossierModule): SectionStatus {
  const statuses = m.sections.map((x) => x.status);
  if (statuses.every((x) => x === "Approuvée")) return "Approuvée";
  if (statuses.every((x) => x === "À évaluer")) return "À évaluer";
  if (statuses.includes("En revue")) return "En revue";
  return "À compléter";
}

/** Elements the dossier still waits for (missing document, document to approve). */
export function missingElements(s: DemoState, dossier: Dossier, moduleN?: number): DossierRequirement[] {
  return dossier.requirements
    .filter((r) => moduleN === undefined || r.module === moduleN)
    .filter((r) => {
      const doc = r.docId ? s.documents.find((d) => d.id === r.docId) : undefined;
      return r.kind === "document" ? !doc : doc?.status !== "Approuvé";
    });
}

export function dossierComplete(s: DemoState, dossier: Dossier) {
  return missingElements(s, dossier).length === 0;
}

/** Status, date and link of a proof (document or approved formula decision). */
export function proofInfo(s: DemoState, dossier: Dossier, proof: DossierProof) {
  if (proof.decision) {
    const d = s.formulaDecisions.find((x) => x.projectCode === dossier.projectCode);
    const approved = d?.status === "Approuvée";
    return {
      status: (approved ? "Approuvé" : "En revue") as DocStatus,
      approved,
      date: d?.approvedAt ?? d?.updatedAt,
      href: `/projets/${dossier.projectCode.toLowerCase()}/formules/comparaison`,
    };
  }
  const doc = s.documents.find((x) => x.id === proof.docId);
  const approved = Boolean(doc && versionInForce(doc));
  return {
    status: (approved ? "Approuvé" : (doc?.status ?? "Brouillon")) as DocStatus,
    approved,
    date: doc ? docDate(doc) : undefined,
    href: doc ? `/projets/${doc.projectCode.toLowerCase()}/documents/${doc.id}` : undefined,
  };
}

/** A section can be submitted when every paragraph is written and supported by an approved proof. */
export function sectionIssues(s: DemoState, dossier: Dossier, section: DossierSection) {
  const issues: string[] = [];
  for (const part of section.parts) {
    if (part.text.trim().length < 10) issues.push(`rédiger le paragraphe « ${part.title} ».`);
    else if (!section.links.some((l) => l.partId === part.id)) issues.push(`lier une preuve au paragraphe « ${part.title} ».`);
  }
  for (const proof of section.proofs) {
    if (section.links.some((l) => l.proofId === proof.id) && !proofInfo(s, dossier, proof).approved) issues.push(`la preuve « ${proof.label} » n'est pas encore approuvée.`);
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Reviews, reserves, transfer                                         */
/* ------------------------------------------------------------------ */

export const REVIEW_STATUS_TONE: Record<DossierReview["status"], Tone> = {
  "En revue": "warn",
  Approuvée: "success",
  "Approuvée avec réserves": "info",
  "Correction demandée": "danger",
};

export function reviewReadiness(draft: ReviewDraft) {
  return [
    { key: "docs", ok: draft.documents.length > 0, okTitle: "Documents accessibles", koTitle: "Documents à sélectionner", detail: `${draft.documents.length} document(s) sélectionné(s)` },
    { key: "people", ok: draft.participants.length > 0, okTitle: "Participants définis", koTitle: "Participants à définir", detail: `${draft.participants.length} participant(s)` },
    {
      key: "justification",
      ok: draft.justification.trim().length >= 20,
      okTitle: "Justification renseignée",
      koTitle: "Justification à compléter",
      detail: draft.justification.trim().length >= 20 ? "La revue peut être soumise." : "Renseignez la justification de la revue.",
    },
  ];
}

export function reviewReady(draft: ReviewDraft) {
  return Boolean(draft.type && draft.date && draft.objet.trim() && draft.expected.trim()) && reviewReadiness(draft).every((x) => x.ok);
}

export function projectReviews(s: DemoState, code: string) {
  return s.dossierReviews.filter((r) => r.projectCode === code);
}

export function openBlockingReserves(s: DemoState, code: string) {
  return s.reserves.filter((r) => r.projectCode === code && r.blocking && r.status === "Ouverte");
}

/** Last review decided favourably (with or without reserves). */
export function approvedReview(s: DemoState, code: string) {
  return projectReviews(s, code)
    .filter((r) => r.status === "Approuvée" || r.status === "Approuvée avec réserves")
    .at(-1);
}

export function transferSteps(s: DemoState, code: string) {
  const t = s.transfers.find((x) => x.projectCode === code);
  const review = approvedReview(s, code);
  const reserves = s.reserves.filter((r) => r.projectCode === code && r.blocking);
  const lifted = review && reserves.every((r) => r.status === "Levée");
  const liftedAt = reserves.map((r) => r.liftedAt).filter(Boolean).sort().at(-1) ?? review?.decidedAt;
  return [
    {
      title: "Réserves bloquantes levées",
      detail: !review ? "Une revue de dossier approuvée est nécessaire." : lifted ? "Toutes les réserves ont été traitées." : `${reserves.filter((r) => r.status === "Ouverte").length} réserve(s) bloquante(s) ouverte(s).`,
      done: Boolean(lifted),
      date: lifted ? liftedAt : undefined,
    },
    {
      title: `Documents transmis à l'${t?.targetTeam.charAt(0).toLowerCase()}${t?.targetTeam.slice(1)}`,
      detail: t?.transmittedAt ? "Les documents de transfert ont été remis." : "Les documents seront remis après la levée des réserves.",
      done: Boolean(t?.transmittedAt),
      date: t?.transmittedAt,
    },
    {
      title: "Réception confirmée",
      detail: t?.receivedAt ? "L'équipe Production a confirmé la réception." : "En attente de confirmation par l'équipe Production.",
      done: Boolean(t?.receivedAt),
      date: t?.receivedAt,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Closure (56)                                                        */
/* ------------------------------------------------------------------ */

export interface ClosureCheck {
  key: string;
  title: string;
  value: string;
  ok: boolean;
  okText: string;
  blockers: string[];
  href: string;
}

export function closureChecks(s: DemoState, code: string): ClosureCheck[] {
  const slug = code.toLowerCase();
  const decisions = [
    ...s.formulaDecisions.filter((d) => d.projectCode === code).map((d) => ({ label: `Décision de formule ${d.formula}`, ok: d.status === "Approuvée" })),
    ...projectReviews(s, code).map((r) => ({ label: `Revue ${r.id}`, ok: r.status === "Approuvée" || r.status === "Approuvée avec réserves" })),
  ];
  const docs = s.documents.filter((d) => d.projectCode === code);
  const archivable = (d: ProjectDocument) => d.archived || d.status === "Approuvé";
  const activities = s.activities.filter((a) => a.projectCode === code);
  const actions = [
    ...activities.map((a) => ({ label: a.title, ok: a.done })),
    ...s.deviations.filter((d) => d.projectCode === code).map((d) => ({ label: `Déviation ${d.id}`, ok: d.status === "Clôturée" })),
    ...s.reserves.filter((r) => r.projectCode === code).map((r) => ({ label: `Réserve ${r.id}`, ok: r.status === "Levée" })),
  ];
  const transfer = s.transfers.find((t) => t.projectCode === code);
  const ratio = (list: { ok: boolean }[]) => `${list.filter((x) => x.ok).length} / ${list.length}`;
  return [
    {
      key: "decisions",
      title: "Décisions approuvées",
      value: ratio(decisions),
      ok: decisions.length > 0 && decisions.every((d) => d.ok),
      okText: "Toutes les décisions ont été approuvées.",
      blockers: decisions.length ? decisions.filter((d) => !d.ok).map((d) => d.label) : ["Aucune décision enregistrée"],
      href: `/dossiers/${slug}/revues`,
    },
    {
      key: "livrables",
      title: "Livrables archivables",
      value: `${docs.filter(archivable).length} / ${docs.length}`,
      ok: docs.every(archivable),
      okText: "Tous les livrables sont archivables.",
      blockers: docs.filter((d) => !archivable(d)).map((d) => `${d.name} (${d.status.toLowerCase()})`),
      href: `/projets/${slug}/documents`,
    },
    {
      key: "actions",
      title: "Actions closes",
      value: ratio(actions),
      ok: actions.every((a) => a.ok),
      okText: "Toutes les actions du projet sont closes.",
      blockers: actions.filter((a) => !a.ok).map((a) => a.label),
      href: "/activites",
    },
    {
      key: "transfert",
      title: "Transfert réceptionné",
      value: transfer?.status === "Réceptionné" ? "Oui" : "Non",
      ok: transfer?.status === "Réceptionné",
      okText: "Le transfert a été réceptionné.",
      blockers: transfer?.status === "Réceptionné" ? [] : [`Transfert ${transfer ? transfer.status.toLowerCase() : "non préparé"}`],
      href: `/dossiers/${slug}/transfert`,
    },
  ];
}
