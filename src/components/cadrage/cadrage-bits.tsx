"use client";

import { Check, CircleCheck, Clock, FileSearch, FileSpreadsheet, FileText, FlaskConical, History, Quote, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, Radio, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { pathwayFor, type InfoQuality, type Unknown } from "@/lib/cadrage";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { NATURES, NATURE_TONE, isProvisional, natureOf } from "@/lib/princeps";
import { downloadWorkbook, type Sheet } from "@/lib/xlsx";
import type { CadrageDatum, CadrageDocState, DataNature, DataSource, DataStatus, ExpectedDocument, Family, Tone } from "@/lib/types";

export const DATA_STATUS_TONE: Record<DataStatus, Tone> = {
  "Extraite à confirmer": "warn",
  Confirmée: "success",
  Corrigée: "info",
  Contradictoire: "danger",
  "Non documentée": "neutral",
};

/** « Enregistrer dans Excel »: saves what was entered on the page as an .xlsx workbook (one sheet per block). */
export function ExcelButton({ filename, sheets, size = "md" }: { filename: string; sheets: () => Sheet[]; size?: "sm" | "md" | "lg" }) {
  return (
    <Button
      variant="outline"
      size={size}
      icon={<FileSpreadsheet className="h-4 w-4" />}
      onClick={() => {
        const book = sheets();
        downloadWorkbook(filename, book);
        toast.show({ title: "Fichier Excel enregistré", description: `${filename}.xlsx — ${book.length} feuilles : ${book.map((s) => s.name).join(", ")}.` });
      }}
    >
      Enregistrer dans Excel
    </Button>
  );
}

export function DataStatusBadge({ status }: { status: DataStatus }) {
  return (
    <Badge tone={DATA_STATUS_TONE[status]} dot>
      {status}
    </Badge>
  );
}

const DOC_STATE_TONE: Record<CadrageDocState, Tone> = { Reçu: "neutral", "À revoir": "warn", Exploitable: "success" };

export function DocStateBadge({ state }: { state: CadrageDocState }) {
  return (
    <Badge tone={DOC_STATE_TONE[state]} dot>
      {state}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Values with their provenance                                        */
/* ------------------------------------------------------------------ */

export interface DatumHandlers {
  onProof: (d: CadrageDatum) => void;
  onConfirm?: (d: CadrageDatum) => void;
  onEdit?: (d: CadrageDatum) => void;
  onResolve?: (d: CadrageDatum) => void;
  /** « Créer un essai pour lever l'inconnue » (reference product sheet). */
  onTrial?: (d: CadrageDatum) => void;
  /** Shows what each value is: sourced fact, measurement, assumption or system proposal. */
  showNature?: boolean;
}

function DatumRow({ d, onProof, onConfirm, onEdit, onResolve, onTrial, showNature }: { d: CadrageDatum } & DatumHandlers) {
  const conflict = d.status === "Contradictoire";
  const missing = d.status === "Non documentée";
  const nature = showNature ? natureOf(d) : undefined;
  const proposal = d.nature === "Proposition IA";
  return (
    <li className={cn("grid items-start gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[190px_minmax(0,1fr)_auto]", conflict && "bg-danger-50/50")}>
      <p className="text-sm font-medium text-ink-600">
        {d.label}
        {d.critical && (
          <span className="ml-1 text-danger-600" title="Valeur d'identité : confirmation requise" aria-label="Valeur d'identité">
            *
          </span>
        )}
      </p>
      <div className="min-w-0">
        {conflict ? (
          <ul className="space-y-1">
            {(d.alternatives ?? []).map((a) => (
              <li key={`${a.value}-${a.source.document}`} className="text-[15px] text-ink-900">
                <span className="font-semibold">{a.value}</span>
                <span className="text-sm text-ink-500"> — {a.source.document}</span>
              </li>
            ))}
          </ul>
        ) : missing ? (
          <p className="text-[15px] text-ink-400">Non documenté dans les sources disponibles</p>
        ) : (
          <p className="text-[15px] font-semibold text-ink-900">{d.value}</p>
        )}
        {!conflict && !missing && (
          <p className="mt-0.5 truncate text-[13px] text-ink-500">{d.source ? `${d.source.document} · ${d.source.location}` : "Saisie manuelle — preuve à rattacher"}</p>
        )}
      </div>
      <div className="flex flex-col items-start gap-1 md:items-end">
        <DataStatusBadge status={d.status} />
        {nature && !conflict && <Badge tone={NATURE_TONE[nature]}>{nature === "Proposition IA" ? "Proposition du système" : nature}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2 md:col-start-2">
        {!missing && (
          <Button variant="ghost" size="sm" icon={<FileSearch className="h-4 w-4" />} onClick={() => onProof(d)}>
            Voir la preuve
          </Button>
        )}
        {d.status === "Extraite à confirmer" && onConfirm && (
          <Button variant="outline" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => onConfirm(d)}>
            {proposal ? "Accepter comme hypothèse" : "Confirmer"}
          </Button>
        )}
        {conflict && onResolve && (
          <Button size="sm" onClick={() => onResolve(d)}>
            Résoudre
          </Button>
        )}
        {!conflict && onEdit && (
          <Button variant="secondary" size="sm" onClick={() => onEdit(d)}>
            {missing ? "Renseigner" : proposal || isProvisional(d) ? "Remplacer" : "Corriger"}
          </Button>
        )}
        {onTrial && (missing || conflict || isProvisional(d)) && (
          <Button variant="ghost" size="sm" icon={<FlaskConical className="h-4 w-4" />} onClick={() => onTrial(d)}>
            Créer un essai
          </Button>
        )}
      </div>
    </li>
  );
}

export function DatumList({ data, className, ...handlers }: { data: CadrageDatum[]; className?: string } & DatumHandlers) {
  return (
    <ul className={cn("divide-y divide-line rounded-xl border border-line", className)}>
      {data.map((d) => (
        <DatumRow key={d.key} d={d} {...handlers} />
      ))}
    </ul>
  );
}

function SourceBlock({ source, value, chosen }: { source: DataSource; value?: string; chosen?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", chosen ? "border-brand-300 bg-brand-50/50" : "border-line bg-subtle")}>
      {value && <p className="mb-2 text-[15px] font-bold text-ink-900">{value}</p>}
      <p className="flex items-start gap-2 text-sm font-semibold text-ink-800">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden />
        {source.document}
      </p>
      <p className="mt-0.5 pl-6 text-[13px] text-ink-500">{source.location}</p>
      <blockquote className="mt-3 flex gap-2 rounded-lg border-l-4 border-brand-400 bg-white px-3 py-2.5 text-sm leading-relaxed text-ink-800">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
        {source.excerpt}
      </blockquote>
    </div>
  );
}

/** "Voir la preuve": the value on one side, where it was read on the other, and what happened to it since. */
export function ProofDrawer({ datum, context, onClose }: { datum: CadrageDatum | null; context?: string; onClose: () => void }) {
  return (
    <Drawer open={Boolean(datum)} onClose={onClose} title={datum?.label ?? ""} subtitle={context} widthClass="max-w-[520px]">
      {datum && (
        <div className="space-y-6">
          <div>
            <p className="text-[13px] text-ink-500">{datum.entity}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <p className="text-xl font-bold text-ink-900">{datum.status === "Contradictoire" ? "Valeur non résolue" : datum.value || "Non documentée"}</p>
              <DataStatusBadge status={datum.status} />
            </div>
            {datum.originalValue && datum.originalValue !== datum.value && (
              <p className="mt-1 text-sm text-ink-500">Valeur d&apos;origine lue : {datum.originalValue}</p>
            )}
          </div>

          <section>
            <h3 className="mb-2 text-[15px] font-bold text-ink-900">{datum.status === "Contradictoire" ? "Sources en contradiction" : "Extrait source"}</h3>
            {datum.status === "Contradictoire" ? (
              <div className="space-y-3">
                {(datum.alternatives ?? []).map((a) => (
                  <SourceBlock key={`${a.value}-${a.source.document}`} source={a.source} value={a.value} />
                ))}
                <p className="text-sm text-ink-600">
                  Vérifiez d&apos;abord s&apos;il s&apos;agit d&apos;un vrai conflit ou de contextes différents (pays, conditionnement, version). Les deux valeurs restent
                  visibles jusqu&apos;à une résolution justifiée.
                </p>
              </div>
            ) : datum.source ? (
              <SourceBlock source={datum.source} />
            ) : (
              <p className="rounded-xl border border-dashed border-line-strong bg-subtle px-4 py-3 text-sm text-ink-600">
                Valeur saisie à la main : aucun document n&apos;y est rattaché pour l&apos;instant. Importez le RCP ou la notice pour en faire la preuve.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-ink-900">
              <History className="h-4 w-4 text-ink-500" aria-hidden />
              Historique de la donnée
            </h3>
            <ol className="space-y-3 border-l-2 border-line pl-4">
              {datum.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="font-semibold text-ink-900">
                    {h.action} <span className="font-normal text-ink-500">— {h.author}, {formatDateTime(h.at)}</span>
                  </p>
                  <p className="text-ink-700">{h.value}</p>
                  {h.note && <p className="text-[13px] text-ink-500">{h.note}</p>}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] text-ink-500">Une correction ne modifie jamais le fichier d&apos;origine : elle crée une nouvelle version de la donnée.</p>
          </section>
        </div>
      )}
    </Drawer>
  );
}

/** Corrects (or types) a value, or chooses the applicable value of a contradiction — always with a reason. */
export function DatumModal({
  datum,
  mode,
  onClose,
  onSubmit,
  natureInput,
}: {
  datum: CadrageDatum;
  mode: "edit" | "resolve";
  onClose: () => void;
  onSubmit: (value: string, note: string, extra?: { nature: DataNature; source?: DataSource }) => void;
  /** Reference product sheet: the author says what the value is and, for a fact, which document proves it. */
  natureInput?: { documents: string[] };
}) {
  const [value, setValue] = useState(mode === "edit" && datum.nature !== "Proposition IA" ? datum.value : "");
  const [note, setNote] = useState("");
  const [nature, setNature] = useState<DataNature>(natureInput?.documents.length ? "Fait sourcé" : "Hypothèse");
  const [document, setDocument] = useState(natureInput?.documents[0] ?? "");
  const [location, setLocation] = useState("");
  const typing = datum.status === "Non documentée";
  const withNature = Boolean(natureInput) && mode === "edit";
  const needsNote = mode === "resolve" || (!typing && !withNature);
  const proofOk = !withNature || nature === "Hypothèse" || (nature === "Fait sourcé" ? Boolean(document && location.trim()) : Boolean(location.trim()));
  const valid = Boolean(value.trim()) && (!needsNote || Boolean(note.trim())) && proofOk && (mode === "resolve" || withNature || value.trim() !== datum.value);
  const submit = () => {
    if (!withNature) return onSubmit(value, note);
    const source: DataSource | undefined =
      nature === "Fait sourcé"
        ? { document, location: location.trim(), excerpt: value.trim() }
        : nature === "Résultat mesuré"
          ? { document: "Résultat de laboratoire", location: location.trim(), excerpt: value.trim() }
          : undefined;
    onSubmit(value, note, { nature, source });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "resolve" ? "Choisir la valeur applicable" : typing ? "Renseigner la valeur" : "Corriger la valeur"}
      subtitle={datum.label}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!valid} onClick={submit}>
            {mode === "resolve" ? "Retenir cette valeur" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {mode === "resolve" ? (
          <fieldset className="space-y-3">
            <legend className="sr-only">Valeurs en contradiction</legend>
            {(datum.alternatives ?? []).map((a) => (
              <div key={`${a.value}-${a.source.document}`} className={cn("rounded-xl border p-4", value === a.value ? "border-brand-400 bg-brand-50/50" : "border-line")}>
                <Radio name="valeur" checked={value === a.value} onChange={() => setValue(a.value)} label={a.value} description={`${a.source.document} · ${a.source.location}`} />
                <p className="mt-2 pl-8 text-sm italic text-ink-600">« {a.source.excerpt} »</p>
              </div>
            ))}
          </fieldset>
        ) : (
          <Field label="Valeur" required htmlFor="datum-value" hint={typing ? "La valeur sera marquée comme saisie manuellement, sans preuve rattachée." : `Valeur actuelle : ${datum.value}`}>
            <Input id="datum-value" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </Field>
        )}
        {withNature && (
          <>
            <Field label="Nature de la valeur" required htmlFor="datum-nature" hint={NATURES.find((n) => n.value === nature)?.detail}>
              <Select id="datum-nature" options={NATURES.filter((n) => n.value !== "Proposition IA").map((n) => ({ value: n.value, label: n.label }))} value={nature} onChange={(e) => setNature(e.target.value as DataNature)} />
            </Field>
            {nature === "Fait sourcé" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Document source" required htmlFor="datum-doc" error={natureInput?.documents.length ? undefined : "Importez d'abord le document dans l'onglet Sources."}>
                  <Select id="datum-doc" placeholder="Aucun document" options={natureInput?.documents ?? []} value={document} onChange={(e) => setDocument(e.target.value)} />
                </Field>
                <Field label="Emplacement" required htmlFor="datum-loc">
                  <Input id="datum-loc" placeholder="Ex. rubrique 5.2, page 4" value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
              </div>
            )}
            {nature === "Résultat mesuré" && (
              <Field label="Référence de la mesure" required htmlFor="datum-loc" hint="Lot du princeps, méthode et rapport : une mesure sans ces repères n'est pas comparable.">
                <Input id="datum-loc" placeholder="Ex. lot 24A118, méthode M-01, rapport RA-012" value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
            )}
          </>
        )}
        <Field label={mode === "resolve" ? "Justification du choix" : "Motif"} required={needsNote} optional={!needsNote} htmlFor="datum-note">
          <Textarea
            id="datum-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={mode === "resolve" ? "Ex. le RCP en vigueur dans le pays de la référence fait foi." : "Ex. erreur de lecture, valeur vérifiée sur le document."}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */

const QUALITY_SEGMENTS: { key: keyof Omit<InfoQuality, "total">; label: string; bar: string }[] = [
  { key: "verified", label: "vérifiées", bar: "bg-success-500" },
  { key: "toConfirm", label: "à confirmer", bar: "bg-warn-500" },
  { key: "conflicting", label: "contradictoires", bar: "bg-danger-500" },
  { key: "missing", label: "non documentées", bar: "bg-ink-300" },
];

/** Quality of the information: four counts, never merged into a single confidence percentage. */
export function QualityBar({ quality, compact }: { quality: InfoQuality; compact?: boolean }) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={QUALITY_SEGMENTS.map((s) => `${quality[s.key]} ${s.label}`).join(", ")}>
        {QUALITY_SEGMENTS.map((s) => (quality[s.key] ? <span key={s.key} className={s.bar} style={{ width: `${(quality[s.key] / quality.total) * 100}%` }} /> : null))}
      </div>
      <ul className={cn("mt-2 flex flex-wrap gap-x-4 gap-y-1", compact ? "text-xs" : "text-[13px]")}>
        {QUALITY_SEGMENTS.filter((s) => !compact || quality[s.key] > 0).map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-ink-600">
            <span className={cn("h-2 w-2 rounded-full", s.bar)} aria-hidden />
            <span className="font-semibold text-ink-900">{quality[s.key]}</span> {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const UNKNOWN_TONE: Record<Unknown["kind"], Tone> = { Donnée: "warn", Document: "info", Équipe: "neutral", Périmètre: "neutral" };

export function UnknownsList({ items, limit }: { items: Unknown[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? items.slice(0, limit) : items;
  if (!items.length) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm text-ink-800">
        <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
        Aucune inconnue identifiée à ce stade.
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-2.5">
        {shown.map((u) => (
          <li key={u.id} className="flex items-start gap-3">
            <Badge tone={UNKNOWN_TONE[u.kind]} className="mt-0.5 w-[76px] justify-center">
              {u.kind}
            </Badge>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink-900">{u.label}</p>
              <p className="text-[13px] leading-snug text-ink-500">{u.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {limit && items.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
          {all ? "Réduire" : `Afficher les ${items.length} inconnues`}
        </button>
      )}
    </>
  );
}

/** Expected documents: present in the list does not mean sufficient in content. */
export function ExpectedDocuments({ expected, received }: { expected: ExpectedDocument[]; received: Set<string> }) {
  return (
    <ul className="divide-y divide-line">
      {expected.map((e) => {
        const ok = received.has(e.type);
        return (
          <li key={e.type} className="flex items-start gap-3 py-2.5">
            {ok ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden /> : <Clock className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" strokeWidth={1.7} aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink-900">{e.type}</p>
              <p className="text-[13px] leading-snug text-ink-500">{e.why}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={ok ? "success" : e.neededFor.startsWith("G0") ? "warn" : "neutral"}>{ok ? "Reçu" : "Attendu"}</Badge>
              <span className="text-xs text-ink-500">{e.neededFor}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The seven business steps of the project, adapted to its dosage form. */
export function PathwaySteps({ family, current = 0 }: { family: Family; current?: number }) {
  return (
    <ol className="space-y-2">
      {pathwayFor(family).map((s) => (
        <li key={s.n} className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-2.5", s.n === current ? "border-brand-300 bg-brand-50/60" : "border-line")}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-700 ring-1 ring-brand-100">{s.n}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink-900">{s.title}</p>
            <p className="text-[13px] leading-snug text-ink-500">{s.detail}</p>
          </div>
          {s.gate && <Badge tone="neutral">{s.gate}</Badge>}
        </li>
      ))}
    </ol>
  );
}

export function SectionTitle({ icon: Icon, title, subtitle, aside }: { icon: LucideIcon; title: string; subtitle?: string; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.6} aria-hidden />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </div>
  );
}
