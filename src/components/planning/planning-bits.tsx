"use client";

import {
  Box,
  CalendarDays,
  CircleAlert,
  Cog,
  FlaskConical,
  Info,
  Microscope,
  Refrigerator,
  Scale,
  ServerCog,
  Thermometer,
  Timer,
  TriangleAlert,
  User,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import type { DemoState } from "@/lib/data";
import { formatDuration, formatWeekday, fromMinutes, toMinutes } from "@/lib/format";
import { DAY_END, DAY_START, EVENT_STYLE, findConflicts, nextFreeSlot } from "@/lib/lab-selectors";
import { useDemo } from "@/lib/store";
import type { PlanningEvent, Resource } from "@/lib/types";

export const RESOURCE_ICONS: Record<Resource["icon"], LucideIcon> = {
  hplc: ServerCog,
  mixer: Cog,
  person: User,
  balance: Scale,
  oven: Thermometer,
  fridge: Refrigerator,
  uv: Microscope,
  dissolution: Waves,
  friability: Timer,
};

export const KIND_ICONS: Record<PlanningEvent["kind"], LucideIcon> = {
  activite: FlaskConical,
  reservation: Box,
  revue: Users,
  maintenance: TriangleAlert,
};

export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => fromMinutes(DAY_START + i * 60));

/** Time options every 30 minutes during the working day. */
export const TIME_OPTIONS = Array.from({ length: (DAY_END - DAY_START) / 30 + 1 }, (_, i) => fromMinutes(DAY_START + i * 30));

