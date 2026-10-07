/**
 * Étape 3 — Aide à la formulation et boucle expérimentale (gate G3).
 *
 * The system proposes a limited number of options with their reasoning and uncertainties; quantities
 * are experimental parameters to approve, never facts read from a leaflet. Trials are compared with
 * the target only when unit and method are compatible. Earlier versions and their results stay.
 */
import { CURRENT_USER } from "./catalog";
import { sync } from "./cadrage";
import type { DemoState } from "./data";
import { excipientFunction } from "./princeps-defs";
import { nextNumber, pad2, stamp, uid, withEvent } from "./state-utils";
import type { FormComponent, FormTrial, FormulaOption, Formulation, OptionStatus, Project, TargetCriterion, TrialResult } from "./types";

export const OPTION_TONE = { Proposée: "neutral", "À tester": "info", Écartée: "neutral", Retenue: "success" } as const;

const EMPTY: Formulation = { options: [], criteria: [], trials: [] };
export const formulationOf = (p: Project): Formulation => p.formulation ?? EMPTY;

/** Latest version of each option letter. */
export function currentOptions(f: Formulation): FormulaOption[] {
  const byCode = new Map<string, FormulaOption>();
  for (const o of f.options) if (!byCode.has(o.code) || byCode.get(o.code)!.version < o.version) byCode.set(o.code, o);
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}
export const earlierVersions = (f: Formulation, o: FormulaOption) => f.options.filter((x) => x.code === o.code && x.version < o.version).sort((a, b) => b.version - a.version);
export const optionLabel = (o: FormulaOption) => `Piste ${o.code} v${o.version}`;

export interface OptionChange {
  label: string;
  before: string;
  after: string;
}

/** What differs between two versions of an option: text fields, then each component added, removed or changed. */
export function optionChanges(before: FormulaOption, after: FormulaOption): OptionChange[] {
  const changes: OptionChange[] = [];
  const text: [string, keyof FormulaOption][] = [["Intitulé", "title"], ["Procédé", "process"], ["Raisonnement", "rationale"], ["Incertitudes", "uncertainties"], ["Risques", "risks"]];
  for (const [label, key] of text) if (String(before[key]).trim() !== String(after[key]).trim()) changes.push({ label, before: String(before[key]), after: String(after[key]) });
  const show = (c?: FormComponent) => (c ? `${c.qty.trim() ? `${c.qty} ${c.unit}`.trim() : "quantité à définir"} · ${c.role || "fonction à préciser"}` : "");
  const key = (c: FormComponent) => c.name.trim().toLowerCase();
  for (const c of before.components) {
    const now = after.components.find((x) => key(x) === key(c));
    if (!now) changes.push({ label: c.name, before: show(c), after: "Retiré" });
    else if (show(now) !== show(c)) changes.push({ label: c.name, before: show(c), after: show(now) });
  }
  for (const c of after.components) if (!before.components.some((x) => key(x) === key(c))) changes.push({ label: c.name, before: "Absent", after: show(c) });
  return changes;
}

/* ------------------------------------------------------------------ */
/* System proposals                                                    */
/* ------------------------------------------------------------------ */

interface Template {
  title: string;
  process: string;
  rationale: string;
  uncertainties: string;
  risks: string;
}

