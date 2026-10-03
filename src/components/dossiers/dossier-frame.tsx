"use client";

import { FolderX } from "lucide-react";
import type { ReactNode } from "react";
import { MetaLine } from "@/components/project-context-header";
import { StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";
import { findDossier } from "@/lib/dossier-selectors";
import { dossierActions, useDemo } from "@/lib/store";
import type { Project } from "@/lib/types";

/** Project + dossier of a `/dossiers/[code]` page. */
export function useDossier(slug: string) {
  const state = useDemo();
  return { state, ...findDossier(state, slug) };
}

export function DossierTabs({ slug, className }: { slug: string; className?: string }) {
  const state = useDemo();
  const { project } = findDossier(state, slug);
  const open = project ? state.reserves.filter((r) => r.projectCode === project.code && r.status === "Ouverte").length : 0;
  const base = `/dossiers/${slug}`;
  return (
    <LinkTabs
      className={className ?? "mt-5"}
      items={[
        { href: base, label: "Dossier" },
        { href: `${base}/revues`, label: "Revues", match: "prefix" },
        { href: `${base}/reserves`, label: open ? `Réserves (${open})` : "Réserves" },
        { href: `${base}/transfert`, label: "Transfert" },
      ]}
    />
  );
}

/** Title block of the dossier pages: breadcrumb, title, project meta line, optional aside. */
export function DossierHeader({
  crumbs,
  title,
  meta,
  aside,
}: {
  crumbs: { label: string; href?: string }[];
  title: ReactNode;
  meta: ReactNode[];
  aside?: ReactNode;
}) {
  return (
    <>
      <Breadcrumb items={crumbs} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[38px]">{title}</h1>
          <MetaLine className="mt-1" items={meta} />
        </div>
        {aside}
      </div>
    </>
  );
}

export const projectCrumbs = (project: Project) => [
  { label: "Projets", href: "/projets" },
  { label: project.code, href: `/projets/${project.slug}` },
];

export function FormulaMeta({ formula, prefix = "" }: { formula: string; prefix?: string }) {
  return (
    <span className="flex items-center gap-2">
      <StatusDot tone="success" />
      {prefix}
      {formula}
    </span>
  );
}

export function DossierMissing({ slug }: { slug: string }) {
  const state = useDemo();
  const project = state.projects.find((p) => p.slug === slug.toLowerCase());
  return (
    <Card className="mt-6">
      <EmptyState
        icon={FolderX}
        title="Dossier non initialisé"
        description={`Aucun dossier CTD n'est encore préparé pour ${slug.toUpperCase()}. Le dossier est initialisé à l'étape « Déposer & transférer » du parcours.`}
        action={
          <span className="flex flex-wrap justify-center gap-3">
            {project && !project.archived && <Button onClick={() => dossierActions.initDossier(project.code)}>Initialiser le dossier</Button>}
            <LinkButton href="/dossiers" variant="outline">
              Voir les dossiers
            </LinkButton>
          </span>
        }
      />
    </Card>
  );
}
