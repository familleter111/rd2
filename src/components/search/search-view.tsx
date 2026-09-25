"use client";

import {
  Box,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Folder,
  Info,
  Pill,
  SearchX,
  User,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadText, formatDateTime } from "@/lib/format";
import { search, type SearchKind, type SearchResult } from "@/lib/selectors";
import { useDemo } from "@/lib/store";
import type { ProjectDocument } from "@/lib/types";

const KIND_ICONS: Record<SearchKind, LucideIcon> = {
  Projet: Folder,
  Lot: Box,
  Document: FileText,
  Essai: FlaskConical,
};

/** Results shown per type in the "Tous" tab before the "Voir les N …" link. */
const GROUP_PREVIEW = 3;

const TABS: { value: "Tous" | SearchKind; label: string }[] = [
  { value: "Tous", label: "Tous" },
  { value: "Projet", label: "Projets" },
  { value: "Lot", label: "Lots" },
  { value: "Document", label: "Documents" },
  { value: "Essai", label: "Essais" },
];

function ResultCard({ result, selected, onSelect }: { result: SearchResult; selected: boolean; onSelect: () => void }) {
  const Icon = KIND_ICONS[result.kind];
  const StatusIcon = result.status.tone === "success" ? CircleCheck : result.status.tone === "warn" ? CircleAlert : result.kind === "Document" ? FileText : undefined;
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-card transition-colors sm:flex-row sm:items-center",
        selected ? "border-brand-400 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 cursor-pointer items-start gap-5 text-left" aria-pressed={selected}>
        <IconTile icon={Icon} size="lg" className="h-[72px] w-[72px] bg-brand-50 text-brand-600 [&_svg]:h-9 [&_svg]:w-9" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-brand-700">{result.kind}</span>
          <span className="block text-xl font-bold text-ink-900">{result.title}</span>
          <span className="mt-0.5 block text-[15px] text-ink-600">{result.subtitle}</span>
          <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
            {result.tags.filter(Boolean).map((tag, i) => {
              const TagIcon = i === 0 ? Folder : i === 1 && result.kind !== "Projet" ? Box : Pill;
              return (
                <span key={`${tag}-${i}`} className="flex items-center gap-2">
                  {i > 0 && <span className="h-4 w-px bg-line-strong" aria-hidden />}
                  <TagIcon className="h-4 w-4 text-ink-500" strokeWidth={1.7} aria-hidden />
                  {tag}
                </span>
              );
            })}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
        <Badge tone={result.status.tone} icon={StatusIcon} size="md">
          {result.status.label}
        </Badge>
        <LinkButton href={result.href} variant="outline" className="min-w-32" iconRight={<ChevronRight className="h-4 w-4" />}>
          Ouvrir
        </LinkButton>
      </div>
    </div>
  );
}

