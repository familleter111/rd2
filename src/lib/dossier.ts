/**
 * Pure state transitions of the documentation, dossier, transfer, configuration and
 * closure modules (mock-ups 45 → 56). Same pattern as `lib/lab.ts`: every reducer takes
 * the demo state and returns a new one (bound in the store as `dossierActions`, replayed
 * by the guided tour), and adds a traceability event.
 */
import type { DemoState } from "./data";
import { DEMO_TODAY, formatNumeric } from "./format";
import { nextNumber, pad2, projectLabel, stamp, uid, withEvent, type NewEvent } from "./state-utils";
import type {
  CircuitStep,
  Dossier,
  DossierReview,
  DossierSection,
  PathTemplate,
  Person,
  ProjectDocument,
  Reserve,
  ReviewDecisionChoice,
  ReviewDraft,
  RolePermission,
  TeamRole,
  TemplatePhase,
  TemplateVersion,
  Transfer,
} from "./types";

/* ------------------------------------------------------------------ */
/* Identifiers & helpers                                               */
/* ------------------------------------------------------------------ */

export const nextReviewId = (s: DemoState) => `RD-${pad2(nextNumber(s.dossierReviews.map((r) => r.id), /^RD-(\d+)$/))}`;
export const nextReserveId = (s: DemoState, offset = 0) => `R-${pad2(nextNumber(s.reserves.map((r) => r.id), /^R-(\d+)$/) + offset)}`;
/** Id of the history event of a document version (the tour links to it: screen 47). */
export const versionEventId = (docId: string, version: number) => `h-${docId}-v${version}`;

const slug = (code: string) => code.toLowerCase();

/** Adds an event with a known id (so pages can link to it). */
function withEventId(s: DemoState, id: string, event: NewEvent): DemoState {
  const next = withEvent(s, event);
  return { ...next, history: [{ ...next.history[0], id }, ...next.history.slice(1)] };
}

function mapDoc(s: DemoState, id: string, fn: (d: ProjectDocument) => ProjectDocument): DemoState {
  return { ...s, documents: s.documents.map((d) => (d.id === id ? fn(d) : d)) };
}

function mapDossier(s: DemoState, code: string, fn: (d: Dossier) => Dossier): DemoState {
  return { ...s, dossiers: s.dossiers.map((d) => (d.projectCode === code ? fn(d) : d)) };
}

function mapSection(s: DemoState, code: string, sectionId: string, fn: (x: DossierSection) => DossierSection): DemoState {
  return mapDossier(s, code, (d) => ({
    ...d,
    modules: d.modules.map((m) => ({ ...m, sections: m.sections.map((x) => (x.id === sectionId ? fn(x) : x)) })),
  }));
}

function findSection(s: DemoState, code: string, sectionId: string) {
  return s.dossiers.find((d) => d.projectCode === code)?.modules.flatMap((m) => m.sections).find((x) => x.id === sectionId);
}

function mapTransfer(s: DemoState, code: string, fn: (t: Transfer) => Transfer): DemoState {
  return { ...s, transfers: s.transfers.map((t) => (t.projectCode === code ? fn(t) : t)) };
}

function mapRole(s: DemoState, id: string, fn: (r: TeamRole) => TeamRole): DemoState {
  return { ...s, roles: s.roles.map((r) => (r.id === id ? fn(r) : r)) };
}

function mapTemplate(s: DemoState, id: string, fn: (t: PathTemplate) => PathTemplate): DemoState {
  return { ...s, templates: s.templates.map((t) => (t.id === id ? fn(t) : t)) };
}

function log(s: DemoState, text: string): DemoState {
  return { ...s, configLog: [{ id: uid("cfg"), at: stamp(), author: "Administrateur", text }, ...s.configLog] };
}

const docEvent = (d: ProjectDocument) => ({
  projectCode: d.projectCode,
  context: `${d.projectCode} • ${d.name}`,
  object: "Document" as const,
  objectLabel: `${d.projectCode} • Document : ${d.name}`,
  docId: d.id,
  href: `/projets/${slug(d.projectCode)}/documents/${d.id}`,
});

const dossierEvent = (code: string, href: string) => ({
  projectCode: code,
  context: `${code} • Dossier CTD`,
  object: "Dossier" as const,
  objectLabel: `${code} • Dossier CTD`,
  href,
});

