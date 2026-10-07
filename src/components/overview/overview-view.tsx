"use client";

import {
  Archive,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  FileSearch,
  Folder,
  FolderSearch,
  ListChecks,
  Map as MapIcon,
  Plus,
  Scale,
  Settings,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ProofDrawer, QualityBar } from "@/components/cadrage/cadrage-bits";
import { ProductVisual } from "@/components/product-visual";
import { JourneyStrip, StageBadge } from "@/components/project-bits";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { allData } from "@/lib/cadrage";
import { CURRENT_USER, DEFAULT_FILTERS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatLong, plural } from "@/lib/format";
import { overviewBoard, percent, projectIndicators, type BoardItem, type Ratio } from "@/lib/overview";
import { filterProjects, isFiltered, projectBadge } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Project, Tone } from "@/lib/types";
import { AppliedFiltersBar, FiltersButton } from "./filters-drawer";
import { OverviewHeader } from "./overview-header";
import { SavedViewsMenu } from "./saved-views-menu";

const SCOPES = ["Tous les projets", "Mes projets", "Projets avec blocage"];

/* ------------------------------------------------------------------ */
/* The four blocks: decide, verify, unblock, prepare                   */
/* ------------------------------------------------------------------ */

function BoardRow({ item, onProof }: { item: BoardItem; onProof: (item: BoardItem) => void }) {
  return (
    <li className="rounded-xl border border-line p-3.5">
      <div className="flex items-start justify-between gap-3">
        <Link href={item.href} className="text-[13px] font-semibold text-brand-700 hover:underline">
          {item.projectLabel}
        </Link>
        <Badge tone={item.tone}>{item.badge}</Badge>
      </div>
      <p className="mt-1 text-[15px] font-semibold leading-snug text-ink-900">{item.title}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-ink-600">{item.detail}</p>
      {item.rule && (
        <dl className="mt-2 space-y-0.5 rounded-lg bg-subtle px-3 py-2 text-[13px] leading-snug">
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-ink-500">Règle :</dt>
            <dd className="text-ink-800">{item.rule}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-ink-500">Preuve attendue :</dt>
            <dd className="text-ink-800">{item.expected}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-ink-500">Responsable :</dt>
            <dd className="text-ink-800">{item.owner}</dd>
          </div>
        </dl>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {item.datum && (
          <Button variant="outline" size="sm" icon={<FileSearch className="h-4 w-4" />} onClick={() => onProof(item)}>
            Voir la preuve
          </Button>
        )}
        <LinkButton href={item.href} variant={item.datum ? "ghost" : "outline"} size="sm" iconRight={<ChevronRight className="h-4 w-4" />}>
          {item.datum ? "Ouvrir la fiche" : item.cta}
        </LinkButton>
      </div>
    </li>
  );
}

function BoardBlock({
  icon,
  tone,
  title,
  hint,
  empty,
  items,
  onProof,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  hint: string;
  empty: string;
  items: BoardItem[];
  onProof: (item: BoardItem) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <IconTile icon={icon} tone={items.length ? tone : "neutral"} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight text-ink-900">{title}</h2>
          <p className="text-[13px] leading-snug text-ink-500">{hint}</p>
        </div>
        <span className={cn("text-[32px] font-bold leading-none", items.length ? "text-ink-900" : "text-ink-300")}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 flex flex-1 items-center gap-2 rounded-xl bg-subtle px-4 py-5 text-sm text-ink-500">
          <CircleCheck className="h-5 w-5 shrink-0 text-ink-300" aria-hidden />
          {empty}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {shown.map((item) => (
            <BoardRow key={item.id} item={item} onProof={onProof} />
          ))}
        </ul>
      )}
      {items.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 cursor-pointer self-start text-sm font-semibold text-brand-700 hover:underline">
          {all ? "Réduire" : `Voir les ${items.length}`}
        </button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio: three distinct indicators per project                    */
/* ------------------------------------------------------------------ */

function RatioBar({ ratio, unit }: { ratio: Ratio; unit: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[17px] font-bold text-ink-900">{percent(ratio)} %</span>
        <span className="text-xs text-ink-500">
          {ratio.done} / {ratio.total} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${percent(ratio)} %`}>
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${percent(ratio)}%` }} />
      </div>
    </>
  );
}

function Indicator({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[13px] font-semibold text-ink-600">{label}</p>
      {children}
    </div>
  );
}

const NotAvailable = ({ children }: { children: string }) => <p className="text-sm text-ink-400">{children}</p>;

function ProjectRow({ project }: { project: Project }) {
  const state = useDemo();
  const href = project.cadrage ? project.portfolioAction.href : `/projets/${project.slug}`;
  const ind = projectIndicators(state, project);

  return (
    <Card className="relative p-4">
      <div className="flex flex-col gap-5 md:flex-row">
        <Link href={href} className="shrink-0" tabIndex={-1} aria-hidden>
          <ProductVisual kind={project.kind} className="h-28 w-full md:h-[96px] md:w-[96px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pr-10">
            <h3 className="text-xl font-bold text-ink-900">
              <Link href={href} className="hover:text-brand-700">
                {project.code} <span className="text-ink-400">•</span> {project.name}
              </Link>
            </h3>
            <StageBadge badge={projectBadge(state, project)} />
          </div>
          <p className="mt-0.5 text-[15px] text-ink-600">{project.portfolioSubtitle}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-700">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4 text-ink-500" aria-hidden />
              {project.owner}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-ink-500" aria-hidden />
              Prochaine revue : {project.milestone.title} — {formatLong(project.milestone.date)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col justify-end md:w-[230px] md:pr-8">
          <p className="text-[13px] text-ink-500">Prochaine action</p>
          <p className="font-semibold leading-snug text-ink-900">{project.nextAction.label}</p>
          <LinkButton href={project.portfolioAction.href} variant={project.portfolioAction.variant} size="sm" className="mt-2 self-start" iconRight={<ChevronRight className="h-4 w-4" />}>
            {project.portfolioAction.label}
          </LinkButton>
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-4 border-t border-line pt-4 md:grid-cols-3">
        <Indicator label="Avancement du travail">
          {ind.work.total ? <RatioBar ratio={ind.work} unit={plural(ind.work.total, "activité")} /> : <NotAvailable>Aucune activité applicable</NotAvailable>}
        </Indicator>
        <Indicator label="Qualité de l'information">
          {ind.info ? <QualityBar quality={ind.info} compact /> : <NotAvailable>Non évaluée — pas de fiche sourcée</NotAvailable>}
        </Indicator>
        <Indicator label="Préparation du dossier">
          {ind.dossier?.total ? <RatioBar ratio={ind.dossier} unit={plural(ind.dossier.total, "section")} /> : <NotAvailable>Dossier non constitué</NotAvailable>}
        </Indicator>
      </div>

      <div className="absolute right-3 top-3">
        <Menu
          label={`Actions pour ${project.code}`}
          items={[
            { label: "Configurer", icon: Settings, href: `/projets/${project.slug}?configurer=1` },
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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function OverviewView({ openFilters = false }: { openFilters?: boolean }) {
  const state = useDemo();
  const [scope, setScope] = useState(SCOPES[0]);
  const [filtersOpen, setFiltersOpen] = useState(openFilters);
  const [proof, setProof] = useState<BoardItem | null>(null);

  const active = state.projects.filter((p) => !p.archived);
  const fullBoard = overviewBoard(state, active);
  const blocked = new Set(fullBoard.blockers.map((b) => b.projectCode));
  const scoped = active.filter((p) => (scope === "Mes projets" ? p.owner === CURRENT_USER : scope === "Projets avec blocage" ? blocked.has(p.code) : true));
  const visible = filterProjects(state, scoped, state.filters);
  const board = overviewBoard(state, visible);
  const filtered = isFiltered(state.filters) || scope !== SCOPES[0];
  // The proof shown is always the current version of the value.
  const proofDatum = proof && ([visible.find((p) => p.code === proof.projectCode)].flatMap((p) => (p ? allData(p) : [])).find((d) => d.key === proof.datum?.key) ?? null);

  return (
    <>
      <OverviewHeader
        subtitle="Ce qu'il faut décider, vérifier et débloquer — avec un accès direct aux preuves"
        action={
          <LinkButton href="/projets/nouveau" size="lg" icon={<Plus className="h-5 w-5" />}>
            Nouveau projet
          </LinkButton>
        }
        tabActions={
          <>
            <Select aria-label="Périmètre" options={SCOPES} value={scope} onChange={(e) => setScope(e.target.value)} className="w-56 [&_select]:h-12" />
            <FiltersButton defaultOpen={openFilters} onOpenChange={setFiltersOpen} />
            <SavedViewsMenu />
          </>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <BoardBlock icon={Scale} tone="info" title="À décider" hint="Arbitrages dont les preuves sont réunies" empty="Aucune décision attendue." items={board.decisions} onProof={setProof} />
        <BoardBlock icon={FileSearch} tone="warn" title="Données à vérifier" hint="Valeurs lues, à confirmer avec leur extrait" empty="Aucune donnée en attente de vérification." items={board.data} onProof={setProof} />
        <BoardBlock icon={TriangleAlert} tone="danger" title="Blocages" hint="Règle, preuve attendue et responsable" empty="Aucun blocage." items={board.blockers} onProof={setProof} />
        <BoardBlock icon={ListChecks} tone="info" title="Revues à préparer" hint="Prochaines portes de décision" empty="Aucune revue à préparer." items={board.reviews} onProof={setProof} />
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">
            Portefeuille{" "}
            <span className="text-lg font-medium text-ink-500">
              — {visible.length} {filtered ? plural(visible.length, "projet affiché", "projets affichés") : plural(visible.length, "projet")}
            </span>
          </h2>
          <p className="text-sm text-ink-500">Trois indicateurs distincts par projet : 100 % sur l&apos;un ne donne jamais 100 % sur les autres.</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <AppliedFiltersBar resultCount={visible.length} />
        {state.projects.length === 0 ? (
          <Card>
            <EmptyState
              icon={Folder}
              title="Aucun projet pour le moment"
              description="Créez votre premier projet à partir d'un médicament de référence : ses décisions, ses données à vérifier et ses blocages apparaîtront ici."
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
          visible.map((p) => <ProjectRow key={p.code} project={p} />)
        )}
      </div>

      <Card className="mt-6 flex flex-col gap-4 p-5 xl:flex-row xl:items-center">
        <div className="flex shrink-0 items-center gap-3 xl:w-44">
          <MapIcon className="h-7 w-7 text-ink-800" strokeWidth={1.6} aria-hidden />
          <h2 className="text-lg font-bold text-ink-900">Parcours R&amp;D</h2>
        </div>
        <JourneyStrip className="flex-1" />
      </Card>

      {isFiltered(state.filters) || filtersOpen || openFilters ? <ScreenRef n={4} label="Filtres et vue enregistrée" /> : <ScreenRef n={1} label="Vue d'ensemble" />}

      <ProofDrawer datum={proofDatum} context={proof?.projectLabel} onClose={() => setProof(null)} />
    </>
  );
}
