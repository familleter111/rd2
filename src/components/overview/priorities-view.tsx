"use client";

import {
  Box,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleArrowUp,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FileText,
  FlaskConical,
  Folder,
  FolderOpen,
  Info,
  ListChecks,
  SquareCheck,
  TriangleAlert,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ProductVisual } from "@/components/product-visual";
import { Badge, IconTile, StatusDot, TONE_TEXT } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { PillTabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { CURRENT_USER } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatNumeric, plural, relativeDue } from "@/lib/format";
import { actions, useDemo } from "@/lib/store";
import type { Priority, PriorityGroup, Tone } from "@/lib/types";
import { OverviewHeader } from "./overview-header";

type Horizon = "today" | "week" | "waiting";

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "waiting", label: "En attente" },
];

const GROUPS: { key: PriorityGroup; title: string; tone: Tone; icon: LucideIcon; box: string; bar: string }[] = [
  { key: "urgent", title: "Urgent", tone: "danger", icon: TriangleAlert, box: "border-danger-100 bg-danger-50/80", bar: "bg-danger-500" },
  { key: "examiner", title: "À examiner", tone: "warn", icon: CircleArrowUp, box: "border-warn-100 bg-warn-50", bar: "bg-warn-500" },
  { key: "preparer", title: "À préparer", tone: "info", icon: ClipboardList, box: "border-brand-100 bg-brand-50/80", bar: "bg-brand-500" },
];

const META_ICONS = { doc: FileText, folder: Folder, calendar: CalendarDays };

function matchesHorizon(p: Priority, horizon: Horizon) {
  if (horizon === "today") return p.horizon === "today";
  if (horizon === "week") return p.horizon === "today" || p.horizon === "week";
  return p.horizon === "waiting";
}

function tryToggle(p: Priority) {
  const result = actions.togglePriority(p.id);
  if (!result.ok) {
    toast.show({ title: "Clôture impossible", description: result.reason, tone: "warn" });
  } else if (!p.done) {
    toast.show({ title: "Activité clôturée", description: `${p.projectCode} • ${p.title}` });
  }
}

