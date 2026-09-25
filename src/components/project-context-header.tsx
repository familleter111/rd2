"use client";

import { ArrowLeftRight, Box, CalendarDays, ChevronDown, FlaskConical, FolderOpen, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusDot } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Breadcrumb } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { useDemo } from "@/lib/store";
import type { Project } from "@/lib/types";

export function MetaLine({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-ink-600", className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="h-5 w-px bg-line-strong" aria-hidden />}
          {item}
        </span>
      ))}
    </p>
  );
}

export function actionsTrigger(label: string) {
  return (
    <>
      {label}
      <ChevronDown className="h-4 w-4" aria-hidden />
    </>
  );
}

export const ACTIONS_TRIGGER_CLASS =
  "inline-flex h-11 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 font-semibold text-brand-700 shadow-card hover:bg-brand-50";

/**
 * Compact project header used by the cross-project modules (catalogue of methods, planning):
 * "Projets > CS-01", "CS-01 • Comprimé", form | dosage | phase, "Actions projet" menu.
 */
export function ProjectContextHeader({
  project,
  crumbs = [],
  extraMeta = [],
  switchHref,
  actions: extraActions = [],
}: {
  project: Project;
  crumbs?: { label: string; href?: string }[];
  extraMeta?: ReactNode[];
  /** Builds the URL of the same page for another project (enables "Changer de projet"). */
  switchHref?: (slug: string) => string;
  actions?: MenuItem[];
}) {
  const state = useDemo();
  const pilot = state.lots.find((l) => l.projectCode === project.code && l.type === "Pilote");
  const others = state.projects.filter((p) => p.code !== project.code && !p.archived);
  const link = (label: string, href: string, icon: LucideIcon): MenuItem => ({ label, href, icon });

  const items: MenuItem[] = [
    ...extraActions,
    link("Ouvrir la fiche projet", `/projets/${project.slug}`, FolderOpen),
    link("Formules & lots", `/projets/${project.slug}/formules`, FlaskConical),
    ...(pilot ? [link(`Lot pilote ${pilot.code}`, `/projets/${project.slug}/lots/${pilot.code.toLowerCase()}`, Box)] : []),
    link("Planning des équipements", `/projets/${project.slug}/planning`, CalendarDays),
    ...(switchHref
      ? others.map((p, i) => ({
          label: `Changer pour ${p.code} • ${p.name}`,
          href: switchHref(p.slug),
          icon: ArrowLeftRight,
          separatorBefore: i === 0,
        }))
      : []),
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: "Projets", href: "/projets" }, { label: project.code, href: `/projets/${project.slug}` }, ...crumbs]} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink-900 sm:text-[34px]">
            {project.code} <span className="text-ink-400">•</span> {project.name}
          </h1>
          <MetaLine
            className="mt-1"
            items={[
              project.formLabel,
              project.dosage,
              ...extraMeta,
              <span key="phase" className="flex items-center gap-2">
                <StatusDot tone={project.phaseTone === "warn" ? "warn" : "success"} />
                Phase actuelle : {project.phase}
              </span>,
            ]}
          />
        </div>
        <Menu label="Actions projet" widthClass="w-80" triggerClassName={ACTIONS_TRIGGER_CLASS} trigger={actionsTrigger("Actions projet")} items={items} />
      </div>
    </div>
  );
}
