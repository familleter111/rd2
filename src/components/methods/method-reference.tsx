"use client";

import { CircleCheck, Clock, Download, FileText, FolderOpen, Info, Paperclip, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { GuideSpot, useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadText, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { latestAnalysis } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { Applicability, Method, MethodDocument, MethodReference, Tone } from "@/lib/types";
import { findMethodBySlug } from "./method-frame";

const APPLICABILITY: { value: Applicability; dot: string }[] = [
  { value: "À confirmer", dot: "border-warn-500 bg-warn-100" },
  { value: "Confirmée", dot: "border-success-500 bg-success-500" },
  { value: "Non applicable", dot: "border-ink-400 bg-slate-200" },
];

const COLUMNS = ["C18, 150 × 4,6 mm, 5 µm", "C18, 250 × 4,6 mm, 5 µm", "C8, 150 × 4,6 mm, 3,5 µm"];
const REAGENTS = ["Tampon phosphate / acétonitrile", "Tampon acétate / méthanol", "Acide phosphorique 0,1 % / acétonitrile"];
const DOSSIERS = ["Interne", "Pharmacopée", "Fournisseur"];

const DOC_TONE: Record<MethodDocument["status"], Tone> = { Disponible: "success", "À créer": "neutral", "À venir": "neutral" };

function ProgressRow({ state, title, detail }: { state: "done" | "warn" | "todo" | "info"; title: string; detail: string }) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        state === "warn" ? "border-warn-100 bg-warn-50/60" : "border-line bg-white",
      )}
    >
      <span className="mt-0.5">
        {state === "done" ? (
          <CircleCheck className="h-7 w-7 fill-success-500 text-white" aria-hidden />
        ) : state === "warn" ? (
          <Clock className="h-7 w-7 text-warn-600" aria-hidden />
        ) : state === "info" ? (
          <Clock className="h-7 w-7 text-brand-600" aria-hidden />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300">
            <span className="h-3 w-3 rounded-full bg-white" />
          </span>
        )}
      </span>
      <span>
        <span className={cn("block font-semibold", state === "warn" ? "text-warn-700" : "text-ink-900")}>{title}</span>
        <span className={cn("block text-sm", state === "warn" ? "text-warn-700" : "text-ink-500")}>{detail}</span>
      </span>
    </li>
  );
}

