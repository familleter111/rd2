"use client";

import { ArrowLeft, BarChart3, Clock, FileArchive, FileText, FlaskConical, Factory, Info, Link2, ListOrdered, Pill, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { DemoState } from "@/lib/data";
import { findSection, openBlockingReserves, proofInfo } from "@/lib/dossier-selectors";
import { buildPdf, buildZip, downloadBlob, type PdfLine } from "@/lib/export-files";
import { DEMO_TODAY, formatDateTime, formatLong } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { dossierActions } from "@/lib/store";
import type { Dossier, Project } from "@/lib/types";
import { DossierHeader, DossierMissing, useDossier } from "./dossier-frame";

const SCOPE: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "developpement", label: "Développement pharmaceutique", icon: Pill },
  { id: "fabrication", label: "Fabrication", icon: Factory },
  { id: "controle", label: "Contrôles", icon: FlaskConical },
  { id: "stabilite", label: "Stabilité", icon: BarChart3 },
];

const OPTIONS = [
  { key: "toc", label: "Inclure la table des matières", detail: "Générer une table des matières avec numérotation des sections", icon: ListOrdered, short: "Table des matières incluse" },
  { key: "proofs", label: "Inclure les références des preuves", detail: "Ajouter les liens vers les documents sources dans l'export", icon: Link2, short: "Références des preuves incluses" },
  { key: "approved", label: "Versions approuvées uniquement", detail: "Exporter uniquement les documents dans leur version approuvée", icon: Clock, short: "Versions approuvées uniquement" },
] as const;

type OptionKey = (typeof OPTIONS)[number]["key"];

