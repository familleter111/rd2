"use client";

import {
  BarChart3,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Factory,
  FileText,
  FlaskConical,
  Info,
  Settings,
  SquareCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GuideDot } from "@/components/guide/guide-mark";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { DOC_TYPES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import type { DemoState } from "@/lib/data";
import { SECTION_TONE, allSections, dossierComplete, missingElements, moduleStatus } from "@/lib/dossier-selectors";
import { formatFileSize } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { dossierActions } from "@/lib/store";
import type { Dossier, DossierRequirement, SectionIcon, SectionStatus } from "@/lib/types";
import { DossierHeader, DossierMissing, DossierTabs, FormulaMeta, projectCrumbs, useDossier } from "./dossier-frame";

export const SECTION_ICONS: Record<SectionIcon, LucideIcon> = {
  settings: Settings,
  factory: Factory,
  flask: FlaskConical,
  chart: BarChart3,
  doc: FileText,
};

export function SectionBadge({ status }: { status: SectionStatus }) {
  return (
    <Badge tone={SECTION_TONE[status]} size="md" className="gap-1.5">
      <StatusDot tone={SECTION_TONE[status]} />
      {status}
    </Badge>
  );
}

/** Adds a document to a section of the dossier (and answers a missing element when there is one). */
export function AddDossierDocumentModal({
  dossier,
  open,
  requirement,
  onClose,
}: {
  dossier: Dossier;
  open: boolean;
  requirement?: DossierRequirement;
  onClose: () => void;
}) {
  const sections = allSections(dossier);
  const [sectionId, setSectionId] = useState(requirement?.sectionId ?? "developpement");
  const [name, setName] = useState(requirement?.docName ?? "");
  const [type, setType] = useState(requirement?.docType ?? DOC_TYPES[0]);
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const exampleFile = { name: `${(name || "document").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_")}_v1.pdf`, size: "1,4 Mo" };

  const submit = () => {
    setAttempted(true);
    if (!file || !name.trim()) return;
    dossierActions.addDossierDocument(dossier.projectCode, {
      sectionId,
      name: name.trim(),
      type,
      file: file.name,
      size: file.size,
      requirementId: requirement && requirement.sectionId === sectionId ? requirement.id : undefined,
    });
    toast.show({ title: "Document ajouté au dossier", description: `${name.trim()} — en revue, lié à la section.` });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter un document"
      subtitle={`Dossier ${dossier.projectCode}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit}>Ajouter au dossier</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Section du dossier" required htmlFor="dd-section">
          <Select
            id="dd-section"
            options={sections.map(({ section }) => ({ value: section.id, label: `${section.code} — ${section.title}` }))}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          />
        </Field>
        <Field label="Nom du document" required htmlFor="dd-name" error={attempted && !name.trim() ? "Donnez un nom au document." : null}>
          <Input id="dd-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type de document" htmlFor="dd-type">
          <Select id="dd-type" options={DOC_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
        </Field>
        <Field label="Fichier" required error={attempted && !file ? "Sélectionnez un fichier." : null}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-brand-200 bg-subtle px-4 py-3 hover:border-brand-300">
              <CloudUpload className="h-6 w-6 text-brand-500" aria-hidden />
              <span className="text-sm">
                <span className="block font-semibold text-ink-900">{file ? file.name : "Choisir un fichier"}</span>
                <span className="text-ink-500">{file ? file.size : "PDF, DOCX • 10 Mo max"}</span>
              </span>
              <input
                type="file"
                accept=".pdf,.docx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile({ name: f.name, size: formatFileSize(f.size) });
                }}
              />
            </label>
            {!file && (
              <Button variant="ghost" size="sm" onClick={() => setFile(exampleFile)}>
                Utiliser un fichier d&apos;exemple
              </Button>
            )}
          </div>
        </Field>
        {requirement && requirement.sectionId === sectionId && (
          <p className="flex gap-2 rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2 text-sm text-ink-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            Ce document répond à l&apos;élément manquant « {requirement.label} ».
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Result of "Vérifier la complétude": status of every module and missing elements. */
export function CompletenessModal({ dossier, open, onClose, state }: { dossier: Dossier; open: boolean; onClose: () => void; state: DemoState }) {
  const missing = missingElements(state, dossier);
  return (
    <Modal open={open} onClose={onClose} title="Complétude du dossier" subtitle={`Dossier ${dossier.projectCode}`} size="lg">
      <p
        className={cn(
          "flex items-center gap-2 rounded-lg px-4 py-3 text-[15px] font-medium",
          missing.length ? "bg-warn-50 text-warn-700" : "bg-success-50 text-success-700",
        )}
      >
        {missing.length ? <CircleAlert className="h-5 w-5" aria-hidden /> : <CircleCheck className="h-5 w-5" aria-hidden />}
        {missing.length ? `${missing.length} élément(s) manquant(s) : la revue ne peut pas encore être préparée.` : "Dossier complet : la revue peut être préparée."}
      </p>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {dossier.modules.map((m) => (
          <li key={m.n} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink-900">
                Module {m.n} • {m.title}
              </span>
              <SectionBadge status={moduleStatus(m)} />
            </div>
            <ul className="mt-1 text-sm text-ink-600">
              {m.sections.map((x) => (
                <li key={x.id}>
                  {x.code} {x.title} — {x.status.toLowerCase()}
                </li>
              ))}
              {missingElements(state, dossier, m.n).map((r) => (
                <li key={r.id} className="font-medium text-danger-700">
                  Manquant : {r.label}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function DossierStructure({ slug }: { slug: string }) {
  const { state, project, dossier } = useDossier(slug);
  const [moduleN, setModuleN] = useState(3);
  const [addFor, setAddFor] = useState<{ open: boolean; requirement?: DossierRequirement; key: number }>({ open: false, key: 0 });
  const [checkOpen, setCheckOpen] = useState(false);
  const guideSection = useGuideTarget(49);

  if (!project) return null;
  if (!dossier) return <DossierMissing slug={slug} />;

  const mod = dossier.modules.find((m) => m.n === moduleN) ?? dossier.modules[0];
  const missing = missingElements(state, dossier, mod.n);
  const complete = dossierComplete(state, dossier);

  return (
    <>
      <DossierHeader
        crumbs={[...projectCrumbs(project), { label: "Dossier" }]}
        title={`Dossier ${project.code}`}
        meta={[project.name, project.dosage, <FormulaMeta key="f" formula={dossier.formula} prefix="Formulation " />]}
      />
      <DossierTabs slug={slug} />

      <div className="mt-5 flex items-start gap-4 rounded-xl border border-brand-100 bg-brand-50/70 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Info className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-ink-900">Organisation documentaire pour la préparation du dossier.</p>
          <p className="text-sm text-ink-600">Structure à adapter au pays et au type de demande.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,0.85fr)]">
        <Card className="h-fit p-4">
          <h2 className="px-1 text-lg font-bold text-ink-900">Structure du dossier (CTD)</h2>
          <ul className="mt-3 space-y-2">
            {dossier.modules.map((m) => {
              const active = m.n === mod.n;
              return (
                <li key={m.n}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setModuleN(m.n)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                      active ? "border-brand-200 bg-brand-50 shadow-[inset_4px_0_0_var(--color-brand-600)]" : "border-line hover:bg-subtle",
                    )}
                  >
                    <FileText className="h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink-900">Module {m.n}</span>
                      <span className="block truncate text-sm text-ink-600">{m.title}</span>
                    </span>
                    <SectionBadge status={moduleStatus(m)} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="h-fit p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-ink-900">
              Module {mod.n} • {mod.title}
            </h2>
            <SectionBadge status={moduleStatus(mod)} />
          </div>
          <p className="mt-1 text-[15px] text-ink-600">{mod.description}</p>
          <ul className="mt-4 space-y-3">
            {mod.sections.map((x) => {
              const Icon = SECTION_ICONS[x.icon];
              const guided = guideSection && x.id === "developpement";
              return (
                <li key={x.id}>
                  <Link
                    href={`/dossiers/${slug}/sections/${x.id}`}
                    className={cn("relative flex items-center gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-brand-200 hover:bg-subtle", guided && "border-brand-300")}
                  >
                    <Icon className="h-7 w-7 shrink-0 text-ink-800" strokeWidth={1.5} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink-900">{x.title}</span>
                      <span className="block text-sm text-ink-600">{x.summary}</span>
                    </span>
                    <SectionBadge status={x.status} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                    {guided && <GuideDot step={49} hint="Ouvrez la section « Développement pharmaceutique »." />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink-900">Éléments manquants – Module {mod.n}</h2>
              <Badge tone={missing.length ? "info" : "success"} size="md">
                {missing.length} élément{missing.length > 1 ? "s" : ""}
              </Badge>
            </div>
            {missing.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-3 text-sm font-medium text-success-700">
                <CircleCheck className="h-5 w-5" aria-hidden />
                Aucun élément manquant pour ce module.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {missing.map((r) => (
                  <li key={r.id} className="rounded-xl border border-danger-100 bg-danger-50/60 p-3">
                    <div className="flex items-start gap-3">
                      <FileText className="h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink-900">{r.label}</span>
                        <span className="block text-sm text-ink-600">{r.detail}</span>
                      </span>
                      <CircleAlert className="h-6 w-6 shrink-0 fill-danger-500 text-white" aria-label="Manquant" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 pl-9">
                      {r.kind === "document" ? (
                        <Button size="sm" variant="outline" onClick={() => setAddFor((a) => ({ open: true, requirement: r, key: a.key + 1 }))}>
                          Ajouter le document
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!r.docId) return;
                              dossierActions.approveDocument(r.docId, "Qualité");
                              toast.show({ title: "Synthèse approuvée", description: `${r.docName} — approuvée par Qualité.` });
                            }}
                          >
                            Approuver (Qualité)
                          </Button>
                          {r.docId && (
                            <LinkButton href={`/projets/${slug}/documents/${r.docId}`} variant="ghost" size="sm">
                              Voir le document
                            </LinkButton>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold text-ink-900">Actions</h2>
            <div className="mt-4 grid gap-3">
              <Button size="lg" icon={<FileText className="h-5 w-5" />} onClick={() => setAddFor((a) => ({ open: true, requirement: undefined, key: a.key + 1 }))}>
                Ajouter un document
              </Button>
              <Button
                size="lg"
                variant="outline"
                icon={<SquareCheck className="h-5 w-5" />}
                onClick={() => {
                  dossierActions.checkCompleteness(project.code, missingElements(state, dossier).length);
                  setCheckOpen(true);
                }}
              >
                Vérifier la complétude
              </Button>
              {complete ? (
                <LinkButton href={`/dossiers/${slug}/revues/nouvelle`} size="lg" variant="outline" icon={<Users className="h-5 w-5" />}>
                  Préparer une revue
                </LinkButton>
              ) : (
                <Button size="lg" variant="secondary" disabled icon={<Users className="h-5 w-5" />} className="disabled:bg-slate-100">
                  Préparer une revue
                </Button>
              )}
            </div>
            {!complete && <p className="mt-2 text-sm text-ink-500">Action disponible lorsque le dossier est complet.</p>}
          </Card>
        </div>
      </div>

      <AddDossierDocumentModal key={addFor.key} dossier={dossier} open={addFor.open} requirement={addFor.requirement} onClose={() => setAddFor((a) => ({ ...a, open: false }))} />
      <CompletenessModal dossier={dossier} open={checkOpen} onClose={() => setCheckOpen(false)} state={state} />
      <ScreenRef n={project.code === "CS-01" ? 48 : undefined} label="Dossiers & revues — structure CTD" />
    </>
  );
}
