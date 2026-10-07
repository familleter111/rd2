"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CloudUpload,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Funnel,
  FolderInput,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { GuideSpot } from "@/components/guide/guide-mark";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, SearchInput, Select } from "@/components/ui/field";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { useDismissable } from "@/components/ui/overlay";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { DOC_CATEGORIES, DOC_TYPES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { DOC_FAMILIES, DOC_STATUS_DOT, docDate, docFamily, docFileName, versionInForce, type DocFamily } from "@/lib/dossier-selectors";
import { buildPdf, downloadBlob } from "@/lib/export-files";
import { formatFileSize, formatNumeric } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { actions, dossierActions, useDemo } from "@/lib/store";
import type { DocCategory, DocStatus, ProjectDocument } from "@/lib/types";
import { ProjectTabs } from "./project-frame";

export function DocStatusBadge({ status, size = "md" }: { status: DocStatus; size?: "sm" | "md" }) {
  return (
    <Badge tone={DOC_STATUS_DOT[status]} size={size} className="gap-1.5">
      <StatusDot tone={DOC_STATUS_DOT[status]} />
      {status}
    </Badge>
  );
}

export function downloadDocument(doc: ProjectDocument) {
  const file = docFileName(doc);
  downloadBlob(
    file.replace(/\.(docx|xlsx|pptx)$/i, ".pdf"),
    buildPdf([
      { text: "Laboratoires SIMED — Espace R&D", size: 10 },
      { text: doc.name, size: 18, bold: true, gap: 8 },
      { text: `${doc.projectCode} • ${doc.type} • version v${doc.version} (${doc.status.toLowerCase()})`, gap: 4 },
      { text: doc.description ?? "", gap: 10 },
      { text: `Responsable : ${doc.owner} — dernière modification le ${formatNumeric(doc.updatedAt)}`, gap: 10 },
      { text: "Document de démonstration : le contenu réel n'est pas disponible dans le prototype.", size: 9, gap: 24 },
    ]),
  );
  toast.show({ title: "Téléchargement lancé", description: file });
}

function ImportModal({
  open,
  onClose,
  projectCode,
  lots,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  projectCode: string;
  lots: string[];
  onImported: (doc: ProjectDocument) => void;
}) {
  const [files, setFiles] = useState<{ name: string; size: string; ext: string }[]>([]);
  const file = files[0] ?? null;
  const [name, setName] = useState("");
  const [cat, setCat] = useState<DocCategory>("Références");
  const [type, setType] = useState(DOC_TYPES[0]);
  const [lot, setLot] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    const ext = (f: File) => f.name.split(".").pop()?.toLowerCase() ?? "";
    if (picked.some((f) => !["pdf", "docx", "xlsx", "pptx"].includes(ext(f)))) return setError("Format non accepté (PDF, DOCX, XLSX, PPTX).");
    if (picked.some((f) => f.size > 10 * 1024 * 1024)) return setError("Un fichier dépasse 10 Mo.");
    setError(null);
    setFiles(picked.map((f) => ({ name: f.name, size: formatFileSize(f.size), ext: ext(f) })));
    if (!name) setName(picked[0].name.replace(/\.[^.]+$/, ""));
  };

  const submit = () => {
    if (!file) return setError("Sélectionnez un fichier à ajouter.");
    if (!name.trim()) return setError("Donnez un nom au document.");
    // The form names the first file; the others keep the name of their file.
    const docs = files.map((f, i) =>
      actions.addDocument({
        projectCode,
        category: cat,
        name: i === 0 ? name.trim() : f.name.replace(/\.[^.]+$/, ""),
        type,
        size: f.size,
        fileType: f.ext.toUpperCase() as ProjectDocument["fileType"],
        lot: lot || undefined,
      }),
    );
    const doc = docs[0];
    toast.show({ title: docs.length > 1 ? `${docs.length} documents ajoutés` : "Document ajouté", description: docs.length > 1 ? docs.map((d) => d.name).join(", ") : `${doc.name} — v1 (brouillon).` });
    onImported(doc);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter un document"
      subtitle={`Projet ${projectCode}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit}>Ajouter</Button>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-brand-200 bg-subtle px-6 py-6 text-center hover:border-brand-300">
        <CloudUpload className="h-9 w-9 text-brand-500" strokeWidth={1.5} aria-hidden />
        <span className="mt-2 font-semibold text-ink-900">{files.length > 1 ? `${files.length} fichiers : ${files.map((f) => f.name).join(", ")}` : file ? file.name : "Choisir un ou plusieurs fichiers"}</span>
        <span className="text-[13px] text-ink-500">{file ? file.size : "PDF, DOCX, XLSX, PPTX • 10 Mo max"}</span>
        <input type="file" multiple accept=".pdf,.docx,.xlsx,.pptx" className="sr-only" onChange={(e) => pick(e.target.files)} />
      </label>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nom du document" required htmlFor="imp-name" className="sm:col-span-2">
          <Input id="imp-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Dossier" htmlFor="imp-cat">
          <Select id="imp-cat" options={DOC_CATEGORIES} value={cat} onChange={(e) => setCat(e.target.value as DocCategory)} />
        </Field>
        <Field label="Type de document" htmlFor="imp-type">
          <Select id="imp-type" options={DOC_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
        </Field>
        <Field label="Lot lié" htmlFor="imp-lot" optional className="sm:col-span-2">
          <Select id="imp-lot" placeholder="Aucun" options={lots} value={lot} onChange={(e) => setLot(e.target.value)} />
        </Field>
      </div>
      {error && (
        <p className="mt-3 text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

function RenameModal({ doc, onClose }: { doc: ProjectDocument | null; onClose: () => void }) {
  const [name, setName] = useState(doc?.name ?? "");
  return (
    <Modal
      open={Boolean(doc)}
      onClose={onClose}
      title="Renommer le document"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!name.trim() || name.trim() === doc?.name}
            onClick={() => {
              if (!doc) return;
              actions.renameDocument(doc.id, name.trim());
              toast.show({ title: "Document renommé", description: name.trim() });
              onClose();
            }}
          >
            Renommer
          </Button>
        </>
      }
    >
      <Field label="Nom du document" htmlFor="rename-doc">
        <Input id="rename-doc" data-autofocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}

function MoveModal({ doc, onClose }: { doc: ProjectDocument | null; onClose: () => void }) {
  const [category, setCategory] = useState<DocCategory>(doc?.category ?? "Références");
  return (
    <Modal
      open={Boolean(doc)}
      onClose={onClose}
      title="Déplacer le document"
      subtitle={doc?.name}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={category === doc?.category}
            onClick={() => {
              if (!doc) return;
              actions.moveDocument(doc.id, category);
              toast.show({ title: "Document déplacé", description: `${doc.name} → ${category}` });
              onClose();
            }}
          >
            Déplacer
          </Button>
        </>
      }
    >
      <Field label="Dossier de destination" htmlFor="move-cat">
        <Select id="move-cat" options={DOC_CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value as DocCategory)} />
      </Field>
    </Modal>
  );
}

interface Filters {
  folder: string;
  status: string;
  archived: boolean;
}

function FiltersPopover({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  const count = (value.folder !== "Tous" ? 1 : 0) + (value.status !== "Tous" ? 1 : 0) + (value.archived ? 1 : 0);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 cursor-pointer items-center gap-2.5 rounded-lg border border-line-strong bg-white px-4 text-[15px] font-medium text-ink-800 hover:border-ink-300"
      >
        <Funnel className="h-5 w-5 text-ink-700" strokeWidth={1.8} aria-hidden />
        Filtres
        {count > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{count}</span>}
        <ChevronDown className={cn("h-4 w-4 text-ink-500 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 space-y-4 rounded-xl border border-line bg-white p-4 shadow-pop">
          <Field label="Dossier" htmlFor="df-folder">
            <Select id="df-folder" options={["Tous", ...DOC_CATEGORIES]} value={value.folder} onChange={(e) => onChange({ ...value, folder: e.target.value })} />
          </Field>
          <Field label="État" htmlFor="df-status">
            <Select
              id="df-status"
              options={["Tous", "Brouillon", "En revue", "À revoir", "Approuvé"]}
              value={value.status}
              onChange={(e) => onChange({ ...value, status: e.target.value })}
            />
          </Field>
          <Checkbox checked={value.archived} onChange={(archived) => onChange({ ...value, archived })} label="Afficher les documents archivés" />
          <Button variant="ghost" size="sm" onClick={() => onChange({ folder: "Tous", status: "Tous", archived: false })}>
            Réinitialiser les filtres
          </Button>
        </div>
      )}
    </div>
  );
}

function Keywords({ doc }: { doc: ProjectDocument }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const keywords = doc.keywords ?? [];
  const add = () => {
    const k = value.trim();
    if (k && !keywords.includes(k)) dossierActions.setDocumentKeywords(doc.id, [...keywords, k]);
    setValue("");
    setAdding(false);
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {keywords.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          {k}
          <button
            type="button"
            aria-label={`Retirer le mot-clé ${k}`}
            disabled={doc.archived}
            onClick={() => dossierActions.setDocumentKeywords(doc.id, keywords.filter((x) => x !== k))}
            className="cursor-pointer rounded-full text-brand-600 hover:text-brand-800 disabled:cursor-not-allowed"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {adding ? (
        <Input
          data-autofocus
          autoFocus
          aria-label="Nouveau mot-clé"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
            if (e.key === "Escape") setAdding(false);
          }}
          onBlur={add}
          className="h-8 w-40 text-sm"
        />
      ) : (
        !doc.archived && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-sm font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Ajouter un mot-clé
          </button>
        )
      )}
    </div>
  );
}

function DocumentPanel({
  doc,
  slug,
  projectName,
  menu,
}: {
  doc: ProjectDocument;
  slug: string;
  projectName: string;
  menu: MenuItem[];
}) {
  const inForce = versionInForce(doc);
  const created = doc.createdAt ?? doc.versions.at(-1)?.date ?? doc.updatedAt;
  const info: [string, ReactNode][] = [
    ["Catégorie", <Badge key="c" tone="info">{docFamily(doc)}</Badge>],
    ["Version", `v${doc.version}`],
    ["État", doc.archived ? <Badge key="a">Archivé</Badge> : <DocStatusBadge key="s" status={doc.status} size="sm" />],
    ["Projet lié", `${doc.projectCode} • ${projectName}`],
    ["Responsable", doc.owner],
    ["Date de création", formatNumeric(created)],
    ["Dernière modification", formatNumeric(doc.updatedAt)],
    ["Format", `${doc.fileType} (${doc.size})`],
  ];
  const href = `/projets/${slug}/documents/${doc.id}`;
  return (
    <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-ink-800">
          <FileText className="h-8 w-8" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-ink-900">
            {doc.name} v{doc.version}
          </h2>
          <p className="truncate text-sm text-ink-500">{docFileName(doc)}</p>
          <div className="mt-2">{doc.archived ? <Badge icon={Archive}>Archivé</Badge> : <DocStatusBadge status={doc.status} />}</div>
        </div>
        <Menu label={`Actions pour ${doc.name}`} items={menu} />
      </div>
      {inForce && inForce !== doc.version && (
        <p className="mt-4 rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2 text-sm text-ink-700">
          La version v{inForce} approuvée reste en vigueur pendant la revue de la v{doc.version}.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2 [&>*]:flex-1 [&>*]:px-3">
        <LinkButton href={href} variant="outline" icon={<Eye className="h-4 w-4" />}>
          Aperçu
        </LinkButton>
        <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadDocument(doc)}>
          Télécharger
        </Button>
        {doc.archived ? (
          <Button variant="outline" icon={<ArchiveRestore className="h-4 w-4" />} onClick={() => dossierActions.restoreDocument(doc.id)}>
            Restaurer
          </Button>
        ) : (
          <LinkButton href={`${href}?nouvelle-version=1`} icon={<FilePlus2 className="h-4 w-4" />} guide={doc.id === "doc-cs-rf2" ? 46 : undefined}>
            Nouvelle version
          </LinkButton>
        )}
      </div>
      <h3 className="mt-6 font-bold text-ink-900">Informations générales</h3>
      <dl className="mt-2 divide-y divide-line/70">
        {info.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[150px_1fr] items-center gap-3 py-2 text-[15px]">
            <dt className="text-ink-600">{k}</dt>
            <dd className="min-w-0 text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 border-t border-line pt-4 font-bold text-ink-900">Description</h3>
      <p className="mt-2 rounded-lg bg-subtle px-3.5 py-3 text-[15px] text-ink-700">{doc.description ?? "Aucune description."}</p>
      <h3 className="mt-5 border-t border-line pt-4 font-bold text-ink-900">Mots-clés</h3>
      <Keywords key={doc.id} doc={doc} />
    </Card>
  );
}

type Sort = { key: "name" | "date"; dir: 1 | -1 };

export function DocumentsView({ slug, initialDocId }: { slug: string; initialDocId?: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<DocFamily | "Tous">("Tous");
  const [filters, setFilters] = useState<Filters>({ folder: "Tous", status: "Tous", archived: false });
  const [sort, setSort] = useState<Sort>({ key: "date", dir: -1 });
  const [selectedId, setSelectedId] = useState<string | null>(initialDocId ?? null);
  const [importOpen, setImportOpen] = useState(false);
  const [importKey, setImportKey] = useState(0);
  const [renameDoc, setRenameDoc] = useState<ProjectDocument | null>(null);
  const [moveDoc, setMoveDoc] = useState<ProjectDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ProjectDocument | null>(null);
  const [archiveDoc, setArchiveDoc] = useState<ProjectDocument | null>(null);

  if (!project) return null;

  const cs = project.code === "CS-01";
  const decisionApproved = state.formulaDecisions.some((d) => d.projectCode === project.code && d.status === "Approuvée");
  const q = query.trim().toLowerCase();
  const scoped = state.documents
    .filter((d) => d.projectCode === project.code)
    .filter((d) => filters.archived || !d.archived)
    .filter((d) => filters.folder === "Tous" || d.category === filters.folder)
    .filter((d) => filters.status === "Tous" || d.status === filters.status)
    .filter((d) => !q || `${d.name} ${d.type} ${d.owner} ${docFileName(d)} ${(d.keywords ?? []).join(" ")}`.toLowerCase().includes(q));
  const visible = scoped
    .filter((d) => family === "Tous" || docFamily(d) === family)
    .sort((a, b) => (sort.key === "name" ? a.name.localeCompare(b.name, "fr") : docDate(a).localeCompare(docDate(b))) * sort.dir);
  const selected = visible.find((d) => d.id === selectedId) ?? visible[0];
  const chips = [
    { value: "Tous" as const, count: scoped.length },
    ...DOC_FAMILIES.map((f) => ({ value: f, count: scoped.filter((d) => docFamily(d) === f).length })).filter((c) => c.value !== "Autres" || c.count > 0),
  ];

  const menuFor = (d: ProjectDocument): MenuItem[] => [
    { label: "Ouvrir", icon: Eye, href: `/projets/${slug}/documents/${d.id}` },
    { label: "Télécharger", icon: Download, onSelect: () => downloadDocument(d) },
    ...(d.archived
      ? [{ label: "Restaurer", icon: ArchiveRestore, onSelect: () => dossierActions.restoreDocument(d.id) }]
      : [
          { label: "Nouvelle version", icon: FilePlus2, href: `/projets/${slug}/documents/${d.id}?nouvelle-version=1` },
          { label: "Renommer", icon: Pencil, onSelect: () => setRenameDoc(d) },
          { label: "Déplacer", icon: FolderInput, onSelect: () => setMoveDoc(d) },
          { label: "Archiver", icon: Archive, separatorBefore: true, onSelect: () => setArchiveDoc(d) },
          ...(d.status === "Brouillon" ? [{ label: "Supprimer le brouillon", icon: Trash2, tone: "danger" as const, onSelect: () => setDeleteDoc(d) }] : []),
        ]),
  ];

  const sortHeader = (key: Sort["key"], label: string) => (
    <button
      type="button"
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : key === "date" ? -1 : 1 }))}
      className="inline-flex cursor-pointer items-center gap-1 font-medium hover:text-ink-900"
      aria-label={`Trier par ${label.toLowerCase()}`}
    >
      {label}
      {sort.key === key && (sort.dir === 1 ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
    </button>
  );

  return (
    <>
      <ProjectTabs slug={slug} />

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card className="min-w-0 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-ink-900">Documents du projet</h2>
            <Button
              size="lg"
              icon={<Plus className="h-5 w-5" />}
              onClick={() => {
                setImportKey((k) => k + 1);
                setImportOpen(true);
              }}
            >
              Ajouter un document
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un document…" className="min-w-56 flex-1 [&_input]:h-12" />
            <FiltersPopover value={filters} onChange={setFilters} />
          </div>
          <div role="tablist" aria-label="Catégories de documents" className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.value}
                type="button"
                role="tab"
                aria-selected={family === c.value}
                onClick={() => setFamily(c.value)}
                className={cn(
                  "h-10 cursor-pointer rounded-full px-4 text-[15px] font-medium transition-colors",
                  family === c.value ? "bg-brand-100 font-semibold text-brand-700" : "bg-slate-100 text-ink-700 hover:bg-slate-200",
                )}
              >
                {c.value} ({c.count})
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={FileText} title="Aucun document" description="Aucun document ne correspond à cette catégorie, à la recherche ou aux filtres." />
          ) : (
            <div className="relative mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[700px] text-left text-[13px]">
                <thead>
                  <tr className="bg-subtle text-[13px] text-ink-700">
                    <th className="px-3 py-3">{sortHeader("name", "Nom du document")}</th>
                    <th className="px-2 py-3 font-medium">Catégorie</th>
                    <th className="px-2 py-3 font-medium">Version</th>
                    <th className="px-2 py-3 font-medium">État</th>
                    <th className="px-2 py-3 font-medium">Responsable</th>
                    <th className="px-2 py-3 font-medium">Projet</th>
                    <th className="px-2 py-3">{sortHeader("date", "Modifié le")}</th>
                    <th className="w-12 px-2 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const isSelected = d.id === selected?.id;
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        aria-selected={isSelected}
                        className={cn(
                          "cursor-pointer border-t border-line/70",
                          isSelected ? "bg-brand-50/70 outline-2 -outline-offset-2 outline-brand-300" : "hover:bg-subtle",
                          d.archived && "text-ink-500",
                        )}
                      >
                        <td className="max-w-60 px-3 py-3">
                          <GuideSpot step={46} active={d.id === "doc-cs-rf2" && selected?.id !== d.id} hint="Sélectionnez le rapport d'essais F2, puis « Nouvelle version »." className="-m-1 p-1">
                            <span className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink-700">
                                <FileText className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-ink-900">
                                  {d.name} v{d.version}
                                </span>
                                <span className="block truncate text-xs text-ink-500">{docFileName(d)}</span>
                              </span>
                            </span>
                          </GuideSpot>
                        </td>
                        <td className="px-2 py-3">
                          <Badge tone="info">{docFamily(d)}</Badge>
                        </td>
                        <td className="px-2 py-3 font-medium text-ink-800">v{d.version}</td>
                        <td className="px-2 py-3">{d.archived ? <Badge icon={Archive}>Archivé</Badge> : <DocStatusBadge status={d.status} size="sm" />}</td>
                        <td className="px-2 py-3 text-ink-800">{d.owner}</td>
                        <td className="px-2 py-3 text-ink-800">{d.projectCode}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-ink-800">{formatNumeric(docDate(d))}</td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <Menu label={`Actions pour ${d.name}`} items={menuFor(d)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selected && <DocumentPanel doc={selected} slug={slug} projectName={project.name} menu={menuFor(selected)} />}
      </div>

      <ImportModal
        key={importKey}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectCode={project.code}
        lots={state.lots.filter((l) => l.projectCode === project.code).map((l) => l.code)}
        onImported={(doc) => setSelectedId(doc.id)}
      />
      <RenameModal key={`r-${renameDoc?.id}`} doc={renameDoc} onClose={() => setRenameDoc(null)} />
      <MoveModal key={`m-${moveDoc?.id}`} doc={moveDoc} onClose={() => setMoveDoc(null)} />
      <ConfirmDialog
        open={Boolean(archiveDoc)}
        onClose={() => setArchiveDoc(null)}
        title="Archiver le document ?"
        message={
          <>
            <strong>{archiveDoc?.name}</strong> sera archivé : il reste consultable en lecture seule et peut être restauré. L&apos;archivage est tracé dans
            l&apos;historique du projet.
          </>
        }
        confirmLabel="Archiver"
        onConfirm={() => {
          if (!archiveDoc) return;
          dossierActions.archiveDocument(archiveDoc.id);
          toast.show({ title: "Document archivé", description: archiveDoc.name });
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteDoc)}
        onClose={() => setDeleteDoc(null)}
        title="Supprimer le brouillon ?"
        message={
          <>
            Le brouillon <strong>{deleteDoc?.name}</strong> (v{deleteDoc?.version}) sera supprimé. La suppression est tracée dans l&apos;historique du projet.
          </>
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          if (!deleteDoc) return;
          actions.deleteDocument(deleteDoc.id);
          toast.show({ title: "Brouillon supprimé", description: deleteDoc.name });
        }}
      />
      <ScreenRef n={cs ? (decisionApproved ? 45 : 15) : undefined} label="Documents du projet" />
    </>
  );
}