function DocumentPanel({ doc }: { doc: ProjectDocument }) {
  const { projects } = useDemo();
  const project = projects.find((p) => p.code === doc.projectCode);
  const rows: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: FileText, label: "Version", value: `v${doc.version}` },
    { icon: Folder, label: "Projet", value: project ? `${project.code} • ${project.name}` : doc.projectCode },
    ...(doc.lot ? [{ icon: Box, label: "Lot", value: `${doc.lot}${doc.formula ? ` (${doc.formula})` : ""}` }] : []),
    { icon: Pill, label: "Forme pharmaceutique", value: project?.form ?? "—" },
    { icon: User, label: "Propriétaire", value: doc.owner },
    { icon: Clock, label: "Dernière modification", value: formatDateTime(doc.updatedAt) },
    { icon: FileText, label: "Taille", value: doc.size },
    { icon: FileText, label: "Type de fichier", value: doc.fileType },
  ];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink-900">Document sélectionné</h2>
        <Badge tone="neutral" icon={FileText} size="md">
          {doc.status}
        </Badge>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <IconTile icon={FileText} size="lg" className="h-24 w-24 bg-brand-50 text-brand-600 [&_svg]:h-11 [&_svg]:w-11" />
        <div>
          <p className="text-2xl font-bold text-ink-900">
            {doc.name} v{doc.version}
          </p>
          <p className="text-[15px] text-ink-600">{doc.type}</p>
        </div>
      </div>
      <LinkButton
        href={`/projets/${doc.projectCode.toLowerCase()}/documents?doc=${doc.id}`}
        size="lg"
        className="mt-5 w-full justify-between"
        icon={<ExternalLink className="h-5 w-5" />}
        iconRight={<ChevronRight className="h-5 w-5" />}
      >
        <span className="flex-1 text-left">Ouvrir le document</span>
      </LinkButton>
      <Button
        variant="outline"
        size="lg"
        className="mt-3 w-full justify-between"
        icon={<Download className="h-5 w-5" />}
        iconRight={<ChevronRight className="h-5 w-5" />}
        onClick={() => {
          downloadText(`${doc.name} v${doc.version}.txt`, `${doc.name} — v${doc.version}\n${doc.type}\nDocument de démonstration.`);
          toast.show({ title: "Téléchargement lancé", description: `${doc.name} v${doc.version}` });
        }}
      >
        <span className="flex-1 text-left">Télécharger</span>
      </Button>
      <dl className="mt-5 divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 py-2.5 text-[15px]">
            <row.icon className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.7} aria-hidden />
            <dt className="w-48 shrink-0 text-ink-600">{row.label}</dt>
            <dd className="flex flex-1 items-center justify-between gap-2 text-ink-900">
              {row.value}
              {row.label === "Version" && (
                <Badge tone="neutral" icon={FileText}>
                  {doc.status}
                </Badge>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function GenericPanel({ result }: { result: SearchResult }) {
  const Icon = KIND_ICONS[result.kind];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink-900">{result.kind} sélectionné</h2>
        <Badge tone={result.status.tone} size="md" dot>
          {result.status.label}
        </Badge>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <IconTile icon={Icon} size="lg" className="h-24 w-24 bg-brand-50 text-brand-600 [&_svg]:h-11 [&_svg]:w-11" />
        <div className="min-w-0">
          <p className="text-2xl font-bold text-ink-900">{result.title}</p>
          <p className="text-[15px] text-ink-600">{result.subtitle}</p>
        </div>
      </div>
      <LinkButton href={result.href} size="lg" className="mt-5 w-full justify-between" icon={<ExternalLink className="h-5 w-5" />} iconRight={<ChevronRight className="h-5 w-5" />}>
        <span className="flex-1 text-left">Ouvrir {result.kind === "Essai" ? "l'essai" : result.kind === "Lot" ? "le lot" : "le projet"}</span>
      </LinkButton>
      <dl className="mt-5 divide-y divide-line">
        {result.details.map((row) => (
          <div key={row.label} className="flex items-center gap-3 py-2.5 text-[15px]">
            <dt className="w-48 shrink-0 text-ink-600">{row.label}</dt>
            <dd className="text-ink-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function SearchView({ query }: { query: string }) {
  const state = useDemo();
  const results = search(state, query);
  const [tab, setTab] = useState<"Tous" | SearchKind>("Tous");
  const firstDocument = results.find((r) => r.kind === "Document");
  const [selectedId, setSelectedId] = useState<string | null>(firstDocument?.id ?? results[0]?.id ?? null);

  const visible = tab === "Tous" ? results : results.filter((r) => r.kind === tab);
  const selected = results.find((r) => r.id === selectedId) ?? visible[0];
  const selectedDoc = selected?.kind === "Document" ? state.documents.find((d) => `d-${d.id}` === selected.id) : undefined;

  return (
    <>
      <PageHeader
        title="Résultats de recherche"
        subtitle={query ? `Résultats pour « ${query} »` : "Saisissez un code, un nom ou une référence dans la barre de recherche."}
        actions={
          <p className="flex max-w-sm gap-2.5 text-[15px] text-ink-600">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" aria-hidden />
            <span>
              Rechercher par code, nom ou référence.
              <br />
              Seulement les éléments accessibles à votre rôle.
            </span>
          </p>
        }
      />

      {results.length === 0 ? (
        <Card className="mt-8">
          <EmptyState
            icon={SearchX}
            title={query ? "Aucun résultat" : "Aucune recherche"}
            description={query ? `Aucun projet, lot, document ou essai ne correspond à « ${query} ».` : "Exemples : CS-01, E-02, Rapport, Friabilité."}
          />
        </Card>
      ) : (
        <>
          <div role="tablist" className="relative mt-7 inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-white p-1 shadow-card">
            {TABS.map((t) => {
              const count = t.value === "Tous" ? results.length : results.filter((r) => r.kind === t.value).length;
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "h-11 cursor-pointer whitespace-nowrap rounded-lg px-6 text-[16px] font-medium transition-colors",
                    active ? "bg-brand-600 font-semibold text-white" : "text-ink-700 hover:bg-brand-50",
                  )}
                >
                  {t.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
            <div className="space-y-4">
              {visible.length === 0 && (
                <Card>
                  <EmptyState icon={SearchX} title="Aucun résultat dans cette catégorie" />
                </Card>
              )}
              {tab === "Tous"
                ? TABS.filter((t) => t.value !== "Tous").map((t) => {
                    const group = results.filter((r) => r.kind === t.value);
                    if (!group.length) return null;
                    return (
                      <section key={t.value} aria-label={t.label} className="space-y-3">
                        {group.slice(0, GROUP_PREVIEW).map((r) => (
                          <ResultCard key={r.id} result={r} selected={r.id === selected?.id} onSelect={() => setSelectedId(r.id)} />
                        ))}
                        {group.length > GROUP_PREVIEW && (
                          <button
                            type="button"
                            onClick={() => setTab(t.value)}
                            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-200 bg-white/60 py-3 text-[15px] font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50/60"
                          >
                            Voir les {group.length} {t.label.toLowerCase()}
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </section>
                    );
                  })
                : visible.map((r) => <ResultCard key={r.id} result={r} selected={r.id === selected?.id} onSelect={() => setSelectedId(r.id)} />)}
            </div>
            {selected && (
              <Card className="h-fit p-6 xl:sticky xl:top-[96px]">
                {selectedDoc ? <DocumentPanel doc={selectedDoc} /> : <GenericPanel result={selected} />}
              </Card>
            )}
          </div>
        </>
      )}

      <ScreenRef n={5} label="Recherche et accès direct" />
    </>
  );
}