const shortDate = (iso: string) => iso.slice(0, 10);

/** New draft version of a template, copied from its active (or latest) version. */
function createTemplateVersion(s: DemoState, templateId: string): DemoState {
  const t = s.templates.find((x) => x.id === templateId);
  if (!t || t.versions.some((v) => v.status === "Brouillon")) return s;
  const source = t.versions.find((v) => v.status === "Actif") ?? t.versions[t.versions.length - 1];
  const version: TemplateVersion = {
    version: Math.max(...t.versions.map((v) => v.version)) + 1,
    status: "Brouillon",
    createdAt: DEMO_TODAY,
    note: `Copie de la version ${source.version}`,
    phases: structuredClone(source.phases),
  };
  return log(mapTemplate(s, templateId, (x) => ({ ...x, versions: [...x.versions, version] })), `Modèle « ${t.name} » : version ${version.version} créée en brouillon.`);
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

export const dossier = {
  /* ---------------- Documents (45–47) ---------------- */

  addDocumentVersion(
    s: DemoState,
    docId: string,
    input: { file: string; size: string; motif: string; status: "Brouillon" | "En revue"; reviewer: string; notify: boolean },
  ): DemoState {
    const d = s.documents.find((x) => x.id === docId);
    if (!d) return s;
    const version = d.version + 1;
    const inForce = d.status === "Approuvé" ? d.version : d.approvedVersion;
    let next = mapDoc(s, docId, (x) => ({
      ...x,
      version,
      status: input.status,
      updatedAt: stamp(),
      size: input.size,
      fileName: input.file,
      approvedVersion: inForce,
      versions: [
        { version, date: stamp(), author: "Chef de projet", note: "Version actuelle", status: input.status, file: input.file, size: input.size, motif: input.motif, reviewer: input.reviewer },
        ...x.versions.map((v) => (v.version === x.version ? { ...v, note: v.version === inForce ? "Version approuvée en vigueur" : "Version remplacée" } : v)),
      ],
    }));
    next = withEventId(next, versionEventId(docId, version), {
      ...docEvent(d),
      title: `${d.name} v${version} ajouté`,
      type: "Ajout",
      motif: input.motif,
      description: `Version v${version} ajoutée (${input.status.toLowerCase()}), soumise à revue par ${input.reviewer}${
        inForce ? ` ; la version v${inForce} approuvée reste en vigueur` : ""
      }.`,
      docBefore: { label: `${d.name} v${d.version}`, status: d.status, date: shortDate(d.updatedAt) },
      docAfter: { label: `${d.name} v${version}`, status: input.status, date: DEMO_TODAY },
      icon: "doc",
    });
    if (input.notify) {
      next = {
        ...next,
        notifications: [
          { id: uid("n"), title: "Nouvelle version à revoir", detail: `${d.name} v${version} — revue demandée à ${input.reviewer}`, when: "À l'instant", href: `/projets/${slug(d.projectCode)}/documents/${d.id}`, tone: "info", read: false },
          ...next.notifications,
        ],
      };
    }
    return next;
  },

  /** Approves the latest version of a document (simulates the reviewer). */
  approveDocument(s: DemoState, docId: string, approver = "Responsable développement"): DemoState {
    const d = s.documents.find((x) => x.id === docId);
    if (!d || d.status === "Approuvé") return s;
    let next = mapDoc(s, docId, (x) => ({
      ...x,
      status: "Approuvé",
      approvedVersion: x.version,
      versions: x.versions.map((v) =>
        v.version === x.version
          ? { ...v, status: "Approuvé" as const, approvedAt: stamp(), approvedBy: approver }
          : v.version === x.approvedVersion
            ? { ...v, note: "Version remplacée" }
            : v,
      ),
    }));
    next = withEvent(next, {
      ...docEvent(d),
      title: `${d.name} v${d.version} approuvé`,
      type: "Approbation",
      author: approver,
      field: "Statut",
      oldValue: d.status,
      newValue: "Approuvé",
      icon: "check",
    });
    return next;
  },

  archiveDocument(s: DemoState, docId: string): DemoState {
    const d = s.documents.find((x) => x.id === docId);
    if (!d || d.archived) return s;
    const next = mapDoc(s, docId, (x) => ({ ...x, archived: true, archivedAt: stamp() }));
    return withEvent(next, { ...docEvent(d), title: "Document archivé", type: "Modification", field: "Archivage", oldValue: "Actif", newValue: "Archivé (lecture seule)", icon: "folder" });
  },

  restoreDocument(s: DemoState, docId: string): DemoState {
    const d = s.documents.find((x) => x.id === docId);
    if (!d || !d.archived) return s;
    const next = mapDoc(s, docId, (x) => ({ ...x, archived: false, archivedAt: undefined }));
    return withEvent(next, { ...docEvent(d), title: "Document restauré", type: "Modification", field: "Archivage", oldValue: "Archivé", newValue: "Actif", icon: "folder" });
  },

  setDocumentKeywords(s: DemoState, docId: string, keywords: string[]): DemoState {
    const d = s.documents.find((x) => x.id === docId);
    if (!d) return s;
    const next = mapDoc(s, docId, (x) => ({ ...x, keywords }));
    return withEvent(next, {
      ...docEvent(d),
      title: "Mots-clés du document modifiés",
      type: "Modification",
      field: "Mots-clés",
      oldValue: (d.keywords ?? []).join(", ") || "—",
      newValue: keywords.join(", ") || "—",
      icon: "edit",
    });
  },

  addDocumentComment(s: DemoState, docId: string, text: string): DemoState {
    return mapDoc(s, docId, (x) => ({ ...x, comments: [...(x.comments ?? []), { id: uid("dc"), author: "Chef de projet", at: stamp(), text }] }));
  },

  /* ---------------- Dossier CTD (48–49) ---------------- */

  updateSectionPart(s: DemoState, code: string, sectionId: string, partId: string, text: string): DemoState {
    const section = findSection(s, code, sectionId);
    const part = section?.parts.find((p) => p.id === partId);
    if (!section || !part || part.text === text) return s;
    const next = mapSection(s, code, sectionId, (x) => ({ ...x, parts: x.parts.map((p) => (p.id === partId ? { ...p, text } : p)) }));
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}/sections/${sectionId}`),
      title: `Section ${section.code} modifiée`,
      type: "Modification",
      field: part.title,
      oldValue: part.text || "—",
      newValue: text || "—",
      icon: "edit",
    });
  },

  updateSectionIntro(s: DemoState, code: string, sectionId: string, intro: string): DemoState {
    const section = findSection(s, code, sectionId);
    if (!section || section.intro === intro) return s;
    const next = mapSection(s, code, sectionId, (x) => ({ ...x, intro }));
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}/sections/${sectionId}`),
      title: `Section ${section.code} modifiée`,
      type: "Modification",
      field: "Introduction",
      oldValue: section.intro || "—",
      newValue: intro || "—",
      icon: "edit",
    });
  },

  linkProof(s: DemoState, code: string, sectionId: string, input: { docId: string; ref: string; partId: string }): DemoState {
    const section = findSection(s, code, sectionId);
    const doc = s.documents.find((d) => d.id === input.docId);
    const part = section?.parts.find((p) => p.id === input.partId);
    if (!section || !doc || !part) return s;
    const existing = section.proofs.find((p) => p.docId === doc.id);
    const proofId = existing?.id ?? uid("p");
    const next = mapSection(s, code, sectionId, (x) => ({
      ...x,
      proofs: existing ? x.proofs : [...x.proofs, { id: proofId, label: `${doc.name} v${doc.approvedVersion ?? doc.version}`, kind: doc.type, docId: doc.id }],
      links: [...x.links, { id: uid("l"), proofId, ref: input.ref, partId: input.partId }],
    }));
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}/sections/${sectionId}`),
      title: "Preuve liée à la section",
      type: "Ajout",
      description: `${doc.name} (${input.ref}) lié au paragraphe « ${part.title} » de la section ${section.code} ${section.title}.`,
      icon: "doc",
    });
  },

  unlinkProof(s: DemoState, code: string, sectionId: string, linkId: string): DemoState {
    return mapSection(s, code, sectionId, (x) => ({ ...x, links: x.links.filter((l) => l.id !== linkId) }));
  },

  submitSection(s: DemoState, code: string, sectionId: string): DemoState {
    const section = findSection(s, code, sectionId);
    if (!section || section.status === "En revue" || section.status === "Approuvée") return s;
    const next = mapSection(s, code, sectionId, (x) => ({ ...x, status: "En revue", submittedAt: stamp() }));
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}/sections/${sectionId}`),
      title: `Section ${section.code} soumise`,
      type: "Soumission",
      description: `Section « ${section.title} » soumise pour revue.`,
      field: "Statut",
      oldValue: section.status,
      newValue: "En revue",
      icon: "send",
    });
  },

  /** Simulates the approval of a submitted section by Quality. */
  approveSection(s: DemoState, code: string, sectionId: string): DemoState {
    const section = findSection(s, code, sectionId);
    if (!section || section.status !== "En revue") return s;
    const next = mapSection(s, code, sectionId, (x) => ({ ...x, status: "Approuvée" }));
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}/sections/${sectionId}`),
      title: `Section ${section.code} approuvée`,
      type: "Approbation",
      author: "Qualité",
      field: "Statut",
      oldValue: "En revue",
      newValue: "Approuvée",
      icon: "check",
    });
  },

  saveReviewDraft(s: DemoState, code: string, draft: ReviewDraft): DemoState {
    return mapDossier(s, code, (d) => ({ ...d, reviewDraft: draft }));
  },

  /** Adds a document expected by the dossier and links it to its section. */
  addDossierDocument(s: DemoState, code: string, input: { sectionId: string; name: string; type: string; file: string; size: string; requirementId?: string }): DemoState {
    const section = findSection(s, code, input.sectionId);
    if (!section) return s;
    const id = uid("doc");
    const doc: ProjectDocument = {
      id,
      projectCode: code,
      category: "CTD",
      name: input.name,
      type: input.type,
      version: 1,
      owner: "Chef de projet",
      updatedAt: stamp(),
      status: "En revue",
      size: input.size,
      fileType: "PDF",
      fileName: input.file,
      createdAt: stamp(),
      description: `Document du dossier, section ${section.code} ${section.title}.`,
      keywords: ["Dossier", section.code],
      versions: [{ version: 1, date: stamp(), author: "Chef de projet", note: "Création du document", status: "En revue", file: input.file, size: input.size }],
    };
    const emptyPart = section.parts.find((p) => !section.links.some((l) => l.partId === p.id)) ?? section.parts[0];
    let next: DemoState = { ...s, documents: [doc, ...s.documents] };
    next = mapSection(next, code, input.sectionId, (x) => ({
      ...x,
      proofs: [...x.proofs, { id: `p-${id}`, label: `${input.name} v1`, kind: input.type, docId: id }],
      links: emptyPart ? [...x.links, { id: uid("l"), proofId: `p-${id}`, ref: "Document complet", partId: emptyPart.id }] : x.links,
    }));
    if (input.requirementId) {
      next = mapDossier(next, code, (d) => ({ ...d, requirements: d.requirements.map((r) => (r.id === input.requirementId ? { ...r, docId: id } : r)) }));
    }
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}/sections/${input.sectionId}`),
      title: `${input.name} ajouté au dossier`,
      type: "Ajout",
      description: `Document ajouté à la section ${section.code} ${section.title} (en revue).`,
      docId: id,
      icon: "doc",
    });
  },

  checkCompleteness(s: DemoState, code: string, missing: number): DemoState {
    const next = mapDossier(s, code, (d) => ({ ...d, checkedAt: stamp() }));
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}`),
      title: "Complétude du dossier vérifiée",
      type: "Modification",
      description: missing ? `${missing} élément(s) manquant(s) dans le module 3.` : "Aucun élément manquant : le dossier peut être revu.",
      icon: "check",
    });
  },

  /* ---------------- Reviews & reserves (50–51) ---------------- */

  submitDossierReview(s: DemoState, code: string, draft: ReviewDraft): DemoState {
    const id = nextReviewId(s);
    const circuit: CircuitStep[] = [
      { role: "Responsable développement", detail: "Avis de développement", status: "Avis favorable", date: draft.date },
      { role: "Qualité", detail: "Examen et décision", status: "À examiner" },
    ];
    const review: DossierReview = { ...draft, id, projectCode: code, status: "En revue", submittedAt: stamp(), circuit };
    const next = mapDossier({ ...s, dossierReviews: [...s.dossierReviews, review] }, code, (d) => ({ ...d, reviewDraft: undefined }));
    return withEvent(next, {
      projectCode: code,
      title: `Revue ${id} soumise`,
      context: `${code} • ${draft.type}`,
      object: "Revue",
      objectLabel: `${code} • Revue ${id}`,
      type: "Soumission",
      description: `${draft.type} prévue le ${formatNumeric(draft.date)} avec ${draft.participants.join(", ")}.`,
      icon: "send",
      href: `/dossiers/${slug(code)}/revues/${id.toLowerCase()}`,
    });
  },

  decideDossierReview(
    s: DemoState,
    reviewId: string,
    input: { decision: ReviewDecisionChoice; justification: string; reserves: { description: string; owner: string; due: string; blocking: boolean }[] },
  ): DemoState {
    const review = s.dossierReviews.find((r) => r.id === reviewId);
    if (!review || review.status !== "En revue") return s;
    const status = input.decision === "approuver" ? "Approuvée" : input.decision === "reserves" ? "Approuvée avec réserves" : "Correction demandée";
    const reserves: Reserve[] =
      input.decision === "reserves"
        ? input.reserves.map((r, i) => ({ ...r, id: nextReserveId(s, i), projectCode: review.projectCode, reviewId, status: "Ouverte" }))
        : [];
    let next: DemoState = {
      ...s,
      reserves: [...s.reserves, ...reserves],
      dossierReviews: s.dossierReviews.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              status,
              decision: input.decision,
              decisionJustification: input.justification,
              decidedAt: stamp(),
              circuit: r.circuit.map((c, i) => (i === r.circuit.length - 1 ? { ...c, status: input.decision === "correction" ? "Correction demandée" : "Approuvé", date: DEMO_TODAY } : c)),
            }
          : r,
      ),
    };
    next = withEvent(next, {
      projectCode: review.projectCode,
      title: `Décision de revue ${reviewId} : ${status.toLowerCase()}`,
      context: `${review.projectCode} • Revue ${reviewId}`,
      object: "Revue",
      objectLabel: `${review.projectCode} • Revue ${reviewId}`,
      type: input.decision === "correction" ? "Correction" : "Approbation",
      author: "Qualité",
      motif: input.justification,
      description: reserves.length ? `Réserves : ${reserves.map((r) => `${r.id} ${r.description}${r.blocking ? " (bloquante)" : ""}`).join(" ; ")}.` : undefined,
      icon: "check",
      href: `/dossiers/${slug(review.projectCode)}/revues/${reviewId.toLowerCase()}`,
    });
    return next;
  },

  liftReserve(s: DemoState, reserveId: string, comment: string): DemoState {
    const r = s.reserves.find((x) => x.id === reserveId);
    if (!r || r.status === "Levée") return s;
    const next = { ...s, reserves: s.reserves.map((x) => (x.id === reserveId ? { ...x, status: "Levée" as const, liftedAt: stamp(), liftComment: comment } : x)) };
    return withEvent(next, {
      projectCode: r.projectCode,
      title: `Réserve ${r.id} levée`,
      context: `${r.projectCode} • Revue ${r.reviewId}`,
      object: "Revue",
      objectLabel: `${r.projectCode} • Réserve ${r.id}`,
      type: "Modification",
      field: "Statut",
      oldValue: "Ouverte",
      newValue: "Levée",
      motif: comment,
      icon: "check",
      href: `/dossiers/${slug(r.projectCode)}/reserves`,
    });
  },

  /* ---------------- Export (52) ---------------- */

  recordExport(s: DemoState, code: string, input: { format: "PDF" | "ZIP"; fileName: string; sections: string[] }): DemoState {
    const next = mapDossier(s, code, (d) => ({ ...d, exports: [{ id: uid("exp"), at: stamp(), author: "Chef de projet", ...input }, ...d.exports] }));
    return withEvent(next, {
      ...dossierEvent(code, `/dossiers/${slug(code)}/export`),
      title: "Dossier exporté",
      type: "Ajout",
      description: `${input.fileName} (${input.format === "PDF" ? "PDF de revue" : "archive documentaire"}) — ${input.sections.join(", ")}.`,
      icon: "doc",
    });
  },

  /* ---------------- Transfer (53) ---------------- */

  transmitTransfer(s: DemoState, code: string): DemoState {
    const t = s.transfers.find((x) => x.projectCode === code);
    if (!t || t.status === "À réceptionner" || t.status === "Réceptionné") return s;
    const next = mapTransfer(s, code, (x) => ({ ...x, status: "À réceptionner", transmittedAt: stamp(), complementRequest: undefined }));
    return withEvent(next, {
      projectCode: code,
      title: `Documents transmis à l'${t.targetTeam.charAt(0).toLowerCase()}${t.targetTeam.slice(1)}`,
      context: `${code} • Transfert`,
      object: "Transfert",
      objectLabel: `${code} • Transfert industriel`,
      type: "Soumission",
      description: `${t.documents.length} documents remis pour transfert (${t.documents.map((d) => d.code).join(", ")}).`,
      icon: "send",
      href: `/dossiers/${slug(code)}/transfert`,
    });
  },

  confirmReception(s: DemoState, code: string, comment: string): DemoState {
    const t = s.transfers.find((x) => x.projectCode === code);
    if (!t || t.status !== "À réceptionner") return s;
    const next = mapTransfer(s, code, (x) => ({ ...x, status: "Réceptionné", receivedAt: stamp(), comment: comment || undefined }));
    return withEvent(next, {
      projectCode: code,
      title: "Réception du transfert confirmée",
      context: `${code} • Transfert`,
      object: "Transfert",
      objectLabel: `${code} • Transfert industriel`,
      type: "Approbation",
      author: t.targetTeam,
      description: comment || "Documents examinés et reçus par l'équipe Production.",
      icon: "check",
      href: `/dossiers/${slug(code)}/transfert`,
    });
  },

  requestComplement(s: DemoState, code: string, comment: string): DemoState {
    const t = s.transfers.find((x) => x.projectCode === code);
    if (!t || t.status !== "À réceptionner") return s;
    const next = mapTransfer(s, code, (x) => ({ ...x, status: "Complément demandé", complementRequest: comment }));
    return withEvent(next, {
      projectCode: code,
      title: "Complément demandé par l'équipe Production",
      context: `${code} • Transfert`,
      object: "Transfert",
      objectLabel: `${code} • Transfert industriel`,
      type: "Correction",
      author: t.targetTeam,
      motif: comment,
      icon: "alert",
      href: `/dossiers/${slug(code)}/transfert`,
    });
  },

  /* ---------------- Configuration (54–55) ---------------- */

  saveRole(s: DemoState, roleId: string, input: { permissions: RolePermission[]; scope: TeamRole["scope"] }): DemoState {
    const role = s.roles.find((r) => r.id === roleId);
    if (!role) return s;
    const changes = input.permissions
      .filter((p) => role.permissions.find((o) => o.key === p.key)?.enabled !== p.enabled)
      .map((p) => `${p.label} : ${p.enabled ? "activé" : "désactivé"}`);
    if (role.scope !== input.scope) changes.push(`Périmètre : ${input.scope}`);
    const next = mapRole(s, roleId, (r) => ({ ...r, ...input }));
    return log(next, `Droits du rôle « ${role.name} » modifiés — ${changes.join(" ; ") || "aucun changement"}.`);
  },

  addRoleMember(s: DemoState, roleId: string, person: Person): DemoState {
    const role = s.roles.find((r) => r.id === roleId);
    if (!role || role.members.some((m) => m.name === person.name)) return s;
    return log(mapRole(s, roleId, (r) => ({ ...r, members: [...r.members, person] })), `${person.name} ajouté(e) au rôle « ${role.name} ».`);
  },

  removeRoleMember(s: DemoState, roleId: string, name: string): DemoState {
    const role = s.roles.find((r) => r.id === roleId);
    if (!role) return s;
    return log(mapRole(s, roleId, (r) => ({ ...r, members: r.members.filter((m) => m.name !== name) })), `${name} retiré(e) du rôle « ${role.name} ».`);
  },

  setNotification(s: DemoState, id: string, channel: "app" | "email", value: boolean): DemoState {
    return { ...s, notificationSettings: s.notificationSettings.map((n) => (n.id === id ? { ...n, [channel]: value } : n)) };
  },

  createTemplateVersion,

  /** Adds an activity or a proof to a phase — always in a draft version (created if needed). */
  addTemplateItem(s: DemoState, templateId: string, phaseKey: string, kind: "activities" | "proofs", label: string): DemoState {
    let next = createTemplateVersion(s, templateId);
    const t = next.templates.find((x) => x.id === templateId);
    const draft = t?.versions.find((v) => v.status === "Brouillon");
    if (!t || !draft) return s;
    next = mapTemplate(next, templateId, (x) => ({
      ...x,
      versions: x.versions.map((v) =>
        v.version === draft.version
          ? {
              ...v,
              phases: v.phases.map((p: TemplatePhase) =>
                p.key === phaseKey ? { ...p, [kind]: [...p[kind], { id: uid("ti"), label, icon: kind === "proofs" ? "doc" : "list" }] } : p,
              ),
            }
          : v,
      ),
    }));
    return log(next, `Modèle « ${t.name} » v${draft.version} : ${kind === "proofs" ? "preuve" : "activité"} « ${label} » ajoutée.`);
  },

  removeTemplateItem(s: DemoState, templateId: string, version: number, phaseKey: string, kind: "activities" | "proofs", itemId: string): DemoState {
    const t = s.templates.find((x) => x.id === templateId);
    const v = t?.versions.find((x) => x.version === version);
    if (!t || !v || v.status !== "Brouillon") return s;
    return mapTemplate(s, templateId, (x) => ({
      ...x,
      versions: x.versions.map((y) =>
        y.version === version ? { ...y, phases: y.phases.map((p) => (p.key === phaseKey ? { ...p, [kind]: p[kind].filter((i) => i.id !== itemId) } : p)) } : y,
      ),
    }));
  },

  activateTemplateVersion(s: DemoState, templateId: string, version: number): DemoState {
    const t = s.templates.find((x) => x.id === templateId);
    if (!t) return s;
    const next = mapTemplate(s, templateId, (x) => ({
      ...x,
      versions: x.versions.map((v) => (v.version === version ? { ...v, status: "Actif" as const } : v.status === "Actif" ? { ...v, status: "Archivé" as const } : v)),
    }));
    return log(next, `Modèle « ${t.name} » : version ${version} activée pour les nouveaux projets.`);
  },

  duplicateTemplate(s: DemoState, templateId: string): DemoState {
    const t = s.templates.find((x) => x.id === templateId);
    if (!t) return s;
    const source = t.versions.find((v) => v.status === "Actif") ?? t.versions[t.versions.length - 1];
    const copy: PathTemplate = {
      ...t,
      id: uid("tpl"),
      name: `Copie de ${t.name}`,
      projectTemplate: `Copie de ${t.projectTemplate}`,
      versions: [{ version: 1, status: "Brouillon", createdAt: DEMO_TODAY, note: `Copie de « ${t.name} » v${source.version}`, phases: structuredClone(source.phases) }],
    };
    return log({ ...s, templates: [...s.templates, copy] }, `Modèle « ${t.name} » dupliqué.`);
  },

  createTemplate(s: DemoState, input: { name: string; family: PathTemplate["family"]; phases: TemplatePhase[] }): DemoState {
    const t: PathTemplate = {
      id: uid("tpl"),
      name: input.name,
      family: input.family,
      projectTemplate: `Modèle ${input.name.toLowerCase()}`,
      versions: [{ version: 1, status: "Brouillon", createdAt: DEMO_TODAY, note: "Nouveau modèle", phases: input.phases }],
    };
    return log({ ...s, templates: [...s.templates, t] }, `Modèle « ${input.name} » créé en brouillon.`);
  },

  /* ---------------- Closure (56) ---------------- */

  closeProject(s: DemoState, code: string, reason: string): DemoState {
    const p = s.projects.find((x) => x.code === code);
    if (!p || p.closedAt) return s;
    const next = { ...s, projects: s.projects.map((x) => (x.code === code ? { ...x, archived: true, closedAt: stamp(), closeReason: reason } : x)) };
    return withEvent(next, {
      projectCode: code,
      title: "Projet clôturé et archivé",
      context: projectLabel(next, code),
      object: "Projet",
      objectLabel: projectLabel(next, code),
      type: "Modification",
      field: "Statut",
      oldValue: "En cours",
      newValue: "Clôturé (lecture seule)",
      motif: reason,
      icon: "folder",
      href: `/projets/${slug(code)}`,
    });
  },
};
