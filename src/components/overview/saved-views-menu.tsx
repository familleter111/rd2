"use client";

import { Bookmark, BookmarkCheck, ChevronDown, RotateCcw, Users } from "lucide-react";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { DEFAULT_FILTERS } from "@/lib/catalog";
import { actions, useDemo } from "@/lib/store";

export function SavedViewsMenu() {
  const { savedViews } = useDemo();

  const items: MenuItem[] = savedViews.length
    ? savedViews.map((view) => ({
        label: view.name,
        description: view.shared ? "Partagée avec l'équipe" : "Vue personnelle",
        icon: view.shared ? Users : BookmarkCheck,
        onSelect: () => {
          actions.setFilters(view.filters);
          toast.show({ title: "Vue appliquée", description: `Filtres de « ${view.name} » appliqués.`, tone: "info" });
        },
      }))
    : [{ label: "Aucune vue enregistrée", description: "Enregistrez une vue depuis le panneau Filtres.", disabled: true }];

  items.push({
    label: "Afficher tous les projets",
    icon: RotateCcw,
    separatorBefore: true,
    onSelect: () => actions.setFilters({ ...DEFAULT_FILTERS }),
  });

  return (
    <Menu
      label="Vues enregistrées"
      items={items}
      widthClass="w-72"
      triggerClassName="inline-flex h-12 items-center gap-2.5 rounded-lg border border-line-strong bg-white px-4 text-[15px] font-medium text-ink-800 transition-colors hover:border-ink-300 hover:bg-subtle"
      trigger={
        <>
          <Bookmark className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          Vue enregistrée
          <ChevronDown className="h-4 w-4 text-ink-500" aria-hidden />
        </>
      }
    />
  );
}
