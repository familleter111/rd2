"use client";

import { ArrowRight, Check, CircleAlert, CircleCheck, FlaskConical, GitBranch, History, Info, ListChecks, Pencil, Plus, Scale, Sparkles, Table2, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { ExcelButton, SectionTitle } from "@/components/cadrage/cadrage-bits";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, Radio, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { diffWords } from "@/lib/diff";
import { OPTION_TONE, canRetain, closestTrial, compare, currentOptions, earlierVersions, formulationOf, optionChanges, optionLabel, suggestOptions, type OptionInput, type OptionSuggestion } from "@/lib/formulation";
import { formatDateTime, formatNumeric, plural } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { formulationWorkbook } from "@/lib/step-exports";
import { formulationActions, useDemo } from "@/lib/store";
import type { FormComponent, FormTrial, FormulaOption, Project, TargetCriterion, TrialResult } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

const BLANK: OptionInput = { title: "", process: "", components: [{ name: "", role: "", qty: "", unit: "mg" }], rationale: "", uncertainties: "", risks: "" };

function OptionModal({ code, option, suggestions = [], onClose }: { code: string; option?: FormulaOption; suggestions?: OptionSuggestion[]; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [form, setForm] = useState<OptionInput>(option ? { title: option.title, process: option.process, components: option.components.map((c) => ({ ...c })), rationale: option.rationale, uncertainties: option.uncertainties, risks: option.risks } : BLANK);
  const [reason, setReason] = useState("");
  const setComponent = (i: number, patch: Partial<FormComponent>) => setForm({ ...form, components: form.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const components = form.components.filter((c) => c.name.trim());
  const valid = Boolean(form.title.trim()) && components.length > 0 && (!option || Boolean(reason.trim()));
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={option ? `${optionLabel(option)} — nouvelle version` : "Ajouter une piste de formulation"}
      subtitle={option ? "La version actuelle et ses résultats restent accessibles." : "Composition candidate, procédé, raisonnement et incertitudes."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const input = { ...form, components };
              if (option) formulationActions.newVersion(code, option.id, input, reason);
              else formulationActions.addOption(code, input);
              toast.show({ title: option ? "Nouvelle version créée" : "Piste ajoutée", description: option ? "Impact à examiner : contrôles, stabilité, bioéquivalence et dossier." : undefined });
              onClose();
            }}
          >
            {option ? "Créer la nouvelle version" : "Ajouter la piste"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {!option && suggestions.length > 0 && (
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
              <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
              Suggestions
            </p>
            <p className="text-[13px] text-ink-500">D&apos;après les cas enregistrés dans vos projets, complétés par des procédés types. Cliquez pour préremplir, y compris des quantités de départ à ajuster.</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {suggestions.map((sug) => (
                <button
                  key={sug.input.title}
                  type="button"
                  aria-pressed={picked === sug.input.title}
                  onClick={() => {
                    setForm({ ...sug.input, components: sug.input.components.map((c) => ({ ...c })) });
                    setPicked(sug.input.title);
                  }}
                  className={cn("cursor-pointer rounded-xl border p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/60", picked === sug.input.title ? "border-brand-400 bg-brand-50" : "border-line")}
                >
                  <Badge tone={sug.kind === "Cas enregistré" ? "success" : "neutral"}>{sug.kind}</Badge>
                  <span className="mt-2 block text-[15px] font-semibold text-ink-900">{sug.input.title}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-ink-600">{sug.basis}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Intitulé de la piste" required htmlFor="opt-title">
            <Input id="opt-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Compression directe" />
          </Field>
          <Field label="Procédé envisagé" htmlFor="opt-process">
            <Input id="opt-process" value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-[15px] font-semibold text-ink-800">
            Composition candidate <span className="text-danger-600">*</span>
          </p>
          <div className="space-y-2">
            {form.components.map((c, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_110px_90px_36px] gap-2">
                <Input aria-label="Composant" placeholder="Composant" value={c.name} onChange={(e) => setComponent(i, { name: e.target.value })} />
                <Input aria-label="Fonction" placeholder="Fonction" value={c.role} onChange={(e) => setComponent(i, { role: e.target.value })} />
                <Input aria-label="Quantité" placeholder="À définir" inputMode="decimal" value={c.qty} onChange={(e) => setComponent(i, { qty: e.target.value })} />
                <Input aria-label="Unité" value={c.unit} onChange={(e) => setComponent(i, { unit: e.target.value })} />
                <IconButton label="Retirer le composant" className="h-11" onClick={() => setForm({ ...form, components: form.components.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ ...form, components: [...form.components, { name: "", role: "", qty: "", unit: "mg" }] })}>
            Ajouter un composant
          </Button>
          <p className="mt-1 text-[13px] text-ink-500">Les quantités sont des paramètres expérimentaux à approuver, pas des faits lus dans une notice : laissez-les vides tant qu&apos;elles ne sont pas définies.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Raisonnement" htmlFor="opt-rationale">
            <Textarea id="opt-rationale" value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} />
          </Field>
          <Field label="Incertitudes" htmlFor="opt-unc">
            <Textarea id="opt-unc" value={form.uncertainties} onChange={(e) => setForm({ ...form, uncertainties: e.target.value })} />
          </Field>
          <Field label="Risques" htmlFor="opt-risks">
            <Textarea id="opt-risks" value={form.risks} onChange={(e) => setForm({ ...form, risks: e.target.value })} />
          </Field>
        </div>
        {option && (
          <Field label="Motif de l'ajustement" required htmlFor="opt-reason" hint="Ex. dissolution trop lente à l'essai E-01 : augmentation du désintégrant.">
            <Textarea id="opt-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function CriterionModal({ code, criterion, onClose }: { code: string; criterion?: TargetCriterion; onClose: () => void }) {
  const [form, setForm] = useState(criterion ?? { label: "", unit: "", method: "", reference: "", referenceSource: "" });
  return (
    <Modal
      open
      onClose={onClose}
      title={criterion ? "Modifier la caractéristique cible" : "Ajouter une caractéristique cible"}
      subtitle="La valeur de référence vient d'une mesure ou d'une source du princeps — sinon elle reste vide."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!form.label.trim()}
            onClick={() => {
              formulationActions.saveCriterion(code, { ...form, id: criterion?.id });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Critère" required htmlFor="crit-label">
          <Input id="crit-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex. Dissolution à 30 min" />
        </Field>
        <Field label="Unité" htmlFor="crit-unit">
          <Input id="crit-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="%, min, N…" />
        </Field>
        <Field label="Méthode et conditions" htmlFor="crit-method" className="sm:col-span-2" hint="Deux résultats ne sont comparés que si l'unité et la méthode sont identiques.">
          <Input id="crit-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="Ex. palette 50 tr/min, pH 6,8" />
        </Field>
        <Field label="Valeur du princeps" htmlFor="crit-ref">
          <Input id="crit-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Non mesurée" />
        </Field>
        <Field label="Source de cette valeur" htmlFor="crit-src">
          <Input id="crit-src" value={form.referenceSource} onChange={(e) => setForm({ ...form, referenceSource: e.target.value })} placeholder="Lot du princeps, rapport, document" />
        </Field>
      </div>
    </Modal>
  );
}

function TrialModal({ code, options, onClose }: { code: string; options: FormulaOption[]; onClose: () => void }) {
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const [lot, setLot] = useState("");
  const [date, setDate] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Planifier un essai"
      subtitle="L'essai est rattaché à une version précise de la piste."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!optionId || !lot.trim()}
            onClick={() => {
              formulationActions.addTrial(code, { optionId, lot, date });
              onClose();
            }}
          >
            Planifier l&apos;essai
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-[15px] font-semibold text-ink-800">Piste testée</legend>
          {options.map((o) => (
            <div key={o.id} className={cn("rounded-xl border p-3", optionId === o.id ? "border-brand-400 bg-brand-50/50" : "border-line")}>
              <Radio name="piste" checked={optionId === o.id} onChange={() => setOptionId(o.id)} label={`${optionLabel(o)} — ${o.title}`} description={o.process} />
            </div>
          ))}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Lot d'essai" required htmlFor="trial-lot">
            <Input id="trial-lot" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Ex. LE-001" />
          </Field>
          <Field label="Date de l'essai" optional htmlFor="trial-date">
            <DateInput id="trial-date" value={date} onChange={setDate} onClear={() => setDate("")} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ResultsModal({ code, trial, criteria, onClose }: { code: string; trial: FormTrial; criteria: TargetCriterion[]; onClose: () => void }) {
  const [results, setResults] = useState<TrialResult[]>(() =>
    criteria.map((c) => trial.results.find((r) => r.criterionId === c.id) ?? { criterionId: c.id, value: "", unit: c.unit, method: c.method }),
  );
  const [note, setNote] = useState(trial.note);
  const set = (id: string, patch: Partial<TrialResult>) => setResults(results.map((r) => (r.criterionId === id ? { ...r, ...patch } : r)));
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Résultats de l'essai ${trial.code}`}
      subtitle={`Lot ${trial.lot} — saisis ici ou repris d'un rapport ; une valeur absente reste absente.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              formulationActions.saveResults(code, trial.id, results, note);
              toast.show({ title: "Résultats enregistrés", description: "L'essai doit être vérifié avant d'entrer dans la comparaison.", tone: "info" });
              onClose();
            }}
          >
            Enregistrer les résultats
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1.4fr)_120px_110px_minmax(0,1.6fr)] gap-2 text-[13px] font-semibold text-ink-600">
          <span>Critère</span>
          <span>Résultat</span>
          <span>Unité</span>
          <span>Méthode et conditions</span>
        </div>
        {criteria.map((c) => {
          const r = results.find((x) => x.criterionId === c.id)!;
          return (
            <div key={c.id} className="grid grid-cols-[minmax(0,1.4fr)_120px_110px_minmax(0,1.6fr)] items-center gap-2">
              <span className="text-[15px] font-semibold text-ink-900">{c.label}</span>
              <Input aria-label={`Résultat — ${c.label}`} inputMode="decimal" value={r.value} onChange={(e) => set(c.id, { value: e.target.value })} />
              <Input aria-label={`Unité — ${c.label}`} value={r.unit} onChange={(e) => set(c.id, { unit: e.target.value })} />
              <Input aria-label={`Méthode — ${c.label}`} value={r.method} onChange={(e) => set(c.id, { method: e.target.value })} />
            </div>
          );
        })}
        <Field label="Observations" optional htmlFor="trial-note">
          <Textarea id="trial-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
      </div>
    </Modal>
  );
}

function DecisionModal({ project, options, onClose }: { project: Project; options: FormulaOption[]; onClose: () => void }) {
  const eligible = options.filter((o) => canRetain(project, o.id));
  const [optionId, setOptionId] = useState(eligible[0]?.id ?? "");
  const [justification, setJustification] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Porte G3 — Retenir une formule et un procédé"
      subtitle="Quelle formule / procédé poursuivre ?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!optionId || !justification.trim()}
            onClick={() => {
              formulationActions.decide(project.code, optionId, justification);
              toast.show({ title: "Formule retenue", description: "Décision G3 enregistrée ; les autres pistes restent consultables comme alternatives étudiées." });
              onClose();
            }}
          >
            Retenir cette piste
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-[15px] font-semibold text-ink-800">Piste à retenir</legend>
          {options.map((o) => {
            const ok = eligible.includes(o);
            return (
              <div key={o.id} className={cn("rounded-xl border p-3", optionId === o.id ? "border-brand-400 bg-brand-50/50" : "border-line", !ok && "opacity-55")}>
                <Radio name="retenue" checked={optionId === o.id} onChange={() => ok && setOptionId(o.id)} label={`${optionLabel(o)} — ${o.title}`} description={ok ? o.process : "Aucun essai vérifié sur cette version : elle ne peut pas être retenue."} />
              </div>
            );
          })}
        </fieldset>
        <Field label="Justification" required htmlFor="g3-motif" hint="Critères prédéfinis satisfaits, écarts acceptés, raisons d'écarter les alternatives. Décideurs proposés : R&D + pharmacien responsable.">
          <Textarea id="g3-motif" value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={500} />
        </Field>
        <p className="flex gap-2.5 rounded-xl bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          Une proximité numérique avec le princeps n&apos;établit pas à elle seule l&apos;équivalence.
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** Changed words: removed ones struck on red, added ones on green, like a highlighter. */
function Diff({ before, after }: { before: string; after: string }) {
  if (before === after) return <>{after || "—"}</>;
  return (
    <>
      {diffWords(before, after).map((part, i) =>
        part.kind === "same" ? (
          <span key={i}>{part.text}</span>
        ) : part.kind === "del" ? (
          <del key={i} className="rounded bg-danger-100 px-0.5 font-semibold text-danger-700 decoration-danger-600 decoration-2">
            {part.text}
          </del>
        ) : (
          <ins key={i} className="rounded bg-success-100 px-0.5 font-semibold text-success-700 no-underline">
            {part.text}
          </ins>
        ),
      )}
    </>
  );
}

const qtyOf = (c?: FormComponent) => (c ? (c.qty.trim() ? `${c.qty} ${c.unit}`.trim() : "À définir") : "");

/** Full content of one version of an option. */
function VersionSheet({ option }: { option: FormulaOption }) {
  return (
    <div className="rounded-xl border border-line">
      <div className="border-b border-line bg-subtle px-4 py-3">
        <p className="text-[15px] font-bold text-ink-900">
          v{option.version} — {option.title}
        </p>
        <p className="text-[13px] text-ink-600">
          {option.by} — {formatDateTime(option.createdAt)}
          {option.changeReason ? ` · motif : ${option.changeReason}` : " · version d'origine"}
        </p>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-ink-800">
          <span className="font-semibold text-ink-900">Procédé : </span>
          {option.process || "—"}
        </p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-left text-[13px] text-ink-500">
              <th className="py-1.5 font-semibold">Composant</th>
              <th className="py-1.5 font-semibold">Fonction</th>
              <th className="py-1.5 text-right font-semibold">Quantité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {option.components.map((c) => (
              <tr key={c.name}>
                <td className="py-1.5 font-semibold text-ink-900">{c.name}</td>
                <td className="py-1.5 text-ink-700">{c.role}</td>
                <td className={cn("py-1.5 text-right font-semibold", c.qty.trim() ? "text-ink-900" : "text-ink-400")}>{qtyOf(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(
          [
            ["Raisonnement", option.rationale],
            ["Incertitudes", option.uncertainties],
            ["Risques", option.risks],
          ] as const
        ).map(([label, text]) => (
          <p key={label} className="text-ink-800">
            <span className="font-semibold text-ink-900">{label} : </span>
            {text || "—"}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Two versions side by side in one sheet, every change highlighted where it happens. */
function VersionCompare({ before, after }: { before: FormulaOption; after: FormulaOption }) {
  const key = (c: FormComponent) => c.name.trim().toLowerCase();
  const names = [...before.components, ...after.components.filter((c) => !before.components.some((x) => key(x) === key(c)))];
  const changes = optionChanges(before, after).length;
  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-subtle px-4 py-3">
        <Badge tone="neutral">v{before.version}</Badge>
        <ArrowRight className="h-4 w-4 text-ink-500" aria-hidden />
        <Badge tone="info">v{after.version}</Badge>
        <span className="text-sm text-ink-700">{changes ? `${changes} ${plural(changes, "élément modifié", "éléments modifiés")}` : "Aucune différence de contenu"}</span>
        <span className="ml-auto flex items-center gap-3 text-[13px] text-ink-600">
          <span>
            <del className="rounded bg-danger-100 px-1 font-semibold text-danger-700 decoration-danger-600 decoration-2">retiré</del>
          </span>
          <span>
            <ins className="rounded bg-success-100 px-1 font-semibold text-success-700 no-underline">ajouté</ins>
          </span>
        </span>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-[15px] font-bold text-ink-900">
          <Diff before={before.title} after={after.title} />
        </p>
        <p className="text-ink-800">
          <span className="font-semibold text-ink-900">Procédé : </span>
          <Diff before={before.process} after={after.process} />
        </p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-left text-[13px] text-ink-500">
              <th className="py-1.5 font-semibold">Composant</th>
              <th className="py-1.5 font-semibold">Fonction</th>
              <th className="py-1.5 text-right font-semibold">Quantité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {names.map((c) => {
              const old = before.components.find((x) => key(x) === key(c));
              const now = after.components.find((x) => key(x) === key(c));
              return (
                <tr key={c.name}>
                  <td className="py-1.5 font-semibold text-ink-900">
                    <Diff before={old?.name ?? ""} after={now?.name ?? ""} />
                  </td>
                  <td className="py-1.5 text-ink-700">
                    <Diff before={old?.role ?? ""} after={now?.role ?? ""} />
                  </td>
                  <td className="py-1.5 text-right font-semibold text-ink-900">
                    {qtyOf(old) === qtyOf(now) ? (
                      qtyOf(now)
                    ) : (
                      <>
                        {old && <del className="mr-1.5 rounded bg-danger-100 px-0.5 text-danger-700 decoration-danger-600 decoration-2">{qtyOf(old)}</del>}
                        {now && <ins className="rounded bg-success-100 px-0.5 text-success-700 no-underline">{qtyOf(now)}</ins>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(
          [
            ["Raisonnement", before.rationale, after.rationale],
            ["Incertitudes", before.uncertainties, after.uncertainties],
            ["Risques", before.risks, after.risks],
          ] as const
        ).map(([label, old, now]) => (
          <p key={label} className="text-ink-800">
            <span className="font-semibold text-ink-900">{label} : </span>
            <Diff before={old} after={now} />
          </p>
        ))}
        {after.changeReason && <p className="rounded-lg bg-subtle px-3 py-2 text-[13px] text-ink-700">Motif de la v{after.version} : {after.changeReason}</p>}
      </div>
    </div>
  );
}

/** History of an option: each version on its own, or two versions compared. */
function OptionHistoryModal({ option, earlier, onClose }: { option: FormulaOption; earlier: FormulaOption[]; onClose: () => void }) {
  // Oldest first: v1, v2, v3…
  const versions = [option, ...earlier].sort((x, y) => x.version - y.version);
  const [view, setView] = useState<"versions" | "comparaison">("versions");
  const [shown, setShown] = useState(option.version);
  const [from, setFrom] = useState(versions[versions.length - 2]?.version ?? option.version);
  const [to, setTo] = useState(option.version);
  const byVersion = (n: number) => versions.find((x) => x.version === n) ?? option;
  const picker = (label: string, value: number, onPick: (n: number) => void) => (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[13px] font-semibold text-ink-600">{label}</span>
      {versions.map((x) => (
        <button
          key={x.version}
          type="button"
          aria-pressed={value === x.version}
          onClick={() => onPick(x.version)}
          className={cn("cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition", value === x.version ? "border-brand-500 bg-brand-600 text-white" : "border-line text-ink-700 hover:border-brand-300 hover:bg-brand-50")}
        >
          v{x.version}
        </button>
      ))}
    </div>
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Historique — Piste ${option.code} · ${option.title}`}
      subtitle="Chaque ajustement crée une version : les versions précédentes et leurs essais sont conservés."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Vue de l'historique">
        {(
          [
            ["versions", "Versions"],
            ["comparaison", "Comparaison"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn("cursor-pointer rounded-lg px-4 py-2 text-[15px] font-semibold transition", view === id ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "text-ink-600 hover:bg-subtle")}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "versions" ? (
        <div className="mt-4 space-y-4">
          {picker("Version", shown, setShown)}
          <VersionSheet option={byVersion(shown)} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {picker("Avant", from, setFrom)}
            {picker("Après", to, setTo)}
          </div>
          {from === to ? <p className="rounded-xl bg-subtle px-4 py-4 text-sm text-ink-600">Choisissez deux versions différentes à comparer.</p> : <VersionCompare before={byVersion(from)} after={byVersion(to)} />}
        </div>
      )}
    </Modal>
  );
}

function OptionCard({ project, option, onEdit }: { project: Project; option: FormulaOption; onEdit: () => void }) {
  const f = formulationOf(project);
  const earlier = earlierVersions(f, option);
  const [history, setHistory] = useState(false);
  const trials = f.trials.filter((t) => t.optionId === option.id);
  const locked = option.status === "Retenue";
  return (
    <Card className={cn("flex flex-col p-5", locked && "border-success-100 ring-1 ring-success-100")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink-500">
            {optionLabel(option)} · {option.origin}
          </p>
          <h3 className="text-lg font-bold text-ink-900">{option.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {earlier.length > 0 && (
            <Button variant="outline" size="sm" icon={<History className="h-4 w-4" />} aria-label={`Historique de la piste ${option.code}`} title="Voir l'historique des modifications (avant / après)" onClick={() => setHistory(true)}>
              {earlier.length}
            </Button>
          )}
          <Badge tone={OPTION_TONE[option.status]} dot size="md">
            {option.status}
          </Badge>
        </div>
      </div>
      {history && <OptionHistoryModal option={option} earlier={earlier} onClose={() => setHistory(false)} />}
      {option.process && <p className="mt-1 text-sm text-ink-700">{option.process}</p>}
      {option.changeReason && <p className="mt-2 rounded-lg bg-subtle px-3 py-2 text-[13px] text-ink-700">Ajustement depuis la version précédente : {option.changeReason}</p>}

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-ink-500">
            <th className="py-1.5 font-semibold">Composant</th>
            <th className="py-1.5 font-semibold">Fonction</th>
            <th className="py-1.5 text-right font-semibold">Quantité</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {option.components.map((c) => (
            <tr key={c.name}>
              <td className="py-1.5 font-semibold text-ink-900">{c.name}</td>
              <td className="py-1.5 text-ink-600">{c.role}</td>
              <td className={cn("py-1.5 text-right", c.qty ? "text-ink-900" : "text-ink-400")}>{c.qty ? `${c.qty} ${c.unit}` : "À définir"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1.5 text-[13px] leading-snug">
        {(
          [
            ["Raisonnement", option.rationale],
            ["Incertitudes", option.uncertainties],
            ["Risques", option.risks],
          ] as const
        )
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-semibold text-ink-800">{k} : </dt>
              <dd className="inline text-ink-600">{v}</dd>
            </div>
          ))}
      </dl>

      <p className="mt-3 text-[13px] text-ink-500">
        {trials.length} {plural(trials.length, "essai")} sur cette version, dont {trials.filter((t) => t.verified).length} vérifié(s)
        {earlier.length > 0 && ` · versions antérieures conservées : ${earlier.map((o) => `v${o.version}`).join(", ")}`}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
          Ajuster (nouvelle version)
        </Button>
        {option.status === "Proposée" && (
          <Button variant="outline" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => formulationActions.setStatus(project.code, option.id, "À tester")}>
            Retenir pour essai
          </Button>
        )}
        {(option.status === "Proposée" || option.status === "À tester") && (
          <Button variant="ghost" size="sm" onClick={() => formulationActions.setStatus(project.code, option.id, "Écartée")}>
            Écarter
          </Button>
        )}
        {option.status === "Écartée" && (
          <Button variant="ghost" size="sm" onClick={() => formulationActions.setStatus(project.code, option.id, "Proposée")}>
            Reprendre la piste
          </Button>
        )}
      </div>
    </Card>
  );
}

export function FormulationView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [dialog, setDialog] = useState<{ kind: "option"; option?: FormulaOption } | { kind: "criterion"; criterion?: TargetCriterion } | { kind: "trial" } | { kind: "results"; trial: FormTrial } | { kind: "decision" } | null>(null);

  if (!project) return null;
  if (!project.cadrage) {
    return (
      <>
        <ProjectTabs slug={project.slug} />
        <Card className="mt-6">
          <EmptyState icon={Info} title="Formulation indisponible pour ce projet" description="Ce projet a été créé avant le nouveau parcours d'aide à la décision." />
        </Card>
      </>
    );
  }

  const code = project.code;
  const f = formulationOf(project);
  const options = currentOptions(f);
  const testable = options.filter((o) => o.status !== "Écartée");
  const verified = f.trials.filter((t) => t.verified);
  const closest = closestTrial(f.criteria, verified);
  const g2 = Boolean(project.princeps?.versions.length);
  const retained = f.options.find((o) => o.id === f.decision?.optionId);
  const canDecide = g2 && options.some((o) => canRetain(project, o.id));
  const optionOf = (id: string) => f.options.find((o) => o.id === id);
  const proposed = f.options.some((o) => o.origin === "Proposition du système");

  return (
    <>
      <ProjectTabs slug={project.slug} actions={<ExcelButton filename={`Formulation_${code}`} sheets={() => formulationWorkbook(project)} />} />

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-ink-900">Formulation &amp; essais</h2>
              <Badge tone={retained ? "success" : canDecide ? "info" : "neutral"} size="md">
                {retained ? `G3 — ${optionLabel(retained)} retenue` : canDecide ? "G3 — décision attendue" : "G3 — essais à réunir"}
              </Badge>
            </div>
            <p className="mt-1 text-[15px] text-ink-600">Quelles formulations et quels procédés faut-il tester, puis laquelle faut-il retenir ?</p>
          </div>
          <Button size="lg" icon={<Scale className="h-5 w-5" />} disabled={!canDecide} onClick={() => setDialog({ kind: "decision" })}>
            {retained ? "Redécider (G3)" : "Retenir une formule (G3)"}
          </Button>
        </div>
        {!g2 && (
          <p className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-[15px] text-ink-800">
            <CircleAlert className="h-5 w-5 shrink-0 text-warn-600" aria-hidden />
            <span className="flex-1">Vous pouvez préparer les pistes et les essais ; la décision G3 s&apos;ouvrira quand une version de la fiche princeps sera validée (G2).</span>
            <LinkButton href={`/projets/${project.slug}/princeps`} variant="outline" size="sm">
              Ouvrir la fiche princeps
            </LinkButton>
          </p>
        )}
        {retained && f.decision && (
          <div className="mt-4 rounded-xl border border-success-100 bg-success-50/70 p-4 text-sm">
            <p className="font-semibold text-ink-900">
              {optionLabel(retained)} — {retained.title} · retenue par {f.decision.decidedBy}, {formatDateTime(f.decision.decidedAt)}
            </p>
            <p className="mt-1 text-ink-700">« {f.decision.justification} »</p>
          </div>
        )}
      </Card>

      {/* Pistes */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-ink-900">
            <GitBranch className="h-6 w-6 text-ink-700" strokeWidth={1.6} aria-hidden />
            Pistes de formulation
          </h2>
          <p className="text-sm text-ink-500">Un nombre limité de pistes, chacune avec son raisonnement, ses incertitudes et ses risques. Aucune formule équivalente n&apos;est promise.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            icon={<Sparkles className="h-4 w-4" />}
            disabled={proposed}
            onClick={() => {
              formulationActions.propose(code);
              toast.show({ title: "Pistes proposées", description: "Deux pistes candidates et les critères cibles par défaut — à examiner et ajuster." });
            }}
          >
            {proposed ? "Pistes déjà proposées" : "Proposer des pistes"}
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ kind: "option" })}>
            Ajouter une piste
          </Button>
        </div>
      </div>
      {options.length === 0 ? (
        <Card className="mt-4">
          <EmptyState icon={FlaskConical} title="Aucune piste pour l'instant" description="Demandez une proposition à partir de la fiche princeps (excipients déclarés, forme, procédés usuels) ou ajoutez votre propre piste." />
        </Card>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {options.map((o) => (
            <OptionCard key={o.id} project={project} option={o} onEdit={() => setDialog({ kind: "option", option: o })} />
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Critères cibles */}
        <Card className="h-fit p-6">
          <SectionTitle
            icon={Target}
            title="Caractéristiques cibles"
            subtitle="Critères configurés pour départager les pistes, avec la valeur du princeps quand elle est connue."
            aside={
              <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ kind: "criterion" })}>
                Ajouter
              </Button>
            }
          />
          {f.criteria.length === 0 ? (
            <p className="mt-4 rounded-xl bg-subtle px-4 py-5 text-center text-sm text-ink-500">Aucun critère. Ajoutez ceux qui serviront à comparer les essais.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {f.criteria.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink-900">
                      {c.label} {c.unit && <span className="font-normal text-ink-500">({c.unit})</span>}
                    </p>
                    <p className="truncate text-[13px] text-ink-500">{c.method || "Méthode à préciser"}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-[15px] font-semibold", c.reference ? "text-ink-900" : "text-ink-400")}>{c.reference ? `${c.reference} ${c.unit}` : "Princeps non mesuré"}</p>
                    {c.referenceSource && <p className="text-[13px] text-ink-500">{c.referenceSource}</p>}
                  </div>
                  <IconButton label={`Modifier ${c.label}`} onClick={() => setDialog({ kind: "criterion", criterion: c })}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={`Retirer ${c.label}`} onClick={() => formulationActions.removeCriterion(code, c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Essais */}
        <Card className="h-fit p-6">
          <SectionTitle
            icon={ListChecks}
            title="Plan d'essais"
            subtitle="Chaque essai est rattaché à une version de piste et à un lot ; ses résultats sont vérifiés avant comparaison."
            aside={
              <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} disabled={!testable.length} onClick={() => setDialog({ kind: "trial" })}>
                Planifier un essai
              </Button>
            }
          />
          {f.trials.length === 0 ? (
            <p className="mt-4 rounded-xl bg-subtle px-4 py-5 text-center text-sm text-ink-500">{testable.length ? "Aucun essai planifié." : "Ajoutez d'abord une piste de formulation."}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {f.trials.map((t) => {
                const o = optionOf(t.optionId);
                const filled = t.results.filter((r) => r.value.trim()).length;
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink-900">
                        {t.code} · {o ? optionLabel(o) : "Piste supprimée"} <span className="font-normal text-ink-500">· lot {t.lot}</span>
                      </p>
                      <p className="text-[13px] text-ink-500">
                        {t.date ? formatNumeric(t.date) : "Date à planifier"} · {filled} / {f.criteria.length} {plural(f.criteria.length, "résultat saisi", "résultats saisis")}
                      </p>
                    </div>
                    <Badge tone={t.verified ? "success" : filled ? "warn" : "neutral"} dot>
                      {t.verified ? "Vérifié" : filled ? "À vérifier" : "Planifié"}
                    </Badge>
                    <Button variant="secondary" size="sm" disabled={!f.criteria.length} onClick={() => setDialog({ kind: "results", trial: t })}>
                      {filled ? "Modifier" : "Saisir les résultats"}
                    </Button>
                    {!t.verified && filled > 0 && (
                      <Button size="sm" icon={<Check className="h-4 w-4" />} onClick={() => formulationActions.verifyTrial(code, t.id)}>
                        Vérifier
                      </Button>
                    )}
                    {!t.verified && (
                      <IconButton label={`Retirer l'essai ${t.code}`} onClick={() => formulationActions.removeTrial(code, t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Comparaison */}
      <Card className="mt-6 p-6">
        <SectionTitle icon={Table2} title="Comparaison au princeps" subtitle="Seuls les essais vérifiés sont comparés, et seulement quand l'unité et la méthode sont identiques." />
        {verified.length === 0 || f.criteria.length === 0 ? (
          <p className="mt-4 rounded-xl bg-subtle px-4 py-6 text-center text-sm text-ink-500">La comparaison apparaîtra dès qu&apos;un essai sera vérifié.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-subtle text-left text-[13px] text-ink-600">
                  <th className="px-4 py-2.5 font-semibold">Critère</th>
                  <th className="px-4 py-2.5 font-semibold">Princeps</th>
                  {verified.map((t) => {
                    const o = optionOf(t.optionId);
                    return (
                      <th key={t.id} className={cn("px-4 py-2.5 font-semibold", t.id === closest && "closest-col closest-col-top text-success-700")} title={t.id === closest ? "Essai le plus proche du princeps" : undefined}>
                        {t.code} — {o ? optionLabel(o) : ""}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {f.criteria.map((c, i) => (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{c.label}</p>
                      <p className="text-[13px] text-ink-500">{c.method || "Méthode à préciser"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className={cn("font-semibold", c.reference ? "text-ink-900" : "text-ink-400")}>{c.reference ? `${c.reference} ${c.unit}` : "Non mesuré"}</p>
                      {c.referenceSource && <p className="text-[13px] text-ink-500">{c.referenceSource}</p>}
                    </td>
                    {verified.map((t) => {
                      const r = t.results.find((x) => x.criterionId === c.id);
                      const cmp = compare(c, r);
                      return (
                        <td key={t.id} className={cn("px-4 py-3", t.id === closest && "closest-col", t.id === closest && i === f.criteria.length - 1 && "closest-col-bottom")}>
                          <p className={cn("font-semibold", r?.value ? "text-ink-900" : "text-ink-400")}>{r?.value ? `${r.value} ${r.unit}` : "—"}</p>
                          <p className={cn("text-[13px] leading-snug", cmp.state === "comparable" ? "text-brand-700" : cmp.state === "non-comparable" ? "text-danger-700" : "text-ink-500")}>{cmp.text}</p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex gap-2 text-[13px] text-ink-500">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          Les écarts sont calculés par une règle déterministe ; leur interprétation et le choix reviennent aux responsables. Le cadre vert entoure l&apos;essai le plus proche du princeps sur le plus grand nombre de critères. Une proximité numérique n&apos;établit pas à elle seule l&apos;équivalence.
        </p>
      </Card>

      {dialog?.kind === "option" && <OptionModal code={code} option={dialog.option} suggestions={dialog.option ? [] : suggestOptions(state, project)} onClose={() => setDialog(null)} />}
      {dialog?.kind === "criterion" && <CriterionModal code={code} criterion={dialog.criterion} onClose={() => setDialog(null)} />}
      {dialog?.kind === "trial" && <TrialModal code={code} options={testable} onClose={() => setDialog(null)} />}
      {dialog?.kind === "results" && <ResultsModal code={code} trial={dialog.trial} criteria={f.criteria} onClose={() => setDialog(null)} />}
      {dialog?.kind === "decision" && <DecisionModal project={project} options={testable} onClose={() => setDialog(null)} />}
    </>
  );
}
