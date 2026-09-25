"use client";

import { Bookmark, Check, Funnel, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Checkbox, DateInput, Field, Input, MultiSelect, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { DEFAULT_FILTERS, FAMILIES, PHASE_OPTIONS, STATUS_OPTIONS } from "@/lib/catalog";
import { plural } from "@/lib/format";
import { activeFilterChips } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Family, OverviewFilters } from "@/lib/types";

/** "Filtres" button owning its drawer; shows the number of active filters. */
export function FiltersButton({ defaultOpen = false, onOpenChange }: { defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { filters } = useDemo();
  const [open, setOpenState] = useState(defaultOpen);
  const [openCount, setOpenCount] = useState(0);
  const setOpen = (value: boolean) => {
    setOpenState(value);
    onOpenChange?.(value);
  };
  const count = activeFilterChips(filters).length;

  return (
    <>
      <Button
        variant={count ? "outline" : "secondary"}
        size="lg"
        icon={<Funnel className="h-5 w-5" strokeWidth={1.8} />}
        onClick={() => {
          setOpenCount((n) => n + 1);
          setOpen(true);
        }}
      >
        Filtres{count ? ` (${count})` : ""}
      </Button>
      <FiltersDrawer key={openCount} open={open} onClose={() => setOpen(false)} initial={filters} />
    </>
  );
}

/** Removable chips of the applied filters + result count. */
export function AppliedFiltersBar({ resultCount, noun = "projet" }: { resultCount: number; noun?: string }) {
  const { filters } = useDemo();
  const chips = activeFilterChips(filters);
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-white px-5 py-3 shadow-card">
      <span className="flex items-center gap-2 text-[15px] text-ink-700">
        <Funnel className="h-4 w-4 text-ink-500" aria-hidden />
        Filtres appliqués :
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => actions.setFilters(chip.remove(filters))}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-100 transition-colors hover:bg-brand-100"
          aria-label={`Retirer le filtre ${chip.label}`}
        >
          {chip.label}
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={() => actions.setFilters({ ...DEFAULT_FILTERS })}
        className="cursor-pointer text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
      >
        Effacer les filtres
      </button>
      <span className="ml-auto text-[15px] text-ink-600">
        {resultCount} {plural(resultCount, noun)}
      </span>
    </div>
  );
}

/**
 * Filters panel with "save as view". Mount it with a new `key` each time it opens
 * so the draft starts from the currently applied filters.
 */
export function FiltersDrawer({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: OverviewFilters;
}) {
  const { projects, savedViews } = useDemo();
  const [draft, setDraft] = useState<OverviewFilters>(initial);
  const [viewName, setViewName] = useState("");
  const [shared, setShared] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const owners = [...new Set(projects.map((p) => p.owner))];
  const set = <K extends keyof OverviewFilters>(key: K, value: OverviewFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const saveView = () => {
    const name = viewName.trim();
    if (!name) return setNameError("Donnez un nom à la vue.");
    if (savedViews.some((v) => v.name.toLowerCase() === name.toLowerCase())) return setNameError("Une vue porte déjà ce nom.");
    actions.saveView(name, shared, draft);
    toast.show({ title: "Vue enregistrée", description: `« ${name} » a été enregistrée${shared ? " et partagée avec votre équipe" : ""}.` });
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filtres"
      icon={<Funnel className="mt-1.5 h-6 w-6 text-ink-800" strokeWidth={1.8} aria-hidden />}
      widthClass="max-w-[420px]"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setDraft({ ...DEFAULT_FILTERS })}>
            Réinitialiser
          </Button>
          <Button
            size="lg"
            icon={<Check className="h-5 w-5" />}
            onClick={() => {
              actions.setFilters(draft);
              onClose();
            }}
            guide={5}
            guideHint="Appliquez les filtres, puis recherchez « CS-01 » dans la barre du haut."
          >
            Appliquer
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Famille pharmaceutique">
          <MultiSelect
            label="Familles pharmaceutiques"
            options={FAMILIES}
            value={draft.families}
            onChange={(v) => set("families", v as Family[])}
            placeholder="Toutes les familles"
          />
        </Field>
        <Field label="Phase">
          <MultiSelect label="Phases" options={PHASE_OPTIONS} value={draft.phases} onChange={(v) => set("phases", v)} placeholder="Toutes les phases" />
        </Field>
        <Field label="Responsable" htmlFor="filter-owner">
          <Select id="filter-owner" options={["Tous", ...owners]} value={draft.owner} onChange={(e) => set("owner", e.target.value)} />
        </Field>
        <Field label="Statut" htmlFor="filter-status">
          <Select id="filter-status" options={["Tous", ...STATUS_OPTIONS]} value={draft.status} onChange={(e) => set("status", e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[15px] font-semibold text-ink-800">Date du jalon</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="filter-from" className="mb-1 block text-[13px] text-ink-500">
                Du
              </label>
              <DateInput id="filter-from" value={draft.from} onChange={(v) => set("from", v)} />
            </div>
            <div>
              <label htmlFor="filter-to" className="mb-1 block text-[13px] text-ink-500">
                Au
              </label>
              <DateInput id="filter-to" value={draft.to} onChange={(v) => set("to", v)} invalid={Boolean(draft.from && draft.to && draft.to < draft.from)} />
            </div>
          </div>
          {draft.from && draft.to && draft.to < draft.from && (
            <p className="mt-1.5 text-sm text-danger-600">La date de fin précède la date de début.</p>
          )}
        </fieldset>
        <Checkbox checked={draft.blockingOnly} onChange={(v) => set("blockingOnly", v)} label="Uniquement les blocages" />

        <div className="space-y-4 border-t border-line pt-5">
          <Field label="Nom de la vue" htmlFor="view-name" error={nameError}>
            <Input
              id="view-name"
              value={viewName}
              placeholder="Ex. Mes projets en formulation"
              invalid={Boolean(nameError)}
              onChange={(e) => {
                setViewName(e.target.value);
                setNameError(null);
              }}
            />
          </Field>
          <Checkbox checked={shared} onChange={setShared} label="Partager avec mon équipe" />
          <Button variant="outline" size="lg" className="w-full" icon={<Bookmark className="h-5 w-5" />} onClick={saveView}>
            Enregistrer cette vue
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