export function ResourceTile({ resource, size = "md" }: { resource: Resource; size?: "sm" | "md" }) {
  const Icon = RESOURCE_ICONS[resource.icon];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-subtle text-ink-700", size === "md" ? "h-12 w-12" : "h-10 w-10")}>
      <Icon className={size === "md" ? "h-6 w-6" : "h-5 w-5"} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/** Horizontal day timeline of resources (screens 32 and 34). */
export function ResourceTimeline({
  resources,
  date,
  selectedId,
  onSelect,
  onSlot,
  compact,
}: {
  resources: Resource[];
  date: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Click on a free hour of a resource (e.g. to request a reservation). */
  onSlot?: (resourceId: string, hour: string) => void;
  compact?: boolean;
}) {
  const state = useDemo();
  const span = DAY_END - DAY_START;
  const pct = (t: string) => ((toMinutes(t) - DAY_START) / span) * 100;

  return (
    <div className="relative overflow-x-auto rounded-xl border border-line">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[220px_minmax(0,1fr)] border-b border-line bg-subtle text-sm font-semibold text-ink-700">
          <div className="px-4 py-3">{compact ? "Équipement" : "Ressource"}</div>
          <div className="relative">
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0, 1fr))` }}>
              {HOURS.map((h) => (
                <span key={h} className="border-l border-line/70 px-1.5 py-3 text-xs font-medium text-ink-600">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
        {resources.map((r) => {
          const events = state.events.filter((e) => e.date === date && e.resourceIds.includes(r.id));
          const selected = r.id === selectedId;
          return (
            <div key={r.id} className={cn("grid grid-cols-[220px_minmax(0,1fr)] border-b border-line last:border-b-0", selected && "bg-brand-50/60")}>
              <button
                type="button"
                onClick={() => onSelect?.(r.id)}
                className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 text-left", !onSelect && "cursor-default")}
              >
                {!compact && <ResourceTile resource={r} size="sm" />}
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-bold text-ink-900">{r.name}</span>
                  <span className="block truncate text-ink-600">{compact ? r.label : r.type}</span>
                  {!compact && <span className="block truncate text-ink-500">{r.team}</span>}
                </span>
              </button>
              <div className="relative my-2 mr-2 rounded-md bg-brand-50" style={{ minHeight: compact ? 52 : 60 }}>
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0, 1fr))` }}>
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-label={`${r.name} — ${h}`}
                      tabIndex={onSlot ? 0 : -1}
                      onClick={() => onSlot?.(r.id, h)}
                      className={cn("border-l border-white/80", onSlot ? "cursor-pointer hover:bg-brand-100" : "cursor-default")}
                    />
                  ))}
                </div>
                {events.map((e) => {
                  const maintenance = e.kind === "maintenance";
                  const left = pct(e.start);
                  const width = pct(e.end) - left;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onSelect?.(r.id)}
                      title={`${e.title} — ${e.start} à ${e.end}`}
                      className={cn(
                        "absolute inset-y-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs",
                        maintenance ? "border-l-slate-500 bg-slate-200 text-ink-700" : "border-l-warn-500 bg-warn-100 text-ink-800",
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <span className="block truncate font-semibold">
                        {e.start} – {e.end}
                      </span>
                      <span className="block truncate">{e.timelineLabel ?? (e.projectCode ? `${e.projectCode} • ${e.title}` : e.title)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-ink-700">
      <span className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full bg-brand-100 ring-1 ring-brand-200" aria-hidden />
        Disponible
      </span>
      <span className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full bg-warn-500" aria-hidden />
        Réservé
      </span>
      <span className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full bg-slate-400" aria-hidden />
        Indisponible
      </span>
    </div>
  );
}

export interface SlotRequest {
  resourceId: string;
  date: string;
  start: string;
  end: string;
  method?: string;
}

export interface Alternative extends SlotRequest {
  id: string;
  warning?: string;
}

/** Alternatives offered when a slot is taken: same resource later, or a similar resource at the same time. */
export function alternativesFor(s: DemoState, req: SlotRequest): Alternative[] {
  const duration = toMinutes(req.end) - toMinutes(req.start);
  const list: Alternative[] = [];
  const conflicts = findConflicts(s, req.resourceId, req.date, req.start, req.end);
  const after = conflicts.map((c) => c.end).sort().at(-1) ?? req.start;
  const later = nextFreeSlot(s, req.resourceId, req.date, duration, after);
  if (later) list.push({ id: "same", ...req, ...later });
  const resource = s.resources.find((r) => r.id === req.resourceId);
  s.resources
    .filter((r) => r.id !== req.resourceId && r.type === resource?.type)
    .forEach((r) => {
      if (findConflicts(s, r.id, req.date, req.start, req.end).length) return;
      const compatible = !req.method || !r.qualifiedFor || r.qualifiedFor.includes(req.method);
      list.push({ id: r.id, ...req, resourceId: r.id, warning: compatible ? undefined : "Compatibilité à vérifier" });
    });
  return list.slice(0, 3);
}

function SlotLine({ resource, date, start, end }: { resource: string; date: string; start: string; end: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
      <span className="font-bold text-ink-900">{resource}</span>
      <span className="text-ink-300">•</span>
      <span className="text-ink-800">{formatWeekday(date)}</span>
      <span className="text-ink-300">•</span>
      <span className="font-semibold text-ink-900">
        {start} – {end}
      </span>
    </span>
  );
}

/** Screen 34 — the requested slot overlaps an existing booking. */
export function ConflictModal({
  request,
  open,
  onClose,
  onUse,
}: {
  request: SlotRequest;
  open: boolean;
  onClose: () => void;
  onUse: (slot: Alternative) => void;
}) {
  const state = useDemo();
  const conflicts = findConflicts(state, request.resourceId, request.date, request.start, request.end);
  const alternatives = alternativesFor(state, request);
  const [choice, setChoice] = useState(alternatives[0]?.id ?? "");
  const resourceName = (id: string) => state.resources.find((r) => r.id === id)?.name ?? id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Conflit de réservation"
      footer={
        <>
          <Button variant="outline" size="lg" onClick={onClose} className="min-w-36">
            Annuler
          </Button>
          <Button
            size="lg"
            disabled={!choice}
            onClick={() => {
              const slot = alternatives.find((a) => a.id === choice);
              if (slot) onUse(slot);
            }}
          >
            Utiliser ce créneau
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-warn-200 bg-warn-50 p-4">
            <TriangleAlert className="h-7 w-7 shrink-0 fill-warn-500 text-white" aria-hidden />
            <div>
              <p className="font-bold text-warn-700">Ce créneau est déjà réservé.</p>
              <p className="text-sm text-warn-700">Le créneau demandé chevauche une réservation existante.</p>
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold text-ink-900">Créneau demandé</p>
            <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
              <CalendarDays className="h-5 w-5 text-ink-600" aria-hidden />
              <SlotLine resource={resourceName(request.resourceId)} date={request.date} start={request.start} end={request.end} />
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold text-ink-900">Réservation existante</p>
            <ul className="space-y-2">
              {conflicts.map((c) => {
                const from = Math.max(toMinutes(c.start), toMinutes(request.start));
                const to = Math.min(toMinutes(c.end), toMinutes(request.end));
                return (
                  <li key={c.id} className="rounded-xl border border-line px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-ink-600" aria-hidden />
                      <SlotLine resource={resourceName(request.resourceId)} date={c.date} start={c.start} end={c.end} />
                    </div>
                    <p className="mt-2 rounded-md bg-danger-50 px-3 py-1.5 text-sm text-danger-700">
                      Chevauchement : {fromMinutes(from)} – {fromMinutes(to)} ({formatDuration(to - from)}) — {c.title}
                      {c.projectCode ? ` (${c.projectCode})` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="border-t border-line pt-4">
            <p className="mb-2 font-semibold text-ink-900">Créneaux alternatifs disponibles</p>
            {alternatives.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-600">
                <CircleAlert className="h-4 w-4" aria-hidden />
                Aucun créneau équivalent ce jour-là : choisissez une autre date.
              </p>
            ) : (
              <div role="radiogroup" aria-label="Créneaux alternatifs" className="grid gap-3 sm:grid-cols-2">
                {alternatives.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={choice === a.id}
                    onClick={() => setChoice(a.id)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      choice === a.id ? "border-brand-400 bg-brand-50" : "border-line hover:border-brand-200",
                    )}
                  >
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", choice === a.id ? "border-brand-600" : "border-line-strong")}>
                      {choice === a.id && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                    </span>
                    <span className="text-sm">
                      <span className="block font-bold text-ink-900">{resourceName(a.resourceId)}</span>
                      <span className="block text-ink-700">{formatWeekday(a.date)}</span>
                      <span className="block text-ink-700">
                        {a.start} – {a.end}
                      </span>
                      {a.warning && (
                        <Badge tone="warn" icon={CircleAlert} className="mt-2">
                          {a.warning}
                        </Badge>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="h-fit rounded-xl bg-brand-50 p-4">
          <Info className="h-7 w-7 fill-brand-600 text-white" aria-hidden />
          <p className="mt-3 font-bold text-ink-900">Aucune réservation créée pour le créneau en conflit.</p>
          <p className="mt-2 text-sm text-ink-600">Veuillez choisir un autre créneau disponible ou un autre équipement pour poursuivre.</p>
        </div>
      </div>
    </Modal>
  );
}

export function EventKindBadge({ kind }: { kind: PlanningEvent["kind"] }) {
  const style = EVENT_STYLE[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", style.card)}>
      <span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </span>
  );
}