function templates(p: Project): Template[] {
  if (p.family === "Liquide") {
    return [
      { title: "Procédé à froid", process: "Mise en solution ou en suspension à température ambiante, ajustement du pH, filtration ou homogénéisation, répartition.", rationale: "Procédé le plus simple ; à retenir si les composants se dispersent ou se dissolvent sans chauffage.", uncertainties: "Solubilité du principe actif et proportions des excipients non documentées.", risks: "Dissolution ou dispersion incomplète ; stabilité physique à vérifier." },
      { title: "Prémélange concentré du principe actif", process: "Dissolution ou dispersion du principe actif dans une fraction du véhicule, incorporation au reste de la préparation, ajustement du pH et du volume, répartition.", rationale: "Facilite l'incorporation homogène d'un principe actif peu soluble ou faiblement dosé.", uncertainties: "Solubilité dans la fraction de véhicule non mesurée.", risks: "Précipitation à la dilution ; homogénéité à vérifier." },
      { title: "Mise en solution avec cosolvant", process: "Dissolution du principe actif dans un cosolvant, ajout progressif à la phase aqueuse, ajustement du pH, filtration, répartition.", rationale: "Alternative si la solubilité aqueuse seule est insuffisante.", uncertainties: "Nature et proportion du cosolvant du princeps non documentées.", risks: "Précipitation ; acceptabilité du cosolvant pour la population visée à confirmer." },
      { title: "Préparation sous atmosphère inerte", process: "Préparation à froid sous azote, ajout d'un antioxydant si justifié, répartition protégée de l'air.", rationale: "À envisager si le principe actif est sensible à l'oxydation.", uncertainties: "Sensibilité à l'oxydation non documentée.", risks: "Contrainte d'équipement ; oxygène résiduel à maîtriser." },
      { title: "Procédé avec étape de chauffage", process: "Préparation d'une phase chauffée, incorporation du principe actif, refroidissement contrôlé, ajustement du pH, répartition.", rationale: "Alternative si un composant exige un chauffage pour se dissoudre ou s'hydrater.", uncertainties: "Sensibilité du principe actif à la chaleur non documentée.", risks: "Dégradation thermique ; étape supplémentaire à maîtriser." },
    ];
  }
  if (p.family === "Semi-solide") {
    return [
      { title: "Émulsification à chaud", process: "Préparation des phases grasse et aqueuse à chaud, émulsification, refroidissement sous agitation, incorporation du principe actif, conditionnement.", rationale: "Procédé classique des crèmes ; texture ajustable par l'agitation et la vitesse de refroidissement.", uncertainties: "Proportions des phases et nature de l'émulsion du princeps non documentées.", risks: "Viscosité et taille des globules sensibles aux paramètres du procédé." },
      { title: "Incorporation en fin de refroidissement", process: "Préparation de la base à chaud, refroidissement, incorporation du principe actif à tiède sous agitation, conditionnement.", rationale: "Limite l'exposition du principe actif à la chaleur.", uncertainties: "Température d'incorporation acceptable non déterminée.", risks: "Homogénéité de la répartition du principe actif." },
      { title: "Fusion et mélange (base anhydre)", process: "Fusion des excipients gras, dispersion du principe actif, refroidissement sous agitation, conditionnement.", rationale: "Adapté à une base de type pommade, sans phase aqueuse.", uncertainties: "Nature de la base du princeps à confirmer.", risks: "Sédimentation pendant le refroidissement ; granulométrie du principe actif." },
      { title: "Émulsification par inversion de phase", process: "Ajout progressif de la phase aqueuse dans la phase grasse jusqu'à inversion, refroidissement, incorporation du principe actif, conditionnement.", rationale: "Peut donner une émulsion plus fine avec moins d'énergie.", uncertainties: "Comportement du système émulsionnant non étudié.", risks: "Point d'inversion sensible à la température et à la composition." },
      { title: "Dispersion à froid", process: "Dispersion du gélifiant, hydratation, incorporation du principe actif à température ambiante, conditionnement.", rationale: "Alternative sans chauffage si la base du princeps le permet.", uncertainties: "Compatibilité de la base avec le principe actif à confirmer.", risks: "Homogénéité de la dispersion ; bulles d'air." },
    ];
  }
  const fill = p.form === "Gélule" ? "mise en gélule" : p.form === "Poudre orale" ? "répartition en sachets" : "compression";
  return [
    { title: p.form === "Comprimé" ? "Compression directe" : "Mélange simple", process: `Tamisage, mélange des poudres, lubrification, ${fill}.`, rationale: "Procédé le plus simple ; à retenir si l'écoulement et l'homogénéité du mélange le permettent.", uncertainties: "Proportions des excipients inconnues ; écoulement et granulométrie du principe actif non mesurés.", risks: "Ségrégation et uniformité de teneur, surtout si le principe actif est faiblement dosé." },
    { title: "Granulation humide", process: `Mélange, granulation humide, séchage, calibrage, lubrification, ${fill}.`, rationale: "Alternative si l'écoulement ou la compressibilité du mélange simple sont insuffisants.", uncertainties: "Sensibilité du principe actif à l'humidité et à la chaleur non documentée.", risks: "Étapes supplémentaires ; impact possible sur la dissolution à vérifier." },
    { title: "Granulation sèche (compactage)", process: `Mélange, compactage, broyage et calibrage, lubrification, ${fill}.`, rationale: "Améliore l'écoulement sans eau ni chaleur ; à envisager si le principe actif y est sensible.", uncertainties: "Compressibilité du mélange non mesurée.", risks: "Fines et perte de compressibilité après compactage ; dissolution à vérifier." },
    { title: "Prémélange géométrique du principe actif", process: `Prémélange du principe actif avec une fraction du diluant par dilutions successives, mélange final, lubrification, ${fill}.`, rationale: "Vise l'uniformité de teneur quand le principe actif est faiblement dosé.", uncertainties: "Granulométrie du principe actif non mesurée.", risks: "Ségrégation au transfert ; temps de mélange à définir." },
    { title: "Granulation en lit d'air fluidisé", process: `Mélange, granulation et séchage en lit d'air fluidisé, calibrage, lubrification, ${fill}.`, rationale: "Granulation et séchage dans le même équipement ; grains plus poreux.", uncertainties: "Disponibilité de l'équipement et sensibilité à la chaleur à confirmer.", risks: "Paramètres de pulvérisation à maîtriser ; impact sur la dissolution." },
  ];
}

