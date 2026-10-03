"use client";

import {
  Archive,
  CalendarDays,
  ChevronRight,
  FileText,
  FlaskConical,
  Folder,
  FolderSearch,
  Goal,
  ListChecks,
  Map as MapIcon,
  Plus,
  Settings,
  Target,
  TriangleAlert,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProductVisual } from "@/components/product-visual";
import { JourneyStrip, PhaseIcon, StageBadge } from "@/components/project-bits";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader, InfoPair } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { CURRENT_USER, DEFAULT_FILTERS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatLong, plural } from "@/lib/format";
import { blockingPrerequisites, filterProjects, isFiltered, projectBadge } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Project } from "@/lib/types";
import { AppliedFiltersBar, FiltersButton } from "./filters-drawer";
import { OverviewHeader } from "./overview-header";
import { SavedViewsMenu } from "./saved-views-menu";

const SCOPES = ["Tous les projets", "Mes projets", "Projets avec blocage"];

function Kpi({
  icon: Icon,
  value,
  label,
  sub,
  tone,
}: {
  icon: typeof Folder;
  value: number;
  label: string;
  sub?: string;
  tone: "info" | "warn";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-5 rounded-xl border px-6 py-5",
        tone === "info" ? "border-brand-100 bg-brand-50/80" : "border-warn-100 bg-warn-50",
      )}
    >
      <Icon
        className={cn("h-11 w-11 shrink-0", tone === "info" ? "text-brand-600" : "fill-warn-500 text-white")}
        strokeWidth={tone === "info" ? 1.5 : 1.8}
        aria-hidden
      />
      <div>
        <p className={cn("text-[40px] font-bold leading-none", tone === "info" ? "text-ink-900" : "text-warn-600")}>{value}</p>
        <p className="mt-1.5 text-[17px] font-medium text-ink-800">{label}</p>
        {sub && <p className="text-sm text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

function PortfolioRow({ project }: { project: Project }) {
  const state = useDemo();
  const badge = projectBadge(state, project);
  const href = `/projets/${project.slug}`;

  return (
    <Card className="relative flex flex-col gap-5 p-4 md:flex-row">
      <Link href={href} className="shrink-0" tabIndex={-1} aria-hidden>
        <ProductVisual kind={project.kind} className="h-32 w-full md:h-[112px] md:w-[112px]" />
      </Link>

      <div className="min-w-0 flex-1 md:py-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pr-10 md:pr-0">
          <h3 className="text-xl font-bold text-ink-900">
            <Link href={href} className="hover:text-brand-700">
              {project.code} <span className="text-ink-400">•</span> {project.name}
            </Link>
          </h3>
          <StageBadge badge={badge} />
        </div>
        <p className="mt-0.5 text-[15px] text-ink-600">{project.portfolioSubtitle}</p>
        <div className="mt-4 flex flex-wrap items-start gap-x-5 gap-y-3">
          <InfoPair icon={<PhaseIcon tone={project.phaseTone} />} label="Phase actuelle" value={project.phase} />
          <span className="hidden h-11 w-px bg-line sm:block" aria-hidden />
          <InfoPair
            icon={<Goal className="mt-1 h-7 w-7 shrink-0 text-ink-700" strokeWidth={1.6} aria-hidden />}
            label="Objectif"
            value={project.objective.title}
            sub={project.objective.detail}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col justify-between gap-4 border-line md:w-[268px] md:border-l md:pl-6 md:pr-7">
        <div className="space-y-3">
          <Link href={href} className="inline-flex items-center gap-2.5 text-sm text-ink-700 hover:text-brand-700">
            <User className="h-5 w-5 text-ink-600" strokeWidth={1.7} aria-hidden />
            {project.owner}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-ink-600" strokeWidth={1.7} aria-hidden />
            <div>
              <p className="text-[13px] text-ink-500">Prochaine action</p>
              <p className="font-semibold text-brand-700">{formatLong(project.nextAction.date)}</p>
              <p className="text-[13px] text-ink-500">{project.nextAction.label}</p>
            </div>
          </div>
        </div>
        <LinkButton
          href={project.portfolioAction.href}
          variant={project.portfolioAction.variant}
          className="w-full md:w-auto md:self-end"
          iconRight={<ChevronRight className="h-4 w-4" />}
        >
          {project.portfolioAction.label}
        </LinkButton>
      </div>

      <div className="absolute right-3 top-3">
        <Menu
          label={`Actions pour ${project.code}`}
          items={[
            { label: "Configurer", icon: Settings, href: `${href}?configurer=1` },
            {
              label: "Archiver",
              icon: Archive,
              description: "Conserve l'historique du projet.",
              onSelect: () => {
                actions.archiveProject(project.code);
                toast.show({
                  title: `${project.code} archivé`,
                  description: "Le projet reste consultable dans Projets › Archivés.",
                  action: { label: "Voir les projets archivés", href: "/projets?vue=archives" },
                });
              },
            },
          ]}
        />
      </div>
    </Card>
  );
}

function DecisionsCard({ codes }: { codes: Set<string> }) {
  const state = useDemo();
  const decisions = state.decisions.filter((d) => codes.has(d.projectCode));
  return (
    <Card className="p-5">
      <CardHeader
        title="À décider"
        icon={<Target className="h-7 w-7 text-ink-800" strokeWidth={1.7} aria-hidden />}
        actions={
          <Link href="/vue-ensemble/revues" className="text-[15px] font-semibold text-brand-700 hover:underline underline-offset-4">
            Voir tout
          </Link>
        }
        className="items-center [&_h2]:text-xl"
      />
      <div className="mt-4 space-y-3">
        {decisions.length === 0 && <p className="rounded-xl bg-subtle px-4 py-6 text-center text-sm text-ink-500">Aucune décision attendue.</p>}
        {decisions.map((d) => (
          <Link
            key={d.id}
            href={d.href}
            className="group flex items-center gap-4 rounded-xl border border-line p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <IconTile icon={d.icon === "flask" ? FlaskConical : FileText} size="lg" className="bg-brand-50 text-ink-700" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">
                {d.title} • {d.projectCode}
              </p>
              <Badge tone={d.status.tone} dot size="md" className="mt-2">
                {d.status.label}
              </Badge>
              <p className="mt-2 text-sm text-ink-500">{d.detail}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-500 group-hover:text-brand-700" aria-hidden />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function ShortcutsCard() {
  const shortcuts = [
    { label: "Créer une demande d'analyse", href: "/methodes?onglet=demandes&nouvelle=1", icon: FlaskConical },
    { label: "Préparer une revue", href: "/vue-ensemble/revues", icon: FileText },
  ];
  return (
    <Card className="p-5">
      <CardHeader title="Mes raccourcis" icon={<Zap className="h-7 w-7 text-ink-800" strokeWidth={1.7} aria-hidden />} className="items-center [&_h2]:text-xl" />
      <div className="mt-4 space-y-3">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center gap-4 rounded-xl border border-line p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <IconTile icon={s.icon} className="bg-brand-50 text-ink-700" />
            <span className="flex-1 font-semibold text-ink-900">{s.label}</span>
            <ChevronRight className="h-5 w-5 text-ink-500 group-hover:text-brand-700" aria-hidden />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function PortfolioView({ openFilters = false }: { openFilters?: boolean }) {
  const state = useDemo();
  const [scope, setScope] = useState(SCOPES[0]);
  const [filtersOpen, setFiltersOpen] = useState(openFilters);

  const active = state.projects.filter((p) => !p.archived);
  const scoped = active.filter((p) => {
    if (scope === "Mes projets") return p.owner === CURRENT_USER;
    if (scope === "Projets avec blocage") return blockingPrerequisites(state, p.code).length > 0;
    return true;
  });
  const visible = filterProjects(state, scoped, state.filters);
  const codes = new Set(visible.map((p) => p.code));
  const blocking = state.prerequisites.filter((p) => codes.has(p.projectCode) && p.blocking && p.status !== "Vérifié").length;
  const reviewsToPrepare = state.reviews.filter((r) => r.status === "a-preparer" && codes.has(r.projectCode)).length;
  const filtered = isFiltered(state.filters) || scope !== SCOPES[0];

  return (
    <>
      <OverviewHeader
        subtitle="Portefeuille R&D, priorités et décisions de l'équipe"
        action={
          <LinkButton href="/projets/nouveau" size="lg" icon={<Plus className="h-5 w-5" />}>
            Nouveau projet
          </LinkButton>
        }
        tabActions={
          <>
            <Select
              aria-label="Périmètre"
              options={SCOPES}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-56 [&_select]:h-12"
            />
            <FiltersButton defaultOpen={openFilters} onOpenChange={setFiltersOpen} />
            <SavedViewsMenu />
          </>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi
              icon={Folder}
              value={visible.length}
              label={filtered ? `${plural(visible.length, "projet affiché", "projets affichés")}` : plural(visible.length, "projet")}
              sub="dans le portefeuille R&D"
              tone="info"
            />
            <Kpi
              icon={TriangleAlert}
              value={blocking}
              label={plural(blocking, "prérequis bloquant", "prérequis bloquants")}
              sub="à traiter pour poursuivre"
              tone="warn"
            />
            <Kpi
              icon={ListChecks}
              value={reviewsToPrepare}
              label={plural(reviewsToPrepare, "revue à préparer", "revues à préparer")}
              sub="à court terme"
              tone="info"
            />
          </div>

          <AppliedFiltersBar resultCount={visible.length} />

          {state.projects.length === 0 ? (
            <Card>
              <EmptyState
                icon={Folder}
                title="Aucun projet pour le moment"
                description="Créez votre premier projet pour suivre ici le portefeuille R&D, les priorités et les décisions de l'équipe."
                action={
                  <LinkButton href="/projets/nouveau" icon={<Plus className="h-5 w-5" />}>
                    Nouveau projet
                  </LinkButton>
                }
              />
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={FolderSearch}
                title="Aucun projet ne correspond"
                description="Modifiez les filtres ou le périmètre pour afficher d'autres projets."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      actions.setFilters({ ...DEFAULT_FILTERS });
                      setScope(SCOPES[0]);
                    }}
                  >
                    Effacer les filtres
                  </Button>
                }
              />
            </Card>
          ) : (
            visible.map((p) => <PortfolioRow key={p.code} project={p} />)
          )}
        </div>

        <aside className="space-y-6">
          <DecisionsCard codes={codes} />
          <ShortcutsCard />
        </aside>
      </div>

      <Card className="mt-6 flex flex-col gap-4 p-5 xl:flex-row xl:items-center">
        <div className="flex shrink-0 items-center gap-3 xl:w-44">
          <MapIcon className="h-7 w-7 text-ink-800" strokeWidth={1.6} aria-hidden />
          <h2 className="text-lg font-bold text-ink-900">Parcours R&amp;D</h2>
        </div>
        <JourneyStrip className="flex-1" />
      </Card>

      {isFiltered(state.filters) || filtersOpen || openFilters ? <ScreenRef n={4} label="Filtres et vue enregistrée" /> : <ScreenRef n={1} label="Portefeuille" />}
    </>
  );
}
