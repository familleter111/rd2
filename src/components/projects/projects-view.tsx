"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Copy,
  FileText,
  Folder,
  FolderSearch,
  Goal,
  Plus,
  Settings,
  SquareArrowOutUpRight,
  TriangleAlert,
  Upload,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppliedFiltersBar, FiltersButton } from "@/components/overview/filters-drawer";
import { SavedViewsMenu } from "@/components/overview/saved-views-menu";
import { ProductVisual } from "@/components/product-visual";
import { Badge, IconTile, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { PageHeader, ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { FAMILIES, TEMPLATE_BY_FAMILY } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatLong } from "@/lib/format";
import { filterProjects, GLOBAL_STATUS_TONE } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Project } from "@/lib/types";

type View = "cartes" | "liste" | "archives";

function archive(project: Project) {
  actions.archiveProject(project.code);
  toast.show({
    title: `${project.code} archivé`,
    description: "L'historique du projet est conservé.",
    action: { label: "Voir les projets archivés", href: "/projets?vue=archives" },
  });
}

function projectMenu(project: Project) {
  const href = `/projets/${project.slug}`;
  return [
    { label: "Ouvrir", icon: SquareArrowOutUpRight, href },
    { label: "Configurer", icon: Settings, href: `${href}?configurer=1` },
    { label: "Dupliquer", icon: Copy, description: "Copie la structure, sans les résultats.", href: `/projets/nouveau?depuis=${project.slug}` },
    { label: "Archiver", icon: Archive, description: "Conserve l'historique du projet.", onSelect: () => archive(project), separatorBefore: true },
  ];
}

function GlobalStatus({ project }: { project: Project }) {
  const tone = GLOBAL_STATUS_TONE[project.globalStatus];
  const Icon = project.globalStatus === "En attente" ? TriangleAlert : project.globalStatus === "En bonne voie" ? CircleCheck : undefined;
  return (
    <Badge tone={tone} size="md" icon={Icon} dot={!Icon} className="px-3 py-1.5">
      {project.globalStatus}
    </Badge>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const href = `/projets/${project.slug}`;
  const rows = [
    { icon: Folder, label: "Phase actuelle", value: project.track.label },
    { icon: User, label: "Chef de projet", value: project.owner },
    { icon: Goal, label: "Prochaine étape", value: project.nextStep },
    { icon: CalendarDays, label: "Date cible", value: formatLong(project.targetDate) },
  ];
  const primary = project.globalStatus === "En cours";

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-4">
        <ProductVisual kind={project.kind} className="h-[92px] w-[92px]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-ink-900">
            <Link href={href} className="hover:text-brand-700">
              {project.code} <span className="text-ink-400">•</span> {project.name}
            </Link>
          </h3>
          <p className="text-[15px] text-ink-600">{project.formLabel}</p>
          <Badge tone={project.track.tone} size="md" className="mt-2">
            {project.track.label}
          </Badge>
        </div>
        <Menu label={`Actions pour ${project.code}`} items={projectMenu(project)} widthClass="w-60" />
      </div>
      <dl className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-4">
            <row.icon className="mt-1 h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
            <div>
              <dt className="text-[13px] text-ink-500">{row.label}</dt>
              <dd className="text-[15px] text-ink-900">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
        <span className="text-[15px] text-ink-800">Statut global</span>
        <GlobalStatus project={project} />
      </div>
      <LinkButton
        href={href}
        variant={primary ? "primary" : "outline"}
        size="lg"
        className="mt-5 w-full"
        iconRight={<ChevronRight className="h-5 w-5" />}
      >
        {primary ? "Ouvrir le projet" : "Voir les détails"}
      </LinkButton>
    </Card>
  );
}

