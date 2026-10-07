/**
 * Étape 2 — Compréhension du princeps (gate G2).
 *
 * The reference product sheet gathers the identity read at the cadrage and the characteristics to
 * reproduce or master. Each value says what it is — sourced fact, measurement, assumption or system
 * proposal — and what is unknown stays unknown until a proof or a trial lifts it.
 */
import { CURRENT_USER } from "./catalog";
import { allData, isVerified, sync } from "./cadrage";
import type { DemoState } from "./data";
import { CADRAGE_GROUP, PRINCEPS_GROUPS, blankPrincepsData, proposeExcipientFunctions, type PrincepsGroup } from "./princeps-defs";
import { stamp, uid, withEvent } from "./state-utils";
import type { CadrageDatum, DataNature, Project } from "./types";

export { PRINCEPS_GROUPS };

export const NATURES: { value: DataNature; label: string; detail: string }[] = [
  { value: "Fait sourcé", label: "Fait présent dans une source", detail: "Écrit explicitement dans un document du projet." },
  { value: "Résultat mesuré", label: "Résultat mesuré sur le princeps", detail: "Obtenu au laboratoire sur un lot du princeps." },
  { value: "Hypothèse", label: "Hypothèse de développement", detail: "Supposition de travail : reste provisoire jusqu'à preuve." },
  { value: "Proposition IA", label: "Proposition du système", detail: "Suggestion automatique : à accepter comme hypothèse ou à remplacer." },
];

export const NATURE_TONE = { "Fait sourcé": "success", "Résultat mesuré": "success", Hypothèse: "warn", "Proposition IA": "info" } as const;

/** Nature shown for a value: the identity read at the cadrage is a sourced fact once it has a document. */
export function natureOf(d: CadrageDatum): DataNature | undefined {
  if (!d.value) return undefined;
  return d.nature ?? (d.source ? "Fait sourcé" : undefined);
}

export const groupOf = (d: CadrageDatum): PrincepsGroup => (d.group as PrincepsGroup | undefined) ?? CADRAGE_GROUP[d.key] ?? "Identité";

/** Assumptions and system proposals are never counted as established, even once a person accepted them. */
export const isProvisional = (d: CadrageDatum) => d.nature === "Hypothèse" || d.nature === "Proposition IA";
export const isEstablished = (d: CadrageDatum) => isVerified(d) && !isProvisional(d);
export const isToVerify = (d: CadrageDatum) => d.status === "Extraite à confirmer" || (isVerified(d) && isProvisional(d));
export const isGap = (d: CadrageDatum) => d.status === "Non documentée" || d.status === "Contradictoire";

export interface SheetStats {
  total: number;
  established: number;
  toVerify: number;
  missing: number;
  conflicting: number;
}

export function sheetStats(p: Project): SheetStats {
  const data = allData(p);
  return {
    total: data.length,
    established: data.filter(isEstablished).length,
    toVerify: data.filter(isToVerify).length,
    missing: data.filter((d) => d.status === "Non documentée").length,
    conflicting: data.filter((d) => d.status === "Contradictoire").length,
  };
}

/** Fingerprint of the sheet: a validated version is to re-evaluate when it no longer matches. */
export const sheetSignature = (p: Project) => JSON.stringify(allData(p).map((d) => [d.key, d.value, d.status, d.nature ?? ""]));

/** Characteristics that keep a validation partial: unknown, contradictory, to confirm or assumed. */
export const provisionalData = (p: Project) => allData(p).filter((d) => isGap(d) || isToVerify(d));

export function versionState(p: Project): { label: string; tone: "neutral" | "success" | "warn" | "info"; stale: boolean } {
  const v = p.princeps?.versions[0];
  if (!v) return { label: "Aucune version validée", tone: "neutral", stale: false };
  if (v.signature !== sheetSignature(p)) return { label: `v${v.n} à réévaluer — fiche modifiée depuis`, tone: "warn", stale: true };
  return { label: `v${v.n} validée — ${v.scope.toLowerCase()}`, tone: v.scope === "Complète" ? "success" : "info", stale: false };
}

/** G2 opens once the committee has launched the project (G1). */
export function canValidate(p: Project) {
  return p.feasibility?.decisions[0]?.choice === "Lancer" && !sheetStats(p).conflicting;
}

/* ------------------------------------------------------------------ */
/* Reducers                                                            */
/* ------------------------------------------------------------------ */

const find = (s: DemoState, code: string) => s.projects.find((p) => p.code === code && p.cadrage);
const labelOf = (p: Project) => `${p.code} • ${p.name}`;
const hrefOf = (p: Project) => `/projets/${p.slug}/princeps`;

function patch(s: DemoState, code: string, update: (p: Project) => Project): DemoState {
  return { ...s, projects: s.projects.map((p) => (p.code === code ? update({ ...p, princeps: p.princeps ?? { data: blankPrincepsData(), trials: [], versions: [] } }) : p)) };
}