/** Candidate composition: the active substance at the reference dosage, the declared excipients with a possible function, no quantity. */
function candidateComponents(p: Project): FormComponent[] {
  const variant = p.cadrage?.variants.find((v) => v.reference) ?? p.cadrage?.variants[0];
  const excipients = (p.cadrage?.data.find((d) => d.key === "excipients")?.value ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  return [
    { name: p.dci || "Principe actif", role: "Principe actif", qty: variant?.dosage ?? "", unit: variant?.unit ?? "mg" },
    ...excipients.map((name) => ({ name, role: excipientFunction(name) ?? "Excipient — fonction à préciser", qty: "", unit: "mg" })),
  ];
}

/** Usual use level of an excipient function, in % of the unit mass — a starting point, never a fact about the reference product. */
const USE_LEVELS: [RegExp, number][] = [
  [/lubrifiant/i, 1],
  [/écoulement/i, 1],
  [/liant \/ désintégrant/i, 5],
  [/^désintégrant$/i, 4],
  [/^liant$/i, 3],
  [/pelliculage/i, 3],
  [/conservateur/i, 0.2],
  [/aromatisant/i, 0.5],
  [/suspension/i, 0.5],
];
const NOTE_QTY = "Quantités de départ proposées (cas enregistrés ou taux d'emploi usuels) : paramètres expérimentaux à ajuster et à approuver.";
const round = (n: number) => String(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10).replace(".", ",");

/**
 * Fills the empty quantities of a suggested composition: the quantity recorded for the same
 * excipient in another option when there is one, otherwise a usual use level, the diluents sharing
 * what is left of an assumed unit mass.
 */
function withStartingQuantities(s: DemoState, p: Project, components: FormComponent[]): FormComponent[] {
  const dose = num(components[0]?.qty ?? "");
  if (p.family !== "Sèche" || dose === null || dose <= 0) return components;
  const recorded = new Map<string, FormComponent>();
  for (const other of s.projects) for (const o of formulationOf(other).options) for (const c of o.components) if (c.qty.trim() && c.role !== "Principe actif") recorded.set(c.name.trim().toLowerCase(), c);
  // Assumed unit mass: the lower the dose, the larger the share of excipients.
  const total = dose >= 250 ? dose / 0.75 : dose >= 50 ? dose / 0.5 : Math.max(100, dose / 0.2);
  const filled = components.map((c, i) => {
    if (i === 0 || c.qty.trim()) return c;
    const known = recorded.get(c.name.trim().toLowerCase());
    if (known) return { ...c, qty: known.qty, unit: known.unit };
    if (/enveloppe/i.test(c.role)) return { ...c, qty: "1", unit: "unité" };
    const level = USE_LEVELS.find(([re]) => re.test(c.role))?.[1];
    return level === undefined ? c : { ...c, qty: round((total * level) / 100), unit: "mg" };
  });
  const rest = filled.filter((c, i) => i > 0 && !c.qty.trim());
  const used = filled.reduce((sum, c) => sum + (c.unit === "mg" ? (num(c.qty) ?? 0) : 0), 0);
  const share = Math.max(total * 0.05, (total - used) / Math.max(1, rest.length));
  return filled.map((c, i) => (i > 0 && !c.qty.trim() ? { ...c, qty: round(share), unit: "mg" } : c));
}

export interface OptionSuggestion {
  input: OptionInput;
  kind: "Cas enregistré" | "Procédé type";
  /** Where the suggestion comes from, and what it is worth. */
  basis: string;
}

/**
 * Three suggestions for a new option: first the cases recorded in the projects of the same dosage
 * family (retained at G3, then tested), completed with standard processes not yet explored here.
 */
export function suggestOptions(s: DemoState, p: Project, count = 3): OptionSuggestion[] {
  const taken = new Set(formulationOf(p).options.map((o) => o.title.trim().toLowerCase()));
  const base = candidateComponents(p);
  const cases: (OptionSuggestion & { rank: number })[] = [];
  for (const other of s.projects) {
    if (other.code === p.code || !other.cadrage || other.family !== p.family) continue;
    const f = formulationOf(other);
    for (const o of currentOptions(f)) {
      if (taken.has(o.title.trim().toLowerCase()) || o.status === "Écartée") continue;
      const verified = f.trials.filter((t) => t.optionId === o.id && t.verified).length;
      const retained = f.decision?.optionId === o.id;
      // The excipients of the recorded case, around the active substance of this project.
      const excipients = o.components.filter((c) => c.role !== "Principe actif").map((c) => ({ ...c }));
      cases.push({
        rank: retained ? 0 : verified ? 1 : 2,
        kind: "Cas enregistré",
        basis: `${other.code} • ${other.name} — ${optionLabel(o)}${retained ? ", retenue en G3" : ""}${verified ? `, ${verified} essai(s) vérifié(s)` : ", sans essai vérifié"}`,
        input: {
          title: o.title,
          process: o.process,
          components: withStartingQuantities(s, p, [base[0], ...excipients]),
          rationale: `Repris du cas ${other.code} (${optionLabel(o)}). ${o.rationale}`.trim(),
          uncertainties: `Composition et quantités issues d'un autre produit : à vérifier pour ce principe actif. ${o.uncertainties}`.trim(),
          risks: o.risks,
        },
      });
    }
  }
  cases.sort((a, b) => a.rank - b.rank);
  const out: OptionSuggestion[] = [];
  const has = (title: string) => out.some((x) => x.input.title.trim().toLowerCase() === title.trim().toLowerCase());
  for (const c of cases) {
    if (out.length < count && !has(c.input.title)) out.push({ input: c.input, kind: c.kind, basis: c.basis });
  }
  for (const t of templates(p)) {
    if (out.length >= count) break;
    if (taken.has(t.title.trim().toLowerCase()) || has(t.title)) continue;
    out.push({ kind: "Procédé type", basis: `Procédé usuel pour une forme ${p.family.toLowerCase()} — proposition du système, faute de cas enregistré équivalent`, input: { ...t, uncertainties: `${t.uncertainties} ${NOTE_QTY}`, components: withStartingQuantities(s, p, base.map((c) => ({ ...c }))) } });
  }
  return out;
}

const DEFAULT_CRITERIA: Record<Project["family"], [string, string][]> = {
  Sèche: [["Dissolution", "%"], ["Dosage", "%"], ["Désagrégation", "min"], ["Uniformité de masse", "%"]],
  Liquide: [["pH", ""], ["Dosage", "%"], ["Densité", "g/mL"]],
  "Semi-solide": [["pH", ""], ["Viscosité", "mPa·s"], ["Dosage", "%"]],
};

/* ------------------------------------------------------------------ */
/* Comparison                                                          */
/* ------------------------------------------------------------------ */

const num = (v: string) => {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
};
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface Comparison {
  state: "absent" | "sans-reference" | "non-comparable" | "comparable";
  text: string;
  /** Numeric gap to the reference, when both values are numbers measured the same way. */
  gap?: number;
}

/** Deterministic comparison of a result with the target: only compatible data are compared. */
export function compare(c: TargetCriterion, r?: TrialResult): Comparison {
  if (!r?.value.trim()) return { state: "absent", text: "Donnée absente" };
  if (!c.reference.trim()) return { state: "sans-reference", text: "Pas de valeur de référence : comparaison non concluante" };
  if (!same(c.unit, r.unit)) return { state: "non-comparable", text: `Non comparable — unité différente (${r.unit || "sans unité"} / ${c.unit || "sans unité"})` };
  if (!same(c.method, r.method)) return { state: "non-comparable", text: "Non comparable — méthode ou conditions différentes" };
  const a = num(r.value);
  const b = num(c.reference);
  if (a === null || b === null) return { state: "comparable", text: "Mêmes unité et méthode — à interpréter" };
  const delta = a - b;
  const pct = b !== 0 ? ` (${delta >= 0 ? "+" : ""}${((delta / b) * 100).toFixed(1).replace(".", ",")} %)` : "";
  return { state: "comparable", gap: delta, text: `Écart ${delta >= 0 ? "+" : ""}${String(Number(delta.toFixed(3))).replace(".", ",")} ${c.unit}${pct}` };
}

/**
 * Trial closest to the reference product: the one with the smallest gap on the largest number of
 * criteria. Null with a single trial, without comparable values, or when two trials are level.
 */
export function closestTrial(criteria: TargetCriterion[], trials: FormTrial[]): string | null {
  if (trials.length < 2) return null;
  const wins = new Map<string, number>();
  for (const c of criteria) {
    const gaps = trials.map((t) => ({ id: t.id, gap: compare(c, t.results.find((r) => r.criterionId === c.id)).gap })).filter((x): x is { id: string; gap: number } => x.gap !== undefined);
    if (!gaps.length) continue;
    const best = Math.min(...gaps.map((x) => Math.abs(x.gap)));
    gaps.filter((x) => Math.abs(x.gap) === best).forEach((x) => wins.set(x.id, (wins.get(x.id) ?? 0) + 1));
  }
  const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
}

/** G3 opens once a version of the reference product sheet is validated and the option has a verified trial. */
export function canRetain(p: Project, optionId: string) {
  return Boolean(p.princeps?.versions.length) && formulationOf(p).trials.some((t) => t.optionId === optionId && t.verified);
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

const find = (s: DemoState, code: string) => s.projects.find((p) => p.code === code && p.cadrage);
const labelOf = (p: Project) => `${p.code} • ${p.name}`;
const hrefOf = (p: Project) => `/projets/${p.slug}/formulation`;
const patch = (s: DemoState, code: string, update: (f: Formulation, p: Project) => Formulation): DemoState => ({
  ...s,
  projects: s.projects.map((p) => (p.code === code && p.cadrage ? { ...p, formulation: update(formulationOf(p), p) } : p)),
});
const nextCode = (f: Formulation) => String.fromCharCode(65 + new Set(f.options.map((o) => o.code)).size);

export type OptionInput = Pick<FormulaOption, "title" | "process" | "components" | "rationale" | "uncertainties" | "risks">;

export const formulation = {
  /** A limited number of relevant options and the default target criteria — proposals to review. */
  propose(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    if (!p || formulationOf(p).options.some((o) => o.origin === "Proposition du système")) return s;
    const at = stamp();
    let next = patch(s, code, (f) => {
      const options = [...f.options];
      for (const t of templates(p).slice(0, 2)) {
        options.push({ ...t, id: uid("opt"), code: nextCode({ ...f, options }), version: 1, components: candidateComponents(p), origin: "Proposition du système", status: "Proposée", createdAt: at, by: "Système" });
      }
      const criteria = f.criteria.length ? f.criteria : DEFAULT_CRITERIA[p.family].map(([label, unit]) => ({ id: uid("crit"), label, unit, method: "", reference: "", referenceSource: "" }));
      return { ...f, options, criteria };
    });
    next = withEvent(next, {
      projectCode: code,
      title: "Pistes de formulation proposées par le système",
      context: labelOf(p),
      object: "Formule",
      objectLabel: `${labelOf(p)} • Formulation`,
      type: "Ajout",
      description: "Deux pistes candidates avec raisonnement, incertitudes et risques. Les quantités sont des paramètres expérimentaux à définir, pas des faits du princeps.",
      icon: "flask",
      href: hrefOf(p),
    });
    return sync(next, code);
  },

  addOption(s: DemoState, code: string, input: OptionInput): DemoState {
    const p = find(s, code);
    if (!p || !input.title.trim()) return s;
    const next = patch(s, code, (f) => ({ ...f, options: [...f.options, { ...input, id: uid("opt"), code: nextCode(f), version: 1, origin: "Saisie", status: "Proposée", createdAt: stamp(), by: CURRENT_USER }] }));
    return sync(withEvent(next, { projectCode: code, title: `Piste de formulation ajoutée — ${input.title.trim()}`, context: labelOf(p), object: "Formule", objectLabel: `${labelOf(p)} • Formulation`, type: "Création", icon: "flask", href: hrefOf(p) }), code);
  },

  /** A justified adjustment creates a new version; the previous one, its results and decisions stay. */
  newVersion(s: DemoState, code: string, optionId: string, input: OptionInput, reason: string): DemoState {
    const p = find(s, code);
    const before = p && formulationOf(p).options.find((o) => o.id === optionId);
    if (!p || !before || !reason.trim()) return s;
    const version = Math.max(...formulationOf(p).options.filter((o) => o.code === before.code).map((o) => o.version)) + 1;
    const next = patch(s, code, (f) => ({
      ...f,
      options: [...f.options, { ...input, id: uid("opt"), code: before.code, version, origin: "Saisie", status: before.status === "Retenue" ? "À tester" : before.status, changeReason: reason.trim(), createdAt: stamp(), by: CURRENT_USER }],
      // A change of composition re-opens the selection: the retained formula has to be decided again.
      decision: f.decision?.optionId === optionId ? undefined : f.decision,
    }));
    return sync(
      withEvent(next, {
        projectCode: code,
        title: `Piste ${before.code} — nouvelle version v${version}`,
        context: labelOf(p),
        object: "Formule",
        objectLabel: `${labelOf(p)} • Piste ${before.code}`,
        type: "Modification",
        field: "Version",
        oldValue: `v${before.version}`,
        newValue: `v${version}`,
        motif: reason.trim(),
        description: "La version précédente et ses résultats restent accessibles. Impact à examiner : contrôles, stabilité, bioéquivalence et dossier.",
        icon: "flask",
        href: hrefOf(p),
      }),
      code,
    );
  },

  setStatus(s: DemoState, code: string, optionId: string, status: OptionStatus): DemoState {
    return patch(s, code, (f) => ({ ...f, options: f.options.map((o) => (o.id === optionId ? { ...o, status } : o)) }));
  },

  saveCriterion(s: DemoState, code: string, input: Omit<TargetCriterion, "id"> & { id?: string }): DemoState {
    if (!input.label.trim()) return s;
    return patch(s, code, (f) => ({
      ...f,
      criteria: input.id ? f.criteria.map((c) => (c.id === input.id ? { ...c, ...input, id: c.id } : c)) : [...f.criteria, { ...input, id: uid("crit") }],
    }));
  },
  removeCriterion(s: DemoState, code: string, id: string): DemoState {
    return patch(s, code, (f) => ({ ...f, criteria: f.criteria.filter((c) => c.id !== id) }));
  },

  addTrial(s: DemoState, code: string, input: { optionId: string; lot: string; date: string }): DemoState {
    const p = find(s, code);
    const option = p && formulationOf(p).options.find((o) => o.id === input.optionId);
    if (!p || !option) return s;
    const trialCode = `E-${pad2(nextNumber(formulationOf(p).trials.map((t) => t.code), /^E-(\d+)$/))}`;
    const next = patch(s, code, (f) => ({
      ...f,
      options: f.options.map((o) => (o.id === option.id && o.status === "Proposée" ? { ...o, status: "À tester" } : o)),
      trials: [...f.trials, { id: uid("trial"), code: trialCode, optionId: option.id, lot: input.lot.trim(), date: input.date, results: [], note: "", verified: false }],
    }));
    return withEvent(next, { projectCode: code, title: `Essai ${trialCode} planifié — ${optionLabel(option)}`, context: labelOf(p), object: "Essai", objectLabel: `${labelOf(p)} • ${trialCode}`, type: "Création", description: `Lot ${input.lot.trim() || "à définir"} — ${option.title}.`, icon: "flask", href: hrefOf(p) });
  },

  /** Entering or changing results always sends the trial back to verification. */
  saveResults(s: DemoState, code: string, trialId: string, results: TrialResult[], note: string): DemoState {
    return patch(s, code, (f) => ({ ...f, trials: f.trials.map((t) => (t.id === trialId ? { ...t, results, note: note.trim(), verified: false, verifiedBy: undefined, verifiedAt: undefined } : t)) }));
  },

  verifyTrial(s: DemoState, code: string, trialId: string): DemoState {
    const p = find(s, code);
    const trial = p && formulationOf(p).trials.find((t) => t.id === trialId);
    if (!p || !trial || !trial.results.some((r) => r.value.trim())) return s;
    const next = patch(s, code, (f) => ({ ...f, trials: f.trials.map((t) => (t.id === trialId ? { ...t, verified: true, verifiedBy: CURRENT_USER, verifiedAt: stamp() } : t)) }));
    return withEvent(next, { projectCode: code, title: `Résultats de l'essai ${trial.code} vérifiés`, context: labelOf(p), object: "Essai", objectLabel: `${labelOf(p)} • ${trial.code}`, type: "Approbation", description: "Données critiques et rattachement essai / lot / formule vérifiés : l'essai entre dans la comparaison.", icon: "check", href: hrefOf(p) });
  },

  removeTrial(s: DemoState, code: string, trialId: string): DemoState {
    return patch(s, code, (f) => ({ ...f, trials: f.trials.filter((t) => t.id !== trialId || t.verified) }));
  },

  /** Gate G3: the retained formula / process, with its justification; the other options stay as studied alternatives. */
  decide(s: DemoState, code: string, optionId: string, justification: string): DemoState {
    const p = find(s, code);
    const option = p && formulationOf(p).options.find((o) => o.id === optionId);
    if (!p || !option || !canRetain(p, optionId) || !justification.trim()) return s;
    const next = patch(s, code, (f) => ({
      ...f,
      options: f.options.map((o) => (o.id === optionId ? { ...o, status: "Retenue" } : o.status === "Retenue" ? { ...o, status: "À tester" } : o)),
      decision: { optionId, justification: justification.trim(), decidedAt: stamp(), decidedBy: CURRENT_USER },
    }));
    return sync(
      withEvent(next, {
        projectCode: code,
        title: `Porte G3 — ${optionLabel(option)} retenue`,
        context: labelOf(p),
        object: "Décision",
        objectLabel: `${labelOf(p)} • G3 — Sélection`,
        type: "Approbation",
        field: "Formule / procédé retenus",
        oldValue: p.formulation?.decision ? "Décision précédente" : "Attendue",
        newValue: `${optionLabel(option)} — ${option.title}`,
        motif: justification.trim(),
        icon: "check",
        href: hrefOf(p),
      }),
      code,
    );
  },
};

export type { FormTrial };
