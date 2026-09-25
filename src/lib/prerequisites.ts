/**
 * Pure transitions of the prerequisites of a project (screens 12 → 14): detail panel, new
 * prerequisite, import of a checked document, reminder. Bound to the store by `actions.*`
 * and replayed by the guided tour.
 */
import type { DemoState } from "./data";
import { DEMO_TODAY } from "./format";
import { stamp, withEvent } from "./state-utils";
import type { Prerequisite, PrerequisiteFile } from "./types";

type Patch = Partial<Pick<Prerequisite, "source" | "importance" | "quality" | "status">>;

const hrefOf = (p: Prerequisite) => `/projets/${p.projectCode.toLowerCase()}/prerequis?prerequis=${p.id}`;
const labels = (p: Prerequisite) => ({
  context: `${p.projectCode} • ${p.name}`,
  object: "Prérequis" as const,
  objectLabel: `${p.projectCode} • Prérequis : ${p.name}`,
});

function replace(s: DemoState, next: Prerequisite): DemoState {
  return { ...s, prerequisites: s.prerequisites.map((p) => (p.id === next.id ? next : p)) };
}

export const prerequisite = {
  /** Detail panel of screen 12 (responsible, importance, quality, status); each change is traced. */
  update(s: DemoState, id: string, patch: Patch): DemoState {
    const prereq = s.prerequisites.find((p) => p.id === id);
    if (!prereq) return s;
    const verified = patch.status === "Vérifié" && prereq.status !== "Vérifié";
    const next: Prerequisite = {
      ...prereq,
      ...patch,
      ...(verified ? { date: DEMO_TODAY, quality: patch.quality ?? (prereq.quality === "Non disponible" ? "Conforme" : prereq.quality) } : {}),
    };
    let n = replace(s, next);
    const changes = (
      [
        ["Statut", prereq.status, next.status],
        ["Responsable", prereq.source, next.source],
        ["Importance", prereq.importance, next.importance],
        ["Qualité", prereq.quality, next.quality],
      ] as [string, string, string][]
    ).filter(([, a, b]) => a !== b);
    for (const [field, oldValue, newValue] of changes) {
      n = withEvent(n, {
        projectCode: prereq.projectCode,
        title: field === "Statut" && newValue === "Vérifié" ? "Prérequis vérifié" : "Prérequis modifié",
        ...labels(prereq),
        type: "Modification",
        field,
        oldValue,
        newValue,
        icon: newValue === "Vérifié" ? "check" : "edit",
        href: hrefOf(prereq),
      });
    }
    return n;
  },

  add(s: DemoState, id: string, input: Pick<Prerequisite, "projectCode" | "category" | "name" | "detail" | "source" | "importance" | "blocking">): DemoState {
    const prereq: Prerequisite = {
      ...input,
      id,
      quality: "Non disponible",
      icon: input.category === "Matières" ? "flask" : input.category === "Ressources" ? "sample" : "doc",
      status: "Non disponible",
      blocking: input.blocking || undefined,
    };
    return withEvent(
      { ...s, prerequisites: [...s.prerequisites, prereq] },
      {
        projectCode: input.projectCode,
        title: "Prérequis ajouté",
        ...labels(prereq),
        type: "Ajout",
        description: `${input.category} — responsable : ${input.source}.`,
        icon: "doc",
        href: hrefOf(prereq),
      },
    );
  },

  /** Screen 13: the imported document is checked, attached and the prerequisite is verified. */
  importDocument(s: DemoState, id: string, input: { file: PrerequisiteFile; docType: string; version: string; supplier: string }): DemoState {
    const prereq = s.prerequisites.find((p) => p.id === id);
    if (!prereq) return s;
    const next: Prerequisite = {
      ...prereq,
      file: input.file,
      reference: input.version || prereq.reference,
      status: "Vérifié",
      quality: "Conforme",
      date: DEMO_TODAY,
      importedAt: stamp(),
    };
    return withEvent(replace(s, next), {
      projectCode: prereq.projectCode,
      title: "Document importé et vérifié",
      ...labels(prereq),
      type: "Ajout",
      field: "Version",
      oldValue: prereq.reference ?? "—",
      newValue: next.reference ?? "—",
      description: `${input.docType} — ${input.supplier} : ${input.file.name}. Informations extraites vérifiées (${(input.file.fields ?? []).map((f) => f.label).join(", ")}).`,
      icon: "check",
      href: hrefOf(prereq),
    });
  },

  /** Removing the piece of a document prerequisite makes it unavailable again. */
  detachFile(s: DemoState, id: string): DemoState {
    const prereq = s.prerequisites.find((p) => p.id === id);
    if (!prereq?.file) return s;
    const next: Prerequisite = {
      ...prereq,
      file: undefined,
      status: prereq.status === "Vérifié" || prereq.status === "Reçu" ? "Non disponible" : prereq.status,
    };
    return withEvent(replace(s, next), {
      projectCode: prereq.projectCode,
      title: "Document retiré du prérequis",
      ...labels(prereq),
      type: "Suppression",
      description: `${prereq.file.name} retiré.`,
      icon: "doc",
      href: hrefOf(prereq),
    });
  },

  remind(s: DemoState, id: string): DemoState {
    const prereq = s.prerequisites.find((p) => p.id === id);
    if (!prereq) return s;
    return withEvent(s, {
      projectCode: prereq.projectCode,
      title: "Relance envoyée",
      ...labels(prereq),
      type: "Relance",
      description: `Rappel envoyé au responsable : ${prereq.source}.`,
      icon: "send",
      href: hrefOf(prereq),
    });
  },
};
