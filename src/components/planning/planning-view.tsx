"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  EllipsisVertical,
  ExternalLink,
  FileText,
  Filter,
  Flag,
  FlaskConical,
  List,
  SquareCheck,
  Users,
  Pencil,
  Plus,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectContextHeader } from "@/components/project-context-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { DateInput, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  DEMO_TODAY,
  addDays,
  formatDayShort,
  formatDuration,
  formatLong,
  formatMonth,
  formatNumeric,
  formatWeekRange,
  formatWeekday,
  fromMinutes,
  startOfWeek,
  toMinutes,
} from "@/lib/format";
import { DAY_END, DAY_START, EVENT_STYLE, findConflicts, nextAvailability } from "@/lib/lab-selectors";
import { NoProject } from "@/components/no-project";
import { findProject } from "@/lib/selectors";
import { labActions, useDemo } from "@/lib/store";
import type { PlanningEvent, PlanningKind, Resource } from "@/lib/types";
import { KIND_ICONS, ResourceTile, ResourceTimeline, TIME_OPTIONS, TimelineLegend } from "./planning-bits";

export type PlanningTab = "agenda" | "ressources" | "charge";

const AGENDA_START = 8 * 60;
const AGENDA_END = 18 * 60;
const ROW = 44;

function EventDetail({ event, onClose, onEdit }: { event: PlanningEvent; onClose: () => void; onEdit: () => void }) {
  const state = useDemo();
  const router = useRouter();
  const project = state.projects.find((p) => p.code === event.projectCode);
  const method = event.method ? state.methods.find((m) => m.ref === event.method) : undefined;
  const equipment = event.resourceIds.map((id) => state.resources.find((r) => r.id === id)).filter((r): r is Resource => Boolean(r && r.category === "Équipement"));
  const duration = toMinutes(event.end) - toMinutes(event.start);
  const style = EVENT_STYLE[event.kind];
  const open = () => {
    if (event.activityId) router.push(`/activites/${event.activityId}`);
    else if (event.lotCode && project && state.pilotLots.some((l) => l.lotCode === event.lotCode)) router.push(`/projets/${project.slug}/lots/${event.lotCode.toLowerCase()}`);
    else if (method) router.push(`/methodes/${method.ref.toLowerCase()}/essais`);
    else if (project) router.push(`/projets/${project.slug}`);
  };

  const rows: { icon: typeof Clock; label: string; value: string; sub?: string }[] = [
    { icon: CalendarDays, label: formatWeekday(event.date), value: `${event.start} – ${event.end} (${formatDuration(duration)})` },
    ...(project ? [{ icon: FlaskConical, label: `${project.code} • ${project.name}`, value: event.lotCode ? `Lot ${event.lotCode}` : project.formLabel }] : []),
    ...(method ? [{ icon: FileText, label: "Méthode", value: `${method.ref} • ${method.name}` }] : []),
    ...(equipment.length ? [{ icon: ServerCog, label: "Équipement", value: equipment.map((r) => r.name).join(", ") }] : event.place ? [{ icon: ServerCog, label: "Lieu", value: event.place }] : []),
    ...(event.analyst ? [{ icon: User, label: "Analyste", value: event.analyst }] : []),
    ...(event.description ? [{ icon: List, label: "Description", value: event.description }] : []),
  ];

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-ink-900">
          {event.title}
          {event.lotCode ? ` — ${event.lotCode}` : ""}
        </h3>
        <button type="button" aria-label="Fermer le détail" onClick={onClose} className="cursor-pointer rounded p-1 text-ink-500 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone={style.tone === "neutral" ? "neutral" : style.tone} dot>
          {style.label}
        </Badge>
        <Badge tone="info">{event.status}</Badge>
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3">
            <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
            <span>
              <span className="block font-semibold text-ink-900">{r.label}</span>
              <span className="block text-ink-600">{r.value}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>
          Modifier
        </Button>
        <Button icon={<ExternalLink className="h-4 w-4" />} onClick={open}>
          Ouvrir l&apos;activité
        </Button>
      </div>
    </div>
  );
}

