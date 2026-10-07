/**
 * Étape 4 — Développement analytique, qualité, impuretés et lot pilote.
 *
 * Sub-pathways: methods, specifications and impurities, raw materials, pilot lot, controls.
 * Nothing is decided by the system: a referenced method is not usable without evaluation, a
 * certificate received is not a release, a missing limit is not invented, and an out-of-limit result
 * opens an investigation — it is never repeated until compliant nor removed.
 */
import { CURRENT_USER } from "./catalog";
import { sync } from "./cadrage";
import type { DemoState } from "./data";
import { formulationOf } from "./formulation";
import { stamp, uid, withEvent } from "./state-utils";
import type { Project, QControl, QImpurity, QMaterial, QMethod, QPilot, QSpec, QualityFile } from "./types";

const EMPTY: QualityFile = { methods: [], specs: [], impurities: [], materials: [], pilot: { lot: "", batchRecord: false, equipmentChecked: false, status: "À préparer", deviations: "" }, controls: [] };
export const qualityOf = (p: Project): QualityFile => p.quality ?? EMPTY;

export const METHOD_KINDS: QMethod["kind"][] = ["Méthode référencée", "Adaptation", "Nouvelle méthode"];
export const METHOD_STATUSES: QMethod["status"][] = ["À évaluer", "Vérification en cours", "Utilisable", "Non utilisable"];
export const MATERIAL_CONTROLS: QMaterial["control"][] = ["Non prélevé", "En contrôle", "Résultats revus"];
export const MATERIAL_DECISIONS: QMaterial["decision"][] = ["En attente", "Utilisable", "Refusée"];

const num = (v: string) => {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
};

export const specLimit = (s: QSpec) => {
  const u = s.unit ? ` ${s.unit}` : "";
  if (s.min && s.max) return `${s.min} – ${s.max}${u}`;
  if (s.min) return `≥ ${s.min}${u}`;
  if (s.max) return `≤ ${s.max}${u}`;
  return "Limite non définie";
};

export type Verdict = "Conforme" | "Hors limite" | "Non évaluable";

/** Deterministic comparison of a result with an approved numeric limit — otherwise nothing is concluded. */
export function checkResult(spec: QSpec | undefined, value: string): { verdict: Verdict; reason: string } {
  if (!spec) return { verdict: "Non évaluable", reason: "Spécification introuvable." };
  if (!spec.approved) return { verdict: "Non évaluable", reason: "La spécification n'est pas approuvée." };
  const v = num(value);
  const min = num(spec.min);
  const max = num(spec.max);
  if (v === null) return { verdict: "Non évaluable", reason: "Résultat non numérique : à interpréter par le responsable." };
  if (min === null && max === null) return { verdict: "Non évaluable", reason: "Limite non numérique ou non définie." };
  const ok = (min === null || v >= min) && (max === null || v <= max);
  return ok ? { verdict: "Conforme", reason: `Dans la limite approuvée (${specLimit(spec)}).` } : { verdict: "Hors limite", reason: `En dehors de la limite approuvée (${specLimit(spec)}).` };
}

