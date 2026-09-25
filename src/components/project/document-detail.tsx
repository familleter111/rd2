"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CircleCheck,
  CloudUpload,
  Download,
  FilePlus2,
  FileText,
  FileX,
  History,
  Info,
  MessageSquareText,
  ShieldCheck,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GuideSpot, useGuideNav } from "@/components/guide/guide-mark";
import { ACTIONS_TRIGGER_CLASS, MetaLine, actionsTrigger } from "@/components/project-context-header";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/field";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { versionEventId } from "@/lib/dossier";
import { docFamily, docFileName, versionInForce } from "@/lib/dossier-selectors";
import { formatDateTime, formatFileSize, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { findProject } from "@/lib/selectors";
import { dossierActions, useDemo } from "@/lib/store";
import type { ProjectDocument } from "@/lib/types";
import { DocStatusBadge, downloadDocument } from "./documents-view";

export type DocSection = "informations" | "versions" | "commentaires" | "tracabilite";

const SECTIONS: { value: DocSection; label: string; icon: LucideIcon }[] = [
  { value: "informations", label: "Informations générales", icon: FileText },
  { value: "versions", label: "Historique des versions", icon: History },
  { value: "commentaires", label: "Commentaires", icon: MessageSquareText },
  { value: "tracabilite", label: "Traçabilité", icon: ShieldCheck },
];

const REVIEWERS = ["Responsable développement", "Pharmacien responsable", "Responsable contrôle qualité", "Assurance qualité"];

/** Example of the mock-up (screen 46), used when the tour opens the dialog. */
const EXAMPLE = { file: { name: "rapport-essais-F2-v3.pdf", size: "1,2 Mo" }, motif: "Ajout des résultats complémentaires." };

function NewVersionModal({
  doc,
  open,
  example,
  onClose,
  onSaved,
}: {
  doc: ProjectDocument;
  open: boolean;
  example: boolean;
  onClose: () => void;
  onSaved: (version: number) => void;
}) {
  const go = useGuideNav();
  const guideSave = useGuideTarget(47);
  const [file, setFile] = useState<{ name: string; size: string } | null>(example ? EXAMPLE.file : null);
  const [motif, setMotif] = useState(example ? EXAMPLE.motif : "");
  const [status, setStatus] = useState<"Brouillon" | "En revue">("Brouillon");
  const [reviewer, setReviewer] = useState(REVIEWERS[0]);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const inForce = versionInForce(doc);
  const current = doc.versions.find((v) => v.version === doc.version);
  const next = doc.version + 1;
  const valid = Boolean(file) && motif.trim().length >= 5;

  const pick = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx", "xlsx"].includes(ext)) return setError("Format non accepté (PDF, DOCX, XLSX).");
    if (f.size > 10 * 1024 * 1024) return setError("Le fichier dépasse 10 Mo.");
    setError(null);
    setFile({ name: f.name, size: formatFileSize(f.size) });
  };

  const save = () => {
    setAttempted(true);
    if (!file || motif.trim().length < 5) return;
    dossierActions.addDocumentVersion(doc.id, { file: file.name, size: file.size, motif: motif.trim(), status, reviewer, notify });
    toast.show({
      title: `Version v${next} enregistrée`,
      description: `${file.name} — ${status.toLowerCase()}${notify ? `, ${reviewer} notifié` : ""}.`,
    });
    if (guideSave) go(47);
    else onSaved(next);
  };

  const summary: { icon: LucideIcon; title: string; detail: string }[] = [
    { icon: FileText, title: `Nouvelle version v${next}`, detail: `Le fichier ${file?.name ?? "sélectionné"} sera ajouté comme version ${next}.` },
    ...(inForce
      ? [{ icon: History, title: `Version approuvée v${inForce} conservée`, detail: `La version v${inForce} reste disponible dans l'historique des versions.` }]
      : []),
    {
      icon: UserCheck,
      title: "Revue requise avant remplacement",
      detail: `La nouvelle version sera soumise à revue par ${reviewer} avant d'éventuel remplacement.`,
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Ajouter une nouvelle version"
      subtitle={
        <>
          <span className="block text-[17px] font-semibold text-ink-900">{doc.name}</span>
          <span className="text-sm text-ink-500">
            Projet {doc.projectCode}
            {doc.formula && <> | Formule {doc.formula}</>}
            {doc.lot && <> | Lot {doc.lot}</>}
          </span>
        </>
      }
      footer={
        <>
          <Button variant="outline" size="lg" className="min-w-36" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" icon={<FilePlus2 className="h-5 w-5" />} onClick={save} disabled={attempted && !valid} guide={valid ? 47 : undefined}>
            Enregistrer la version
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 rounded-xl border border-line p-4">
          <h3 className="font-bold text-ink-900">Version actuelle (v{doc.version})</h3>
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-subtle p-4">
            <FileText className="h-8 w-8 shrink-0 text-ink-700" strokeWidth={1.4} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">
                {doc.name} - v{doc.version}
              </p>
              <p className="truncate text-sm text-ink-500">{docFileName(doc)}</p>
              {current?.approvedAt && (
                <p className="mt-1 text-sm text-ink-600">
                  Approuvé le {formatNumeric(current.approvedAt)} par {current.approvedBy}
                </p>
              )}
            </div>
            <DocStatusBadge status={doc.status} size="sm" />
          </div>

          <h3 className="mt-5 border-t border-line pt-4 font-bold text-ink-900">Nouvelle version</h3>
          <Field label="Fichier" required className="mt-3" error={attempted && !file ? "Sélectionnez le fichier de la nouvelle version." : error}>
            <GuideSpot step={47} active={!valid} hint="À faire d'abord : choisir le fichier et indiquer le motif, puis « Enregistrer la version ».">
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-line-strong px-3 py-2.5">
                  <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{file.name}</span>
                  <span className="text-sm text-ink-500">{file.size}</span>
                  <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-label="Fichier prêt" />
                  <button type="button" aria-label="Retirer le fichier" onClick={() => setFile(null)} className="cursor-pointer rounded p-1 text-ink-500 hover:bg-slate-100">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-brand-200 bg-subtle px-4 py-3 hover:border-brand-300">
                    <CloudUpload className="h-6 w-6 text-brand-500" aria-hidden />
                    <span className="text-sm">
                      <span className="block font-semibold text-ink-900">Choisir un fichier</span>
                      <span className="text-ink-500">PDF, DOCX, XLSX • 10 Mo max</span>
                    </span>
                    <input type="file" accept=".pdf,.docx,.xlsx" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => setFile(EXAMPLE.file)}>
                    Utiliser le fichier d&apos;exemple
                  </Button>
                </div>
              )}
            </GuideSpot>
          </Field>
          <Field label="Motif de la nouvelle version" required htmlFor="nv-motif" className="mt-4" error={attempted && motif.trim().length < 5 ? "Indiquez le motif de la nouvelle version." : null}>
            <Textarea id="nv-motif" rows={3} maxLength={1000} value={motif} onChange={(e) => setMotif(e.target.value)} invalid={attempted && motif.trim().length < 5} />
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Statut de la nouvelle version" required htmlFor="nv-status">
              <Select id="nv-status" options={["Brouillon", "En revue"]} value={status} onChange={(e) => setStatus(e.target.value as "Brouillon" | "En revue")} />
            </Field>
            <Field label="Relecteur" required htmlFor="nv-reviewer">
              <Select id="nv-reviewer" options={REVIEWERS} value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
            </Field>
          </div>
          <Checkbox className="mt-4" checked={notify} onChange={setNotify} label="Notifier le relecteur par e-mail" />
        </div>

        <div className="h-fit rounded-xl border border-line p-4">
          <h3 className="font-bold text-ink-900">Résumé des changements</h3>
          <ul className="mt-2 divide-y divide-line">
            {summary.map((x) => (
              <li key={x.title} className="flex gap-3 py-3">
                <x.icon className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.6} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{x.title}</span>
                  <span className="block text-[13px] text-ink-600">{x.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function VersionsSection({ doc, onNewVersion, justSaved }: { doc: ProjectDocument; onNewVersion: () => void; justSaved: number | null }) {
  const inForce = versionInForce(doc);
  const reviewer = doc.versions.find((v) => v.version === doc.version)?.reviewer ?? "le relecteur";
  const eventHref = `/projets/${doc.projectCode.toLowerCase()}/historique?evenement=${versionEventId(doc.id, doc.version)}`;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink-900">Historique des versions</h2>
        {!doc.archived && (
          <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={onNewVersion} guide={doc.id === "doc-cs-rf2" && doc.version < 3 ? 47 : undefined}>
            Ajouter une nouvelle version
          </Button>
        )}
      </div>
      {justSaved && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-success-100 bg-success-50 px-4 py-3">
          <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink-800">
            Version v{justSaved} enregistrée{inForce && inForce !== justSaved ? ` ; la version v${inForce} approuvée reste en vigueur jusqu'à l'approbation par ${reviewer}` : ""}.
          </p>
          <LinkButton href={eventHref} variant="outline" size="sm" icon={<History className="h-4 w-4" />} guide={doc.id === "doc-cs-rf2" ? 47 : undefined}>
            Voir dans l&apos;historique du projet
          </LinkButton>
        </div>
      )}
      <div className="relative mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="bg-subtle text-[13px] text-ink-700">
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-3 py-3 font-medium">Fichier</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Auteur</th>
              <th className="px-3 py-3 font-medium">Motif</th>
              <th className="px-3 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {doc.versions.map((v) => (
              <tr key={v.version} className="border-t border-line/70">
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink-900">v{v.version}</span>
                  {v.version === inForce && <span className="ml-2 text-xs text-success-700">en vigueur</span>}
                </td>
                <td className="px-3 py-3 text-ink-700">{v.file ?? (v.version === doc.version ? docFileName(doc) : "—")}</td>
                <td className="px-3 py-3 text-ink-700">{v.date ? formatNumeric(v.date) : "—"}</td>
                <td className="px-3 py-3 text-ink-700">{v.author}</td>
                <td className="max-w-64 px-3 py-3 text-ink-700">{v.motif ?? v.note}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-2 text-ink-800">
                    <StatusDot tone={v.status === "Approuvé" ? "success" : v.status === "Brouillon" ? "info" : "warn"} />
                    {v.version !== doc.version && v.version !== inForce ? "Remplacée" : (v.status ?? doc.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {inForce && inForce !== doc.version && !doc.archived && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
          <Info className="h-4 w-4 text-brand-600" aria-hidden />
          <span className="flex-1">
            Démonstration : simulez l&apos;approbation de la v{doc.version} par {reviewer}.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              dossierActions.approveDocument(doc.id, reviewer === "le relecteur" ? "Responsable développement" : reviewer);
              toast.show({ title: `Version v${doc.version} approuvée`, description: `${doc.name} : la v${doc.version} devient la version en vigueur.` });
            }}
          >
            Approuver la v{doc.version}
          </Button>
        </div>
      )}
    </Card>
  );
}

function CommentsSection({ doc }: { doc: ProjectDocument }) {
  const [text, setText] = useState("");
  const comments = doc.comments ?? [];
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink-900">Commentaires</h2>
      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">Aucun commentaire pour le moment.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-subtle px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">
                {c.author} <span className="font-normal text-ink-500">— {formatDateTime(c.at)}</span>
              </p>
              <p className="mt-1 text-[15px] text-ink-700">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Textarea aria-label="Nouveau commentaire" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter un commentaire…" />
        <div className="mt-2 flex justify-end">
          <Button
            disabled={!text.trim()}
            onClick={() => {
              dossierActions.addDocumentComment(doc.id, text.trim());
              setText("");
              toast.show({ title: "Commentaire publié", description: doc.name });
            }}
          >
            Publier
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TraceSection({ doc }: { doc: ProjectDocument }) {
  const state = useDemo();
  const events = state.history
    .filter((h) => h.docId === doc.id || h.href?.includes(doc.id))
    .sort((a, b) => b.at.localeCompare(a.at));
  const base = `/projets/${doc.projectCode.toLowerCase()}/historique`;
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink-900">Traçabilité</h2>
      {events.length === 0 ? (
        <EmptyState icon={History} title="Aucun événement" description="Les modifications de ce document apparaîtront ici." />
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-32 shrink-0 text-sm text-ink-600">{formatDateTime(e.at)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900">{e.title}</span>
                <span className="block text-sm text-ink-500">
                  Par {e.author}
                  {e.motif && ` — ${e.motif}`}
                </span>
              </span>
              <Link href={`${base}?evenement=${e.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                Voir dans l&apos;historique
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function InfoSection({ doc, projectName }: { doc: ProjectDocument; projectName: string }) {
  const inForce = versionInForce(doc);
  const rows: [string, string][] = [
    ["Catégorie", docFamily(doc)],
    ["Type", doc.type],
    ["Dossier", doc.category],
    ["Version en vigueur", inForce ? `v${inForce}` : "Aucune version approuvée"],
    ["Dernière version", `v${doc.version} (${doc.status.toLowerCase()})`],
    ["Projet lié", `${doc.projectCode} • ${projectName}`],
    ["Responsable", doc.owner],
    ...(doc.formula ? ([["Formule", doc.formula]] as [string, string][]) : []),
    ...(doc.lot ? ([["Lot", doc.lot]] as [string, string][]) : []),
    ["Date de création", formatNumeric(doc.createdAt ?? doc.versions.at(-1)?.date ?? doc.updatedAt)],
    ["Dernière modification", formatNumeric(doc.updatedAt)],
    ["Format", `${doc.fileType} (${doc.size})`],
    ["Fichier", docFileName(doc)],
  ];
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink-900">Informations générales</h2>
      <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-3 border-b border-line/70 py-2.5 text-[15px]">
            <dt className="text-ink-600">{k}</dt>
            <dd className="min-w-0 break-words text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 font-bold text-ink-900">Description</h3>
      <p className="mt-2 rounded-lg bg-subtle px-3.5 py-3 text-[15px] text-ink-700">{doc.description ?? "Aucune description."}</p>
      {(doc.keywords ?? []).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {doc.keywords?.map((k) => (
            <span key={k} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
              {k}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

export function DocumentDetail({ slug, docId, initialSection, newVersion }: { slug: string; docId: string; initialSection?: DocSection; newVersion?: "vide" | "exemple" }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const doc = state.documents.find((d) => d.id === docId && d.projectCode === project?.code);
  const [section, setSection] = useState<DocSection>(initialSection ?? "versions");
  const [modal, setModal] = useState<{ open: boolean; example: boolean; key: number }>({ open: Boolean(newVersion), example: newVersion === "exemple", key: 0 });
  const [justSaved, setJustSaved] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (!project) return null;
  if (!doc) {
    return (
      <Card className="mt-5">
        <EmptyState
          icon={FileX}
          title="Document introuvable"
          description="Ce document n'existe pas ou a été supprimé."
          action={<LinkButton href={`/projets/${slug}/documents`}>Retour aux documents</LinkButton>}
        />
      </Card>
    );
  }

  const openModal = (example = false) => setModal((m) => ({ open: true, example, key: m.key + 1 }));
  const menu: MenuItem[] = [
    ...(!doc.archived ? [{ label: "Nouvelle version", icon: FilePlus2, onSelect: () => openModal() }] : []),
    { label: "Télécharger", icon: Download, onSelect: () => downloadDocument(doc) },
    doc.archived
      ? { label: "Restaurer", icon: ArchiveRestore, onSelect: () => dossierActions.restoreDocument(doc.id) }
      : { label: "Archiver", icon: Archive, separatorBefore: true, onSelect: () => setArchiveOpen(true) },
  ];

  return (
    <>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[38px]">
            {project.code} • {project.name}
          </h1>
          <MetaLine
            className="mt-1"
            items={[
              project.formLabel,
              project.dosage,
              ...(doc.formula ? [<span key="f" className="flex items-center gap-2"><StatusDot tone="info" />{doc.formula}</span>] : []),
              ...(doc.lot ? [<span key="l" className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden />Lot {doc.lot}</span>] : []),
            ]}
          />
        </div>
        <Menu label="Actions document" items={menu} trigger={actionsTrigger("Actions document")} triggerClassName={ACTIONS_TRIGGER_CLASS} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-ink-900">Documents</h2>
          <p className="text-lg text-ink-600">{doc.name}</p>
          <Card className="mt-4 overflow-hidden">
            <Link href={`/projets/${slug}/documents?doc=${doc.id}`} className="flex items-center gap-2 border-b border-line px-4 py-3 text-[15px] font-medium text-brand-700 hover:bg-brand-50">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Retour aux documents
            </Link>
            <div className="flex items-start gap-3 border-b border-line px-4 py-3">
              <FileText className="h-8 w-8 shrink-0 text-ink-700" strokeWidth={1.4} aria-hidden />
              <span>
                <span className="block font-semibold text-ink-900">{doc.name}</span>
                <span className="block text-sm text-ink-500">Type : {doc.type}</span>
                {doc.archived && <Badge className="mt-1">Archivé</Badge>}
              </span>
            </div>
            <nav aria-label="Sections du document">
              {SECTIONS.map((x) => (
                <button
                  key={x.value}
                  type="button"
                  aria-current={section === x.value ? "true" : undefined}
                  onClick={() => setSection(x.value)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-[15px] transition-colors",
                    section === x.value ? "border-l-4 border-brand-600 bg-brand-50 pl-3 font-semibold text-brand-700" : "text-ink-800 hover:bg-subtle",
                  )}
                >
                  <x.icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
                  {x.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>
        <div className="min-w-0">
          {section === "informations" && <InfoSection doc={doc} projectName={project.name} />}
          {section === "versions" && <VersionsSection doc={doc} onNewVersion={() => openModal()} justSaved={justSaved} />}
          {section === "commentaires" && <CommentsSection doc={doc} />}
          {section === "tracabilite" && <TraceSection doc={doc} />}
        </div>
      </div>

      <NewVersionModal
        key={modal.key}
        doc={doc}
        open={modal.open}
        example={modal.example}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={(v) => {
          setModal((m) => ({ ...m, open: false }));
          setSection("versions");
          setJustSaved(v);
        }}
      />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archiver le document ?"
        message={<>Le document reste consultable en lecture seule et peut être restauré. L&apos;archivage est tracé dans l&apos;historique du projet.</>}
        confirmLabel="Archiver"
        onConfirm={() => {
          dossierActions.archiveDocument(doc.id);
          toast.show({ title: "Document archivé", description: doc.name });
        }}
      />
      <ScreenRef n={doc.id === "doc-cs-rf2" ? 46 : undefined} label="Document — importer une nouvelle version" />
    </>
  );
}