export const princeps = {
  /** Opens the sheet of a project created before étape 2 existed. */
  open(s: DemoState, code: string): DemoState {
    return find(s, code) ? patch(s, code, (p) => p) : s;
  },

  /** Proposes the usual function of each declared excipient — a proposal, shown and counted as such. */
  proposeFunctions(s: DemoState, code: string): DemoState {
    const p = find(s, code);
    const excipients = p?.cadrage?.data.find((d) => d.key === "excipients");
    if (!p || !excipients?.value) return s;
    const value = proposeExcipientFunctions(excipients.value);
    const at = stamp();
    let next = patch(s, code, (x) => ({
      ...x,
      princeps: {
        ...x.princeps!,
        data: x.princeps!.data.map((d) =>
          d.key === "excipientFunctions"
            ? {
                ...d,
                value,
                originalValue: value,
                status: "Extraite à confirmer",
                nature: "Proposition IA",
                source: {
                  document: "Proposition du système",
                  location: "Dictionnaire des fonctions usuelles des excipients",
                  excerpt: `Fonctions habituellement associées aux excipients déclarés (${excipients.value}). Ce n'est pas une information du princeps : ni les quantités ni le rôle réel dans cette formule ne sont connus.`,
                },
                history: [...d.history, { at, author: "Système", action: "Extraction", value, note: "Proposition automatique à accepter comme hypothèse ou à remplacer" }],
              }
            : d,
        ),
      },
    }));
    next = withEvent(next, {
      projectCode: code,
      title: "Fonctions des excipients proposées par le système",
      context: labelOf(p),
      object: "Projet",
      objectLabel: `${labelOf(p)} • Fiche princeps`,
      type: "Ajout",
      description: "Proposition issue du dictionnaire des fonctions usuelles — à accepter comme hypothèse de développement ou à remplacer par un fait sourcé.",
      icon: "flask",
      href: hrefOf(p),
    });
    return sync(next, code);
  },

  /** « Créer un essai pour lever l'inconnue »: an experimental question and the activity that carries it. */
  addTrial(s: DemoState, code: string, input: { datumKey: string; title: string; objective: string; owner: string }): DemoState {
    const p = find(s, code);
    const datum = p && allData(p).find((d) => d.key === input.datumKey);
    if (!p || !datum || !input.title.trim()) return s;
    const id = uid("trial");
    let next = patch(s, code, (x) => ({
      ...x,
      princeps: { ...x.princeps!, trials: [...x.princeps!.trials, { id, datumKey: input.datumKey, title: input.title.trim(), objective: input.objective.trim(), owner: input.owner, createdAt: stamp() }] },
    }));
    next = {
      ...next,
      activities: [
        ...next.activities,
        {
          id: uid("act"),
          projectCode: code,
          title: input.title.trim(),
          detail: `Essai pour lever l'inconnue « ${datum.label} »${input.objective.trim() ? ` — ${input.objective.trim()}` : ""}`,
          tags: [code, "Princeps"],
          status: { label: "À faire", tone: "warn" },
          state: "a-faire",
          due: p.cadrage?.startDate || p.createdAt,
          owner: input.owner || p.owner,
          icon: "flask",
          done: false,
          kind: "standard",
          href: hrefOf(p),
          cadrageTask: `essai-${id}`,
        },
      ],
    };
    return withEvent(next, {
      projectCode: code,
      title: `Essai créé pour lever une inconnue — ${datum.label}`,
      context: labelOf(p),
      object: "Essai",
      objectLabel: `${labelOf(p)} • ${input.title.trim()}`,
      type: "Création",
      description: input.objective.trim() || undefined,
      icon: "flask",
      href: hrefOf(p),
    });
  },

  removeTrial(s: DemoState, code: string, id: string): DemoState {
    const next = patch(s, code, (x) => ({ ...x, princeps: { ...x.princeps!, trials: x.princeps!.trials.filter((t) => t.id !== id) } }));
    return { ...next, activities: next.activities.filter((a) => !(a.projectCode === code && a.cadrageTask === `essai-${id}` && !a.done)) };
  },

  /** Gate G2: validates a version of the sheet with the initial strategy; partial while something is provisional. */
  validate(s: DemoState, code: string, input: { strategy: string; note: string }): DemoState {
    const p = find(s, code);
    if (!p || !canValidate(p) || !input.strategy.trim()) return s;
    const provisional = provisionalData(p).map((d) => d.label);
    const n = (p.princeps?.versions[0]?.n ?? 0) + 1;
    const scope = provisional.length ? "Partielle" : "Complète";
    let next = patch(s, code, (x) => ({
      ...x,
      princeps: {
        ...x.princeps!,
        versions: [{ n, at: stamp(), by: CURRENT_USER, scope, strategy: input.strategy.trim(), note: input.note.trim(), provisional, signature: sheetSignature(x) }, ...x.princeps!.versions],
      },
    }));
    next = withEvent(next, {
      projectCode: code,
      title: `Porte G2 — fiche princeps v${n} validée (${scope.toLowerCase()})`,
      context: labelOf(p),
      object: "Décision",
      objectLabel: `${labelOf(p)} • G2 — Stratégie`,
      type: "Approbation",
      field: "Fiche princeps",
      oldValue: p.princeps?.versions[0] ? `v${p.princeps.versions[0].n}` : "Aucune version",
      newValue: `v${n} — ${scope.toLowerCase()}`,
      motif: input.note.trim() || undefined,
      description: `Stratégie initiale : ${input.strategy.trim()}${provisional.length ? ` Restent provisoires : ${provisional.join(", ")}.` : ""}`,
      icon: "check",
      href: hrefOf(p),
    });
    return sync(next, code);
  },
};
