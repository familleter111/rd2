"use client";

import { Archive, ArchiveRestore, CalendarDays, ChevronRight, FolderX, Pencil, User, Users } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import type { ReactNode } from "react";
import { ProductVisual } from "@/components/product-visual";
import { StageBadge } from "@/components/project-bits";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { Breadcrumb } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { formatLong, plural } from "@/lib/format";
import { findProject, projectBadge } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Project } from "@/lib/types";

const SECTION_LABELS: Record<string, string> = {
  cadrage: "Cadrage",
  faisabilite: "Faisabilité",
  formulation: "Formulation",
  qualite: "Qualité & lot pilote",
  stabilite: "Stabilité",
  bioequivalence: "Bioéquivalence",
  dossier: "Dossier de validation",
  princeps: "Fiche princeps",
  prerequis: "Prérequis",
  formules: "Formules & lots",
  essais: "Essais",
  documents: "Documents",
  historique: "Historique",
  planning: "Planning",
  lots: "Lots pilotes",
  deviations: "Déviations",
  cloture: "Clôture",
};

/** Target of the section crumb when the section has no index page of its own. */
const SECTION_HREF: Record<string, (slug: string) => string> = {
  lots: (slug) => `/projets/${slug}/formules/lots`,
};

const SUB_LABELS: Record<string, string> = {
  comparaison: "Comparaison",
  lots: "Lots",
  nouvelle: "Nouvelle formule",
};

/** Project tabs rendered by each project page (so pages can add their own actions). */
export function ProjectTabs({ slug, actions: tabActions }: { slug: string; actions?: ReactNode }) {
  const state = useDemo();
  const base = `/projets/${slug}`;
  const cs = slug === "cs-01";
  // Projects created with the decision-support pathway follow its steps; earlier projects keep their tabs.
  if (findProject(state, slug)?.cadrage) {
    return (
      <LinkTabs
        className="mt-5"
        actions={tabActions}
        items={[
          { href: `${base}/cadrage`, label: "Cadrage" },
          { href: `${base}/faisabilite`, label: "Faisabilité" },
          { href: `${base}/princeps`, label: "Princeps" },
          { href: `${base}/formulation`, label: "Formulation" },
          { href: `${base}/qualite`, label: "Qualité & lot pilote" },
          { href: `${base}/stabilite`, label: "Stabilité" },
          { href: `${base}/bioequivalence`, label: "Bioéquivalence" },
          { href: `${base}/dossier`, label: "Dossier" },
          { href: `${base}/historique`, label: "Historique" },
        ]}
      />
    );
  }
  return (
    <LinkTabs
      className="mt-5"
      actions={tabActions}
      items={[
        { href: base, label: "Vue projet" },
        { href: `${base}/prerequis`, label: "Prérequis" },
        { href: `${base}/formules`, label: "Formules & lots", match: "prefix", guide: cs ? 17 : undefined },
        { href: `${base}/essais`, label: "Essais" },
        { href: `${base}/documents`, label: "Documents", guide: cs ? 15 : undefined },
        { href: `${base}/planning`, label: "Planning" },
        { href: `${base}/historique`, label: "Historique", guide: cs ? 16 : undefined },
      ]}
    />
  );
}

export function FormulaSubTabs({ slug }: { slug: string }) {
  const base = `/projets/${slug}/formules`;
  return (
    <LinkTabs
      size="sm"
      className="mt-1 rounded-t-xl border-b-line bg-white/60 px-5 pt-3"
      items={[
        { href: base, label: "Versions" },
        { href: `${base}/comparaison`, label: "Comparaison" },
        { href: `${base}/lots`, label: "Lots" },
      ]}
    />
  );
}

function TeamMenu({ project }: { project: Project }) {
  const members = project.team.filter((m) => m.person);
  return (
    <Menu
      label="Équipe du projet"
      align="left"
      widthClass="w-72"
      items={members.map((m) => ({ label: m.person, description: m.role, icon: User }))}
      triggerClassName="flex items-start gap-3 rounded-lg text-left hover:bg-brand-50/60"
      trigger={
        <>
          <Users className="mt-1 h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
          <span>
            <span className="block text-[13px] text-ink-500">Équipe R&amp;D</span>
            <span className="block font-semibold text-ink-900">
              {members.length} {plural(members.length, "membre")}
            </span>
          </span>
        </>
      }
    />
  );
}

