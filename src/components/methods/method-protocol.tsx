"use client";

import { Check, CircleAlert, CircleCheck, Download, FileText, History, Paperclip, Plus, Save, Send, Trash2, UserPlus, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea, controlClass } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { M01_SOURCE_CRITERIA, PEOPLE_LAB } from "@/lib/data-lab";
import { downloadText, formatDateTime, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { methodContext } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { Method, MethodProtocol, ProtocolParams, Tone } from "@/lib/types";
import { findMethodBySlug } from "./method-frame";

const STATUS_TONE: Record<MethodProtocol["status"], Tone> = { Brouillon: "neutral", "En revue": "warn", Approuvé: "success" };

const PARAMS: { key: keyof ProtocolParams; label: string; required?: boolean; unitKey?: keyof ProtocolParams; units?: string[] }[] = [
  { key: "equipment", label: "Équipement", required: true },
  { key: "wavelength", label: "Longueur d'onde", required: true, unitKey: "wavelengthUnit", units: ["nm"] },
  { key: "column", label: "Colonne", required: true },
  { key: "temperature", label: "Température colonne", unitKey: "temperatureUnit", units: ["°C"] },
  { key: "mobilePhase", label: "Phase mobile", required: true },
  { key: "injection", label: "Volume d'injection", unitKey: "injectionUnit", units: ["µL"] },
  { key: "flow", label: "Débit", required: true, unitKey: "flowUnit", units: ["mL/min"] },
  { key: "duration", label: "Durée d'analyse", unitKey: "durationUnit", units: ["min", "h"] },
];

const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[17px] font-bold text-ink-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function RowLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-sm text-ink-700">
      {children}
      {required && <span className="text-danger-600"> *</span>}
    </span>
  );
}

