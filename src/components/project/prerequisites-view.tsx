"use client";

import {
  Box,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Download,
  FileText,
  FlaskConical,
  History,
  Info,
  Link2,
  Mail,
  Paperclip,
  Plus,
  Send,
  Settings,
  TestTubes,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GuideDot } from "@/components/guide/guide-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, DateInput, Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { PREREQUISITE_CATEGORIES, RECIPIENTS, SUPPLIERS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { buildPdf, downloadBlob } from "@/lib/export-files";
import { DEMO_TODAY, addDays, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { findProject } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Prerequisite, PrerequisiteCategory, PrerequisiteImportance, PrerequisiteQuality, PrerequisiteStatus, Project, RequestType } from "@/lib/types";
import { ImportDocumentModal } from "./prerequisite-import";
import { ProjectTabs } from "./project-frame";

const CATEGORY_ICON: Record<PrerequisiteCategory, LucideIcon> = { Documents: FileText, Matières: FlaskConical, Ressources: Settings };
const ROW_ICON: Record<Prerequisite["icon"], LucideIcon> = { doc: FileText, flask: FlaskConical, sample: TestTubes };
const IMPORTANCES: PrerequisiteImportance[] = ["Très importante", "Importante", "Normale"];
const QUALITIES: PrerequisiteQuality[] = ["Non disponible", "À vérifier", "Conforme", "Non conforme"];

/** Radio options of the "Statut" block (wording adapted to documents or to materials / resources). */
function statusOptions(category: PrerequisiteCategory): { value: PrerequisiteStatus; detail: string }[] {
  const doc = category === "Documents";
  return [
    { value: "Non disponible", detail: doc ? "Document non reçu." : "Élément non reçu." },
    { value: "En cours de réception", detail: "Demande envoyée, en attente de réception." },
    { value: "Reçu", detail: doc ? "Document reçu, en attente de vérification." : "Élément reçu, en attente de vérification." },
    { value: "Vérifié", detail: doc ? "Document vérifié et conforme." : "Élément vérifié et conforme." },
  ];
}

/** Status shown in the lists ("Manquant", "Réception attendue", "Vérifiée"…). */
export function prerequisiteLook(p: Prerequisite): { label: string; text: string; icon: LucideIcon; iconClass: string } {
  switch (p.status) {
    case "Non disponible":
      return { label: "Manquant", text: "text-warn-700", icon: CircleAlert, iconClass: "fill-warn-500 text-white" };
    case "En cours de réception":
      return { label: "Réception attendue", text: "text-warn-700", icon: CircleAlert, iconClass: "fill-warn-500 text-white" };
    case "Reçu":
      return { label: "Reçu, à vérifier", text: "text-brand-700", icon: Clock, iconClass: "text-brand-600" };
    default:
      return {
        label: p.agreement === "f" ? "Vérifiée" : p.agreement === "pl" ? "Vérifiés" : "Vérifié",
        text: "text-success-700",
        icon: CircleCheck,
        iconClass: "fill-success-500 text-white",
      };
  }
}

const hasPiece = (p: Prerequisite) => Boolean(p.file || p.documentId);

function downloadPiece(p: Prerequisite, project: Project) {
  if (!p.file) return;
  const blob = buildPdf([
    { text: p.file.name, size: 16, bold: true },
    { text: `${project.code} • ${project.name} — prérequis « ${p.name} » (${p.reference ?? "sans version"})`, gap: 6 },
    { text: `Statut : ${p.status}. Qualité : ${p.quality}. Responsable : ${p.source}.` },
    ...(p.file.fields?.length ? [{ text: "Informations vérifiées", bold: true, gap: 12 }, ...p.file.fields.map((f) => ({ text: `${f.label} : ${f.value}` }))] : []),
    { text: "Document de démonstration généré par l'Espace R&D.", size: 9, gap: 18 },
  ]);
  downloadBlob(p.file.name.replace(/\.[^.]+$/, ".pdf"), blob);
  toast.show({ title: "Téléchargement lancé", description: p.file.name });
}

/* ------------------------------------------------------------------ */
/* Request (screen 14)                                                 */
/* ------------------------------------------------------------------ */

const REQUEST_TYPES: { value: RequestType; label: string; icon: LucideIcon }[] = [
  { value: "Document", label: "Document", icon: FileText },
  { value: "Matière", label: "Matière", icon: FlaskConical },
  { value: "Réactif", label: "Réactif", icon: Box },
];