function FullHeader({ project }: { project: Project }) {
  const state = useDemo();
  const badge = projectBadge(state, project);
  return (
    <Card className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
      <ProductVisual kind={project.kind} className="h-[116px] w-full lg:w-[116px]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[30px] font-extrabold tracking-tight text-ink-900 sm:text-[32px]">
            {project.code} <span className="text-ink-400">•</span> {project.name}
          </h1>
          <StageBadge badge={badge} />
        </div>
        <p className="mt-0.5 text-lg text-ink-600">
          {project.formLabel} <span className="text-ink-400">•</span> Dosage {project.dosage}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
          <StatusDot tone={project.archived ? "neutral" : "success"} />
          <span className="font-semibold text-ink-900">{project.archived ? "Projet archivé" : "Projet en cours"}</span>
          <span className="text-ink-400">·</span>
          <span className="text-ink-600">Phase actuelle : {project.phase}</span>
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 border-line sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-2 lg:border-l lg:pl-8">
        <Link href={`/projets/${project.slug}/historique`} className="flex items-start gap-3 rounded-lg hover:bg-brand-50/60">
          <User className="mt-1 h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
          <span>
            <span className="block text-[13px] text-ink-500">Chef de projet</span>
            <span className="flex items-center gap-1 font-semibold text-ink-900">
              {project.owner}
              <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
            </span>
          </span>
        </Link>
        <TeamMenu project={project} />
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-1 h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
          <span>
            <span className="block text-[13px] text-ink-500">Date de création</span>
            <span className="block font-semibold text-ink-900">{formatLong(project.createdAt)}</span>
          </span>
        </div>
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-1 h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
          <span>
            <span className="block text-[13px] text-ink-500">Dernière mise à jour</span>
            <span className="block font-semibold text-ink-900">{formatLong(project.updatedAt)}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

function CompactHeader({ project, title }: { project: Project; title: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[34px] font-extrabold tracking-tight text-ink-900 sm:text-[38px]">{title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-3">
          <span className="text-xl font-bold text-ink-900">
            {project.code} • {project.name}
          </span>
          <Badge tone="info">{project.formLabel}</Badge>
          <span className="h-5 w-px bg-line-strong" aria-hidden />
          <span className="text-[15px] text-ink-600">Dosage : {project.dosage}</span>
        </p>
      </div>
      <Badge tone="warn" icon={Pencil} size="md" className="px-4 py-2 text-[15px]">
        Brouillon
      </Badge>
    </div>
  );
}

export function ProjectFrame({ slug, children }: { slug: string; children: ReactNode }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const segments = useSelectedLayoutSegments();

  if (!project) {
    return (
      <Card className="mt-4">
        <EmptyState
          icon={FolderX}
          title="Projet introuvable"
          description={`Aucun projet ne correspond au code « ${slug.toUpperCase()} ». Il a peut-être été créé dans un autre navigateur, ou supprimé.`}
          action={<LinkButton href="/projets">Retour aux projets</LinkButton>}
        />
      </Card>
    );
  }

  const [section, sub] = segments;
  const crumbs: { label: string; href?: string }[] = [
    { label: "Projets", href: "/projets" },
    { label: `${project.code} • ${project.name}`, href: section ? `/projets/${project.slug}` : undefined },
  ];
  if (section)
    crumbs.push({
      label: SECTION_LABELS[section] ?? section,
      href: sub ? (SECTION_HREF[section]?.(project.slug) ?? `/projets/${project.slug}/${section}`) : undefined,
    });
  const docName = section === "documents" && sub ? state.documents.find((d) => d.id === sub)?.name : undefined;
  if (sub) crumbs.push({ label: docName ?? SUB_LABELS[sub] ?? sub.toUpperCase() });
  const editingFormula = section === "formules" && sub === "nouvelle";
  // Pilot lot, deviation and document pages (screens 35 → 39, 46) and the closure page (56) render their own header.
  const ownHeader = (Boolean(sub) && (section === "lots" || section === "deviations" || section === "documents")) || section === "cloture";

  return (
    <>
      <Breadcrumb items={crumbs} />
      {project.archived && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-slate-100 px-4 py-3 text-[15px] text-ink-700">
          <Archive className="h-5 w-5 text-ink-500" aria-hidden />
          <span className="flex-1">Ce projet est archivé : il reste consultable, son historique est conservé.</span>
          <Button
            variant="outline"
            size="sm"
            icon={<ArchiveRestore className="h-4 w-4" />}
            onClick={() => {
              actions.restoreProject(project.code);
              toast.show({ title: `${project.code} restauré`, description: "Le projet est de nouveau actif." });
            }}
          >
            Restaurer
          </Button>
        </div>
      )}
      {!ownHeader && (
        <div className="mt-4">
          {editingFormula ? <CompactHeader project={project} title="Éditer une nouvelle formule" /> : <FullHeader project={project} />}
        </div>
      )}
      {children}
    </>
  );
}