function PriorityCard({
  item,
  bar,
  selected,
  onSelect,
}: {
  item: Priority;
  bar: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { projects } = useDemo();
  const project = projects.find((p) => p.code === item.projectCode);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer gap-4 rounded-xl border bg-white p-4 shadow-card transition-shadow hover:shadow-pop",
        selected ? "border-brand-300 ring-2 ring-brand-200" : "border-transparent",
        item.done && "opacity-60",
      )}
    >
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={item.done} onChange={() => tryToggle(item)} label={<span className="sr-only">Clôturer « {item.title} »</span>} />
      </div>
      <span className={cn("w-[3px] shrink-0 self-stretch rounded-full", bar)} aria-hidden />
      {project && <ProductVisual kind={project.kind} className="hidden h-[72px] w-[72px] sm:flex" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={onSelect} className="cursor-pointer text-left">
            <span className="block text-[17px] font-bold text-ink-900">
              {item.projectCode} • {project?.name}
            </span>
            <span className={cn("block font-semibold text-ink-900", item.done && "line-through")}>{item.title}</span>
          </button>
          {item.done ? (
            <Badge tone="success" icon>
              Clôturée
            </Badge>
          ) : (
            item.badge && (
              <Badge tone={item.badge.tone} icon={item.badge.tone === "danger" ? CircleAlert : item.badge.tone === "warn" ? CircleAlert : undefined}>
                {item.badge.label}
              </Badge>
            )
          )}
        </div>
        <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-xl text-sm leading-relaxed text-ink-600">{item.description}</p>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {item.action.kind === "remind" ? (
              <Button
                variant="outline"
                iconRight={<ChevronRight className="h-4 w-4" />}
                className="min-w-36"
                onClick={() => {
                  actions.remindPriority(item.id);
                  toast.show({ title: "Relance envoyée", description: "La relance est tracée dans l'historique du projet." });
                }}
              >
                {item.action.label}
              </Button>
            ) : (
              <LinkButton href={item.action.href ?? "#"} variant="outline" className="min-w-36" iconRight={<ChevronRight className="h-4 w-4" />}>
                {item.action.label}
              </LinkButton>
            )}
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-600">
          {item.meta.map((m, i) => {
            const Icon = META_ICONS[m.icon];
            return (
              <li key={m.label} className="flex items-center gap-2">
                {i > 0 && <span className="mr-2 hidden h-4 w-px bg-line-strong sm:block" aria-hidden />}
                <Icon className="h-4 w-4 text-ink-500" strokeWidth={1.7} aria-hidden />
                {m.label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <Icon className="h-5 w-5 shrink-0 text-ink-600" strokeWidth={1.7} aria-hidden />
      <span className="w-28 shrink-0 text-[15px] text-ink-700">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function PriorityDetail({ item, onClose }: { item: Priority; onClose: () => void }) {
  const { projects } = useDemo();
  const project = projects.find((p) => p.code === item.projectCode);
  if (!project) return null;
  const group = GROUPS.find((g) => g.key === item.group)!;
  const href = item.action.href ?? `/projets/${project.slug}/prerequis`;
  const dueTone: Tone = relativeDue(item.due).startsWith("En retard") ? "danger" : "warn";

  return (
    <Card className="p-6 xl:sticky xl:top-[96px]">
      <div className="flex items-center gap-3">
        <IconTile icon={FlaskConical} tone={group.tone} />
        <Badge tone={group.tone} icon={CircleAlert}>
          {group.title}
        </Badge>
        <div className="ml-auto flex items-center">
          <Menu
            label="Autres actions"
            items={[
              { label: "Ouvrir le projet", icon: FolderOpen, href: `/projets/${project.slug}` },
              { label: item.done ? "Rouvrir l'activité" : "Marquer comme terminée", icon: SquareCheck, onSelect: () => tryToggle(item) },
            ]}
          />
          <IconButton label="Fermer le détail" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      <h2 className="mt-4 text-[26px] font-bold leading-tight text-ink-900">
        {project.code} • {project.name}
      </h2>
      <p className="mt-1 text-xl text-ink-700">{item.title}</p>

      <div className="mt-5 flex gap-5 rounded-xl border border-line p-4">
        <ProductVisual kind={project.kind} className="h-24 w-24" />
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] content-center gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-ink-500">Forme galénique</dt>
          <dd className="font-medium text-ink-900">{project.form}</dd>
          <dt className="text-ink-500">Dosage</dt>
          <dd className="font-medium text-ink-900">{project.dosage}</dd>
          <dt className="text-ink-500">Formule</dt>
          <dd className="font-medium text-ink-900">{item.detail.formula}</dd>
          <dt className="text-ink-500">Statut projet</dt>
          <dd className={cn("flex items-center gap-2 whitespace-nowrap font-medium", TONE_TEXT[item.detail.projectStatus.tone])}>
            <StatusDot tone={item.detail.projectStatus.tone} />
            {item.detail.projectStatus.label}
          </dd>
        </dl>
      </div>

      <div className="mt-2 divide-y divide-line">
        <DetailRow icon={User} label="Responsable">
          <User className="h-4 w-4 text-ink-500" aria-hidden />
          <span className="flex-1 text-[15px] text-ink-900">{item.assignee}</span>
          <ChevronRight className="h-4 w-4 text-ink-400" aria-hidden />
        </DetailRow>
        <DetailRow icon={CalendarDays} label="Échéance">
          <span className="flex-1 text-[15px] text-ink-900">{formatNumeric(item.due)}</span>
          <Badge tone={dueTone} size="md">
            {relativeDue(item.due)}
          </Badge>
        </DetailRow>
        <DetailRow icon={ListChecks} label="Prérequis">
          {item.detail.prerequisite.ok ? (
            <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-label="Satisfait" />
          ) : (
            <CircleAlert className="h-5 w-5 shrink-0 fill-warn-500 text-white" aria-label="Non satisfait" />
          )}
          <Link href={`/projets/${project.slug}/prerequis`} className="text-[15px] text-ink-900 underline decoration-ink-300 underline-offset-4 hover:text-brand-700">
            {item.detail.prerequisite.label}
          </Link>
        </DetailRow>
        <DetailRow icon={Box} label="Lien lot">
          <ExternalLink className="h-4 w-4 text-brand-600" aria-hidden />
          <Link href={item.detail.lot.href} className="text-[15px] font-medium text-brand-700 underline underline-offset-4">
            {item.detail.lot.label}
          </Link>
        </DetailRow>
        <DetailRow icon={FileText} label="Source">
          <ExternalLink className="h-4 w-4 text-brand-600" aria-hidden />
          <Link href={item.detail.source.href} className="text-[15px] font-medium text-brand-700 hover:underline underline-offset-4">
            {item.detail.source.label}
          </Link>
        </DetailRow>
      </div>

      <LinkButton href={href} size="lg" className="mt-4 w-full justify-between" iconRight={<ChevronRight className="h-5 w-5" />}>
        <span className="flex-1 text-center">Ouvrir l&apos;activité</span>
      </LinkButton>

      <p className="mt-4 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm leading-relaxed text-ink-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        {item.detail.note}
      </p>
    </Card>
  );
}

export function PrioritiesView() {
  const { priorities } = useDemo();
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [assignee, setAssignee] = useState(CURRENT_USER);
  const [selectedId, setSelectedId] = useState<string | null>("pri-2");

  const assignees = [...new Set(priorities.map((p) => p.assignee))];
  const items = priorities.filter((p) => matchesHorizon(p, horizon) && (assignee === "Tous" || p.assignee === assignee));
  const selected = items.find((p) => p.id === selectedId);

  return (
    <>
      <OverviewHeader subtitle="Priorités, jalons et décisions de l'équipe" />

      <div className={cn("mt-6 grid grid-cols-1 gap-6", selected && "xl:grid-cols-[minmax(0,1fr)_450px]")}>
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <PillTabs items={HORIZONS} value={horizon} onChange={setHorizon} />
            <span className="mx-2 hidden h-8 w-px bg-line-strong md:block" aria-hidden />
            <Select
              aria-label="Responsable"
              icon={User}
              options={[{ value: "Tous", label: "Tous les responsables" }, ...assignees]}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full sm:ml-auto sm:w-64"
            />
          </div>

          {items.length === 0 && (
            <Card>
              <EmptyState icon={SquareCheck} title="Aucune activité" description="Rien à traiter pour ce filtre. Essayez un autre horizon ou un autre responsable." />
            </Card>
          )}

          {GROUPS.map((group) => {
            const groupItems = items.filter((p) => p.group === group.key);
            if (!groupItems.length) return null;
            const Icon = group.icon;
            return (
              <section key={group.key} className={cn("rounded-2xl border p-4", group.box)} aria-labelledby={`group-${group.key}`}>
                <h2 id={`group-${group.key}`} className="mb-3 flex items-center gap-3 px-1">
                  <Icon
                    className={cn("h-7 w-7", group.tone === "danger" ? "fill-danger-600 text-white" : group.tone === "warn" ? "fill-warn-500 text-white" : "fill-brand-600 text-white")}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className={cn("text-xl font-bold", TONE_TEXT[group.tone])}>{group.title}</span>
                  <span className="text-[15px] text-ink-600">
                    {groupItems.length} {plural(groupItems.length, "activité")}
                  </span>
                </h2>
                <div className="space-y-3">
                  {groupItems.map((item) => (
                    <PriorityCard
                      key={item.id}
                      item={item}
                      bar={group.bar}
                      selected={item.id === selectedId}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {selected && <PriorityDetail item={selected} onClose={() => setSelectedId(null)} />}
      </div>

      <ScreenRef n={2} label="Mes priorités" />
    </>
  );
}