function ReferenceForm({ method }: { method: Method }) {
  const state = useDemo();
  const router = useRouter();
  const go = useGuideNav();
  const guideProtocol = useGuideTarget(24);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<MethodReference>(method.reference);
  const [sourceName, setSourceName] = useState(method.reference.sourceDoc?.name ?? "");
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof MethodReference>(key: K, value: MethodReference[K]) => setForm((f) => ({ ...f, [key]: value }));

  const equipment = state.resources.filter((r) => r.category === "Équipement");
  const resource = state.resources.find((r) => r.id === form.equipment);
  const analysis = latestAnalysis(state, method.ref);
  const confirmed = form.applicability === "Confirmée";
  const errors = {
    reference: !form.reference.trim() ? "Renseignez la référence." : null,
    edition: !form.edition.trim() ? "Renseignez l'édition." : null,
    title: !form.title.trim() ? "Renseignez le titre." : null,
    source: !sourceName ? "Joignez le document source." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);
  const dirty = JSON.stringify(form) !== JSON.stringify(method.reference) || sourceName !== (method.reference.sourceDoc?.name ?? "");

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      toast.show({ title: "Fiche incomplète", description: "Complétez les champs obligatoires avant d'enregistrer.", tone: "warn" });
      return false;
    }
    const patch: Partial<MethodReference> = {};
    (Object.keys(form) as (keyof MethodReference)[]).forEach((k) => {
      if (k !== "sourceDoc" && form[k] !== method.reference[k]) (patch as Record<string, unknown>)[k] = form[k];
    });
    if (Object.keys(patch).length) labActions.saveReference(method.ref, patch);
    if (sourceName !== (method.reference.sourceDoc?.name ?? "")) labActions.replaceSourceDocument(method.ref, sourceName);
    return true;
  };

  const prepareProtocol = () => {
    if (dirty && !save()) return;
    labActions.createProtocol(method.ref);
    toast.show({ title: "Protocole v1 créé", description: "Complétez les paramètres et les critères d'acceptation." });
    if (guideProtocol) go(24);
    else router.push(`/methodes/${method.ref.toLowerCase()}/protocole`);
  };

  const essaisState = !analysis
    ? { state: "todo" as const, detail: "Les essais ne sont pas encore démarrés." }
    : analysis.status === "Validée"
      ? { state: "done" as const, detail: `Résultats de ${analysis.id} validés.` }
      : { state: "info" as const, detail: `${analysis.id} — ${analysis.status.toLowerCase()}.` };

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="min-w-0 space-y-5">
        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink-900">Informations de référence</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr_0.7fr]">
            <Field label="Dossier source" required htmlFor="ref-dossier">
              <Select id="ref-dossier" options={DOSSIERS} value={form.dossier} onChange={(e) => set("dossier", e.target.value)} />
            </Field>
            <Field label="Référence" required htmlFor="ref-code" error={show(errors.reference)}>
              <Input id="ref-code" value={form.reference} invalid={Boolean(show(errors.reference))} onChange={(e) => set("reference", e.target.value)} />
            </Field>
            <Field label="Édition" required htmlFor="ref-edition" error={show(errors.edition)}>
              <Input id="ref-edition" value={form.edition} invalid={Boolean(show(errors.edition))} onChange={(e) => set("edition", e.target.value)} />
            </Field>
          </div>
          <Field label="Titre" required htmlFor="ref-title" error={show(errors.title)} className="mt-4">
            <Input id="ref-title" value={form.title} invalid={Boolean(show(errors.title))} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="ref-desc" className="mt-4">
            <Textarea id="ref-desc" rows={3} maxLength={500} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <Field label="Document source" required error={show(errors.source)} className="mt-2">
            <div className="flex flex-col gap-3 sm:flex-row">
              {sourceName ? (
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <FileText className="h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.5} aria-hidden />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold text-ink-900">{sourceName}</span>
                    <span className="block text-ink-500">
                      {method.reference.sourceDoc?.folder ?? "Dossier interne"} <span className="mx-1 text-ink-300">|</span>
                      {formatNumeric(method.reference.sourceDoc?.date ?? "2026-09-24")}
                    </span>
                  </span>
                  <button type="button" aria-label="Retirer le document source" onClick={() => setSourceName("")} className="cursor-pointer rounded p-1 text-ink-500 hover:text-danger-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="flex flex-1 items-center rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm text-ink-500">Aucun document source joint.</p>
              )}
              <Button variant="outline" size="lg" icon={<Paperclip className="h-5 w-5" />} onClick={() => fileRef.current?.click()}>
                {sourceName ? "Remplacer le document" : "Joindre un document"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const names = Array.from(e.target.files ?? []).map((file) => file.name);
                  if (names.length) setSourceName(names.join(", "));
                  e.target.value = "";
                }}
              />
            </div>
          </Field>

          <Field label="Applicabilité" required htmlFor="ref-applicability" className="mt-4">
            <GuideSpot step={24} active={!confirmed} hint="À faire d'abord : passer l'applicabilité à « Confirmée », puis « Préparer le protocole ».">
              <div className="relative">
                <span
                  className={cn("pointer-events-none absolute left-3.5 top-1/2 z-[1] h-5 w-5 -translate-y-1/2 rounded-full border-[5px]", APPLICABILITY.find((a) => a.value === form.applicability)?.dot)}
                  aria-hidden
                />
                <Select
                  id="ref-applicability"
                  options={APPLICABILITY.map((a) => a.value)}
                  value={form.applicability}
                  onChange={(e) => set("applicability", e.target.value as Applicability)}
                  className="[&_select]:pl-11"
                />
              </div>
            </GuideSpot>
            {!confirmed && (
              <p className="mt-2 rounded-lg bg-subtle px-3 py-2 text-sm text-ink-600">L&apos;applicabilité doit être confirmée avant de pouvoir préparer le protocole.</p>
            )}
          </Field>
        </Card>

        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink-900">Ressources et conditions principales</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Équipement" required htmlFor="ref-equip" hint={resource ? `${resource.label} — disponible` : undefined}>
              <Select id="ref-equip" options={equipment.map((r) => ({ value: r.id, label: r.id }))} value={form.equipment} onChange={(e) => set("equipment", e.target.value)} />
            </Field>
            <Field label="Colonne" required htmlFor="ref-column">
              <Select id="ref-column" placeholder="À sélectionner" options={COLUMNS} value={form.column} onChange={(e) => set("column", e.target.value)} />
            </Field>
            <Field label="Réactifs principaux" required htmlFor="ref-reagents">
              <Select id="ref-reagents" placeholder="À confirmer" options={REAGENTS} value={form.reagents} onChange={(e) => set("reagents", e.target.value)} />
            </Field>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink-900">Documents associés</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {method.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-7 w-7 shrink-0 text-ink-600" strokeWidth={1.4} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900">{d.name}</span>
                  <span className="block truncate text-sm text-ink-500">{d.file ?? (d.status === "À créer" ? "Non disponible" : "À venir")}</span>
                </span>
                {d.date && <span className="hidden text-sm text-ink-600 sm:block">{formatNumeric(d.date)}</span>}
                <Badge tone={DOC_TONE[d.status]} size="md" className="rounded-full">
                  {d.status}
                </Badge>
                <Menu
                  label={`Actions pour ${d.name}`}
                  items={
                    d.status === "Disponible"
                      ? [
                          { label: "Ouvrir", icon: FolderOpen, onSelect: () => toast.show({ title: d.file ?? d.name, description: "Aperçu non disponible dans la démonstration.", tone: "info" }) },
                          {
                            label: "Télécharger",
                            icon: Download,
                            onSelect: () => {
                              downloadText(`${d.file ?? d.name}.txt`, `${method.ref} — ${d.name}\nDocument de démonstration.`);
                              toast.show({ title: "Téléchargement lancé", description: d.file ?? d.name });
                            },
                          },
                        ]
                      : [{ label: d.id === "d-protocol" ? "Créé depuis l'onglet Protocole" : "Disponible après validation", disabled: true }]
                  }
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink-900">État d&apos;avancement</h2>
          <ul className="mt-3 space-y-2">
            <ProgressRow
              state={sourceName ? "done" : "todo"}
              title="Source identifiée"
              detail={sourceName ? "Le document source est disponible." : "Joignez le document source de la méthode."}
            />
            <ProgressRow
              state={confirmed ? "done" : form.applicability === "Non applicable" ? "todo" : "warn"}
              title="Applicabilité"
              detail={
                confirmed
                  ? "L'applicabilité de la méthode est confirmée."
                  : form.applicability === "Non applicable"
                    ? "La méthode n'est pas applicable au projet."
                    : "L'applicabilité de la méthode doit être confirmée."
              }
            />
            <ProgressRow state={essaisState.state} title="Essais" detail={essaisState.detail} />
          </ul>
          {!confirmed && !method.protocol && (
            <p className="mt-3 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
              <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
              <span>
                <span className="block font-semibold text-brand-700">Action indisponible</span>
                <span className="text-ink-600">Le protocole ne peut pas être préparé tant que l&apos;applicabilité de la méthode n&apos;est pas confirmée.</span>
              </span>
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              size="lg"
              icon={<Save className="h-5 w-5" />}
              onClick={() => {
                if (save()) toast.show({ title: "Fiche de référence enregistrée", description: `${method.ref} • ${method.name}` });
              }}
              disabled={!dirty}
            >
              Enregistrer
            </Button>
            {method.protocol ? (
              <LinkButton href={`/methodes/${method.ref.toLowerCase()}/protocole`} size="lg" icon={<FileText className="h-5 w-5" />}>
                Voir le protocole
              </LinkButton>
            ) : (
              <Button size="lg" icon={<FileText className="h-5 w-5" />} disabled={!confirmed} onClick={prepareProtocol} guide={24}>
                Préparer le protocole
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function MethodReferenceView({ slug }: { slug: string }) {
  const state = useDemo();
  const method = findMethodBySlug(state, slug);
  if (!method) return null;
  return (
    <>
      <ReferenceForm key={`${method.ref}-${JSON.stringify(method.reference)}`} method={method} />
      <ScreenRef n={method.ref === "M-01" ? 23 : undefined} label="Méthode — référence" />
    </>
  );
}
