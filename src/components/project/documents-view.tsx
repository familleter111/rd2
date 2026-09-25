"use client";

import {
  ArrowDownUp,
  Box,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CloudUpload,
  Download,
  FilePlus2,
  FileText,
  FlaskConical,
  Folder,
  FolderInput,
  History,
  Info,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge, TONE_ICON } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, SearchInput, Select, controlClass } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { DOC_CATEGORIES, DOC_TYPES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { downloadText, formatDateTime, formatFileSize, formatShort, plural } from "@/lib/format";
import { DOC_STATUS_TONE, findProject } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { DocCategory, DocStatus, ProjectDocument } from "@/lib/types";
import { ProjectTabs } from "./project-frame";

const CATEGORY_ICONS: Record<DocCategory, LucideIcon> = {
  Références: Folder,
  Formulation: FlaskConical,
  Méthodes: FileText,
  "Lots & contrôles": Box,
  Stabilité: ChartNoAxesColumn,
  CTD: Folder,
};

const STATUS_ICONS: Record<DocStatus, LucideIcon> = {
  Brouillon: FileText,
  Approuvé: CircleCheck,
  "À revoir": TriangleAlert,
  "En revue": History,
};

const STATUS_NOTES: Record<DocStatus, string> = {
  Approuvé: "Ce document est approuvé. Il n'est pas directement modifiable.",
  Brouillon: "Ce document est un brouillon : il peut être renommé, déplacé ou supprimé.",
  "À revoir": "Des remarques sont à traiter avant une nouvelle soumission.",
  "En revue": "Ce document est en cours de revue par les approbateurs.",
};

type SortKey = "name" | "version" | "owner" | "status";

type SortState = { key: SortKey; dir: 1 | -1 };

function SortHeader({ k, label, sort, onSort }: { k: SortKey; label: string; sort: SortState; onSort: (s: SortState) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSort({ key: k, dir: sort.key === k ? ((sort.dir * -1) as 1 | -1) : 1 })}
      className="inline-flex cursor-pointer items-center gap-1.5 font-medium hover:text-ink-900"
      aria-label={`Trier par ${label.toLowerCase()}`}
    >
      {label}
      {sort.key === k ? (
        sort.dir === 1 ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ArrowDownUp className="h-3.5 w-3.5 text-ink-400" aria-hidden />
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge tone={DOC_STATUS_TONE[status]} icon={STATUS_ICONS[status]} size="md">
      {status}
    </Badge>
  );
}

function LabeledSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="relative block min-w-36">
      <span className="pointer-events-none absolute left-3 top-1.5 text-[11px] text-ink-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(controlClass, "h-12 cursor-pointer appearance-none pl-3 pr-9 pt-4 text-sm")}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
    </label>
  );
}