function ProtocolEditor({ method, protocol }: { method: Method; protocol: MethodProtocol }) {
  const state = useDemo();
  const go = useGuideNav();
  const guideApprove = useGuideTarget(25);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<MethodProtocol>(protocol);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const editable = protocol.status === "Brouillon";
  const ctx = methodContext(state, method);
  const project = state.projects.find((p) => p.code === method.projectCode);
  const equipment = state.resources.filter((r) => r.category === "Équipement");
  const people = Object.values(PEOPLE_LAB).filter((p) => !draft.reviewers.some((r) => r.name === p.name));

  const setParam = (key: keyof ProtocolParams, value: string) => setDraft((d) => ({ ...d, params: { ...d.params, [key]: value } }));
  const setCriterion = (id: string, patch: Partial<{ value: string; unit: string }>) =>
    setDraft((d) => ({ ...d, criteria: d.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const touch = (key: string) => setTouched((t) => new Set(t).add(key));

  const missingParams = PARAMS.filter((p) => p.required && !draft.params[p.key].trim());
  const missingCriteria = draft.criteria.filter((c) => !c.value.trim());
  const textMissing = !draft.objective.trim() || !draft.preparation.trim();
  const complete = !missingParams.length && !missingCriteria.length && !textMissing;
  const showError = (key: string, empty: boolean) => empty && (attempted || touched.has(key));

  const saveDraft = (silent = false) => labActions.updateProtocol(method.ref, draft, silent);

  const submit = () => {
    setAttempted(true);
    if (!complete) {
      toast.show({ title: "Protocole incomplet", description: "Complétez les paramètres et tous les critères d'acceptation.", tone: "warn" });
      return;
    }
    saveDraft(true);
    labActions.submitProtocol(method.ref);
    toast.show({ title: "Protocole soumis en revue", description: `Relecteurs notifiés : ${draft.reviewers.map((r) => r.name).join(", ")}.` });
  };

  const approve = () => {
    labActions.approveProtocol(method.ref);
    toast.show({ title: "Protocole approuvé", description: "Les relecteurs ont approuvé la version v1 : les essais peuvent être préparés." });
    if (guideApprove) go(25);
  };

  const prefill = () => {
    setDraft((d) => ({
      ...d,
      criteria: d.criteria.map((c) => (c.value.trim() ? c : { ...c, value: (method.ref === "M-01" && M01_SOURCE_CRITERIA[c.id]) || "Selon Pharmacopée" })),
    }));
    toast.show({ title: "Critères pré-remplis", description: "Valeurs reprises du dossier source — vérifiez-les avant de soumettre.", tone: "info" });
  };

  const infoRows: [string, ReactNode][] = [
    ["Méthode", `${method.ref} • ${method.name}`],
    ["Projet", project ? `${project.code} • ${project.name}` : method.projectCode],
    ["Formule", ctx.formula || "—"],
    ["Lot", ctx.lotCode || "—"],
    ["Équipement principal", draft.params.equipment || "—"],
    [
      "Statut",
      <Badge key="s" tone={STATUS_TONE[protocol.status]} dot>
        {protocol.status}
      </Badge>,
    ],
    ["Version", protocol.version],
    ["Créé le", formatNumeric(protocol.createdAt)],
    ["Modifié le", formatNumeric(protocol.updatedAt)],
    ["Responsable", protocol.owner],
  ];

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-ink-900">Protocole analytique — {protocol.version}</h2>
          <Badge tone={STATUS_TONE[protocol.status]} dot size="md">
            {protocol.status}
          </Badge>
        </div>
        <fieldset disabled={!editable} className="mt-4 min-w-0 space-y-4">
          <Section title="Objectif">
            <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
              <RowLabel required>Objectif</RowLabel>
              <Textarea
                aria-label="Objectif"
                rows={2}
                maxLength={500}
                value={draft.objective}
                invalid={showError("objective", !draft.objective.trim())}
                onBlur={() => touch("objective")}
                onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
                className="text-sm"
              />
            </div>
          </Section>

          <Section title="Préparation des échantillons">
            <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
              <RowLabel required>Mode opératoire</RowLabel>
              <Textarea
                aria-label="Mode opératoire"
                rows={2}
                maxLength={500}
                value={draft.preparation}
                invalid={showError("preparation", !draft.preparation.trim())}
                onBlur={() => touch("preparation")}
                onChange={(e) => setDraft((d) => ({ ...d, preparation: e.target.value }))}
                className="text-sm"
              />
            </div>
          </Section>

          <Section title="Paramètres de méthode">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2">
              {PARAMS.map((p) => (
                <div key={p.key} className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-2">
                  <RowLabel required={p.required}>{p.label}</RowLabel>
                  <div className="flex min-w-0 gap-2">
                    {p.key === "equipment" ? (
                      <Select
                        aria-label={p.label}
                        size="sm"
                        placeholder="Sélectionner"
                        options={equipment.map((r) => r.id)}
                        value={draft.params.equipment}
                        invalid={showError(p.key, !draft.params.equipment)}
                        onChange={(e) => setParam("equipment", e.target.value)}
                        className="min-w-0 flex-1"
                      />
                    ) : (
                      <input
                        aria-label={p.label}
                        value={draft.params[p.key]}
                        onBlur={() => touch(p.key)}
                        onChange={(e) => setParam(p.key, e.target.value)}
                        className={cn(controlClass, "h-9 min-w-0 flex-1 px-3 text-sm", showError(p.key, Boolean(p.required) && !draft.params[p.key].trim()) && "border-danger-500")}
                      />
                    )}
                    {p.unitKey && p.units && (
                      <Select aria-label={`Unité — ${p.label}`} size="sm" options={p.units} value={draft.params[p.unitKey]} onChange={(e) => setParam(p.unitKey!, e.target.value)} className="w-28 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Critères d'acceptation"
            action={
              editable && missingCriteria.length > 0 ? (
                <Button variant="link" size="sm" onClick={prefill} guide={25} guideHint="À faire d'abord : compléter les critères d'acceptation, puis soumettre le protocole.">
                  Pré-remplir depuis le dossier source
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-2.5">
              {draft.criteria.map((c) => {
                const error = showError(c.id, !c.value.trim());
                return (
                  <div key={c.id} className="grid gap-2 md:grid-cols-[210px_minmax(0,1fr)_110px] md:items-start">
                    <span className="pt-2 text-sm text-ink-700">{c.label}</span>
                    <div>
                      <Input
                        aria-label={c.label}
                        placeholder="À définir selon le protocole"
                        value={c.value}
                        invalid={error}
                        onBlur={() => touch(c.id)}
                        onChange={(e) => setCriterion(c.id, { value: e.target.value })}
                        className="h-9 text-sm"
                      />
                      {error && (
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-danger-600" role="alert">
                          <CircleAlert className="h-4 w-4 fill-danger-600 text-white" aria-hidden />
                          Ce critère est obligatoire.
                        </p>
                      )}
                    </div>
                    <Input aria-label={`Unité — ${c.label}`} value={c.unit} onChange={(e) => setCriterion(c.id, { unit: e.target.value })} className="h-9 text-sm" />
                  </div>
                );
              })}
            </div>
          </Section>

          {draft.extraSteps.length > 0 && (
            <Section title="Étapes complémentaires">
              <ol className="space-y-2.5">
                {draft.extraSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink-700">{i + 1}</span>
                    <Textarea
                      aria-label={`Étape complémentaire ${i + 1}`}
                      rows={2}
                      value={step}
                      placeholder="Décrire l'étape…"
                      onChange={(e) => setDraft((d) => ({ ...d, extraSteps: d.extraSteps.map((x, j) => (j === i ? e.target.value : x)) }))}
                      className="text-sm"
                    />
                    <button
                      type="button"
                      aria-label={`Supprimer l'étape ${i + 1}`}
                      onClick={() => setDraft((d) => ({ ...d, extraSteps: d.extraSteps.filter((_, j) => j !== i) }))}
                      className="mt-2 cursor-pointer rounded p-1 text-ink-500 hover:text-danger-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {draft.attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {draft.attachments.map((name) => (
                <li key={name} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                  <Paperclip className="h-4 w-4 text-ink-500" aria-hidden />
                  {name}
                  {editable && (
                    <button type="button" aria-label={`Retirer ${name}`} onClick={() => setDraft((d) => ({ ...d, attachments: d.attachments.filter((x) => x !== name) }))} className="cursor-pointer text-ink-500 hover:text-danger-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {editable ? (
          <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-line pt-4">
            <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft((d) => ({ ...d, extraSteps: [...d.extraSteps, ""] }))}>
              Ajouter une étape
            </Button>
            <Button variant="outline" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              Joindre un document
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setDraft((d) => ({ ...d, attachments: [...new Set([...d.attachments, file.name])] }));
                e.target.value = "";
              }}
            />
            <div className="ml-auto flex flex-wrap items-start gap-3">
              <Button
                variant="outline"
                icon={<Save className="h-4 w-4" />}
                onClick={() => {
                  saveDraft();
                  toast.show({ title: "Brouillon enregistré", description: `Critères définis : ${draft.criteria.length - missingCriteria.length} / ${draft.criteria.length}.` });
                }}
              >
                Enregistrer le brouillon
              </Button>
              <div className="text-right">
                <Button icon={<Send className="h-4 w-4" />} onClick={submit} disabled={!complete} guide={25} className="disabled:bg-slate-300">
                  Soumettre le protocole
                </Button>
                {!complete && <p className="mt-1 max-w-56 text-xs text-ink-500">Compléter tous les critères pour pouvoir soumettre.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "mt-5 flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm",
              protocol.status === "Approuvé" ? "bg-success-50 text-success-700" : "bg-warn-50 text-warn-700",
            )}
          >
            {protocol.status === "Approuvé" ? <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
            <span className="flex-1 font-medium">
              {protocol.status === "Approuvé"
                ? `Protocole approuvé le ${formatNumeric(protocol.approvedAt ?? protocol.updatedAt)} — les essais peuvent être préparés.`
                : `Protocole soumis ${protocol.submittedAt ? `le ${formatDateTime(protocol.submittedAt)} ` : ""}— en attente des relecteurs.`}
            </span>
            {protocol.status === "Approuvé" && (
              <LinkButton href={`/methodes/${method.ref.toLowerCase()}/essais`} guide={25}>
                Préparer les essais
              </LinkButton>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="text-lg font-bold text-ink-900">Informations générales</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            {infoRows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3 py-2">
                <dt className="text-ink-600">{label}</dt>
                <dd className="text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-bold text-ink-900">Versions</h2>
          <ul className="mt-3 space-y-2">
            {method.versions.map((v) => (
              <li key={v.version} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
                <span className="font-bold text-ink-900">{v.version}</span>
                <Badge tone={v.status === "Approuvé" ? "success" : v.status === "Brouillon" ? "neutral" : "neutral"} dot>
                  {v.status}
                </Badge>
                <span className="ml-auto text-sm text-ink-600">{formatNumeric(v.date)}</span>
                <Menu
                  label={`Actions pour ${v.version}`}
                  items={[
                    { label: "Voir l'historique", icon: History, href: `/methodes/${method.ref.toLowerCase()}/historique` },
                    {
                      label: "Télécharger",
                      icon: Download,
                      onSelect: () => {
                        downloadText(`${method.ref}-protocole-${v.version}.txt`, `${method.ref} — protocole ${v.version}\nObjectif : ${protocol.objective}\n`);
                        toast.show({ title: "Téléchargement lancé", description: `${method.ref} — ${v.version}` });
                      },
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink-900">Relecteurs</h2>
            {editable && (
              <Menu
                label="Ajouter un relecteur"
                widthClass="w-72"
                triggerClassName="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-300 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                trigger={
                  <>
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Ajouter un relecteur
                  </>
                }
                items={
                  people.length
                    ? people.map((p) => ({
                        label: p.name,
                        description: p.role,
                        onSelect: () => {
                          setDraft((d) => ({ ...d, reviewers: [...d.reviewers, { ...p, status: "En attente" }] }));
                          labActions.addReviewer(method.ref, p);
                        },
                      }))
                    : [{ label: "Aucun autre relecteur", disabled: true }]
                }
              />
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {protocol.reviewers.map((r) => (
              <li key={r.name} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials(r.name)}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-semibold text-ink-900">{r.name}</span>
                  <span className="block text-ink-500">{r.role}</span>
                </span>
                <Badge tone={r.status === "Approuvé" ? "success" : "neutral"} size="md">
                  {r.status}
                </Badge>
              </li>
            ))}
          </ul>
          {protocol.status === "En revue" && (
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/70 p-3">
              <p className="text-sm text-ink-600">Démonstration : simulez la réponse des relecteurs pour poursuivre.</p>
              <Button className="mt-2 w-full" icon={<Check className="h-4 w-4" />} onClick={approve} guide={25}>
                Simuler l&apos;approbation des relecteurs
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">Critères à compléter</h2>
            <span className="text-sm font-semibold text-ink-700">
              {draft.criteria.length - missingCriteria.length} / {draft.criteria.length}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {draft.criteria.map((c) => {
              const filled = Boolean(c.value.trim());
              const error = showError(c.id, !filled);
              return (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  {filled ? (
                    <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden />
                  ) : error ? (
                    <CircleAlert className="h-5 w-5 shrink-0 fill-danger-600 text-white" aria-hidden />
                  ) : (
                    <span className="h-5 w-5 shrink-0 rounded border-2 border-line-strong" aria-hidden />
                  )}
                  <span className="flex-1 text-ink-800">{c.label}</span>
                  <span className={cn("font-medium", filled ? "text-success-700" : error ? "text-danger-600" : "text-ink-500")}>{filled ? "Défini" : "À définir"}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function MethodProtocolView({ slug }: { slug: string }) {
  const state = useDemo();
  const method = findMethodBySlug(state, slug);
  if (!method) return null;
  const n = method.ref === "M-01" ? 24 : undefined;

  if (!method.protocol) {
    const confirmed = method.reference.applicability === "Confirmée";
    return (
      <>
        <Card className="mt-5">
          <EmptyState
            icon={FileText}
            title="Aucun protocole pour le moment"
            description={
              confirmed
                ? "L'applicabilité est confirmée : vous pouvez préparer la première version du protocole."
                : "L'applicabilité de la méthode doit être confirmée dans l'onglet « Référence » avant de préparer le protocole."
            }
            action={
              confirmed ? (
                <Button
                  icon={<FileText className="h-4 w-4" />}
                  onClick={() => {
                    labActions.createProtocol(method.ref);
                    toast.show({ title: "Protocole v1 créé" });
                  }}
                >
                  Préparer le protocole
                </Button>
              ) : (
                <LinkButton href={`/methodes/${method.ref.toLowerCase()}`}>Confirmer l&apos;applicabilité</LinkButton>
              )
            }
          />
        </Card>
        <ScreenRef n={n} label="Méthode — protocole" />
      </>
    );
  }

  return (
    <>
      <ProtocolEditor key={`${method.ref}-${method.protocol.status}-${method.protocol.version}`} method={method} protocol={method.protocol} />
      <ScreenRef n={n} label="Méthode — protocole" />
    </>
  );
}