function RequestDrawer({
  project,
  prerequisite,
  prerequisites,
  open,
  onClose,
}: {
  project: Project;
  prerequisite?: Prerequisite;
  prerequisites: Prerequisite[];
  open: boolean;
  onClose: () => void;
}) {
  const [type, setType] = useState<RequestType>(prerequisite?.category === "Matières" ? "Matière" : "Document");
  const [object, setObject] = useState(prerequisite?.name ?? "");
  const [recipient, setRecipient] = useState(prerequisite ? (RECIPIENTS.includes(prerequisite.source) ? prerequisite.source : "R&D") : "");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(addDays(DEMO_TODAY, 4));
  const [justification, setJustification] = useState(prerequisite?.defaultJustification ?? "");
  const [linkedId, setLinkedId] = useState(prerequisite?.id ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  const errors = {
    object: !object.trim() ? "Renseignez l'objet de la demande." : null,
    recipient: !recipient ? "Choisissez un destinataire." : null,
    supplier: !supplier ? "Choisissez un fournisseur." : null,
    date: !date ? "Choisissez une date." : date < DEMO_TODAY ? "La date souhaitée ne peut pas être passée." : null,
    justification: !justification.trim() ? "Justifiez la demande." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);
  const linked = prerequisites.find((p) => p.id === linkedId);

  const submit = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const ref = actions.createRequest({
      projectCode: project.code,
      type,
      object: object.trim(),
      recipient,
      supplier,
      wishedDate: date,
      justification: justification.trim(),
      prerequisiteId: linkedId || undefined,
    });
    setCreatedRef(ref);
    toast.show({ title: `Demande ${ref} créée`, description: `${object.trim()} — transmise à : ${recipient}.` });
  };

  const locked = Boolean(createdRef);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Créer une demande"
      subtitle="Demander un document, une matière ou un réactif."
      footer={
        locked ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Fermer
            </Button>
            <Button
              variant="outline"
              size="lg"
              icon={<Plus className="h-5 w-5" />}
              onClick={() => {
                setCreatedRef(null);
                setSubmitted(false);
                setObject("");
                setJustification("");
                setLinkedId("");
                setSupplier("");
              }}
            >
              Nouvelle demande
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={onClose}>
              Annuler
            </Button>
            <Button size="lg" onClick={submit}>
              Créer la demande
            </Button>
          </div>
        )
      }
    >
      <fieldset disabled={locked} className="space-y-5 disabled:opacity-80">
        <Field label="Type de demande">
          <Segmented label="Type de demande" options={REQUEST_TYPES} value={type} onChange={setType} />
        </Field>
        <Field label="Objet" required htmlFor="req-object" error={show(errors.object)}>
          <Input id="req-object" value={object} placeholder="Ex. Certificat GMP fournisseur" invalid={Boolean(show(errors.object))} onChange={(e) => setObject(e.target.value)} />
        </Field>
        <Field label="Destinataire interne" required htmlFor="req-recipient" error={show(errors.recipient)}>
          <Select id="req-recipient" placeholder="À sélectionner" options={RECIPIENTS} value={recipient} invalid={Boolean(show(errors.recipient))} onChange={(e) => setRecipient(e.target.value)} />
        </Field>
        <Field label="Fournisseur" required htmlFor="req-supplier" error={show(errors.supplier)}>
          <Select id="req-supplier" placeholder="À sélectionner" options={SUPPLIERS} value={supplier} invalid={Boolean(show(errors.supplier))} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field label="Date souhaitée" required htmlFor="req-date" error={show(errors.date)}>
          <DateInput id="req-date" value={date} onChange={setDate} onClear={() => setDate("")} invalid={Boolean(show(errors.date))} />
        </Field>
        <Field label="Justification" required htmlFor="req-justification" error={show(errors.justification)}>
          <Textarea
            id="req-justification"
            rows={3}
            maxLength={500}
            value={justification}
            placeholder="Ex. Requis pour la revue de faisabilité."
            invalid={Boolean(show(errors.justification))}
            onChange={(e) => setJustification(e.target.value)}
          />
        </Field>
        {prerequisite ? null : (
          <Field label="Prérequis associé" htmlFor="req-linked" optional>
            <Select
              id="req-linked"
              placeholder="Aucun"
              options={prerequisites.filter((p) => p.status !== "Vérifié").map((p) => ({ value: p.id, label: p.name }))}
              value={linkedId}
              onChange={(e) => setLinkedId(e.target.value)}
            />
          </Field>
        )}
      </fieldset>

      {linked && (
        <div className="mt-5 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/80 p-4">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-ink-700" aria-hidden />
          <div>
            <p className="font-semibold text-ink-900">Prérequis associé</p>
            <p className="font-semibold text-ink-900">{linked.name}</p>
            <p className="text-sm text-ink-600">
              Prérequis du projet {project.code} • {project.name}
            </p>
          </div>
        </div>
      )}

      {createdRef && (
        <div className="mt-5">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
            <CircleCheck className="h-8 w-8 shrink-0 fill-success-500 text-white" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold text-ink-900">
                Demande créée • <span className="text-success-600">À traiter</span>
              </p>
              <p className="text-sm text-ink-600">Référence interne : {createdRef}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-ink-500" aria-hidden />
          </div>
          {linked && <p className="mt-2 text-sm text-ink-600">Le prérequis passe « en cours de réception » : il restera à le recevoir puis à le vérifier.</p>}
        </div>
      )}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Add a prerequisite                                                  */
