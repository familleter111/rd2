/**
 * Étape 5 — Stabilité.
 *
 * The plan (lots, conditions, time points, analyses) is entered and approved for the market and the
 * procedure: no climate count or duration is hard-coded. Only the time points required for the
 * dossier in preparation block it. A result out of the approved limit is to investigate; the
 * scientific conclusion is written and approved by a person.
 */
import { CURRENT_USER } from "./catalog";
import { sync } from "./cadrage";
import type { DemoState } from "./data";
import { checkResult, qualityOf } from "./quality";
import { stamp, uid, withEvent } from "./state-utils";
import type { Project, StabilityEntry, StabilityFile } from "./types";

const EMPTY: StabilityFile = { referential: "", packaging: "", lots: [], conditions: [], points: [], specIds: [], entries: [] };
export const stabilityOf = (p: Project): StabilityFile => p.stability ?? EMPTY;

export const pointLabel = (month: number) => (month === 0 ? "T0" : `M${month}`);

export type CellState = "Prévu" | "Reçu" | "À vérifier" | "Approuvé" | "À investiguer";
export const CELL_TONE = { Prévu: "neutral", Reçu: "info", "À vérifier": "warn", Approuvé: "success", "À investiguer": "danger" } as const;

export const cellEntries = (st: StabilityFile, lot: string, condition: string, month: number) =>
  st.entries.filter((e) => e.lot === lot && e.condition === condition && e.month === month && st.specIds.includes(e.specId));

/** State of one lot × condition × time point, from the results of the analyses followed. */
export function cellState(st: StabilityFile, lot: string, condition: string, month: number): CellState {
  const entries = cellEntries(st, lot, condition, month);
  if (!entries.length) return "Prévu";
  if (entries.some((e) => e.status === "À investiguer")) return "À investiguer";
  if (entries.length < st.specIds.length) return "Reçu";
  return entries.every((e) => e.status === "Approuvé") ? "Approuvé" : "À vérifier";
}

export interface Cell {
  lot: string;
  condition: string;
  month: number;
  state: CellState;
  required: boolean;
}

export function cells(st: StabilityFile): Cell[] {
  return st.lots.flatMap((lot) => st.conditions.flatMap((condition) => st.points.map((pt) => ({ lot, condition, month: pt.month, required: pt.required, state: cellState(st, lot, condition, pt.month) }))));
}

export const planComplete = (st: StabilityFile) => Boolean(st.referential.trim() && st.lots.length && st.conditions.length && st.points.length && st.specIds.length);

/** Required time points that are not approved yet: only these block the dossier in preparation. */
export const missingRequired = (st: StabilityFile) => cells(st).filter((c) => c.required && c.state !== "Approuvé");
export const canConclude = (st: StabilityFile) => Boolean(st.approvedAt) && cells(st).some((c) => c.required) && missingRequired(st).length === 0;

export const evolutionKey = (specId: string, lot: string, condition: string) => `${specId}|${lot}|${condition}`;

export interface Evolution {
  key: string;
  specId: string;
  lot: string;
  condition: string;
  /** One value per planned time point, in order; undefined while there is no result. */
  series: { month: number; value?: string; status?: StabilityEntry["status"] }[];
  /** Change between the first and the last numeric result — a plain difference, not a trend model. */
  change?: number;
  note: string;
}

const numeric = (v?: string) => {
  const n = Number((v ?? "").trim().replace(",", "."));
  return v?.trim() && Number.isFinite(n) ? n : null;
};

