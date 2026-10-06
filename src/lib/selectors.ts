import { DEFAULT_FILTERS } from "./catalog";
import type { DemoState } from "./data";
import { formatNumeric } from "./format";
import type {
  DocStatus,
  FormulaDecision,
  Labelled,
  LotStatus,
  OverviewFilters,
  Project,
  StageIcon,
  TestResult,
  TestStatus,
  Tone,
} from "./types";

/* ------------------------------------------------------------------ */
/* Status → tone mappings                                              */
/* ------------------------------------------------------------------ */

export const DOC_STATUS_TONE: Record<DocStatus, Tone> = {
  Brouillon: "neutral",
  Approuvé: "success",
  "À revoir": "warn",
  "En revue": "info",
};

export const LOT_STATUS_TONE: Record<LotStatus, Tone> = {
  Disponible: "success",
  "En cours": "warn",
  Planifié: "neutral",
};

export const TEST_STATUS_TONE: Record<TestStatus, Tone> = {
  Conforme: "success",
  "Non conforme": "danger",
  "En attente": "warn",
  "Non démarré": "neutral",
};

export const GLOBAL_STATUS_TONE: Record<Project["globalStatus"], Tone> = {
  "En cours": "success",
  "En attente": "warn",
  "En bonne voie": "success",
};

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export function findProject(s: DemoState, slug: string) {
  return s.projects.find((p) => p.slug === slug.toLowerCase());
}

export function blockingPrerequisites(s: DemoState, projectCode: string) {
  return s.prerequisites.filter((p) => p.projectCode === projectCode && p.blocking && p.status !== "Vérifié");
}

export type BadgeIcon = StageIcon | "warning";

/** Badge shown next to a project name: a blocking prerequisite overrides the stage. */
export function projectBadge(s: DemoState, p: Project): Labelled & { icon: BadgeIcon } {
  if (blockingPrerequisites(s, p.code).length > 0) {
    return { label: "Prérequis incomplets", tone: "warn", icon: "warning" };
  }
  return { label: p.stage.label, tone: "info", icon: p.stage.icon };
}

export function isFiltered(f: OverviewFilters) {
  return activeFilterChips(f).length > 0;
}

export function filterProjects(s: DemoState, projects: Project[], f: OverviewFilters) {
  return projects.filter((p) => {
    if (f.families.length && !f.families.includes(p.family)) return false;
    if (f.phases.length && !f.phases.includes(p.stage.label)) return false;
    if (f.owner !== "Tous" && p.owner !== f.owner) return false;
    if (f.status !== "Tous" && p.globalStatus !== f.status) return false;
    if (f.from && p.nextAction.date < f.from) return false;
    if (f.to && p.nextAction.date > f.to) return false;
    if (f.blockingOnly && blockingPrerequisites(s, p.code).length === 0) return false;
    return true;
  });
}

export interface FilterChip {
  key: string;
  label: string;
  remove: (f: OverviewFilters) => OverviewFilters;
}

export function activeFilterChips(f: OverviewFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  f.families.forEach((family) =>
    chips.push({
      key: `family-${family}`,
      label: `Famille : ${family}`,
      remove: (x) => ({ ...x, families: x.families.filter((v) => v !== family) }),
    }),
  );
  f.phases.forEach((phase) =>
    chips.push({
      key: `phase-${phase}`,
      label: `Phase : ${phase}`,
      remove: (x) => ({ ...x, phases: x.phases.filter((v) => v !== phase) }),
    }),
  );
  if (f.owner !== DEFAULT_FILTERS.owner)
    chips.push({ key: "owner", label: `Responsable : ${f.owner}`, remove: (x) => ({ ...x, owner: DEFAULT_FILTERS.owner }) });
  if (f.status !== DEFAULT_FILTERS.status)
    chips.push({ key: "status", label: `Statut : ${f.status}`, remove: (x) => ({ ...x, status: DEFAULT_FILTERS.status }) });
  if (f.from !== DEFAULT_FILTERS.from || f.to !== DEFAULT_FILTERS.to)
    chips.push({
      key: "dates",
      label: `Jalon : ${f.from ? formatNumeric(f.from) : "…"} → ${f.to ? formatNumeric(f.to) : "…"}`,
      remove: (x) => ({ ...x, from: DEFAULT_FILTERS.from, to: DEFAULT_FILTERS.to }),
    });
  if (f.blockingOnly)
    chips.push({ key: "blocking", label: "Uniquement les blocages", remove: (x) => ({ ...x, blockingOnly: false }) });
  return chips;
}