function content(state: DemoState, project: Project, dossier: Dossier, sections: string[], options: Record<OptionKey, boolean>) {
  const list = sections.map((id) => findSection(dossier, id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const proofLines = (section: (typeof list)[number]["section"]) =>
    section.proofs
      .map((p) => ({ p, info: proofInfo(state, dossier, p) }))
      .filter(({ info }) => !options.approved || info.approved)
      .map(({ p, info }) => `${p.label} — ${p.kind} (${info.status.toLowerCase()})`);
  return { list, proofLines };
}

export function DossierExport({ slug }: { slug: string }) {
  const { state, project, dossier } = useDossier(slug);
  const go = useGuideNav();
  const guideGenerate = useGuideTarget(53);
  const [format, setFormat] = useState<"PDF" | "ZIP">("PDF");
  const [sections, setSections] = useState<string[]>(SCOPE.map((s) => s.id));
  const [options, setOptions] = useState<Record<OptionKey, boolean>>({ toc: true, proofs: true, approved: true });

  if (!project) return null;
  if (!dossier) return <DossierMissing slug={slug} />;

  const fileName = `Dossier-${project.code}-revue.${format === "PDF" ? "pdf" : "zip"}`;
  const openReserves = openBlockingReserves(state, project.code).length + state.reserves.filter((r) => r.projectCode === project.code && !r.blocking && r.status === "Ouverte").length;
  const unfinished = sections.some((id) => findSection(dossier, id)?.section.status !== "Approuvée");
  const scopeLabels = SCOPE.filter((s) => sections.includes(s.id)).map((s) => s.label);

  const generate = () => {
    const { list, proofLines } = content(state, project, dossier, sections, options);
    if (format === "PDF") {
      const lines: PdfLine[] = [
        { text: "Laboratoires SIMED — Espace R&D", size: 10 },
        { text: `Dossier ${project.code} • ${project.name} ${project.dosage} — formule ${dossier.formula}`, size: 18, bold: true, gap: 6 },
        { text: `Copie de revue générée le ${formatLong(DEMO_TODAY)}. Cet export documentaire ne constitue pas un paquet eCTD validé.`, size: 10, gap: 4 },
      ];
      if (options.toc) {
        lines.push({ text: "Table des matières", size: 14, bold: true, gap: 14 });
        list.forEach(({ section }, i) => lines.push({ text: `${i + 1}. ${section.code} ${section.title} (${section.status.toLowerCase()})` }));
      }
      list.forEach(({ section }, i) => {
        lines.push({ text: `${i + 1}. ${section.code} ${section.title}`, size: 14, bold: true, gap: 16 });
        lines.push({ text: section.heading, bold: true, gap: 4 });
        lines.push({ text: section.intro });
        section.parts.forEach((p, j) => {
          lines.push({ text: `${i + 1}.${j + 1} ${p.title}`, bold: true, gap: 6 });
          lines.push({ text: p.text || "(paragraphe à rédiger)" });
        });
        if (options.proofs) {
          lines.push({ text: "Preuves associées", bold: true, gap: 6 });
          proofLines(section).forEach((t) => lines.push({ text: `• ${t}`, size: 10 }));
        }
      });
      downloadBlob(fileName, buildPdf(lines));
    } else {
      const files = [
        {
          name: "00_Sommaire.txt",
          content: [`Dossier ${project.code} — archive documentaire`, `Générée le ${formatLong(DEMO_TODAY)}`, "", ...list.map(({ section }) => `${section.code} ${section.title} — ${section.status}`)].join("\r\n"),
        },
        ...list.map(({ section }) => ({
          name: `${section.code}_${section.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_")}.txt`,
          content: [
            `${section.code} ${section.title}`,
            "",
            section.heading,
            section.intro,
            "",
            ...section.parts.map((p) => `${p.title}\r\n${p.text || "(paragraphe à rédiger)"}\r\n`),
            ...(options.proofs ? ["Preuves associées :", ...proofLines(section).map((t) => `- ${t}`)] : []),
          ].join("\r\n"),
        })),
      ];
      downloadBlob(fileName, buildZip(files));
    }
    dossierActions.recordExport(project.code, { format, fileName, sections: scopeLabels });
    toast.show({ title: "Export généré", description: `${fileName} — ${scopeLabels.length} section(s), copie de revue.` });
    if (guideGenerate) {
      toast.show({
        title: "Parcours : préparation du transfert",
        description: "La réserve R-01 est levée et les documents sont transmis à l'équipe Production.",
        tone: "info",
      });
      go(53);
    }
  };

  return (
    <>
      <DossierHeader
        crumbs={[{ label: "Dossiers & revues", href: "/dossiers" }, { label: project.code, href: `/dossiers/${slug}` }]}
        title={`Exporter le dossier ${project.code}`}
        meta={[
          <span key="p" className="font-semibold text-ink-900">
            {project.code} • {project.name}
          </span>,
          project.dosage,
          <span key="f" className="font-semibold text-ink-900">
            {dossier.formula}
          </span>,
        ]}
        aside={
          <LinkButton href={`/dossiers/${slug}`} variant="outline" size="lg" icon={<ArrowLeft className="h-5 w-5" />}>
            Retour au dossier
          </LinkButton>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-bold text-ink-900">Configuration de l&apos;export</h2>
          <p className="mt-4 font-semibold text-ink-900">Format de l&apos;export</p>
          <div role="radiogroup" aria-label="Format de l'export" className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: "PDF", title: "PDF de revue", detail: "Document structuré et paginé pour revue interne", icon: FileText },
                { value: "ZIP", title: "Archive documentaire (ZIP)", detail: "Dossier de documents sources au format natif", icon: FileArchive },
              ] as const
            ).map((f) => {
              const active = format === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFormat(f.value)}
                  className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left", active ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200" : "border-line hover:bg-subtle")}
                >
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", active ? "border-brand-600" : "border-line-strong")}>
                    {active && <span className="h-3 w-3 rounded-full bg-brand-600" />}
                  </span>
                  <f.icon className="h-7 w-7 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
                  <span>
                    <span className="block font-semibold text-ink-900">{f.title}</span>
                    <span className="block text-sm text-ink-600">{f.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-6 font-semibold text-ink-900">Périmètre du dossier</p>
          <p className="text-sm text-ink-600">Sélectionnez les sections à inclure dans l&apos;export.</p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {SCOPE.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Checkbox
                  checked={sections.includes(s.id)}
                  onChange={(v) => setSections((l) => (v ? SCOPE.map((x) => x.id).filter((id) => id === s.id || l.includes(id)) : l.filter((x) => x !== s.id)))}
                  label={
                    <span className="flex items-center gap-3">
                      <s.icon className="h-5 w-5 text-ink-700" strokeWidth={1.6} aria-hidden />
                      {s.label}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>

          <p className="mt-6 font-semibold text-ink-900">Options d&apos;export</p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {OPTIONS.map((o) => (
              <li key={o.key} className="px-4 py-3">
                <Checkbox
                  checked={options[o.key]}
                  onChange={(v) => setOptions((x) => ({ ...x, [o.key]: v }))}
                  label={
                    <span className="flex items-center gap-3 font-medium">
                      <o.icon className="h-5 w-5 text-ink-700" strokeWidth={1.6} aria-hidden />
                      {o.label}
                    </span>
                  }
                  description={<span className="pl-8">{o.detail}</span>}
                />
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-[15px] text-ink-700">
            <Info className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            Cet export documentaire ne constitue pas un paquet eCTD validé.
          </p>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-5 sm:p-6">
            <h2 className="text-xl font-bold text-ink-900">Aperçu de l&apos;export</h2>
            <div className="mt-4 flex flex-col items-center">
              <span className="flex h-40 w-32 flex-col items-center justify-center gap-4 rounded-lg border border-line bg-white shadow-card">
                {format === "PDF" ? <FileText className="h-10 w-10 text-danger-500" strokeWidth={1.4} aria-hidden /> : <FileArchive className="h-10 w-10 text-brand-600" strokeWidth={1.4} aria-hidden />}
                <span className="w-20 space-y-1.5" aria-hidden>
                  <span className="block h-1.5 rounded bg-slate-200" />
                  <span className="block h-1.5 w-3/4 rounded bg-slate-200" />
                  <span className="block h-1.5 w-1/2 rounded bg-slate-200" />
                </span>
              </span>
              <p className="mt-3 text-lg font-bold text-ink-900">{fileName}</p>
            </div>
            <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
              <div className="grid grid-cols-[140px_1fr] gap-3 px-4 py-3">
                <dt className="font-medium text-ink-700">Format</dt>
                <dd className="text-ink-900">{format === "PDF" ? "PDF de revue" : "Archive documentaire (ZIP)"}</dd>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 px-4 py-3">
                <dt className="font-medium text-ink-700">Périmètre</dt>
                <dd className="flex flex-wrap gap-2">
                  {scopeLabels.map((l) => (
                    <span key={l} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                      {l}
                    </span>
                  ))}
                  {scopeLabels.length === 0 && <span className="text-sm text-danger-600">Aucune section sélectionnée</span>}
                </dd>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 px-4 py-3">
                <dt className="font-medium text-ink-700">Options</dt>
                <dd>
                  <ul className="list-disc pl-5 text-sm text-ink-800">
                    {OPTIONS.filter((o) => options[o.key]).map((o) => (
                      <li key={o.key}>{o.short}</li>
                    ))}
                    {OPTIONS.every((o) => !options[o.key]) && <li>Aucune option</li>}
                  </ul>
                </dd>
              </div>
              <div className="grid grid-cols-[140px_1fr] items-center gap-3 px-4 py-3">
                <dt className="font-medium text-ink-700">Statut du document</dt>
                <dd>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
                    <FileText className="h-4 w-4" aria-hidden />
                    Copie de revue
                  </span>
                </dd>
              </div>
            </dl>
            {(openReserves > 0 || unfinished) && (
              <p className="mt-4 flex items-start gap-3 rounded-xl bg-warn-50 px-4 py-3 text-sm">
                <TriangleAlert className="h-5 w-5 shrink-0 text-warn-600" aria-hidden />
                <span>
                  <span className="block font-semibold text-warn-700">{openReserves > 0 ? "Des réserves restent ouvertes." : "Des sections sont encore en cours."}</span>
                  <span className="text-ink-700">Le dossier contient des éléments en cours de finalisation.</span>
                </span>
              </p>
            )}
            {dossier.exports.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-ink-900">Derniers exports</p>
                <ul className="mt-1 text-sm text-ink-600">
                  {dossier.exports.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      {e.fileName} — {formatDateTime(e.at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          <div className="flex flex-wrap justify-end gap-3">
            <LinkButton href={`/dossiers/${slug}`} variant="outline" size="lg" className="min-w-40">
              Annuler
            </LinkButton>
            <Button size="lg" icon={<FileText className="h-5 w-5" />} onClick={generate} disabled={sections.length === 0} guide={53} className="min-w-52">
              Générer l&apos;export
            </Button>
          </div>
        </div>
      </div>
      <ScreenRef n={project.code === "CS-01" ? 52 : undefined} label="Exporter le dossier" />
    </>
  );
}