function DocumentPreview({ doc, onNewVersion }: { doc: ProjectDocument; onNewVersion: () => void }) {
  const [tab, setTab] = useState<"apercu" | "details" | "historique">("apercu");
  const details: [string, string][] = [
    ["Type", doc.type],
    ["Catégorie", doc.category],
    ["Version", `v${doc.version}`],
    ["Propriétaire", doc.owner],
    ["Dernière modification", formatDateTime(doc.updatedAt)],
    ["Taille", doc.size],
    ["Format", doc.fileType],
    ...(doc.lot ? ([["Lot", doc.lot]] as [string, string][]) : []),
    ...(doc.formula ? ([["Formule", doc.formula]] as [string, string][]) : []),
    ...(doc.method ? ([["Méthode", doc.method]] as [string, string][]) : []),
  ];

  return (
    <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={doc.status} />
        <span className="text-sm text-ink-600">
          v{doc.version} • {formatShort(doc.updatedAt)}
        </span>
      </div>
      <div className="mt-4 flex items-start gap-4">
        <FileText className="h-10 w-10 shrink-0 text-ink-700" strokeWidth={1.4} aria-hidden />
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink-900">{doc.name}</h2>
          <p className="text-sm text-ink-600">
            {doc.type} • {doc.size}
          </p>
        </div>
      </div>
      <Tabs
        className="mt-4"
        size="sm"
        items={[
          { value: "apercu", label: "Aperçu" },
          { value: "details", label: "Détails" },
          { value: "historique", label: "Historique" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === "apercu" && (
          <div className="h-56 overflow-hidden rounded-lg border border-line bg-slate-50 p-4">
            <div className="h-full rounded-md bg-white px-6 py-5 shadow-card">
              <Image src="/brand/simed-logo.png" alt="" width={200} height={114} className="h-auto w-24" />
              <p className="mt-3 border-b border-ink-300 pb-2 text-lg font-bold text-ink-900">{doc.name}</p>
              <div className="mt-3 space-y-2" aria-hidden>
                <div className="h-2 w-3/4 rounded bg-slate-200" />
                <div className="h-2 w-full rounded bg-slate-100" />
                <div className="h-2 w-5/6 rounded bg-slate-100" />
                <div className="h-2 w-2/3 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        )}
        {tab === "details" && (
          <dl className="divide-y divide-line">
            {details.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[170px_1fr] gap-3 py-2 text-sm">
                <dt className="text-ink-500">{k}</dt>
                <dd className="text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {tab === "historique" && (
          <ol className="space-y-3">
            {doc.versions.map((v) => (
              <li key={v.version} className="flex items-start gap-3 rounded-lg border border-line p-3">
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-700">v{v.version}</span>
                <div className="text-sm">
                  <p className="font-medium text-ink-900">{v.note}</p>
                  <p className="text-ink-500">
                    {v.date ? formatDateTime(v.date) : "Date non renseignée"} — {v.author}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          icon={<Download className="h-4 w-4" />}
          onClick={() => {
            downloadText(`${doc.name} v${doc.version}.txt`, `${doc.name} — v${doc.version}\n${doc.type}\nStatut : ${doc.status}\nDocument de démonstration.`);
            toast.show({ title: "Téléchargement lancé", description: `${doc.name} v${doc.version}` });
          }}
        >
          Télécharger
        </Button>
        <Button variant="outline" size="sm" className="h-9" icon={<History className="h-4 w-4" />} onClick={() => setTab("historique")}>
          Voir l&apos;historique
        </Button>
        <Button variant="outline" size="sm" className="h-9" icon={<FilePlus2 className="h-4 w-4" />} onClick={onNewVersion}>
          Créer une nouvelle version
        </Button>
      </div>
      <p className="mt-4 flex gap-2.5 rounded-lg border border-brand-100 bg-brand-50/70 p-3 text-sm text-ink-700">
        <Info className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_ICON.info)} aria-hidden />
        {STATUS_NOTES[doc.status]}
      </p>
    </Card>
  );
}

function ImportModal({
  open,
  onClose,
  projectCode,
  category,
  lots,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  projectCode: string;
  category: DocCategory;
  lots: string[];
  onImported: (doc: ProjectDocument) => void;
}) {
  const [file, setFile] = useState<{ name: string; size: string; ext: string } | null>(null);
  const [name, setName] = useState("");
  const [cat, setCat] = useState<DocCategory>(category);
  const [type, setType] = useState(DOC_TYPES[0]);
  const [lot, setLot] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx", "xlsx", "pptx"].includes(ext)) return setError("Format non accepté (PDF, DOCX, XLSX, PPTX).");
    if (f.size > 10 * 1024 * 1024) return setError("Le fichier dépasse 10 Mo.");
    setError(null);
    setFile({ name: f.name, size: formatFileSize(f.size), ext });
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = () => {
    if (!file) return setError("Sélectionnez un fichier à importer.");
    if (!name.trim()) return setError("Donnez un nom au document.");
    const doc = actions.addDocument({
      projectCode,
      category: cat,
      name: name.trim(),
      type,
      size: file.size,
      fileType: file.ext.toUpperCase() as ProjectDocument["fileType"],
      lot: lot || undefined,
    });
    toast.show({ title: "Document importé", description: `${doc.name} — v1 (brouillon) dans « ${cat} ».` });
    onImported(doc);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importer un document"
      subtitle={`Projet ${projectCode}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit}>Importer</Button>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-brand-200 bg-subtle px-6 py-6 text-center hover:border-brand-300">
        <CloudUpload className="h-9 w-9 text-brand-500" strokeWidth={1.5} aria-hidden />
        <span className="mt-2 font-semibold text-ink-900">{file ? file.name : "Choisir un fichier"}</span>
        <span className="text-[13px] text-ink-500">{file ? file.size : "PDF, DOCX, XLSX, PPTX • 10 Mo max"}</span>
        <input type="file" accept=".pdf,.docx,.xlsx,.pptx" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nom du document" required htmlFor="imp-name" className="sm:col-span-2">
          <Input id="imp-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Catégorie" htmlFor="imp-cat">
          <Select id="imp-cat" options={DOC_CATEGORIES} value={cat} onChange={(e) => setCat(e.target.value as DocCategory)} />
        </Field>
        <Field label="Type de document" htmlFor="imp-type">
          <Select id="imp-type" options={DOC_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
        </Field>
        <Field label="Lot lié" htmlFor="imp-lot" optional className="sm:col-span-2">
          <Select id="imp-lot" placeholder="Aucun" options={lots} value={lot} onChange={(e) => setLot(e.target.value)} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-danger-600" role="alert">{error}</p>}
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
      <Field label="Catégorie de destination" htmlFor="move-cat">
        <Select id="move-cat" options={DOC_CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value as DocCategory)} />
      </Field>
    </Modal>
  );
}

export function DocumentsView({ slug, initialDocId }: { slug: string; initialDocId?: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const initialDoc = state.documents.find((d) => d.id === initialDocId);

  const [category, setCategory] = useState<DocCategory>(initialDoc?.category ?? "Références");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [versionFilter, setVersionFilter] = useState("Toutes");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [sort, setSort] = useState<SortState>({ key: "name", dir: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(initialDoc?.id ?? null);
  const [checked, setChecked] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importKey, setImportKey] = useState(0);
  const [renameDoc, setRenameDoc] = useState<ProjectDocument | null>(null);
  const [moveDoc, setMoveDoc] = useState<ProjectDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ProjectDocument | null>(null);

  if (!project) return null;

  const projectDocs = state.documents.filter((d) => d.projectCode === project.code);
  const inCategory = projectDocs.filter((d) => d.category === category);
  const q = query.trim().toLowerCase();
  const visible = inCategory
    .filter((d) => !q || `${d.name} ${d.type} ${d.owner}`.toLowerCase().includes(q))
    .filter((d) => typeFilter === "Tous" || d.type === typeFilter)
    .filter((d) => versionFilter === "Toutes" || (versionFilter === "v3 et +" ? d.version >= 3 : `v${d.version}` === versionFilter))
    .filter((d) => statusFilter === "Tous" || d.status === statusFilter)
    .sort((a, b) => {
      const va = sort.key === "version" ? a.version : a[sort.key];
      const vb = sort.key === "version" ? b.version : b[sort.key];
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr")) * sort.dir;
    });
  const selected = visible.find((d) => d.id === selectedId) ?? visible[0];

  const selectCategory = (c: DocCategory) => {
    setCategory(c);
    setChecked([]);
    setTypeFilter("Tous");
    setSelectedId(null);
  };

  const allChecked = visible.length > 0 && visible.every((d) => checked.includes(d.id));

  return (
    <>
      <ProjectTabs slug={slug} />

      <p className="mt-5 text-[15px] text-ink-600">Gérez l&apos;ensemble des documents liés au projet : études, méthodes, lots, stabilité et soumissions.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6 [&>*]:min-w-0">
        {DOC_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c];
          const count = projectDocs.filter((d) => d.category === c).length;
          const active = c === category;
          return (
            <button
              key={c}
              type="button"
              onClick={() => selectCategory(c)}
              aria-pressed={active}
              className={cn(
                "flex cursor-pointer items-center gap-3.5 rounded-xl border bg-white px-4 py-4 text-left shadow-card transition-colors",
                active ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
              )}
            >
              <Icon className={cn("h-9 w-9 shrink-0", active ? "text-brand-600" : "text-ink-700")} strokeWidth={1.4} aria-hidden />
              <span>
                <span className="block font-semibold text-ink-900">{c}</span>
                <span className="block text-sm text-ink-500">
                  {count} {plural(count, "document")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Card className="mt-4 flex flex-wrap items-center gap-3 p-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un document…" className="min-w-60 flex-1 [&_input]:h-12" />
        <LabeledSelect label="Type de document" value={typeFilter} onChange={setTypeFilter} options={["Tous", ...new Set(inCategory.map((d) => d.type))]} />
        <LabeledSelect label="Version" value={versionFilter} onChange={setVersionFilter} options={["Toutes", "v1", "v2", "v3 et +"]} />
        <LabeledSelect label="Statut" value={statusFilter} onChange={setStatusFilter} options={["Tous", "Brouillon", "En revue", "À revoir", "Approuvé"]} />
        <Button
          size="lg"
          icon={<Plus className="h-5 w-5" />}
          className="sm:ml-auto"
          onClick={() => {
            setImportKey((k) => k + 1);
            setImportOpen(true);
          }}
        >
          Importer un document
        </Button>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
        <Card className="min-w-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
            <h2 className="font-semibold text-ink-900">
              {visible.length} {plural(visible.length, "document")} dans {category}
            </h2>
            {checked.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-600">
                  {checked.length} {plural(checked.length, "sélectionné")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => {
                    const docs = projectDocs.filter((d) => checked.includes(d.id));
                    downloadText(`${project.code}-documents.txt`, docs.map((d) => `${d.name} v${d.version} — ${d.status}`).join("\n"));
                    toast.show({ title: "Export lancé", description: `${docs.length} ${plural(docs.length, "document")}` });
                  }}
                >
                  Télécharger
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setChecked([])}>
                  Désélectionner
                </Button>
              </div>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={FileText} title="Aucun document" description="Aucun document ne correspond à cette catégorie ou à ces filtres." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-sm text-ink-600">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={allChecked}
                        onChange={(c) => setChecked(c ? visible.map((d) => d.id) : [])}
                        label={<span className="sr-only">Tout sélectionner</span>}
                      />
                    </th>
                    <th className="px-3 py-2.5">
                      <SortHeader k="name" label="Nom du document" sort={sort} onSort={setSort} />
                    </th>
                    <th className="px-3 py-2.5">
                      <SortHeader k="version" label="Version" sort={sort} onSort={setSort} />
                    </th>
                    <th className="px-3 py-2.5">
                      <SortHeader k="owner" label="Propriétaire" sort={sort} onSort={setSort} />
                    </th>
                    <th className="px-3 py-2.5">
                      <SortHeader k="status" label="Statut" sort={sort} onSort={setSort} />
                    </th>
                    <th className="w-12 px-2 py-2.5">
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
                        className={cn("cursor-pointer border-b border-line/70 last:border-0", isSelected ? "bg-brand-50/70" : "hover:bg-subtle")}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked.includes(d.id)}
                            onChange={(c) => setChecked((l) => (c ? [...l, d.id] : l.filter((x) => x !== d.id)))}
                            label={<span className="sr-only">Sélectionner {d.name}</span>}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-3">
                            <FileText className="h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.5} aria-hidden />
                            <span>
                              <span className="block font-semibold text-ink-900">{d.name}</span>
                              <span className="block text-sm text-ink-500">{d.type}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-md bg-brand-50 px-2.5 py-1 text-sm font-semibold text-brand-700">v{d.version}</span>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span className="block text-ink-800">{d.owner}</span>
                          <span className="block text-ink-500">{formatShort(d.updatedAt)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <Menu
                            label={`Actions pour ${d.name}`}
                            items={[
                              { label: "Renommer", icon: Pencil, onSelect: () => setRenameDoc(d) },
                              { label: "Déplacer", icon: FolderInput, onSelect: () => setMoveDoc(d) },
                              ...(d.status === "Brouillon"
                                ? [{ label: "Supprimer le brouillon", icon: Trash2, tone: "danger" as const, separatorBefore: true, onSelect: () => setDeleteDoc(d) }]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selected && (
          <DocumentPreview
            key={selected.id}
            doc={selected}
            onNewVersion={() => {
              const v = actions.newDocumentVersion(selected.id);
              toast.show({ title: `Version v${v} créée`, description: `${selected.name} — nouvelle version en brouillon.` });
            }}
          />
        )}
      </div>

      <ImportModal
        key={importKey}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectCode={project.code}
        category={category}
        lots={state.lots.filter((l) => l.projectCode === project.code).map((l) => l.code)}
        onImported={(doc) => {
          setCategory(doc.category);
          setSelectedId(doc.id);
        }}
      />
      <RenameModal key={`r-${renameDoc?.id}`} doc={renameDoc} onClose={() => setRenameDoc(null)} />
      <MoveModal key={`m-${moveDoc?.id}`} doc={moveDoc} onClose={() => setMoveDoc(null)} />
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
          setChecked((l) => l.filter((x) => x !== deleteDoc.id));
          toast.show({ title: "Brouillon supprimé", description: deleteDoc.name });
        }}
      />
      <ScreenRef n={15} label="Documents du projet" />
    </>
  );
}
