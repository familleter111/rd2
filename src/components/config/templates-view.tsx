"use client";

import {
  ArrowRight,
  ChartNoAxesColumn,
  ChevronRight,
  CircleCheck,
  Copy,
  FileText,
  FlaskConical,
  Info,
  List,
  Plus,
  Settings,
  SquareCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Segmented, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { FAMILIES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatNumeric } from "@/lib/format";
import { dossierActions, getDemoState, useDemo } from "@/lib/store";
import type { Family, PathTemplate, TemplateIcon, TemplatePhase, TemplateStatus, TemplateVersion } from "@/lib/types";
import { ConfigFrame } from "./config-frame";

const ICONS: Record<TemplateIcon, LucideIcon> = {
  doc: FileText,
  list: List,
  flask: FlaskConical,
  settings: Settings,
  check: SquareCheck,
  chart: ChartNoAxesColumn,
  users: Users,
  arrow: ArrowRight,
};

const STATUS_TONE: Record<TemplateStatus, "success" | "neutral" | "info"> = { Actif: "success", Brouillon: "neutral", Archivé: "info" };

function StatusLabel({ status }: { status: TemplateStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", status === "Actif" ? "text-success-700" : "text-ink-500")}>
      <StatusDot tone={STATUS_TONE[status]} />
      {status}
    </span>
  );
}

const EMPTY_PHASES = (): TemplatePhase[] =>
  [
    ["cadrer", "Cadrer", "Évaluer la faisabilité et réunir les prérequis."],
    ["developper", "Développer", "Développer les formules et réaliser les essais."],
    ["confirmer", "Confirmer", "Produire un lot pilote, réaliser les contrôles et suivre la stabilité."],
    ["deposer", "Déposer & transférer", "Préparer le dossier, réaliser la revue et assurer le transfert."],
  ].map(([key, title, description]) => ({ key, title, description, activities: [], proofs: [] }));

function AddItemModal({
  template,
  version,
  phaseKey,
  open,
  onClose,
  onAdded,
}: {
  template: PathTemplate;
  version: TemplateVersion;
  phaseKey: string;
  open: boolean;
  onClose: () => void;
  onAdded: (draftVersion: number) => void;
}) {
  const [phase, setPhase] = useState(phaseKey);
  const [kind, setKind] = useState<"activities" | "proofs">("activities");
  const [label, setLabel] = useState("");
  const active = version.status !== "Brouillon";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter une activité"
      subtitle={`${template.name} — version ${version.version}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={label.trim().length < 3}
            onClick={() => {
              dossierActions.addTemplateItem(template.id, phase, kind, label.trim());
              const draft = getDemoState().templates.find((t) => t.id === template.id)?.versions.find((v) => v.status === "Brouillon");
              toast.show({
                title: kind === "activities" ? "Activité ajoutée" : "Preuve ajoutée",
                description: active
                  ? `Version ${draft?.version} créée en brouillon : la version ${version.version} reste utilisée par les projets.`
                  : `${label.trim()} — version ${draft?.version} (brouillon).`,
              });
              if (draft) onAdded(draft.version);
              onClose();
            }}
          >
            Ajouter
          </Button>
        </>
      }
    >
      {active && (
        <p className="mb-4 flex gap-2 rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2 text-sm text-ink-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          La version {version.version} est {version.status.toLowerCase()} : la modification sera faite dans une nouvelle version en brouillon.
        </p>
      )}
      <div className="grid gap-4">
        <Field label="Étape du parcours" htmlFor="ti-phase">
          <Select id="ti-phase" options={version.phases.map((p) => ({ value: p.key, label: p.title }))} value={phase} onChange={(e) => setPhase(e.target.value)} />
        </Field>
        <Field label="Type">
          <Segmented
            label="Type"
            options={[
              { value: "activities", label: "Activité" },
              { value: "proofs", label: "Preuve requise" },
            ]}
            value={kind}
            onChange={setKind}
          />
        </Field>
        <Field label="Libellé" required htmlFor="ti-label">
          <Input id="ti-label" data-autofocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Étude de compatibilité contenant-contenu" />
        </Field>
      </div>
    </Modal>
  );
}

function NewTemplateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [family, setFamily] = useState<Family>("Sèche");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau modèle"
      subtitle="Le modèle est créé en brouillon avec les 4 étapes du parcours R&D."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={name.trim().length < 3}
            onClick={() => {
              dossierActions.createTemplate({ name: name.trim(), family, phases: EMPTY_PHASES() });
              const created = getDemoState().templates.at(-1);
              toast.show({ title: "Modèle créé", description: `${name.trim()} — version 1 (brouillon).` });
              if (created) onCreated(created.id);
              onClose();
            }}
          >
            Créer le modèle
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Nom du modèle" required htmlFor="nt-name">
          <Input id="nt-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Forme sèche orale — générique" />
        </Field>
        <Field label="Famille de produit" htmlFor="nt-family">
          <Select id="nt-family" options={FAMILIES} value={family} onChange={(e) => setFamily(e.target.value as Family)} />
        </Field>
      </div>
    </Modal>
  );
}

function ItemRow({ item, removable, onRemove }: { item: { id: string; label: string; icon: TemplateIcon }; removable: boolean; onRemove: () => void }) {
  const Icon = ICONS[item.icon];
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
      <Icon className="h-5 w-5 shrink-0 text-ink-700" strokeWidth={1.6} aria-hidden />
      <span className="min-w-0 flex-1 text-sm text-ink-900">{item.label}</span>
      <Menu
        label={`Actions pour ${item.label}`}
        items={[{ label: removable ? "Retirer" : "Retirer (version brouillon uniquement)", icon: Trash2, tone: "danger", disabled: !removable, onSelect: onRemove }]}
      />
    </li>
  );
}

export function TemplatesView() {
  const state = useDemo();
  const [selectedId, setSelectedId] = useState(state.templates[0]?.id);
  const [versionBy, setVersionBy] = useState<Record<string, number>>({});
  const [phaseKey, setPhaseKey] = useState("cadrer");
  const [addOpen, setAddOpen] = useState(0);
  const [newOpen, setNewOpen] = useState(0);

  const template = state.templates.find((t) => t.id === selectedId) ?? state.templates[0];
  const defaultVersion = (t: PathTemplate) => (t.versions.find((v) => v.status === "Actif") ?? t.versions[t.versions.length - 1]).version;
  const version = template.versions.find((v) => v.version === (versionBy[template.id] ?? defaultVersion(template))) ?? template.versions[0];
  const draft = template.versions.find((v) => v.status === "Brouillon");
  const phaseIndex = Math.max(0, version.phases.findIndex((p) => p.key === phaseKey));
  const usedBy = state.projects.filter((p) => p.template === template.projectTemplate);
  const showVersion = (v: number) => setVersionBy((m) => ({ ...m, [template.id]: v }));

  return (
    <ConfigFrame
      title="Modèles de parcours"
      subtitle="Configurer les modèles de parcours de développement utilisés dans les projets."
      screen={<ScreenRef n={55} label="Configuration — modèles de parcours" />}
    >
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <h2 className="px-1 text-lg font-bold text-ink-900">Liste des modèles</h2>
          <Button variant="outline" className="mt-3 w-full" icon={<Plus className="h-4 w-4" />} onClick={() => setNewOpen((n) => n + 1)}>
            Nouveau modèle
          </Button>
          <ul className="mt-3 divide-y divide-line">
            {state.templates.map((t) => {
              const shown = t.versions.find((v) => v.status === "Actif") ?? t.versions[t.versions.length - 1];
              const active = t.id === template.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors",
                      active ? "bg-brand-50 shadow-[inset_4px_0_0_var(--color-brand-600)]" : "hover:bg-subtle",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink-900">{t.name}</span>
                      <span className="block text-sm text-ink-500">v{shown.version}</span>
                    </span>
                    <StatusLabel status={shown.status} />
                    <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-ink-900">
                {template.name}
                <Badge tone={STATUS_TONE[version.status]} size="md" className="gap-1.5">
                  <StatusDot tone={STATUS_TONE[version.status]} />
                  {version.status}
                </Badge>
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[15px] text-ink-600">
                {template.versions.length > 1 ? (
                  <Select
                    aria-label="Version affichée"
                    size="sm"
                    className="w-56"
                    options={template.versions.map((v) => ({ value: String(v.version), label: `Version ${v.version} — ${v.status.toLowerCase()}` }))}
                    value={String(version.version)}
                    onChange={(e) => showVersion(Number(e.target.value))}
                  />
                ) : (
                  <span>Version {version.version}</span>
                )}
                <span className="text-sm">
                  {version.note} • {formatNumeric(version.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => {
                  dossierActions.duplicateTemplate(template.id);
                  const copy = getDemoState().templates.at(-1);
                  toast.show({ title: "Modèle dupliqué", description: `${copy?.name} — version 1 (brouillon).` });
                  if (copy) setSelectedId(copy.id);
                }}
              >
                Dupliquer le modèle
              </Button>
              {version.status === "Brouillon" ? (
                <Button
                  icon={<CircleCheck className="h-4 w-4" />}
                  onClick={() => {
                    dossierActions.activateTemplateVersion(template.id, version.version);
                    toast.show({ title: `Version ${version.version} activée`, description: "Elle sera utilisée par les nouveaux projets ; les projets existants restent inchangés." });
                  }}
                >
                  Activer la version
                </Button>
              ) : (
                <Button
                  icon={<Plus className="h-4 w-4" />}
                  disabled={Boolean(draft)}
                  title={draft ? `La version ${draft.version} est déjà en brouillon.` : undefined}
                  onClick={() => {
                    dossierActions.createTemplateVersion(template.id);
                    const created = getDemoState().templates.find((t) => t.id === template.id)?.versions.at(-1);
                    toast.show({ title: `Version ${created?.version} créée`, description: "Copie de la version active, en brouillon." });
                    if (created) showVersion(created.version);
                  }}
                >
                  Créer une version
                </Button>
              )}
            </div>
          </div>

          <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Étapes du parcours">
            {version.phases.map((p, i) => {
              const current = i === phaseIndex;
              const passed = i < phaseIndex;
              return (
                <li key={p.key} className="relative flex flex-col items-center">
                  {i > 0 && <span className={cn("absolute right-1/2 top-4 h-0.5 w-full", passed || current ? "bg-brand-600" : "bg-line-strong")} aria-hidden />}
                  <button
                    type="button"
                    onClick={() => setPhaseKey(p.key)}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "relative z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-sm font-bold",
                      current ? "bg-brand-600 text-white ring-4 ring-brand-100" : "bg-slate-400 text-white hover:bg-slate-500",
                    )}
                  >
                    {i + 1}
                  </button>
                  <span className={cn("mt-2 text-center text-[15px]", current ? "font-semibold text-brand-700" : "text-ink-700")}>{p.title}</span>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {version.phases.map((p, i) => (
              <section
                key={p.key}
                onClick={() => setPhaseKey(p.key)}
                className={cn("cursor-pointer rounded-xl border p-3", i === phaseIndex ? "border-brand-300 bg-brand-50/40" : "border-line bg-subtle/60")}
              >
                <div className="flex items-start gap-2.5">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", i === phaseIndex ? "bg-brand-600" : "bg-slate-400")}>{i + 1}</span>
                  <div>
                    <h3 className="text-lg font-bold text-ink-900">{p.title}</h3>
                    <p className="text-sm text-ink-600">{p.description}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-ink-800">Activités</p>
                <ul className="mt-1.5 space-y-1.5">
                  {p.activities.map((a) => (
                    <ItemRow
                      key={a.id}
                      item={a}
                      removable={version.status === "Brouillon"}
                      onRemove={() => dossierActions.removeTemplateItem(template.id, version.version, p.key, "activities", a.id)}
                    />
                  ))}
                  {p.activities.length === 0 && <li className="text-sm text-ink-500">Aucune activité.</li>}
                </ul>
                <p className="mt-3 border-t border-line pt-3 text-sm font-semibold text-ink-800">Preuves requises</p>
                <ul className="mt-1.5 space-y-1.5">
                  {p.proofs.map((a) => (
                    <ItemRow
                      key={a.id}
                      item={a}
                      removable={version.status === "Brouillon"}
                      onRemove={() => dossierActions.removeTemplateItem(template.id, version.version, p.key, "proofs", a.id)}
                    />
                  ))}
                  {p.proofs.length === 0 && <li className="text-sm text-ink-500">Aucune preuve.</li>}
                </ul>
              </section>
            ))}
          </div>

          <Button variant="outline" className="mt-4" icon={<Plus className="h-4 w-4" />} disabled={version.status === "Archivé"} onClick={() => setAddOpen((n) => n + 1)}>
            Ajouter une activité — {version.phases[phaseIndex]?.title}
          </Button>

          <div className="mt-5 grid gap-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4 md:grid-cols-2">
            <p className="flex gap-3 text-sm">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
              <span>
                <span className="block font-semibold text-ink-900">Modifications dans une nouvelle version</span>
                <span className="text-ink-600">
                  Toute modification d&apos;un modèle de parcours est effectuée dans une nouvelle version. Les versions précédentes sont conservées et restent consultables.
                </span>
              </span>
            </p>
            <p className="flex gap-3 text-sm md:border-l md:border-brand-100 md:pl-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
              <span>
                <span className="block font-semibold text-ink-900">Projets existants inchangés sans mise à jour explicite</span>
                <span className="text-ink-600">
                  Les projets existants conservent le modèle de parcours et la version utilisés au moment de leur création, sauf mise à jour explicite par le chef de projet.
                  {usedBy.length > 0 && ` Utilisé par : ${usedBy.map((p) => p.code).join(", ")}.`}
                </span>
              </span>
            </p>
          </div>
        </Card>
      </div>

      {addOpen > 0 && (
        <AddItemModal
          key={`add-${addOpen}`}
          template={template}
          version={version}
          phaseKey={version.phases[phaseIndex]?.key ?? "cadrer"}
          open
          onClose={() => setAddOpen(0)}
          onAdded={showVersion}
        />
      )}
      {newOpen > 0 && (
        <NewTemplateModal
          key={`new-${newOpen}`}
          open
          onClose={() => setNewOpen(0)}
          onCreated={(id) => {
            setSelectedId(id);
            setPhaseKey("cadrer");
          }}
        />
      )}
    </ConfigFrame>
  );
}