/* ------------------------------------------------------------------ */
/* Formulas & tests                                                    */
/* ------------------------------------------------------------------ */

export function projectFormulas(s: DemoState, projectCode: string) {
  return s.formulas.filter((f) => f.projectCode === projectCode && f.status !== "Archivée" && f.status !== "Référence");
}

/** Results of a formula, taken from its most recent tested lot. */
export function testsForFormula(s: DemoState, projectCode: string, formula: string): TestResult[] {
  const all = s.tests.filter((t) => t.projectCode === projectCode && t.formula === formula);
  if (!all.length) return [];
  const lotDates = new Map<string, string>();
  all.forEach((t) => {
    const lot = s.lots.find((l) => l.projectCode === projectCode && l.code === t.lotCode);
    lotDates.set(t.lotCode, lot?.createdAt ?? "0000");
  });
  const latestLot = [...lotDates.entries()].sort((a, b) => b[1].localeCompare(a[1]))[0][0];
  return all.filter((t) => t.lotCode === latestLot);
}

export function criteriaFor(s: DemoState, projectCode: string) {
  const seen: string[] = [];
  s.tests.filter((t) => t.projectCode === projectCode).forEach((t) => {
    if (!seen.includes(t.criterion)) seen.push(t.criterion);
  });
  return seen;
}

export function pendingTests(tests: TestResult[]) {
  return tests.filter((t) => t.status === "En attente" || t.status === "Non démarré");
}

/* ------------------------------------------------------------------ */
/* Formula decisions (one per formula)                                 */
/* ------------------------------------------------------------------ */

/** Decisions of a project, most recent first. */
export function projectDecisions(s: DemoState, projectCode: string) {
  return s.formulaDecisions.filter((d) => d.projectCode === projectCode).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function decisionFor(s: DemoState, projectCode: string, formula: string) {
  return s.formulaDecisions.find((d) => d.projectCode === projectCode && d.formula === formula);
}

/** Decision the circuit works on: the given formula, else the most recent one of the project. */
export function currentDecision(s: DemoState, projectCode: string, formula?: string) {
  return formula ? decisionFor(s, projectCode, formula) : projectDecisions(s, projectCode)[0];
}

/** Approved decision that retains a formula (it opens the pilot lot), if any. */
export function retainedDecision(s: DemoState, projectCode: string) {
  return s.formulaDecisions.find((d) => d.projectCode === projectCode && d.status === "Approuvée" && d.choice === "retenir");
}

/**
 * A decision under examination, or approved with « retenir », can no longer be edited.
 * Once « poursuivre » or « revoir » is approved, a new decision can be prepared on the same formula.
 */
export function decisionLocked(d?: FormulaDecision) {
  return Boolean(d && (d.status === "Soumise" || (d.status === "Approuvée" && d.choice === "retenir")));
}

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */

export type SearchKind = "Projet" | "Lot" | "Document" | "Essai";

export interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  status: Labelled;
  tags: string[];
  href: string;
  projectCode: string;
  details: { label: string; value: string }[];
}