/* ------------------------------------------------------------------ */

function AddPrerequisiteModal({
  project,
  category: initialCategory,
  open,
  onClose,
  onCreated,
}: {
  project: Project;
  category: PrerequisiteCategory;
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [category, setCategory] = useState<PrerequisiteCategory>(initialCategory);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [source, setSource] = useState("Achats");
  const [importance, setImportance] = useState<PrerequisiteImportance>("Importante");
  const [blocking, setBlocking] = useState(false);
  const [tried, setTried] = useState(false);
  const error = !name.trim() ? "Nommez le prérequis." : name.trim().length < 3 ? "Trois caractères minimum." : null;

  const create = () => {
    setTried(true);
    if (error) return;
    const id = actions.addPrerequisite({ projectCode: project.code, category, name: name.trim(), detail: detail.trim() || "Prérequis ajouté pour la revue.", source, importance, blocking });
    toast.show({ title: "Prérequis ajouté", description: `${name.trim()} — ${category.toLowerCase()}, statut « Non disponible ».` });
    onCreated(id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Ajouter un prérequis"
      subtitle={`Projet ${project.code} • ${project.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={create}>
            Ajouter le prérequis
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Catégorie" required htmlFor="ap-category">
          <Select id="ap-category" options={PREREQUISITE_CATEGORIES.map((c) => c.value)} value={category} onChange={(e) => setCategory(e.target.value as PrerequisiteCategory)} />
        </Field>
        <Field label="Responsable" required htmlFor="ap-source">
          <Select id="ap-source" options={RECIPIENTS} value={source} onChange={(e) => setSource(e.target.value)} />
        </Field>
        <Field label="Nom" required htmlFor="ap-name" error={tried ? error : null} className="col-span-2">
          <Input id="ap-name" value={name} placeholder="Ex. Certificat d'analyse du lot fournisseur" invalid={tried && Boolean(error)} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="ap-detail" optional className="col-span-2">
          <Textarea id="ap-detail" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
        <Field label="Importance" required htmlFor="ap-importance">
          <Select id="ap-importance" options={IMPORTANCES} value={importance} onChange={(e) => setImportance(e.target.value as PrerequisiteImportance)} />
        </Field>
        <div className="flex items-end pb-2.5">
          <Checkbox checked={blocking} onChange={setBlocking} label="Bloquant pour la revue" />
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Detail panel (screen 12)                                            */
/* ------------------------------------------------------------------ */

function PrerequisitePanel({
  project,
  prerequisite: p,
  onClose,
  onImport,
  onRequest,
}: {
  project: Project;
  prerequisite: Prerequisite;
  onClose: () => void;
  onImport: () => void;
  onRequest: () => void;
}) {
  const state = useDemo();
  const router = useRouter();
  const [statusError, setStatusError] = useState<string | null>(null);
  const guideImport = useGuideTarget(13) && p.id === "pr-cr-1";
  const guideRequest = useGuideTarget(14) && p.id === "pr-cr-2";
  const request = p.requestRef ? state.requests.find((r) => r.ref === p.requestRef) : undefined;
  const look = prerequisiteLook(p);

  const setStatus = (status: PrerequisiteStatus) => {
    if (status === "Vérifié" && p.category === "Documents" && !hasPiece(p)) {
      setStatusError("Ajoutez le document avant de le marquer comme vérifié.");
      return;
    }
    setStatusError(null);
    actions.updatePrerequisite(p.id, { status });
    toast.show({ title: `${p.name} : ${status.toLowerCase()}`, description: "Le changement de statut est tracé dans l'historique du projet." });
  };

  return (
    <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-ink-900">{p.name}</h2>
        <button type="button" aria-label="Fermer le détail" onClick={onClose} className="-mr-1 cursor-pointer rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-600">{p.detail}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Responsable" required htmlFor="pp-source">
          <Select id="pp-source" options={[...new Set([p.source, ...RECIPIENTS])]} value={p.source} onChange={(e) => actions.updatePrerequisite(p.id, { source: e.target.value })} />
        </Field>
        <Field label="Importance" required htmlFor="pp-importance">
          <Select id="pp-importance" options={IMPORTANCES} value={p.importance} onChange={(e) => actions.updatePrerequisite(p.id, { importance: e.target.value as PrerequisiteImportance })} />
        </Field>
        <Field label="Qualité" required htmlFor="pp-quality" className="col-span-2">
          <Select id="pp-quality" options={QUALITIES} value={p.quality} onChange={(e) => actions.updatePrerequisite(p.id, { quality: e.target.value as PrerequisiteQuality })} />
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-[15px] font-semibold text-ink-800">Statut</legend>
        <div className="divide-y divide-line rounded-xl border border-line">
          {statusOptions(p.category).map((o) => {
            const checked = p.status === o.value;
            return (
              <label key={o.value} className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors", checked ? "bg-brand-50" : "hover:bg-subtle")}>
                <input type="radio" name={`statut-${p.id}`} className="peer sr-only" checked={checked} onChange={() => setStatus(o.value)} />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white peer-focus-visible:ring-3 peer-focus-visible:ring-brand-200",
                    checked ? "border-brand-600" : "border-line-strong",
                  )}
                >
                  {checked && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                </span>
                <span className="flex w-5 shrink-0 justify-center">{checked && <look.icon className={cn("h-5 w-5", look.iconClass)} aria-hidden />}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900">{o.value}</span>
                  <span className="block text-[13px] text-ink-500">{o.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
        {statusError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-danger-600" role="alert">
            <CircleAlert className="h-4 w-4 shrink-0 fill-danger-600 text-white" aria-hidden />
            {statusError}
          </p>
        )}
      </fieldset>

      <h3 className="mt-4 text-[15px] font-semibold text-ink-800">Document associé</h3>
      {p.file ? (
        <div className="mt-1.5 rounded-xl border border-line p-3">
          <div className="flex items-center gap-3">
            <FileText className="h-7 w-7 shrink-0 text-ink-600" strokeWidth={1.4} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-900">{p.file.name}</span>
              <span className="block text-xs text-ink-500">
                {p.reference ? `${p.reference} · ` : ""}
                {p.file.size}
                {p.file.pages ? ` · ${p.file.pages} pages` : ""}
                {p.date && p.status === "Vérifié" ? ` · vérifié le ${formatNumeric(p.date)}` : ""}
              </span>
            </span>
            <button type="button" aria-label={`Télécharger ${p.file.name}`} onClick={() => downloadPiece(p, project)} className="cursor-pointer rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700">
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Retirer ${p.file.name}`}
              onClick={() => {
                actions.detachPrerequisiteFile(p.id);
                toast.show({ title: "Document retiré", description: `${p.name} repasse « non disponible ».`, tone: "info" });
              }}
              className="cursor-pointer rounded-lg p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-2.5">
            <Button variant="outline" size="sm" className="w-full" icon={<Upload className="h-4 w-4" />} onClick={onImport}>
              Importer une nouvelle version
            </Button>
            {guideImport && <GuideDot step={13} hint="Le fournisseur a transmis la version 4 de son DMF : importez-la et vérifiez les informations extraites." />}
          </div>
        </div>
      ) : p.documentId ? (
        <button
          type="button"
          onClick={() => router.push(`/projets/${project.slug}/documents?doc=${p.documentId}`)}
          className="mt-1.5 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left text-sm hover:border-brand-300"
        >
          <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.4} aria-hidden />
          <span className="flex-1 font-semibold text-ink-900">{state.documents.find((d) => d.id === p.documentId)?.name ?? "Document du projet"}</span>
          <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={onImport}
          className="relative mt-1.5 flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-brand-200 px-3 py-3 hover:border-brand-400 hover:bg-brand-50/40"
        >
          <Paperclip className="h-5 w-5 text-brand-600" aria-hidden />
          <span className="text-left">
            <span className="block font-semibold text-brand-700">Ajouter un document</span>
            <span className="block text-xs text-ink-500">PDF, DOC, XLSX (max. 10 Mo)</span>
          </span>
          {guideImport && <GuideDot step={13} />}
        </button>
      )}

      {request && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-ink-700">
          <Send className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          Demande {request.ref} envoyée à {request.recipient} ({request.supplier}) — réception souhaitée le {formatNumeric(request.wishedDate)}.
        </p>
      )}

      <div className="relative mt-4">
        <Menu
          label="Demander au responsable"
          className="w-full"
          align="left"
          widthClass="w-full"
          triggerClassName={cn(
            "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border font-semibold transition-colors",
            guideRequest ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : "border-brand-300 bg-white text-brand-700 hover:bg-brand-50",
          )}
          trigger={
            <>
              <Mail className="h-5 w-5" aria-hidden />
              Demander au responsable
              <ChevronDown className="h-4 w-4" aria-hidden />
            </>
          }
          items={[
            { label: "Créer une demande", description: `Document, matière ou réactif — destinataire : ${p.source}.`, icon: Send, onSelect: onRequest },
            {
              label: "Envoyer un rappel",
              description: "Relance tracée dans l'historique du projet.",
              icon: Mail,
              disabled: p.status === "Vérifié",
              onSelect: () => {
                actions.remindPrerequisite(p.id);
                toast.show({ title: "Rappel envoyé", description: `${p.name} — ${p.source}.` });
              },
            },
            { label: "Voir l'historique", icon: History, href: `/projets/${project.slug}/historique?objet=Pr%C3%A9requis&periode=tout`, separatorBefore: true },
          ]}
        />
        {guideRequest && <GuideDot step={14} hint="Demandez le certificat GMP aux Achats (« Créer une demande »)." />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function PrerequisiteRow({
  p,
  selected,
  onSelect,
  onImport,
  onRequest,
  guideStep,
  guideHint,
}: {
  p: Prerequisite;
  selected: boolean;
  onSelect: () => void;
  onImport: () => void;
  onRequest: () => void;
  guideStep?: number;
  guideHint?: string;
}) {
  const look = prerequisiteLook(p);
  const Icon = ROW_ICON[p.icon];
  const missing = p.status === "Non disponible";
  return (
    <li
      onClick={onSelect}
      className={cn(
        "relative grid cursor-pointer grid-cols-[22px_34px_minmax(0,1fr)_104px_20px_164px_88px_32px] items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
        selected ? (missing ? "border-warn-500/60 bg-warn-50" : "border-brand-300 bg-brand-50/70") : "border-line bg-white hover:border-brand-200",
      )}
    >
      <input
        type="radio"
        name="prerequis"
        aria-label={p.name}
        checked={selected}
        onChange={onSelect}
        className={cn("h-5 w-5 cursor-pointer", selected && missing ? "accent-warn-600" : "accent-brand-600")}
      />
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-subtle">
        <Icon className="h-5 w-5 text-ink-700" strokeWidth={1.6} aria-hidden />
      </span>
      <span className="min-w-0 truncate font-semibold text-ink-900">{p.name}</span>
      <span className="truncate text-sm text-ink-600">{p.reference ?? "—"}</span>
      <span title={p.detail} className="inline-flex cursor-help text-ink-400">
        <Info className="h-[18px] w-[18px]" aria-label={p.detail} />
      </span>
      <span className={cn("flex items-center gap-2 text-sm font-medium", look.text)}>
        <look.icon className={cn("h-5 w-5 shrink-0", look.iconClass)} aria-hidden />
        {look.label}
      </span>
      <span className="text-sm tabular-nums text-ink-600">{p.date ? formatNumeric(p.date) : "—"}</span>
      <span onClick={(e) => e.stopPropagation()}>
        <Menu
          label={`Actions pour ${p.name}`}
          items={[
            { label: p.file ? "Importer une nouvelle version" : "Importer et vérifier un document", icon: Upload, onSelect: onImport },
            { label: "Créer une demande", icon: Send, onSelect: onRequest, disabled: p.status === "Vérifié" },
            ...(p.status !== "Vérifié" && (p.category !== "Documents" || hasPiece(p))
              ? [
                  {
                    label: "Marquer comme vérifié",
                    icon: CircleCheck,
                    onSelect: () => {
                      actions.updatePrerequisite(p.id, { status: "Vérifié" });
                      toast.show({ title: "Prérequis vérifié", description: p.name });
                    },
                  },
                ]
              : []),
          ]}
        />
      </span>
      {guideStep !== undefined && <GuideDot step={guideStep} hint={guideHint} />}
    </li>
  );
}

export function PrerequisitesView({
  slug,
  selectedId,
  openRequestFor,
  importFor,
  example,
}: {
  slug: string;
  selectedId?: string;
  openRequestFor?: string;
  importFor?: string;
  example?: boolean;
}) {
  const state = useDemo();
  const router = useRouter();
  const project = findProject(state, slug);
  const all = project ? state.prerequisites.filter((p) => p.projectCode === project.code) : [];
  const firstMissing = all.find((p) => p.blocking && p.status !== "Vérifié") ?? all.find((p) => p.status !== "Vérifié");
  const [selected, setSelected] = useState<string | null>(openRequestFor ?? importFor ?? selectedId ?? firstMissing?.id ?? null);
  const [drawer, setDrawer] = useState<{ open: boolean; prerequisiteId?: string; key: number }>({ open: Boolean(openRequestFor), prerequisiteId: openRequestFor, key: 0 });
  const [importer, setImporter] = useState<{ open: boolean; id?: string; example: boolean; key: number }>({ open: Boolean(importFor), id: importFor, example: Boolean(example), key: 0 });
  const [adding, setAdding] = useState<{ open: boolean; category: PrerequisiteCategory; key: number }>({ open: false, category: "Documents", key: 0 });
  const guideImport = useGuideTarget(13);
  const guideRequest = useGuideTarget(14);

  if (!project) return null;
  const current = all.find((p) => p.id === selected);
  const openDrawer = (prerequisiteId?: string) => setDrawer((d) => ({ open: true, prerequisiteId, key: d.key + 1 }));
  const openImport = (id: string) => setImporter((m) => ({ open: true, id, example: false, key: m.key + 1 }));
  const missing = all.filter((p) => p.status !== "Vérifié");
  const blockingMissing = missing.filter((p) => p.blocking);
  const importing = all.find((p) => p.id === importer.id);

  // Mock-ups 12 → 14 tell the story of CR-01: the page shows the screen reached by the data.
  const cr = project.code === "CR-01";
  const screen = !cr
    ? undefined
    : importer.open
      ? 13
      : drawer.open || all.find((p) => p.id === "pr-cr-2")?.requestRef
        ? 14
        : all.some((p) => p.importedAt)
          ? 13
          : 12;
  const screenLabel = screen === 13 ? "Importer et vérifier un document" : screen === 14 ? "Demander un document ou une matière" : "Prérequis du projet";

  return (
    <>
      <ProjectTabs slug={slug} />

      {all.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={FileText}
            title="Aucun prérequis"
            description="Ajoutez les documents, matières et ressources nécessaires à la revue."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding((a) => ({ open: true, category: "Documents", key: a.key + 1 }))}>
                Ajouter un prérequis
              </Button>
            }
          />
        </Card>
      ) : (
        <div className={cn("mt-5 grid grid-cols-1 gap-5", current && "xl:grid-cols-[minmax(0,1fr)_420px]")}>
          <div className="min-w-0 space-y-4">
            {PREREQUISITE_CATEGORIES.map((c) => {
              const items = all.filter((p) => p.category === c.value);
              const Icon = CATEGORY_ICON[c.value];
              const verified = items.filter((p) => p.status === "Vérifié").length;
              return (
                <Card key={c.value} className="p-4">
                  <div className="flex items-start gap-4 px-1">
                    <Icon className="mt-0.5 h-8 w-8 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h2 className="flex items-baseline gap-4 text-lg font-bold text-ink-900">
                        {c.value}
                        <span className={cn("font-semibold tabular-nums", verified === items.length ? "text-success-600" : "text-brand-600")}>
                          {verified} / {items.length}
                        </span>
                      </h2>
                      <p className="text-sm text-ink-600">{c.detail}</p>
                    </div>
                    <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding((a) => ({ open: true, category: c.value, key: a.key + 1 }))}>
                      Ajouter
                    </Button>
                  </div>
                  {items.length === 0 ? (
                    <p className="mt-3 rounded-lg bg-subtle px-4 py-3 text-sm text-ink-500">Aucun élément dans cette catégorie.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {items.map((p) => {
                        const dotImport = guideImport && cr && p.id === "pr-cr-1" && selected !== p.id;
                        const dotRequest = guideRequest && cr && p.id === "pr-cr-2" && selected !== p.id;
                        return (
                          <PrerequisiteRow
                            key={p.id}
                            p={p}
                            selected={selected === p.id}
                            onSelect={() => setSelected(p.id)}
                            onImport={() => openImport(p.id)}
                            onRequest={() => openDrawer(p.id)}
                            guideStep={dotImport ? 13 : dotRequest ? 14 : undefined}
                            guideHint={
                              dotImport
                                ? "Le fournisseur a transmis la version 4 de son DMF : ouvrez le DMF / CEP puis « Importer une nouvelle version »."
                                : "Sélectionnez le certificat GMP puis « Demander au responsable »."
                            }
                          />
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}

            {missing.length > 0 ? (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
                <CircleAlert className="h-7 w-7 shrink-0 fill-danger-500 text-white" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-danger-700">
                    {blockingMissing.length
                      ? `${blockingMissing.map((p) => p.name).join(" et ")} requis avant la revue.`
                      : `${missing.length} prérequis à compléter avant la revue.`}
                  </p>
                  <p className="text-sm text-ink-700">Tous les prérequis doivent être complétés pour pouvoir préparer la revue.</p>
                </div>
                <div className="text-center">
                  <Button size="lg" disabled className="min-w-52 disabled:bg-slate-300" icon={<FileText className="h-5 w-5" />}>
                    Préparer la revue
                  </Button>
                  <p className="mt-1 text-xs text-ink-500">Action indisponible tant que des prérequis sont manquants.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-success-500/30 bg-success-50 px-4 py-3">
                <CircleCheck className="h-7 w-7 shrink-0 fill-success-500 text-white" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-success-700">Tous les prérequis sont vérifiés.</p>
                  <p className="text-sm text-ink-700">La revue peut être préparée avec les pièces du projet.</p>
                </div>
                <Button size="lg" className="min-w-52" icon={<FileText className="h-5 w-5" />} onClick={() => router.push("/vue-ensemble/revues")}>
                  Préparer la revue
                </Button>
              </div>
            )}
          </div>

          {current && (
            <PrerequisitePanel
              key={current.id}
              project={project}
              prerequisite={current}
              onClose={() => setSelected(null)}
              onImport={() => openImport(current.id)}
              onRequest={() => openDrawer(current.id)}
            />
          )}
        </div>
      )}

      <RequestDrawer
        key={`req-${drawer.key}`}
        project={project}
        prerequisite={all.find((p) => p.id === drawer.prerequisiteId)}
        prerequisites={all}
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
      />
      {importing && (
        <ImportDocumentModal
          key={`imp-${importer.key}`}
          project={project}
          prerequisite={importing}
          prerequisites={all}
          example={importer.example}
          open={importer.open}
          onClose={() => setImporter((m) => ({ ...m, open: false }))}
          onSaved={(id) => {
            setImporter((m) => ({ ...m, open: false }));
            setSelected(id);
          }}
        />
      )}
      <AddPrerequisiteModal
        key={`add-${adding.key}`}
        project={project}
        category={adding.category}
        open={adding.open}
        onClose={() => setAdding((a) => ({ ...a, open: false }))}
        onCreated={(id) => {
          setAdding((a) => ({ ...a, open: false }));
          setSelected(id);
        }}
      />
      <ScreenRef n={screen} label={screenLabel} />
    </>
  );
}