function ProjectTable({ projects, archived }: { projects: Project[]; archived?: boolean }) {
  return (
    <Card className="relative overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[15px]">
        <thead>
          <tr className="border-b border-line bg-subtle text-sm text-ink-600">
            <th className="px-5 py-3 font-medium">Projet</th>
            <th className="px-4 py-3 font-medium">Phase actuelle</th>
            <th className="px-4 py-3 font-medium">Chef de projet</th>
            <th className="px-4 py-3 font-medium">Prochaine étape</th>
            <th className="px-4 py-3 font-medium">Date cible</th>
            <th className="px-4 py-3 font-medium">Statut</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {projects.map((p) => (
            <tr key={p.code} className="hover:bg-subtle/70">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <ProductVisual kind={p.kind} className="h-12 w-12 rounded-lg" />
                  <div>
                    <Link href={`/projets/${p.slug}`} className="font-semibold text-ink-900 hover:text-brand-700">
                      {p.code} • {p.name}
                    </Link>
                    <p className="text-[13px] text-ink-500">{p.formLabel}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-ink-800">{p.phase}</td>
              <td className="px-4 py-3 text-ink-800">{p.owner}</td>
              <td className="px-4 py-3 text-ink-800">{p.nextStep}</td>
              <td className="px-4 py-3 text-ink-800">{formatLong(p.targetDate)}</td>
              <td className="px-4 py-3">
                {archived ? (
                  <Badge tone="neutral" icon={Archive} size="md">
                    Archivé
                  </Badge>
                ) : (
                  <span className="flex items-center gap-2 text-ink-800">
                    <StatusDot tone={GLOBAL_STATUS_TONE[p.globalStatus]} />
                    {p.globalStatus}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {archived ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ArchiveRestore className="h-4 w-4" />}
                    onClick={() => {
                      actions.restoreProject(p.code);
                      toast.show({ title: `${p.code} restauré`, description: "Le projet est de nouveau actif." });
                    }}
                  >
                    Restaurer
                  </Button>
                ) : (
                  <Menu label={`Actions pour ${p.code}`} items={projectMenu(p)} widthClass="w-60" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ImportTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Importer un modèle" subtitle="Démarrer un projet à partir d'un modèle de parcours standard.">
      <ul className="space-y-3">
        {FAMILIES.map((family) => (
          <li key={family} className="flex items-center gap-4 rounded-xl border border-line p-4">
            <IconTile icon={FileText} className="bg-brand-50 text-brand-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">{TEMPLATE_BY_FAMILY[family]}</p>
              <p className="text-sm text-ink-500">Famille {family.toLowerCase()} — parcours galénique, analytique, stabilité et dossier.</p>
            </div>
            <LinkButton href={`/projets/nouveau?modele=${encodeURIComponent(family)}`} variant="outline" size="sm" onClick={onClose}>
              Utiliser
            </LinkButton>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-500">L&apos;import de modèles personnalisés (fichier Excel) sera disponible dans une prochaine étape.</p>
    </Modal>
  );
}

export function ProjectsView({ initialView }: { initialView: View }) {
  const state = useDemo();
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const matchesQuery = (p: Project) => !q || `${p.code} ${p.name} ${p.formLabel} ${p.form}`.toLowerCase().includes(q);
  const active = filterProjects(state, state.projects.filter((p) => !p.archived), state.filters).filter(matchesQuery);
  const archived = state.projects.filter((p) => p.archived).filter(matchesQuery);
  const showBanner = state.draft && !state.draftBannerDismissed;

  return (
    <>
      <PageHeader
        title="Projets"
        subtitle="Suivi des projets de développement et d'optimisation"
        actions={
          <>
            <Button variant="outline" size="lg" icon={<Upload className="h-5 w-5" />} onClick={() => setImportOpen(true)}>
              Importer un modèle
            </Button>
            <LinkButton href="/projets/nouveau" size="lg" icon={<Plus className="h-5 w-5" />} guide={7}>
              Nouveau projet
            </LinkButton>
          </>
        }
      />

      <Tabs
        className="mt-5"
        items={[
          { value: "cartes", label: "Cartes" },
          { value: "liste", label: "Liste" },
          { value: "archives", label: "Archivés", count: archived.length || undefined },
        ]}
        value={view}
        onChange={setView}
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un projet…" className="w-full sm:w-64 [&_input]:h-12" />
            {view !== "archives" && (
              <>
                <SavedViewsMenu />
                <FiltersButton />
              </>
            )}
          </>
        }
      />

      {showBanner && view !== "archives" && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-brand-100 bg-brand-50/80 p-4">
          <IconTile icon={FileText} size="lg" className="bg-white text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-ink-900">Reprendre un brouillon</p>
            <p className="text-[15px] text-ink-600">
              Un projet est en cours de création{state.draft?.name ? ` (${state.draft.code ? `${state.draft.code} — ` : ""}${state.draft.name})` : ""}. Vous pouvez le reprendre pour le finaliser.
            </p>
          </div>
          <LinkButton href="/projets/nouveau?brouillon=1" variant="outline" size="lg" className="min-w-36">
            Reprendre
          </LinkButton>
          <button
            type="button"
            aria-label="Masquer le brouillon"
            onClick={() => actions.dismissDraftBanner()}
            className="cursor-pointer rounded-lg p-2 text-ink-600 hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {view !== "archives" && (
        <div className="mt-5">
          <AppliedFiltersBar resultCount={active.length} />
        </div>
      )}

      <div className="mt-5">
        {view === "archives" ? (
          archived.length ? (
            <ProjectTable projects={archived} archived />
          ) : (
            <Card>
              <EmptyState icon={Archive} title="Aucun projet archivé" description="Les projets archivés conservent leur historique et peuvent être restaurés à tout moment." />
            </Card>
          )
        ) : active.length === 0 ? (
          <Card>
            {state.projects.length === 0 ? (
              <EmptyState
                icon={FolderSearch}
                title="Aucun projet pour le moment"
                description="Créez votre premier projet : déposez vos documents, l'IA préremplit les informations produit."
                action={<LinkButton href="/projets/nouveau">Nouveau projet</LinkButton>}
              />
            ) : (
              <EmptyState icon={FolderSearch} title="Aucun projet ne correspond" description="Modifiez la recherche ou les filtres." />
            )}
          </Card>
        ) : view === "cartes" ? (
          <div className={cn("grid gap-5 md:grid-cols-2 2xl:grid-cols-3", active.length >= 3 && "xl:grid-cols-3")}>
            {active.map((p) => (
              <ProjectCard key={p.code} project={p} />
            ))}
          </div>
        ) : (
          <ProjectTable projects={active} />
        )}
      </div>

      <ImportTemplateModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ScreenRef n={6} label="Liste des projets" />
    </>
  );
}