export interface Prerequisite {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/** What the pilot lot needs before its internal launch authorisation — and exactly what is missing. */
export function pilotPrerequisites(p: Project): Prerequisite[] {
  const q = qualityOf(p);
  const f = formulationOf(p);
  const retained = f.options.find((o) => o.id === f.decision?.optionId);
  const pending = q.materials.filter((m) => m.decision !== "Utilisable");
  return [
    { key: "formule", label: "Formule et procédé retenus (G3)", ok: Boolean(retained), detail: retained ? `Piste ${retained.code} v${retained.version} — ${retained.title}` : "Aucune formule retenue" },
    { key: "lot", label: "Lot pilote identifié", ok: Boolean(q.pilot.lot.trim()), detail: q.pilot.lot.trim() || "Numéro de lot à renseigner" },
    { key: "dossier", label: "Dossier de lot préparé", ok: q.pilot.batchRecord, detail: q.pilot.batchRecord ? "Préparé" : "À préparer" },
    {
      key: "matieres",
      label: "Matières premières utilisables",
      ok: q.materials.length > 0 && pending.length === 0,
      detail: !q.materials.length ? "Aucune matière enregistrée" : pending.length ? `Décision en attente : ${pending.map((m) => m.name).join(", ")}` : `${q.materials.length} matière(s) déclarée(s) utilisable(s)`,
    },
    { key: "equipements", label: "Équipements vérifiés", ok: q.pilot.equipmentChecked, detail: q.pilot.equipmentChecked ? "Vérifiés" : "Vérification à faire" },
  ];
}

export const openInvestigations = (q: QualityFile) => q.controls.filter((c) => c.investigation && !c.investigation.closedAt);

/** "Données suffisantes pour la prochaine activité ?" — a summary, the responsible people decide. */
export function qualitySummary(p: Project) {
  const q = qualityOf(p);
  return {
    methods: { done: q.methods.filter((m) => m.status === "Utilisable").length, total: q.methods.length },
    specs: { done: q.specs.filter((s) => s.approved).length, total: q.specs.length },
    materials: { done: q.materials.filter((m) => m.decision === "Utilisable").length, total: q.materials.length },
    pilot: q.pilot.status,
    controls: q.controls.length,
    investigations: openInvestigations(q).length,
  };
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

const find = (s: DemoState, code: string) => s.projects.find((p) => p.code === code && p.cadrage);
const labelOf = (p: Project) => `${p.code} • ${p.name}`;
const hrefOf = (p: Project) => `/projets/${p.slug}/qualite`;
const patch = (s: DemoState, code: string, update: (q: QualityFile, p: Project) => QualityFile): DemoState => ({
  ...s,
  projects: s.projects.map((p) => (p.code === code && p.cadrage ? { ...p, quality: update(qualityOf(p), p) } : p)),
});
const upsert = <T extends { id: string }>(list: T[], item: Omit<T, "id"> & { id?: string }, prefix: string): T[] =>
  item.id ? list.map((x) => (x.id === item.id ? ({ ...x, ...item } as T) : x)) : [...list, { ...item, id: uid(prefix) } as T];

type Input<T> = Omit<T, "id"> & { id?: string };

export const quality = {
  /** Starts the lists from what the project already decided: retained formula and target criteria. Limits stay empty. */
  seed(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const f = formulationOf(p);
    const retained = f.options.find((o) => o.id === f.decision?.optionId);
    return patch(s, code, (q) => ({
      ...q,
      materials: [
        ...q.materials,
        ...(retained?.components ?? []).filter((c) => !q.materials.some((m) => m.name === c.name)).map((c): QMaterial => ({ id: uid("mat"), name: c.name, supplierLot: "", coa: false, sds: false, control: "Non prélevé", decision: "En attente" })),
      ],
      specs: [
        ...q.specs,
        ...f.criteria.filter((c) => !q.specs.some((x) => x.test === c.label)).map((c): QSpec => ({ id: uid("spec"), test: c.label, method: c.method, min: "", max: "", unit: c.unit, origin: "", approved: false })),
      ],
    }));
  },

  saveMethod(s: DemoState, code: string, input: Input<QMethod>): DemoState {
    return patch(s, code, (q) => ({ ...q, methods: upsert(q.methods, input, "meth") }));
  },
  removeMethod(s: DemoState, code: string, id: string): DemoState {
    return patch(s, code, (q) => ({ ...q, methods: q.methods.filter((m) => m.id !== id) }));
  },

  /** Editing a specification withdraws its approval: results are compared with approved versions only. */
  saveSpec(s: DemoState, code: string, input: Omit<Input<QSpec>, "approved" | "approvedBy">): DemoState {
    return patch(s, code, (q) => ({ ...q, specs: upsert(q.specs, { ...input, approved: false, approvedBy: undefined }, "spec") }));
  },
  /**
   * Approval needs the origin of the limit; it can be given at the same time. Results already entered
   * are then evaluated: one that turns out to be out of limit opens its investigation.
   */
  approveSpec(s: DemoState, code: string, id: string, origin?: string): DemoState {
    const p = find(s, code);
    const stored = p && qualityOf(p).specs.find((x) => x.id === id);
    const spec = stored && { ...stored, origin: origin?.trim() || stored.origin, approved: true, approvedBy: CURRENT_USER };
    if (!p || !spec || !spec.origin.trim()) return s;
    const next = patch(s, code, (q) => ({
      ...q,
      specs: q.specs.map((x) => (x.id === id ? spec : x)),
      controls: q.controls.map((c) => (c.specId === id && !c.investigation && checkResult(spec, c.value).verdict === "Hors limite" ? { ...c, investigation: { note: "" } } : c)),
    }));
    return withEvent(next, { projectCode: code, title: `Spécification approuvée — ${spec.test}`, context: labelOf(p), object: "Méthode", objectLabel: `${labelOf(p)} • Spécifications`, type: "Approbation", description: `${specLimit(spec)} — origine de la limite : ${spec.origin}.`, icon: "check", href: hrefOf(p) });
  },
  removeSpec(s: DemoState, code: string, id: string): DemoState {
    return patch(s, code, (q) => (q.controls.some((c) => c.specId === id) ? q : { ...q, specs: q.specs.filter((x) => x.id !== id) }));
  },

  saveImpurity(s: DemoState, code: string, input: Input<QImpurity>): DemoState {
    return patch(s, code, (q) => ({ ...q, impurities: upsert(q.impurities, input, "imp") }));
  },
  removeImpurity(s: DemoState, code: string, id: string): DemoState {
    return patch(s, code, (q) => ({ ...q, impurities: q.impurities.filter((x) => x.id !== id) }));
  },

  saveMaterial(s: DemoState, code: string, input: Input<QMaterial>): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const before = qualityOf(p).materials.find((m) => m.id === input.id);
    // A use decision needs the reviewed control results: a certificate alone is not a release.
    const decision = input.decision === "Utilisable" && input.control !== "Résultats revus" ? "En attente" : input.decision;
    const next = patch(s, code, (q) => ({ ...q, materials: upsert(q.materials, { ...input, decision }, "mat") }));
    if (before?.decision === decision || decision === "En attente") return next;
    return withEvent(next, { projectCode: code, title: `Matière première — ${input.name} : ${decision.toLowerCase()}`, context: labelOf(p), object: "Lot", objectLabel: `${labelOf(p)} • Matières premières`, type: "Approbation", description: `Lot fournisseur ${input.supplierLot || "non renseigné"} — décision d'utilisation prise après revue des résultats de contrôle.`, icon: "check", href: hrefOf(p) });
  },
  removeMaterial(s: DemoState, code: string, id: string): DemoState {
    return patch(s, code, (q) => ({ ...q, materials: q.materials.filter((x) => x.id !== id) }));
  },

  setPilot(s: DemoState, code: string, change: Partial<Pick<QPilot, "lot" | "batchRecord" | "equipmentChecked" | "deviations">>): DemoState {
    return patch(s, code, (q) => (q.pilot.status === "À préparer" || "deviations" in change ? { ...q, pilot: { ...q.pilot, ...change } } : q));
  },

  /** Internal launch authorisation: refused while a prerequisite is missing. */
  authorizePilot(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    if (!p || qualityOf(p).pilot.status !== "À préparer" || pilotPrerequisites(p).some((x) => !x.ok)) return s;
    const next = patch(s, code, (q) => ({ ...q, pilot: { ...q.pilot, status: "Autorisé", authorizedAt: stamp(), authorizedBy: CURRENT_USER } }));
    return sync(withEvent(next, { projectCode: code, title: `Lot pilote ${qualityOf(p).pilot.lot} — lancement autorisé`, context: labelOf(p), object: "Lot", objectLabel: `${labelOf(p)} • Lot pilote`, type: "Approbation", description: "Prérequis satisfaits : formule retenue, dossier de lot, matières utilisables, équipements vérifiés.", icon: "check", href: hrefOf(p) }), code);
  },
  advancePilot(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    const status = p && qualityOf(p).pilot.status;
    if (!p || (status !== "Autorisé" && status !== "Fabriqué")) return s;
    const to = status === "Autorisé" ? "Fabriqué" : "Revu";
    const next = patch(s, code, (q) => ({ ...q, pilot: { ...q.pilot, status: to, reviewedAt: to === "Revu" ? stamp() : q.pilot.reviewedAt } }));
    return sync(withEvent(next, { projectCode: code, title: `Lot pilote ${qualityOf(p).pilot.lot} — ${to === "Fabriqué" ? "fabrication et conditionnement terminés" : "revue du lot effectuée"}`, context: labelOf(p), object: "Lot", objectLabel: `${labelOf(p)} • Lot pilote`, type: "Modification", field: "Statut", oldValue: status, newValue: to, description: qualityOf(p).pilot.deviations ? `Écarts : ${qualityOf(p).pilot.deviations}` : undefined, icon: "box", href: hrefOf(p) }), code);
  },

  /** Records a result linked to its lot, sample and specification; out of limit → investigation to open. */
  addControl(s: DemoState, code: string, input: Omit<QControl, "id" | "investigation">): DemoState {
    const p = find(s, code);
    const spec = p && qualityOf(p).specs.find((x) => x.id === input.specId);
    if (!p || !spec || !input.value.trim()) return s;
    const { verdict, reason } = checkResult(spec, input.value);
    const control: QControl = { ...input, id: uid("ctl"), investigation: verdict === "Hors limite" ? { note: "" } : undefined };
    const next = patch(s, code, (q) => ({ ...q, controls: [...q.controls, control] }));
    return withEvent(next, { projectCode: code, title: `Résultat de contrôle — ${spec.test} : ${verdict.toLowerCase()}`, context: labelOf(p), object: "Essai", objectLabel: `${labelOf(p)} • Lot ${input.lot}`, type: "Ajout", description: `${input.value} ${spec.unit} — ${reason}${verdict === "Hors limite" ? " Résultat hors limite à investiguer : le résultat initial est conservé." : ""}`, icon: verdict === "Hors limite" ? "alert" : "flask", href: hrefOf(p) });
  },
  closeInvestigation(s: DemoState, code: string, id: string, note: string): DemoState {
    const p = find(s, code);
    if (!p || !note.trim()) return s;
    const next = patch(s, code, (q) => ({ ...q, controls: q.controls.map((c) => (c.id === id && c.investigation ? { ...c, investigation: { note: note.trim(), closedAt: stamp() } } : c)) }));
    return withEvent(next, { projectCode: code, title: "Investigation d'un résultat hors limite clôturée", context: labelOf(p), object: "Essai", objectLabel: `${labelOf(p)} • Contrôles`, type: "Modification", description: note.trim(), icon: "check", href: hrefOf(p) });
  },
};
