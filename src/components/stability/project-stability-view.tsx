"use client";

import { CalendarClock, Check, CircleAlert, CircleCheck, ClipboardList, Info, LineChart, Plus, Scale, TriangleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ExcelButton, SectionTitle } from "@/components/cadrage/cadrage-bits";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDateTime, plural } from "@/lib/format";
import { checkResult, qualityOf, specLimit } from "@/lib/quality";
import { findProject } from "@/lib/selectors";
import { CELL_TONE, canConclude, cellEntries, cellState, cells, evolutions, missingRequired, planComplete, pointLabel, requiredProgress, stabilityOf, type PlanInput } from "@/lib/stability";
import { stabilityWorkbook } from "@/lib/step-exports";
import { stabilityActions, useDemo } from "@/lib/store";
import type { Project, QSpec, StabilityFile } from "@/lib/types";

const VERDICT_TONE = { Conforme: "success", "Hors limite": "danger", "Non évaluable": "neutral" } as const;

function Chips({ items, onRemove, render }: { items: string[]; onRemove: (i: number) => void; render?: (item: string, i: number) => ReactNode }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 py-1.5 pl-3 pr-1.5 text-[15px] font-semibold text-brand-800">
          {render ? render(item, i) : item}
          <button type="button" aria-label={`Retirer ${item}`} onClick={() => onRemove(i)} className="cursor-pointer rounded p-1 text-brand-700 hover:bg-brand-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function AddInline({ label, placeholder, onAdd, numeric }: { label: string; placeholder: string; onAdd: (v: string) => void; numeric?: boolean }) {
  const [value, setValue] = useState("");
  const ok = numeric ? value.trim() !== "" && Number(value) >= 0 : Boolean(value.trim());
  const add = () => {
    if (!ok) return;
    onAdd(value.trim());
    setValue("");
  };
  return (
    <div className="mt-2 flex gap-2">
      <Input aria-label={label} placeholder={placeholder} inputMode={numeric ? "numeric" : undefined} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="max-w-72" />
      <Button variant="outline" icon={<Plus className="h-4 w-4" />} disabled={!ok} onClick={add}>
        Ajouter
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

function PlanEditor({ project, st, specs }: { project: Project; st: StabilityFile; specs: QSpec[] }) {
  const pilotLot = qualityOf(project).pilot.lot;
  const packaging = project.cadrage?.data.find((d) => d.key === "packaging")?.value ?? "";
  const [plan, setPlan] = useState<PlanInput>({ referential: st.referential, packaging: st.packaging || packaging, lots: st.lots.length ? st.lots : pilotLot ? [pilotLot] : [], conditions: st.conditions, points: st.points, specIds: st.specIds });
  const dirty = JSON.stringify(plan) !== JSON.stringify({ referential: st.referential, packaging: st.packaging, lots: st.lots, conditions: st.conditions, points: st.points, specIds: st.specIds });
  const code = project.code;
  return (
    <Card className="p-6">
      <SectionTitle
        icon={ClipboardList}
        title="Plan de stabilité"
        subtitle="Conditions, lots, analyses et échéances sont décidés pour le dossier visé, selon les référentiels du marché — aucune règle universelle n'est appliquée d'office."
        aside={<Badge tone={st.approvedAt ? "success" : "neutral"} size="md">{st.approvedAt ? "Plan approuvé" : "Plan à approuver"}</Badge>}
      />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Référentiel appliqué (version)" required htmlFor="st-ref" hint="Référence et version retenues avec les affaires réglementaires pour ce marché et cette procédure.">
          <Input id="st-ref" value={plan.referential} onChange={(e) => setPlan({ ...plan, referential: e.target.value })} placeholder="Ex. ligne directrice applicable au marché visé, version…" />
        </Field>
        <Field label="Conditionnement étudié" htmlFor="st-pack">
          <Input id="st-pack" value={plan.packaging} onChange={(e) => setPlan({ ...plan, packaging: e.target.value })} />
        </Field>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">Lots</p>
          <Chips items={plan.lots} onRemove={(i) => setPlan({ ...plan, lots: plan.lots.filter((_, j) => j !== i) })} />
          <AddInline label="Lot" placeholder="Numéro de lot" onAdd={(v) => !plan.lots.includes(v) && setPlan({ ...plan, lots: [...plan.lots, v] })} />
        </div>
        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">Conditions de conservation</p>
          <Chips items={plan.conditions} onRemove={(i) => setPlan({ ...plan, conditions: plan.conditions.filter((_, j) => j !== i) })} />
          <AddInline label="Condition" placeholder="Température / humidité" onAdd={(v) => !plan.conditions.includes(v) && setPlan({ ...plan, conditions: [...plan.conditions, v] })} />
        </div>
        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">Échéances (mois depuis T0)</p>
          <Chips
            items={plan.points.map((x) => pointLabel(x.month))}
            onRemove={(i) => setPlan({ ...plan, points: plan.points.filter((_, j) => j !== i) })}
            render={(item, i) => (
              <label className="inline-flex cursor-pointer items-center gap-2">
                {item}
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={plan.points[i].required} onChange={(e) => setPlan({ ...plan, points: plan.points.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })} />
                <span className="text-xs font-medium text-brand-700">requise pour le dossier</span>
              </label>
            )}
          />
          <AddInline
            label="Échéance en mois"
            placeholder="0 pour T0, 3, 6…"
            numeric
            onAdd={(v) => {
              const month = Math.round(Number(v));
              if (!plan.points.some((x) => x.month === month)) setPlan({ ...plan, points: [...plan.points, { month, required: false }].sort((a, b) => a.month - b.month) });
            }}
          />
          <p className="mt-1.5 text-[13px] text-ink-500">Une échéance future non requise ne bloque pas la préparation du dossier.</p>
        </div>
        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">Analyses suivies</p>
          {specs.length === 0 ? (
            <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-ink-600">
              Aucune spécification. Créez-les dans l&apos;étape « Qualité &amp; lot pilote ».{" "}
              <LinkButton href={`/projets/${project.slug}/qualite`} variant="link">
                Ouvrir
              </LinkButton>
            </p>
          ) : (
            <div className="space-y-2">
              {specs.map((s) => (
                <Checkbox
                  key={s.id}
                  checked={plan.specIds.includes(s.id)}
                  onChange={(v) => setPlan({ ...plan, specIds: v ? [...plan.specIds, s.id] : plan.specIds.filter((id) => id !== s.id) })}
                  label={s.test}
                  description={`${specLimit(s)} · ${s.approved ? "spécification approuvée" : "non approuvée : résultats non évaluables"}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button
          variant="outline"
          disabled={!dirty}
          onClick={() => {
            stabilityActions.savePlan(code, plan);
            toast.show({ title: "Plan enregistré", description: st.approvedAt ? "Le plan a changé : il doit être approuvé à nouveau." : "À approuver pour ouvrir la saisie des résultats.", tone: "info" });
          }}
        >
          Enregistrer le plan
        </Button>
        <Button icon={<Check className="h-4 w-4" />} disabled={dirty || Boolean(st.approvedAt) || !planComplete(st)} onClick={() => stabilityActions.approvePlan(code)}>
          Approuver le plan
        </Button>
        <span className="text-[13px] text-ink-500">
          {st.approvedAt
            ? `Approuvé par ${st.approvedBy} — ${formatDateTime(st.approvedAt)}`
            : dirty
              ? "Modifications non enregistrées."
              : planComplete(st)
                ? "Le plan est complet : il peut être approuvé."
                : "Il faut un référentiel, au moins un lot, une condition, une échéance et une analyse."}
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Cell                                                                */
/* ------------------------------------------------------------------ */

function CellModal({ project, st, cell, onClose }: { project: Project; st: StabilityFile; cell: { lot: string; condition: string; month: number }; onClose: () => void }) {
  const specs = qualityOf(project).specs.filter((s) => st.specIds.includes(s.id));
  const entries = cellEntries(st, cell.lot, cell.condition, cell.month);
  const [values, setValues] = useState(() => specs.map((s) => ({ specId: s.id, value: entries.find((e) => e.specId === s.id)?.value ?? "", note: entries.find((e) => e.specId === s.id)?.note ?? "" })));
  const [investigation, setInvestigation] = useState("");
  const state = cellState(st, cell.lot, cell.condition, cell.month);
  const dirty = values.some((v) => (entries.find((e) => e.specId === v.specId)?.value ?? "") !== v.value.trim());
  const complete = entries.length === specs.length;
  const toInvestigate = entries.some((e) => e.status === "À investiguer");
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`${pointLabel(cell.month)} — ${cell.condition}`}
      subtitle={`Lot ${cell.lot} · chaque résultat est comparé à sa spécification approuvée`}
      footer={
        <>
          <Badge tone={CELL_TONE[state]} dot size="md" className="mr-auto">
            {state}
          </Badge>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="outline" disabled={!dirty || state === "Approuvé"} onClick={() => stabilityActions.saveCell(project.code, cell, values)}>
            Enregistrer les résultats
          </Button>
          <Button
            icon={<Check className="h-4 w-4" />}
            disabled={dirty || !complete || state === "Approuvé" || (toInvestigate && !investigation.trim())}
            onClick={() => {
              stabilityActions.approveCell(project.code, cell, investigation);
              onClose();
            }}
          >
            Approuver
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {specs.map((s) => {
          const v = values.find((x) => x.specId === s.id)!;
          const check = v.value.trim() ? checkResult(s, v.value) : null;
          const set = (patch: Partial<typeof v>) => setValues(values.map((x) => (x.specId === s.id ? { ...x, ...patch } : x)));
          return (
            <div key={s.id} className="grid items-center gap-3 rounded-xl border border-line p-3 md:grid-cols-[minmax(0,1.3fr)_130px_minmax(0,1.4fr)_auto]">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink-900">{s.test}</p>
                <p className="truncate text-[13px] text-ink-500">
                  {specLimit(s)} · {s.method || "méthode à préciser"}
                </p>
              </div>
              <Input aria-label={`Résultat — ${s.test}`} inputMode="decimal" placeholder="Résultat" value={v.value} disabled={state === "Approuvé"} onChange={(e) => set({ value: e.target.value })} />
              <Input aria-label={`Remarque — ${s.test}`} placeholder="Remarque" value={v.note} disabled={state === "Approuvé"} onChange={(e) => set({ note: e.target.value })} />
              {check ? <Badge tone={VERDICT_TONE[check.verdict]}>{check.verdict}</Badge> : <Badge tone="neutral">Prévu</Badge>}
            </div>
          );
        })}
        {toInvestigate && state !== "Approuvé" && (
          <div className="rounded-xl border border-danger-200 bg-danger-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-danger-700">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              Résultat hors limite à investiguer : la valeur saisie est conservée.
            </p>
            <Field label="Conclusion de l'investigation" required htmlFor="st-inv" className="mt-3">
              <Textarea id="st-inv" value={investigation} onChange={(e) => setInvestigation(e.target.value)} maxLength={300} placeholder="Contrôle de la donnée, cause identifiée, essai complémentaire…" />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ProjectStabilityView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [cell, setCell] = useState<{ lot: string; condition: string; month: number } | null>(null);
  const [conclusion, setConclusion] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState(false);

  if (!project) return null;
  if (!project.cadrage) {
    return (
      <>
        <ProjectTabs slug={project.slug} />
        <Card className="mt-6">
          <EmptyState icon={Info} title="Étape indisponible pour ce projet" description="Ce projet a été créé avant le nouveau parcours d'aide à la décision." />
        </Card>
      </>
    );
  }

  const code = project.code;
  const st = stabilityOf(project);
  const specs = qualityOf(project).specs;
  const all = cells(st);
  const missing = missingRequired(st);
  const count = (s: string) => all.filter((c) => c.state === s).length;
  const progress = requiredProgress(st);
  const evolution = evolutions(st);
  const text = conclusion ?? st.conclusionDraft ?? "";

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Stabilite_${code}`} sheets={() => stabilityWorkbook(project)} />} />

      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Stabilité</h2>
          <Badge tone={st.conclusion ? "success" : st.approvedAt ? "info" : "neutral"} size="md">
            {st.conclusion ? "Conclusion approuvée" : st.approvedAt ? "Étude en cours" : "Plan à approuver"}
          </Badge>
        </div>
        <p className="mt-1 text-[15px] text-ink-600">Les résultats disponibles soutiennent-ils les conditions proposées et le niveau de préparation du dossier visé ?</p>
        {st.approvedAt && (
          <dl className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-5">
            {(["Prévu", "Reçu", "À vérifier", "Approuvé", "À investiguer"] as const).map((s) => (
              <div key={s} className="rounded-xl bg-subtle px-4 py-3">
                <dt className="text-[13px] text-ink-500">{s}</dt>
                <dd className={cn("text-[26px] font-bold leading-tight", s === "À investiguer" && count(s) ? "text-danger-700" : "text-ink-900")}>{count(s)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <div className="mt-6">
        <PlanEditor key={`${st.approvedAt ?? "draft"}-${st.lots.join()}-${st.conditions.join()}-${st.points.length}-${st.specIds.length}`} project={project} st={st} specs={specs} />
      </div>

      {st.approvedAt && (
        <>
          <Card className="mt-6 p-6">
            <SectionTitle icon={CalendarClock} title="Matrice lots × conditions × échéances" subtitle="Cliquez une case pour saisir, vérifier et approuver ses résultats. ★ = échéance requise pour le dossier." />
            {st.lots.map((lot) => (
              <section key={lot} className="mt-5">
                <h3 className="text-[15px] font-bold text-ink-900">Lot {lot}</h3>
                <div className="mt-2 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="bg-subtle text-left text-[13px] text-ink-600">
                        <th className="px-4 py-2.5 font-semibold">Condition</th>
                        {st.points.map((pt) => (
                          <th key={pt.month} className="px-3 py-2.5 text-center font-semibold">
                            {pointLabel(pt.month)}
                            {pt.required && <span title="Requise pour le dossier"> ★</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {st.conditions.map((condition) => (
                        <tr key={condition}>
                          <td className="px-4 py-2.5 font-semibold text-ink-900">{condition}</td>
                          {st.points.map((pt) => {
                            const s = cellState(st, lot, condition, pt.month);
                            return (
                              <td key={pt.month} className="px-3 py-2 text-center">
                                <button type="button" onClick={() => setCell({ lot, condition, month: pt.month })} className="cursor-pointer rounded-lg p-1 hover:bg-brand-50" aria-label={`${pointLabel(pt.month)}, ${condition}, lot ${lot} : ${s}`}>
                                  <Badge tone={CELL_TONE[s]} dot>
                                    {s}
                                  </Badge>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </Card>

          <Card className="mt-6 p-6">
            <SectionTitle icon={LineChart} title="Évolution du produit dans le temps" subtitle="Pour chaque analyse suivie, par lot et par condition : ses résultats d'échéance en échéance, l'écart entre le premier et le dernier résultat, et votre commentaire." aside={<Badge tone={progress.total && progress.done === progress.total ? "success" : "neutral"} size="md">{progress.done} / {progress.total} échéances requises approuvées</Badge>} />
            <div className="mt-4">
              {evolution.length === 0 ? (
                <p className="mt-3 rounded-xl bg-subtle px-4 py-4 text-sm text-ink-600">Aucune analyse suivie dans le plan.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {evolution.map((ev) => {
                    const spec = specs.find((s) => s.id === ev.specId);
                    return (
                      <li key={ev.key} className="rounded-xl border border-line p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[15px] font-semibold text-ink-900">
                            {spec?.test ?? "Analyse"} <span className="font-normal text-ink-500">· lot {ev.lot} · {ev.condition}</span>
                          </p>
                          <p className="text-[13px] text-ink-600">
                            Limite : {spec ? specLimit(spec) : "—"}
                            {ev.change !== undefined && (
                              <span className="ml-3 font-semibold text-ink-900">
                                Écart depuis le premier résultat : {ev.change > 0 ? "+" : ""}
                                {String(ev.change).replace(".", ",")} {spec?.unit}
                              </span>
                            )}
                          </p>
                        </div>
                        <ol className="mt-3 flex flex-wrap items-stretch gap-2">
                          {ev.series.map((pt, k) => (
                            <li key={pt.month} className="flex items-center gap-2">
                              {k > 0 && <span className="text-ink-300" aria-hidden>→</span>}
                              <span className={cn("rounded-lg border px-3 py-1.5 text-center", pt.value === undefined ? "border-dashed border-line text-ink-400" : pt.status === "À investiguer" ? "border-danger-200 bg-danger-50 text-danger-700" : pt.status === "Approuvé" ? "border-success-100 bg-success-50/70 text-ink-900" : "border-line text-ink-900")}>
                                <span className="block text-[12px] font-semibold text-ink-500">{pointLabel(pt.month)}</span>
                                <span className="block text-[15px] font-bold">{pt.value === undefined ? "—" : `${pt.value} ${spec?.unit ?? ""}`.trim()}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                        <Input
                          key={`${ev.key}-${ev.note}`}
                          aria-label={`Commentaire — ${spec?.test ?? "analyse"}, lot ${ev.lot}, ${ev.condition}`}
                          placeholder="Commentaire sur cette évolution"
                          defaultValue={ev.note}
                          maxLength={300}
                          className="mt-3"
                          onBlur={(e) => e.target.value.trim() !== ev.note && stabilityActions.saveEvolutionNote(code, ev.key, e.target.value)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-[13px] text-ink-500">Le commentaire s&apos;enregistre en quittant le champ. Aucune projection ni durée de conservation n&apos;est calculée.</p>
            </div>
          </Card>

          <Card className="mt-6 p-6">
            <SectionTitle icon={Scale} title="Conclusion scientifique" subtitle="Échéances acquises, échéances encore attendues et justification des données retenues pour le dossier courant." />
            {missing.length > 0 ? (
              <div className="mt-4 rounded-xl border border-warn-200 bg-warn-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-ink-900">
                  <CircleAlert className="h-5 w-5 text-warn-600" aria-hidden />
                  {missing.length} {plural(missing.length, "échéance requise n'est pas approuvée", "échéances requises ne sont pas approuvées")}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-ink-700">
                  {missing.map((c) => (
                    <li key={`${c.lot}-${c.condition}-${c.month}`}>
                      {pointLabel(c.month)} · {c.condition} · lot {c.lot} — {c.state.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </div>
            ) : !all.some((c) => c.required) ? (
              <p className="mt-4 rounded-xl bg-subtle px-4 py-4 text-sm text-ink-600">Aucune échéance n&apos;est marquée « requise pour le dossier » dans le plan : indiquez lesquelles le sont pour pouvoir conclure.</p>
            ) : null}
            {st.conclusion && !rewriting ? (
              <div className={cn("mt-3 rounded-xl border p-4 text-sm", st.conclusion.partial ? "border-warn-200 bg-warn-50" : "border-success-100 bg-success-50/70")}>
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                  <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
                  {st.conclusion.partial ? "Conclusion intermédiaire" : "Conclusion"} approuvée par {st.conclusion.by} — {formatDateTime(st.conclusion.at)}
                  {st.conclusion.progress && <Badge tone={st.conclusion.partial ? "warn" : "success"}>{st.conclusion.progress}</Badge>}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-ink-800">{st.conclusion.text}</p>
                {st.conclusion.partial && <p className="mt-2 text-[13px] text-ink-600">Elle sera à reprendre quand toutes les échéances requises seront approuvées : le dossier attend la conclusion complète.</p>}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setConclusion(st.conclusion?.text ?? "");
                    setRewriting(true);
                  }}
                >
                  Mettre à jour la conclusion
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Field label="Conclusion générale" htmlFor="st-conclusion" hint="Rédigée par le responsable stabilité, jamais déduite automatiquement d'une tendance. Vous pouvez l'écrire et l'approuver à tout moment ; tant que des échéances requises manquent, elle est enregistrée comme intermédiaire.">
                  <Textarea id="st-conclusion" value={text} onChange={(e) => setConclusion(e.target.value)} maxLength={600} className="min-h-28" />
                </Field>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={text === (st.conclusionDraft ?? "")}
                    onClick={() => {
                      stabilityActions.saveDraft(code, text);
                      toast.show({ title: "Commentaire enregistré", description: "Il reste modifiable jusqu'à l'approbation.", tone: "info" });
                    }}
                  >
                    Enregistrer le commentaire
                  </Button>
                  <Button
                    icon={<Check className="h-4 w-4" />}
                    disabled={!text.trim()}
                    onClick={() => {
                      stabilityActions.conclude(code, text);
                      setRewriting(false);
                      setConclusion(null);
                    }}
                  >
                    {canConclude(st) ? "Approuver la conclusion" : "Approuver la conclusion intermédiaire"}
                  </Button>
                  {rewriting && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRewriting(false);
                        setConclusion(null);
                      }}
                    >
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {cell && <CellModal key={`${cell.lot}-${cell.condition}-${cell.month}-${cellEntries(st, cell.lot, cell.condition, cell.month).length}`} project={project} st={st} cell={cell} onClose={() => setCell(null)} />}
    </>
  );
}
