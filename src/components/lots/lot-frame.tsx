"use client";

import { Box, CalendarDays, CircleCheck, Clock, FileText, FolderOpen, PauseCircle, Settings2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ACTIONS_TRIGGER_CLASS, MetaLine, actionsTrigger } from "@/components/project-context-header";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { LinkTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import type { DemoState } from "@/lib/data";
import { lotConditions } from "@/lib/lab-selectors";
import { findProject } from "@/lib/selectors";
import { useDemo } from "@/lib/store";

export function findPilot(s: DemoState, slug: string, lotSlug: string) {
  const project = findProject(s, slug);
  const pilot = project ? s.pilotLots.find((l) => l.projectCode === project.code && l.lotCode.toLowerCase() === lotSlug.toLowerCase()) : undefined;
  const lot = project && pilot ? s.lots.find((l) => l.projectCode === project.code && l.code === pilot.lotCode) : undefined;
  return { project, pilot, lot };
}

function StatusBanner({ tone, icon: Icon, title, detail }: { tone: "success" | "warn" | "info"; icon: typeof Clock; title: string; detail: string }) {
  return (
    <div
      className={cn(
        "flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-card",
        tone === "success" ? "border-success-100 bg-success-50" : tone === "warn" ? "border-warn-100 bg-warn-50" : "border-brand-100 bg-brand-50",
      )}
    >
      <Icon
        className={cn("h-8 w-8 shrink-0", tone === "success" ? "fill-success-500 text-white" : tone === "warn" ? "text-warn-600" : "text-brand-600")}
        aria-hidden
      />
      <div>
        <p className="font-bold text-ink-900">{title}</p>
        <p className="text-sm text-ink-600">{detail}</p>
      </div>
    </div>
  );
}

/** Header + tabs of the pilot lot pages (screens 35 → 38). */
export function LotFrame({ slug, lotSlug, children }: { slug: string; lotSlug: string; children: ReactNode }) {
  const state = useDemo();
  const { project, pilot } = findPilot(state, slug, lotSlug);

  if (!project || !pilot) {
    return (
      <Card className="mt-4">
        <EmptyState
          icon={Box}
          title="Fiche lot pilote indisponible"
          description={`Le lot « ${lotSlug.toUpperCase()} » n'a pas de dossier de fabrication pilote.`}
          action={<LinkButton href={`/projets/${slug}/formules/lots`}>Voir les lots du projet</LinkButton>}
        />
      </Card>
    );
  }

  const conditions = lotConditions(state, project.code, pilot.lotCode);
  const missing = conditions.filter((c) => !c.done);
  const current = pilot.steps.find((s) => s.status === "En cours" || s.status === "En pause");
  const index = current ? pilot.steps.indexOf(current) + 1 : 0;
  const base = `/projets/${project.slug}/lots/${pilot.lotCode.toLowerCase()}`;
  const openDeviations = state.deviations.filter((d) => d.lotCode === pilot.lotCode && d.projectCode === project.code && d.status !== "Clôturée").length;

  const banner =
    pilot.status === "Préparation" ? (
      missing.length ? (
        <StatusBanner tone="warn" icon={TriangleAlert} title="Conditions préalables incomplètes" detail={`${missing.length} condition(s) en attente : ${missing.map((m) => m.title.toLowerCase()).join(", ")}.`} />
      ) : (
        <StatusBanner tone="success" icon={CircleCheck} title="Prêt à démarrer" detail="Toutes les conditions préalables sont remplies." />
      )
    ) : pilot.status === "En fabrication" ? (
      current?.status === "En pause" ? (
        <StatusBanner tone="warn" icon={PauseCircle} title={`Étape « ${current.title} » en pause`} detail={openDeviations ? `${openDeviations} déviation(s) ouverte(s) sur ce lot.` : "Reprenez l'étape depuis l'onglet Exécution."} />
      ) : (
        <StatusBanner tone="info" icon={Clock} title="Fabrication en cours" detail={current ? `Étape ${index}/${pilot.steps.length} : ${current.title}` : "Exécution en cours."} />
      )
    ) : (
      <StatusBanner tone="success" icon={CircleCheck} title="Fabrication terminée" detail="Toutes les étapes sont réalisées ; contrôles en cours." />
    );

  return (
    <>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink-900 sm:text-[36px]">
            {pilot.lotCode} <span className="text-ink-400">•</span> Lot pilote
          </h1>
          <MetaLine
            className="mt-1"
            items={[
              <span key="p">
                {project.code} • {project.name}
              </span>,
              project.dosage,
              pilot.formula,
            ]}
          />
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {banner}
          <Menu
            label="Actions lot"
            widthClass="w-72"
            triggerClassName={ACTIONS_TRIGGER_CLASS}
            trigger={actionsTrigger("Actions lot")}
            items={[
              { label: "Préparation du lot", icon: Settings2, href: base },
              { label: "Planning des équipements", icon: CalendarDays, href: `/projets/${project.slug}/planning?jour=${pilot.plannedDate}` },
              { label: "Documents du projet", icon: FileText, href: `/projets/${project.slug}/documents` },
              { label: "Tous les lots du projet", icon: FolderOpen, href: `/projets/${project.slug}/formules/lots` },
            ]}
          />
        </div>
      </div>
      <LinkTabs
        className="mt-4"
        items={[
          { href: base, label: "Préparation" },
          { href: `${base}/execution`, label: "Exécution" },
          { href: `${base}/controles`, label: "Contrôles", guide: 37 },
          { href: `${base}/deviations`, label: openDeviations ? `Déviations (${openDeviations})` : "Déviations", guide: 38 },
          { href: `${base}/documents`, label: "Documents" },
          { href: `${base}/historique`, label: "Historique" },
        ]}
      />
      {children}
    </>
  );
}