const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function search(s: DemoState, query: string): SearchResult[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const match = (...fields: (string | undefined)[]) => fields.some((f) => f && normalize(f).includes(q));
  const results: SearchResult[] = [];
  const projectOf = (code: string) => s.projects.find((p) => p.code === code);

  s.projects.forEach((p) => {
    if (!match(p.code, p.name, p.description, p.form, p.dci)) return;
    results.push({
      id: `p-${p.code}`,
      kind: "Projet",
      title: `${p.code} • ${p.name}`,
      subtitle: p.description,
      status: p.archived ? { label: "Archivé", tone: "neutral" } : { label: "Actif", tone: "success" },
      tags: [p.code, p.formLabel],
      href: `/projets/${p.slug}`,
      projectCode: p.code,
      details: [
        { label: "Forme pharmaceutique", value: p.form },
        { label: "Dosage", value: p.dosage },
        { label: "Phase actuelle", value: p.phase },
        { label: "Chef de projet", value: p.owner },
      ],
    });
  });

  s.lots.forEach((l) => {
    const p = projectOf(l.projectCode);
    if (!match(l.code, l.projectCode, l.formula, l.comment)) return;
    results.push({
      id: `l-${l.id}`,
      kind: "Lot",
      title: `${l.code} • Lot ${l.type === "Essai" ? "d'essai" : l.type === "Pilote" ? "pilote" : "échantillon"} (${l.formula})`,
      subtitle: l.comment,
      status: { label: l.status, tone: LOT_STATUS_TONE[l.status] },
      tags: [l.projectCode, p?.form ?? "", l.formula],
      href: `/projets/${l.projectCode.toLowerCase()}/formules/lots?lot=${l.code}`,
      projectCode: l.projectCode,
      details: [
        { label: "Projet", value: p ? `${p.code} • ${p.name}` : l.projectCode },
        { label: "Formule", value: l.formula },
        { label: "Quantité", value: `${l.quantity} ${l.unit}` },
        { label: "Responsable", value: l.owner },
      ],
    });
  });

  s.documents.forEach((d) => {
    const p = projectOf(d.projectCode);
    if (!match(d.name, d.type, d.projectCode, d.lot, d.formula, d.method)) return;
    results.push({
      id: `d-${d.id}`,
      kind: "Document",
      title: `${d.name} v${d.version}`,
      subtitle: `${d.type}${d.lot ? ` — lot ${d.lot}` : ""}`,
      status: { label: d.status, tone: DOC_STATUS_TONE[d.status] },
      tags: [d.projectCode, ...(d.lot ? [d.lot] : []), p?.form ?? ""],
      href: `/projets/${d.projectCode.toLowerCase()}/documents?doc=${d.id}`,
      projectCode: d.projectCode,
      details: [],
    });
  });

  s.tests
    .filter((t) => t.lotCode !== "REF")
    .forEach((t) => {
      const p = projectOf(t.projectCode);
      if (!match(t.criterion, t.lotCode, t.projectCode, t.method)) return;
      results.push({
        id: `t-${t.id}`,
        kind: "Essai",
        title: `${t.criterion} • ${t.lotCode}`,
        subtitle: `Essai de ${t.criterion.toLowerCase()} sur le lot ${t.lotCode} (${t.formula})`,
        status:
          t.status === "Conforme" || t.status === "Non conforme"
            ? { label: "Résultats disponibles", tone: "success" }
            : { label: t.status, tone: TEST_STATUS_TONE[t.status] },
        tags: [t.projectCode, t.lotCode, p?.form ?? ""],
        href: `/projets/${t.projectCode.toLowerCase()}/essais`,
        projectCode: t.projectCode,
        details: [
          { label: "Projet", value: p ? `${p.code} • ${p.name}` : t.projectCode },
          { label: "Lot", value: `${t.lotCode} (${t.formula})` },
          { label: "Méthode", value: t.method ?? "Contrôle visuel" },
          { label: "Résultat", value: t.result ?? "—" },
          { label: "Statut", value: t.status },
        ],
      });
    });

  return results;
}