function EditEventModal({ event, open, onClose }: { event: PlanningEvent; open: boolean; onClose: () => void }) {
  const state = useDemo();
  const [date, setDate] = useState(event.date);
  const [start, setStart] = useState(event.start);
  const [end, setEnd] = useState(event.end);
  const conflicts = event.resourceIds.flatMap((id) => findConflicts(state, id, date, start, end, event.id));
  const invalid = end <= start;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Modifier le créneau"
      subtitle={event.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={invalid || conflicts.length > 0 || !date}
            onClick={() => {
              labActions.updateEvent(event.id, { date, start, end });
              toast.show({ title: "Créneau modifié", description: `${formatNumeric(date)} — ${start} à ${end}.` });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date" required htmlFor="ev-date">
          <DateInput id="ev-date" value={date} onChange={setDate} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" required htmlFor="ev-start">
            <Select id="ev-start" options={TIME_OPTIONS} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fin" required htmlFor="ev-end" error={invalid ? "La fin doit suivre le début." : null}>
            <Select id="ev-end" options={TIME_OPTIONS} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        {conflicts.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Créneau indisponible : {conflicts.map((c) => `${c.title} (${c.start}–${c.end})`).join(", ")}.
          </p>
        )}
      </div>
    </Modal>
  );
}

function PlanActivityDrawer({ projectCode, open, onClose, onCreated }: { projectCode: string; open: boolean; onClose: () => void; onCreated: (id: string, date: string) => void }) {
  const state = useDemo();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PlanningKind>("activite");
  const [date, setDate] = useState("2026-10-08");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [resourceId, setResourceId] = useState("");
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const conflicts = resourceId ? findConflicts(state, resourceId, date, start, end) : [];
  const errors = {
    title: title.trim().length < 3 ? "Renseignez l'intitulé." : null,
    time: end <= start ? "La fin doit suivre le début." : null,
    conflict: conflicts.length ? `Ressource indisponible : ${conflicts.map((c) => `${c.title} (${c.start}–${c.end})`).join(", ")}.` : null,
  };
  const show = (e: string | null) => (submitted ? e : null);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Planifier une activité"
      subtitle={`Ajouter un créneau au planning de ${projectCode}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="lg"
            onClick={() => {
              setSubmitted(true);
              if (Object.values(errors).some(Boolean)) return;
              const id = `ev-${Date.now().toString(36)}`;
              const resource = state.resources.find((r) => r.id === resourceId);
              labActions.createEvent({
                id,
                kind,
                title: title.trim(),
                projectCode,
                place: resource?.name ?? (place.trim() || undefined),
                resourceIds: resourceId ? [resourceId] : [],
                date,
                start,
                end,
                description: description.trim() || undefined,
                timelineLabel: `${projectCode} • ${title.trim()}`,
              });
              toast.show({ title: "Activité planifiée", description: `${title.trim()} — ${formatNumeric(date)}, ${start}–${end}.` });
              onCreated(id, date);
              onClose();
            }}
          >
            Planifier
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Intitulé" required htmlFor="pa-title" error={show(errors.title)}>
          <Input id="pa-title" placeholder="Ex. Contrôle en cours LP-01" value={title} invalid={Boolean(show(errors.title))} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Type" htmlFor="pa-kind">
          <Select
            id="pa-kind"
            options={[
              { value: "activite", label: "Activité" },
              { value: "reservation", label: "Réservation" },
              { value: "revue", label: "Revue" },
            ]}
            value={kind}
            onChange={(e) => setKind(e.target.value as PlanningKind)}
          />
        </Field>
        <Field label="Date" required htmlFor="pa-date">
          <DateInput id="pa-date" value={date} onChange={setDate} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" required htmlFor="pa-start">
            <Select id="pa-start" options={TIME_OPTIONS} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fin" required htmlFor="pa-end" error={show(errors.time)}>
            <Select id="pa-end" options={TIME_OPTIONS} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Ressource" htmlFor="pa-res" optional error={show(errors.conflict)}>
          <Select id="pa-res" placeholder="Aucune" options={state.resources.map((r) => ({ value: r.id, label: `${r.name} — ${r.label}` }))} value={resourceId} onChange={(e) => setResourceId(e.target.value)} />
        </Field>
        {!resourceId && (
          <Field label="Lieu" htmlFor="pa-place" optional>
            <Input id="pa-place" placeholder="Ex. Salle de réunion" value={place} onChange={(e) => setPlace(e.target.value)} />
          </Field>
        )}
        <Field label="Description" htmlFor="pa-desc" optional>
          <Textarea id="pa-desc" rows={3} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}

/** Dated item of a project shown above the time grid: milestone, activity to finish, review to hold. */
interface Deadline {
  id: string;
  date: string;
  title: string;
  kind: "jalon" | "echeance" | "revue";
  projectCode: string;
  href: string;
}

const DEADLINE_LOOK: Record<Deadline["kind"], { label: string; icon: typeof Flag; chip: string }> = {
  jalon: { label: "Jalon", icon: Flag, chip: "border-warn-200 bg-warn-50 text-warn-700 hover:border-warn-500" },
  echeance: { label: "Échéance d'activité", icon: SquareCheck, chip: "border-brand-200 bg-white text-brand-700 hover:border-brand-500" },
  revue: { label: "Revue planifiée", icon: Users, chip: "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-500" },
};

function DeadlineChip({ item, compact }: { item: Deadline; compact?: boolean }) {
  const look = DEADLINE_LOOK[item.kind];
  return (
    <Link
      href={item.href}
      title={`${look.label} — ${item.projectCode} • ${item.title}`}
      className={cn("flex items-center gap-1.5 rounded-md border font-semibold transition-colors", compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs", look.chip)}
    >
      <look.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function Agenda({ projectCode, initialWeek, initialEventId }: { projectCode: string; initialWeek: string; initialEventId?: string }) {
  const state = useDemo();
  const [week, setWeek] = useState(startOfWeek(initialWeek));
  const [mode, setMode] = useState<"semaine" | "mois">("semaine");
  const [kinds, setKinds] = useState<PlanningKind[]>(["activite", "reservation", "revue"]);
  const [allProjects, setAllProjects] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialEventId ?? "ev-hplc");
  const [editing, setEditing] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [planKey, setPlanKey] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);

  const days = Array.from({ length: 5 }, (_, i) => addDays(week, i));
  const visible = state.events.filter((e) => kinds.includes(e.kind) && (allProjects || e.projectCode === projectCode));
  const selected = visible.find((e) => e.id === selectedId);
  // Milestones, activity deadlines and planned reviews: a project has dates before it has booked slots.
  const mine = (code: string) => allProjects || code === projectCode;
  const deadlines: Deadline[] = [
    ...state.projects
      .filter((p) => !p.archived && mine(p.code))
      .map((p): Deadline => ({ id: `jalon-${p.code}`, date: p.milestone.date, title: p.milestone.title, kind: "jalon", projectCode: p.code, href: `/projets/${p.slug}` })),
    ...(kinds.includes("activite")
      ? state.activities
          .filter((a) => !a.done && mine(a.projectCode) && !state.events.some((e) => e.activityId === a.id))
          .map((a): Deadline => ({ id: a.id, date: a.due, title: a.title, kind: "echeance", projectCode: a.projectCode, href: `/activites/${a.id}` }))
      : []),
    ...(kinds.includes("revue")
      ? state.reviews
          .filter((r) => r.status !== "cloturee" && mine(r.projectCode))
          .map((r): Deadline => ({ id: r.id, date: r.date, title: r.title, kind: "revue", projectCode: r.projectCode, href: "/vue-ensemble/revues" }))
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const dated = [...visible.map((e) => ({ date: e.date, title: e.title })), ...deadlines.map((d) => ({ date: d.date, title: d.title }))].sort((a, b) => a.date.localeCompare(b.date));
  const hours = Array.from({ length: (AGENDA_END - AGENDA_START) / 60 }, (_, i) => fromMinutes(AGENDA_START + i * 60));
  const monthStart = startOfWeek(`${week.slice(0, 7)}-01`);
  const monthDays = Array.from({ length: 35 }, (_, i) => addDays(monthStart, i));
  const shift = (delta: number) => setWeek(addDays(week, mode === "semaine" ? delta * 7 : delta * 28));
  const weekDeadlines = deadlines.filter((d) => d.date >= days[0] && d.date <= addDays(week, 6));
  const emptyWeek = mode === "semaine" && !weekDeadlines.length && !visible.some((e) => e.date >= days[0] && e.date <= days[4]);
  /** Nearest dated item when the displayed week is empty (the next one, else the last one). */
  const nearest = emptyWeek ? (dated.find((x) => x.date > days[4]) ?? dated.filter((x) => x.date < days[0]).at(-1)) : undefined;

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setWeek(startOfWeek(DEMO_TODAY))}>
          Aujourd&apos;hui
        </Button>
        <Button variant="secondary" aria-label="Période précédente" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" aria-label="Période suivante" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="min-w-52 text-xl font-bold text-ink-900">{mode === "semaine" ? formatWeekRange(days[0], days[4]) : formatMonth(week)}</h2>
        <div role="radiogroup" aria-label="Période affichée" className="flex rounded-lg border border-line bg-subtle p-1">
          {(["semaine", "mois"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn("h-9 cursor-pointer rounded-md px-6 text-sm font-medium", mode === m ? "bg-brand-600 text-white shadow-sm" : "text-ink-700 hover:bg-white")}
            >
              {m === "semaine" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Menu
            label="Filtres du planning"
            widthClass="w-72"
            triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            trigger={
              <>
                <Filter className="h-4 w-4" aria-hidden />
                Filtres
              </>
            }
            items={[
              ...(["activite", "reservation", "revue", "maintenance"] as PlanningKind[]).map((k) => ({
                label: `${kinds.includes(k) ? "✓ " : ""}${EVENT_STYLE[k].label === "Indisponible" ? "Maintenance" : EVENT_STYLE[k].label}`,
                onSelect: () => setKinds((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k])),
              })),
              {
                label: allProjects ? "✓ Tous les projets" : `Projet ${projectCode} uniquement`,
                description: allProjects ? "Cliquer pour n'afficher que le projet courant" : "Cliquer pour afficher tous les projets",
                onSelect: () => setAllProjects((v) => !v),
                separatorBefore: true,
              },
            ]}
          />
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setPlanKey((k) => k + 1);
              setPlanOpen(true);
            }}
          >
            Planifier une activité
          </Button>
        </div>
      </div>

      {emptyWeek && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-[15px] text-ink-700">
          <CalendarDays className="h-5 w-5 text-brand-600" aria-hidden />
          <span className="flex-1">
            Rien de planifié cette semaine{allProjects ? "" : ` pour ${projectCode}`}.
            {nearest ? ` ${nearest.date > days[4] ? "Prochaine date" : "Dernière date"} : ${nearest.title}, le ${formatLong(nearest.date)}.` : " Planifiez une activité pour remplir l'agenda."}
          </span>
          {nearest && (
            <Button variant="outline" onClick={() => setWeek(startOfWeek(nearest.date))}>
              Afficher cette semaine
            </Button>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {mode === "semaine" ? (
          <div className="relative overflow-x-auto rounded-xl border border-line">
            <div className="grid min-w-[760px] grid-cols-[64px_repeat(5,minmax(0,1fr))]">
              <div className="border-b border-line bg-subtle px-2 py-3 text-center text-sm font-semibold text-ink-700">Heure</div>
              {days.map((d) => {
                const focus = selected?.date === d;
                return (
                  <div
                    key={d}
                    className={cn("border-b border-l border-line px-2 py-3 text-center text-sm font-semibold", focus ? "bg-brand-100/70 text-brand-700" : "bg-subtle text-ink-700")}
                  >
                    {formatDayShort(d)}
                    {d === DEMO_TODAY && <span className="ml-1.5 rounded bg-brand-600 px-1.5 text-[11px] text-white">Aujourd&apos;hui</span>}
                  </div>
                );
              })}
              {weekDeadlines.length > 0 && (
                <>
                  <div className="flex items-center justify-center border-b border-line px-1 text-center text-[11px] font-semibold leading-tight text-ink-600">Jalons et échéances</div>
                  {days.map((d, i) => (
                    <div key={d} className="min-w-0 space-y-1 border-b border-l border-line p-1.5">
                      {weekDeadlines
                        // Week-end dates are shown on the Friday, with their date.
                        .filter((x) => x.date === d || (i === 4 && x.date > d))
                        .map((x) => (
                          <DeadlineChip key={x.id} item={x.date === d ? x : { ...x, title: `${x.title} (${formatNumeric(x.date).slice(0, 5)})` }} />
                        ))}
                    </div>
                  ))}
                </>
              )}
              <div>
                {hours.map((h) => (
                  <div key={h} className="border-b border-line/60 px-2 text-center text-xs text-ink-600" style={{ height: ROW, lineHeight: `${ROW}px` }}>
                    {h}
                  </div>
                ))}
              </div>
              {days.map((d) => (
                <div key={d} className={cn("relative border-l border-line", selected?.date === d && "bg-brand-50/40")}>
                  {hours.map((h) => (
                    <div key={h} className="border-b border-line/60" style={{ height: ROW }} />
                  ))}
                  {visible
                    .filter((e) => e.date === d)
                    .map((e) => {
                      const style = EVENT_STYLE[e.kind];
                      const Icon = KIND_ICONS[e.kind];
                      const top = ((toMinutes(e.start) - AGENDA_START) / 60) * ROW;
                      const height = Math.max(((toMinutes(e.end) - toMinutes(e.start)) / 60) * ROW - 4, 26);
                      const active = e.id === selectedId;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelectedId(e.id)}
                          className={cn(
                            "absolute inset-x-1 cursor-pointer overflow-hidden rounded-lg border-l-4 px-2.5 py-1.5 text-left text-xs shadow-sm transition-shadow hover:shadow-md",
                            style.card,
                            style.bar,
                            active && "ring-2 ring-brand-500",
                          )}
                          style={{ top: top + 2, height }}
                        >
                          <span className="block text-ink-700">
                            {e.start} – {e.end}
                          </span>
                          <span className="flex items-center gap-1.5 font-bold text-ink-900">
                            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{e.title}</span>
                          </span>
                          <span className="block truncate text-ink-600">{[e.projectCode, e.lotCode].filter(Boolean).join(" • ")}</span>
                          <span className="block truncate text-ink-600">{e.place}</span>
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
              {["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map((d) => (
                <div key={d} className="bg-subtle px-2 py-2 text-center font-semibold text-ink-700">
                  {d}
                </div>
              ))}
              {monthDays.map((d) => (
                <div key={d} className={cn("min-h-24 bg-white p-1.5", !d.startsWith(week.slice(0, 7)) && "bg-slate-50")}>
                  <p className={cn("text-xs font-semibold", d === DEMO_TODAY ? "text-brand-700" : "text-ink-500")}>{Number(d.slice(8))}</p>
                  <ul className="mt-1 space-y-1">
                    {deadlines
                      .filter((x) => x.date === d)
                      .map((x) => (
                        <li key={x.id}>
                          <DeadlineChip item={x} compact />
                        </li>
                      ))}
                    {visible
                      .filter((e) => e.date === d)
                      .map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(e.id);
                              setWeek(startOfWeek(e.date));
                              setMode("semaine");
                            }}
                            className={cn("w-full cursor-pointer truncate rounded border-l-2 px-1.5 py-0.5 text-left text-xs", EVENT_STYLE[e.kind].card, EVENT_STYLE[e.kind].bar)}
                          >
                            {e.start} {e.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {selected ? (
          <EventDetail
            event={selected}
            onClose={() => setSelectedId(null)}
            onEdit={() => {
              setEditing((k) => k + 1);
              setEditOpen(true);
            }}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-500">
            Sélectionnez un créneau pour afficher son détail.
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-ink-700">
        {(["activite", "reservation", "revue"] as PlanningKind[]).map((k) => (
          <span key={k} className="flex items-center gap-2">
            <span className={cn("h-3.5 w-3.5 rounded-full", EVENT_STYLE[k].dot)} aria-hidden />
            {EVENT_STYLE[k].label}
          </span>
        ))}
        {(Object.keys(DEADLINE_LOOK) as Deadline["kind"][]).map((k) => {
          const look = DEADLINE_LOOK[k];
          return (
            <span key={k} className="flex items-center gap-2">
              <look.icon className="h-4 w-4 text-ink-500" aria-hidden />
              {look.label}
            </span>
          );
        })}
      </div>
      {selected && <EditEventModal key={`edit-${editing}`} event={selected} open={editOpen} onClose={() => setEditOpen(false)} />}
      <PlanActivityDrawer
        key={`plan-${planKey}`}
        projectCode={projectCode}
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onCreated={(id, date) => {
          setWeek(startOfWeek(date));
          setSelectedId(id);
        }}
      />
    </Card>
  );
}

function Resources({ initialDay }: { initialDay: string }) {
  const state = useDemo();
  const router = useRouter();
  const [day, setDay] = useState(initialDay);
  const [category, setCategory] = useState("Tous");
  const [team, setTeam] = useState("Toutes");
  const [project, setProject] = useState("Tous");
  const [selectedId, setSelectedId] = useState("HPLC-01");
  const [listOpen, setListOpen] = useState(false);
  const order = ["HPLC-01", "HPLC-02", "MEL-01", "ANA-LAB"];
  const resources = state.resources
    .filter((r) => category === "Tous" || r.category === category)
    .filter((r) => team === "Toutes" || r.team === team)
    .filter((r) => project === "Tous" || state.events.some((e) => e.date === day && e.projectCode === project && e.resourceIds.includes(r.id)))
    .sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  const selected = state.resources.find((r) => r.id === selectedId) ?? resources[0];
  const next = selected ? nextAvailability(state, selected.id, day) : undefined;
  const nextEnd = next ? fromMinutes(Math.min(toMinutes(next) + 120, DAY_END)) : undefined;
  const bookings = selected ? state.events.filter((e) => e.resourceIds.includes(selected.id)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)) : [];
  const teams = [...new Set(state.resources.map((r) => r.team))];

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-subtle p-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))] lg:items-end">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
            <CalendarDays className="h-5 w-5 text-ink-600" aria-hidden />
            <span className="flex-1 font-medium text-ink-900">{formatWeekday(day)}</span>
            <button type="button" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))} className="cursor-pointer rounded p-1.5 text-ink-600 hover:bg-subtle">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Jour suivant" onClick={() => setDay(addDays(day, 1))} className="cursor-pointer rounded p-1.5 text-ink-600 hover:bg-subtle">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <label className="text-sm font-semibold text-ink-800">
            Type
            <Select className="mt-1" size="sm" options={[{ value: "Tous", label: "Tous" }, "Équipement", "Personnel"]} value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="text-sm font-semibold text-ink-800">
            Équipe
            <Select className="mt-1" size="sm" options={[{ value: "Toutes", label: "Toutes" }, ...teams]} value={team} onChange={(e) => setTeam(e.target.value)} />
          </label>
          <label className="text-sm font-semibold text-ink-800">
            Projet
            <Select className="mt-1" size="sm" options={[{ value: "Tous", label: "Tous" }, ...state.projects.map((p) => p.code)]} value={project} onChange={(e) => setProject(e.target.value)} />
          </label>
        </div>
        <div className="mt-4">
          <ResourceTimeline resources={resources} date={day} selectedId={selected?.id} onSelect={setSelectedId} />
        </div>
        <TimelineLegend />
      </div>

      {selected && (
        <Card className="h-fit p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-bold text-ink-900">{selected.name}</h3>
            <Menu
              label={`Actions pour ${selected.name}`}
              trigger={<EllipsisVertical className="h-5 w-5" />}
              triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50"
              items={[
                { label: "Voir les réservations", icon: List, onSelect: () => setListOpen(true) },
                { label: "Planning des équipements", icon: CalendarDays, href: `/projets/cs-01/planning?jour=${day}` },
              ]}
            />
          </div>
          <div className="mt-3 flex items-center gap-4">
            <ResourceTile resource={selected} />
            <div className="text-sm">
              <p className="text-lg font-bold text-ink-900">{selected.name}</p>
              <p className="text-ink-700">{selected.type}</p>
              <p className="text-ink-500">{selected.team}</p>
            </div>
          </div>
          <div className="mt-4 space-y-4 border-t border-line pt-4 text-sm">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-5 w-5 text-ink-600" aria-hidden />
              <div>
                <p className="font-semibold text-ink-900">Propriétaire</p>
                <p className="text-ink-600">{selected.owner}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-line pt-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-ink-600" aria-hidden />
              <div>
                <p className="font-semibold text-ink-900">Statut de qualification</p>
                <p className={cn("flex items-center gap-1.5 font-semibold", selected.qualification.status === "À vérifier" ? "text-warn-700" : "text-success-700")}>
                  {selected.qualification.status === "À vérifier" && <TriangleAlert className="h-4 w-4 fill-warn-500 text-white" aria-hidden />}
                  {selected.qualification.status}
                </p>
                <p className="text-ink-600">Prochaine vérification : {formatNumeric(selected.qualification.next)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-line pt-4">
              <Clock className="mt-0.5 h-5 w-5 text-ink-600" aria-hidden />
              <div>
                <p className="font-semibold text-ink-900">Prochaine disponibilité</p>
                <p className="text-2xl font-bold text-ink-900">{next ?? "—"}</p>
                <p className="text-ink-600">{next ? `${day === DEMO_TODAY ? "Aujourd'hui" : formatWeekday(day)}, ${formatNumeric(day)}` : "Aucun créneau libre ce jour"}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <Button
              size="lg"
              className="w-full"
              icon={<CalendarDays className="h-5 w-5" />}
              guide={selected.id === "HPLC-01" ? 33 : undefined}
              disabled={!next}
              onClick={() => {
                const params = new URLSearchParams({ ressource: selected.id, date: day, debut: next ?? "09:00", fin: nextEnd ?? "11:00" });
                router.push(`/planning/reservation?${params.toString()}`);
              }}
            >
              Réserver
            </Button>
            <Button variant="outline" size="lg" className="w-full" icon={<List className="h-5 w-5" />} onClick={() => setListOpen(true)}>
              Voir les réservations
            </Button>
          </div>
          <Modal open={listOpen} onClose={() => setListOpen(false)} size="md" title={`Réservations — ${selected.name}`} subtitle={selected.label}>
            {bookings.length === 0 ? (
              <p className="text-sm text-ink-500">Aucune réservation.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {bookings.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className={cn("h-3 w-3 rounded-full", EVENT_STYLE[b.kind].dot)} aria-hidden />
                    <span className="flex-1">
                      <span className="block font-semibold text-ink-900">{b.title}</span>
                      <span className="block text-ink-500">{b.projectCode ?? "—"}</span>
                    </span>
                    <span className="text-right text-ink-700">
                      {formatNumeric(b.date)}
                      <span className="block text-ink-500">
                        {b.start} – {b.end}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Modal>
        </Card>
      )}
    </div>
  );
}

function Workload({ week }: { week: string }) {
  const state = useDemo();
  const [from, setFrom] = useState(startOfWeek(week));
  const to = addDays(from, 4);
  const capacity = (DAY_END - DAY_START) / 60 * 5;
  const rows = state.resources.map((r) => {
    const minutes = state.events
      .filter((e) => e.resourceIds.includes(r.id) && e.date >= from && e.date <= to)
      .reduce((sum, e) => sum + toMinutes(e.end) - toMinutes(e.start), 0);
    return { r, hours: minutes / 60 };
  });
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" aria-label="Semaine précédente" onClick={() => setFrom(addDays(from, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" aria-label="Semaine suivante" onClick={() => setFrom(addDays(from, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold text-ink-900">Charge du {formatWeekRange(from, to)}</h2>
        <span className="ml-auto text-sm text-ink-500">Capacité : {capacity} h par ressource (5 jours × 10 h)</span>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map(({ r, hours }) => {
          const ratio = Math.min(hours / capacity, 1);
          return (
            <li key={r.id} className="grid grid-cols-[180px_minmax(0,1fr)_70px] items-center gap-3 text-sm">
              <span className="truncate font-medium text-ink-900">{r.name}</span>
              <span className="h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Charge ${r.name}`}>
                <span className={cn("block h-full rounded-full", ratio > 0.8 ? "bg-danger-500" : ratio > 0.5 ? "bg-warn-500" : "bg-brand-500")} style={{ width: `${Math.max(ratio * 100, hours ? 3 : 0)}%` }} />
              </span>
              <span className="text-right tabular-nums text-ink-700">{hours.toString().replace(".", ",")} h</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function PlanningView({ slug, initialTab, week, day, eventId }: { slug: string; initialTab: PlanningTab; week: string; day: string; eventId?: string }) {
  const state = useDemo();
  const project = findProject(state, slug) ?? state.projects[0];
  const [tab, setTab] = useState<PlanningTab>(initialTab);
  if (!project) {
    return <NoProject title="Planning" subtitle="Agenda de l'équipe, ressources et réservations." description="Le planning s'organise autour des projets : créez un premier projet pour planifier des activités et réserver des ressources." />;
  }
  const pilot = state.lots.find((l) => l.projectCode === project.code && l.type === "Pilote");

  return (
    <>
      <ProjectContextHeader
        project={project}
        crumbs={[{ label: "Planning" }]}
        switchHref={(s) => `/planning?projet=${s}`}
        extraMeta={tab === "ressources" && pilot ? [<span key="f">Formule : {pilot.formula}</span>, <span key="l">Lot pilote : {pilot.code}</span>] : []}
      />
      <h2 className="mt-6 text-[28px] font-extrabold tracking-tight text-ink-900">
        {tab === "agenda" ? "Planning de l'équipe" : tab === "ressources" ? "Disponibilité des ressources" : "Charge de l'équipe"}
      </h2>
      <Tabs
        className="mt-2"
        items={[
          { value: "agenda", label: "Agenda" },
          { value: "ressources", label: "Ressources", guide: 32 },
          { value: "charge", label: "Charge" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "agenda" && <Agenda projectCode={project.code} initialWeek={week} initialEventId={eventId} />}
      {tab === "ressources" && <Resources initialDay={day} />}
      {tab === "charge" && <Workload week={week} />}
      {tab === "agenda" ? (
        <ScreenRef n={31} label="Planning — agenda de l'équipe" />
      ) : tab === "ressources" ? (
        <ScreenRef n={32} label="Planning — ressources et disponibilités" />
      ) : (
        <ScreenRef label="Planning — charge de l'équipe" />
      )}
    </>
  );
}