/** How each followed analysis moves over time, per lot and condition, with the comment written on it. */
export function evolutions(st: StabilityFile): Evolution[] {
  return st.specIds.flatMap((specId) =>
    st.lots.flatMap((lot) =>
      st.conditions.map((condition) => {
        const series = st.points.map((pt) => {
          const e = st.entries.find((x) => x.specId === specId && x.lot === lot && x.condition === condition && x.month === pt.month);
          return { month: pt.month, value: e?.value, status: e?.status };
        });
        const values = series.map((x) => numeric(x.value)).filter((x): x is number => x !== null);
        const key = evolutionKey(specId, lot, condition);
        return { key, specId, lot, condition, series, change: values.length > 1 ? Number((values[values.length - 1] - values[0]).toFixed(3)) : undefined, note: st.evolutionNotes?.[key] ?? "" };
      }),
    ),
  );
}

/** Required time points approved out of those planned: the progress shown with the conclusion. */
export function requiredProgress(st: StabilityFile) {
  const required = cells(st).filter((c) => c.required);
  return { done: required.filter((c) => c.state === "Approuvé").length, total: required.length };
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

const find = (s: DemoState, code: string) => s.projects.find((p) => p.code === code && p.cadrage);
const labelOf = (p: Project) => `${p.code} • ${p.name}`;
const hrefOf = (p: Project) => `/projets/${p.slug}/stabilite`;
const patch = (s: DemoState, code: string, update: (st: StabilityFile, p: Project) => StabilityFile): DemoState => ({
  ...s,
  projects: s.projects.map((p) => (p.code === code && p.cadrage ? { ...p, stability: update(stabilityOf(p), p) } : p)),
});

export type PlanInput = Pick<StabilityFile, "referential" | "packaging" | "lots" | "conditions" | "points" | "specIds">;

export const stability = {
  /** Saving the plan withdraws its approval: conditions, lots, analyses and time points are approved together. */
  savePlan(s: DemoState, code: string, plan: PlanInput): DemoState {
    return patch(s, code, (st) => ({ ...st, ...plan, points: [...plan.points].sort((a, b) => a.month - b.month), approvedAt: undefined, approvedBy: undefined, conclusion: undefined }));
  },

  approvePlan(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    if (!p || !planComplete(stabilityOf(p))) return s;
    const st = stabilityOf(p);
    const next = patch(s, code, (x) => ({ ...x, approvedAt: stamp(), approvedBy: CURRENT_USER }));
    return sync(
      withEvent(next, {
        projectCode: code,
        title: "Plan de stabilité approuvé",
        context: labelOf(p),
        object: "Stabilité",
        objectLabel: `${labelOf(p)} • Stabilité`,
        type: "Approbation",
        description: `Référentiel : ${st.referential}. Lots : ${st.lots.join(", ")}. Conditions : ${st.conditions.join(" ; ")}. Échéances : ${st.points.map((x) => `${pointLabel(x.month)}${x.required ? " (requise)" : ""}`).join(", ")}.`,
        icon: "chart",
        href: hrefOf(p),
      }),
      code,
    );
  },

  /** Records the results of a cell: each one is checked against its approved specification. */
  saveCell(s: DemoState, code: string, cell: { lot: string; condition: string; month: number }, values: { specId: string; value: string; note: string }[]): DemoState {
    const p = find(s, code);
    if (!p || !stabilityOf(p).approvedAt) return s;
    const specs = qualityOf(p).specs;
    const at = stamp();
    let out = 0;
    const next = patch(s, code, (st) => {
      let entries = st.entries;
      for (const v of values) {
        const same = (e: StabilityEntry) => e.lot === cell.lot && e.condition === cell.condition && e.month === cell.month && e.specId === v.specId;
        const before = entries.find(same);
        if (!v.value.trim()) continue;
        if (before && before.value === v.value.trim() && before.note === v.note.trim()) continue;
        const verdict = checkResult(specs.find((x) => x.id === v.specId), v.value).verdict;
        if (verdict === "Hors limite") out++;
        const entry: StabilityEntry = { id: before?.id ?? uid("stab"), ...cell, specId: v.specId, value: v.value.trim(), note: v.note.trim(), status: verdict === "Hors limite" ? "À investiguer" : "Reçu", enteredAt: at };
        entries = before ? entries.map((e) => (same(e) ? entry : e)) : [...entries, entry];
      }
      return { ...st, entries, conclusion: undefined };
    });
    return withEvent(next, {
      projectCode: code,
      title: `Résultats de stabilité saisis — ${pointLabel(cell.month)}, ${cell.condition}`,
      context: labelOf(p),
      object: "Stabilité",
      objectLabel: `${labelOf(p)} • Lot ${cell.lot}`,
      type: "Ajout",
      description: out ? `${out} résultat(s) hors limite à investiguer. Les données sont conservées telles que saisies.` : "Résultats à vérifier puis approuver.",
      icon: out ? "alert" : "chart",
      href: hrefOf(p),
    });
  },

  /** Approves the results of a cell; one that was to investigate needs the outcome of the investigation. */
  approveCell(s: DemoState, code: string, cell: { lot: string; condition: string; month: number }, investigation: string): DemoState {
    const p = find(s, code);
    if (!p) return s;
    const st = stabilityOf(p);
    const entries = cellEntries(st, cell.lot, cell.condition, cell.month);
    if (entries.length < st.specIds.length) return s;
    if (entries.some((e) => e.status === "À investiguer") && !investigation.trim()) return s;
    const ids = new Set(entries.map((e) => e.id));
    const next = patch(s, code, (x) => ({
      ...x,
      entries: x.entries.map((e) => (ids.has(e.id) ? { ...e, status: "Approuvé", note: e.status === "À investiguer" ? `${e.note ? `${e.note} — ` : ""}Investigation : ${investigation.trim()}` : e.note } : e)),
    }));
    return sync(
      withEvent(next, {
        projectCode: code,
        title: `Résultats de stabilité approuvés — ${pointLabel(cell.month)}, ${cell.condition}`,
        context: labelOf(p),
        object: "Stabilité",
        objectLabel: `${labelOf(p)} • Lot ${cell.lot}`,
        type: "Approbation",
        description: investigation.trim() ? `Après investigation : ${investigation.trim()}` : undefined,
        icon: "check",
        href: hrefOf(p),
      }),
      code,
    );
  },

  /** The approved scientific conclusion — never deduced automatically from a trend or a projection. */
  /** Comment on the evolution of one analysis over time. */
  saveEvolutionNote(s: DemoState, code: string, key: string, note: string): DemoState {
    return patch(s, code, (st) => ({ ...st, evolutionNotes: { ...st.evolutionNotes, [key]: note.trim() } }));
  },

  /** Keeps the comment being written, without approving anything. */
  saveDraft(s: DemoState, code: string, text: string): DemoState {
    return patch(s, code, (st) => ({ ...st, conclusionDraft: text }));
  },

  /**
   * Approved at any time once the plan is approved. While required time points are missing, it is an
   * interim conclusion that records the progress; it is written again when the results are complete.
   */
  conclude(s: DemoState, code: string, text: string): DemoState {
    const p = find(s, code);
    if (!p || !stabilityOf(p).approvedAt || !text.trim()) return s;
    const before = stabilityOf(p);
    const { done, total } = requiredProgress(before);
    const partial = !canConclude(before);
    const next = patch(s, code, (st) => ({ ...st, conclusionDraft: text.trim(), conclusion: { text: text.trim(), at: stamp(), by: CURRENT_USER, partial: partial || undefined, progress: `${done} / ${total} échéances requises approuvées` } }));
    return sync(
      withEvent(next, {
        projectCode: code,
        title: partial ? "Conclusion intermédiaire de stabilité approuvée" : "Conclusion de stabilité approuvée",
        context: labelOf(p),
        object: "Stabilité",
        objectLabel: `${labelOf(p)} • Stabilité`,
        type: "Approbation",
        description: `${done} / ${total} échéances requises approuvées. ${text.trim()}`,
        icon: "check",
        href: hrefOf(p),
      }),
      code,
    );
  },
};
