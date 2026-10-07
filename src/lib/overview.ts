/**
 * Vue d'ensemble: what the team has to decide, verify, unblock and prepare — each item with a
 * direct access to its proof — and the three distinct indicators of a project.
 */
import { allData, g0Readiness, hasIdentityProof, infoQuality, needsReview, type InfoQuality } from "./cadrage";
import { canLaunch, feasibilityRows, feasibilityScore } from "./feasibility";
import { canValidate, versionState } from "./princeps";
import type { DemoState } from "./data";
import type { CadrageDatum, Project, Tone } from "./types";

export interface BoardItem {
  id: string;
  projectCode: string;
  projectLabel: string;
  title: string;
  detail: string;
  tone: Tone;
  badge: string;
  href: string;
  cta: string;
  /** Value whose proof can be opened from the board. */
  datum?: CadrageDatum;
  /** Blockers name the rule, the expected proof and who can lift them. */
  rule?: string;
  expected?: string;
  owner?: string;
}

export interface Board {
  decisions: BoardItem[];
  data: BoardItem[];
  blockers: BoardItem[];
  reviews: BoardItem[];
}

const labelOf = (p: Project) => `${p.code} • ${p.name}`;

export function overviewBoard(s: DemoState, projects: Project[]): Board {
  const board: Board = { decisions: [], data: [], blockers: [], reviews: [] };
  const codes = new Set(projects.map((p) => p.code));
  const byCode = new Map(projects.map((p) => [p.code, p]));

  for (const p of projects) {
    const c = p.cadrage;
    if (!c) continue;
    const href = `/projets/${p.slug}/cadrage`;
    const base = { projectCode: p.code, projectLabel: labelOf(p) };
    const readiness = g0Readiness(p);

    if (c.g0.status === "Attendue" && readiness.ready) {
      board.decisions.push({
        ...base,
        id: `g0-${p.code}`,
        title: "G0 — Quel produit et quel marché développons-nous ?",
        detail: "Preuves réunies : identité confirmée, périmètre, documents initiaux. Décideurs proposés : chef de projet + R&D.",
        tone: "info",
        badge: "Décision attendue",
        href: `${href}#porte-g0`,
        cta: "Examiner et décider",
      });
    } else if (c.g0.status === "Attendue") {
      const missing = readiness.checks.filter((x) => !x.ok);
      board.reviews.push({
        ...base,
        id: `rev-g0-${p.code}`,
        title: "Revue de cadrage (G0) à préparer",
        detail: `${missing.length} preuve${missing.length > 1 ? "s" : ""} à réunir : ${missing.map((x) => x.label.toLowerCase()).join(", ")}.`,
        tone: "warn",
        badge: "Preuves incomplètes",
        href: `${href}#porte-g0`,
        cta: "Compléter le cadrage",
      });
    } else {
      const decision = p.feasibility?.decisions[0];
      const rows = feasibilityRows(s, p);
      const score = feasibilityScore(rows);
      const feasibilityHref = `/projets/${p.slug}/faisabilite`;
      if (!decision || decision.choice === "Compléter") {
        const item = {
          ...base,
          id: `g1-${p.code}`,
          detail: `Score ${score.value} % — ${score.established} établis, ${score.toComplete} à compléter, ${score.notEvaluated} non évalués, ${score.criticalOpen} critique(s) ouvert(s). Décideur proposé : comité développement.`,
          href: feasibilityHref,
        };
        // The decision is ready to be taken once every criterion has been looked at.
        if (score.notEvaluated === 0) board.decisions.push({ ...item, title: "G1 — Lancer, compléter, différer ou arrêter ?", tone: "info", badge: "Décision attendue", cta: "Examiner et décider" });
        else board.reviews.push({ ...item, title: "Revue de faisabilité (G1) à préparer", tone: "info", badge: `${score.notEvaluated} à évaluer`, cta: "Préparer la faisabilité" });
        for (const r of rows.filter((x) => x.status === "Bloquant" || (x.critical && x.status !== "Établi"))) {
          board.blockers.push({
            ...base,
            id: `b-${p.code}-${r.key}`,
            title: r.label,
            detail: r.note || "Critère critique non évalué.",
            tone: "danger",
            badge: r.status === "Bloquant" ? "Bloquant" : "Peut bloquer",
            href: feasibilityHref,
            cta: "Ouvrir la faisabilité",
            rule: canLaunch(rows) ? "Critère critique : le score ne le compense pas." : "Un critère déclaré bloquant empêche de lancer.",
            expected: r.action,
            owner: p.owner,
          });
        }
      } else if (decision.choice === "Lancer") {
        const version = versionState(p);
        const princepsHref = `/projets/${p.slug}/princeps`;
        if (!p.princeps?.versions.length || version.stale) {
          const item = { ...base, id: `g2-${p.code}`, href: princepsHref, detail: version.stale ? "La fiche a changé depuis la dernière version validée : à réévaluer." : "Caractéristiques cibles, inconnues restantes et stratégie initiale. Décideurs proposés : galéniste + analytique + R&D." };
          if (canValidate(p)) board.decisions.push({ ...item, title: "G2 — Valider la fiche princeps et la stratégie", tone: "info", badge: version.stale ? "À réévaluer" : "Décision attendue", cta: "Examiner et décider" });
          else board.reviews.push({ ...item, title: "Revue de stratégie (G2) à préparer", tone: "warn", badge: "Contradiction à résoudre", cta: "Ouvrir la fiche princeps" });
        }
      }
    }

    for (const d of allData(p).filter(needsReview)) {
      const conflict = d.status === "Contradictoire";
      board.data.push({
        ...base,
        id: `d-${p.code}-${d.key}`,
        title: conflict ? `${d.label} : ${(d.alternatives ?? []).map((a) => a.value).join(" ≠ ")}` : `${d.label} : ${d.value}`,
        detail: conflict ? `${(d.alternatives ?? []).length} sources divergent` : `${d.source?.document ?? "Saisie manuelle"} — ${d.source?.location ?? "sans document"}`,
        tone: conflict ? "danger" : "warn",
        badge: d.status,
        href: p.princeps?.data.includes(d) ? `/projets/${p.slug}/princeps` : href,
        cta: "Voir la preuve",
        datum: d,
      });
      if (conflict) {
        board.blockers.push({
          ...base,
          id: `b-${p.code}-${d.key}`,
          title: `Contradiction non résolue — ${d.label.toLowerCase()}`,
          detail: "Les deux valeurs sont conservées avec leur contexte ; ce qui en dépend est suspendu.",
          tone: "danger",
          badge: "Bloquant",
          href,
          cta: "Résoudre",
          datum: d,
          rule: "Une valeur contradictoire ne peut pas alimenter une conclusion.",
          expected: "Choix de la valeur applicable, avec justification",
          owner: p.owner,
        });
      }
    }

    if (!hasIdentityProof(c)) {
      board.blockers.push({
        ...base,
        id: `b-${p.code}-preuve`,
        title: "Document d'identité du princeps manquant",
        detail: "L'identité a été confirmée sans RCP ni notice rattaché.",
        tone: "danger",
        badge: "Bloquant",
        href: `${href}#documents`,
        cta: "Ajouter le document",
        rule: "La porte G0 s'appuie sur les documents initiaux.",
        expected: "RCP ou notice du princeps",
        owner: p.owner,
      });
    }
  }

  // Elements of the modules that are not redesigned yet (demonstration dataset).
  for (const d of s.decisions.filter((x) => codes.has(x.projectCode))) {
    const p = byCode.get(d.projectCode)!;
    board.decisions.push({ id: d.id, projectCode: p.code, projectLabel: labelOf(p), title: d.title, detail: d.detail, tone: d.status.tone, badge: d.status.label, href: d.href, cta: "Examiner" });
  }
  for (const pr of s.prerequisites.filter((x) => codes.has(x.projectCode) && x.blocking && x.status !== "Vérifié")) {
    const p = byCode.get(pr.projectCode)!;
    board.blockers.push({
      id: pr.id,
      projectCode: p.code,
      projectLabel: labelOf(p),
      title: pr.name,
      detail: pr.detail,
      tone: "danger",
      badge: "Bloquant",
      href: `/projets/${p.slug}/prerequis`,
      cta: "Ouvrir",
      rule: "Prérequis bloquant : la revue ne peut pas être préparée sans lui.",
      expected: `${pr.name} vérifié`,
      owner: pr.source,
    });
  }
  for (const r of s.reviews.filter((x) => codes.has(x.projectCode) && x.status === "a-preparer")) {
    const p = byCode.get(r.projectCode)!;
    const open = r.checklist.filter((x) => x.state !== "done").length;
    board.reviews.push({
      id: r.id,
      projectCode: p.code,
      projectLabel: labelOf(p),
      title: r.title,
      detail: `${r.type} — ${open} point${open > 1 ? "s" : ""} à réunir avant la revue.`,
      tone: "info",
      badge: r.badge.label,
      href: "/vue-ensemble/revues",
      cta: "Préparer",
    });
  }
  return board;
}

export interface Ratio {
  done: number;
  total: number;
}

export interface Indicators {
  /** Work progress: activities done among the applicable ones. */
  work: Ratio;
  /** Quality of the information; null while the project has no sourced data sheet. */
  info: InfoQuality | null;
  /** Dossier readiness: required sections complete and approved; null while no dossier exists. */
  dossier: Ratio | null;
}

/** Three separate axes: 100 % on one never implies 100 % on another. */
export function projectIndicators(s: DemoState, p: Project): Indicators {
  const activities = s.activities.filter((a) => a.projectCode === p.code);
  const dossier = s.dossiers.find((d) => d.projectCode === p.code);
  const sections = dossier?.modules.flatMap((m) => m.sections) ?? [];
  return {
    work: { done: activities.filter((a) => a.done).length, total: activities.length },
    info: p.cadrage ? infoQuality(allData(p)) : null,
    dossier: dossier ? { done: sections.filter((x) => x.status === "Approuvée").length, total: sections.length } : null,
  };
}

export const percent = (r: Ratio) => (r.total ? Math.round((r.done / r.total) * 100) : 0);
