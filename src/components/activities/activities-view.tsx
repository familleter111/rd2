"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Download,
  EllipsisVertical,
  FileText,
  List,
  ListChecks,
  Paperclip,
  Play,
  Plus,
  RotateCcw,
  User,
  UserRoundPen,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { PageHeader, ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, addDays, daysBetween, downloadText, formatMonth, formatNumeric, formatShort, startOfWeek } from "@/lib/format";
import { activityState } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { Activity, ActivityState } from "@/lib/types";
import { ReassignModal, STATE_LABEL, completionBlocker, dueLabel, isUrgent, useAssignees } from "./activity-bits";

const DUE_FILTERS = [
  { value: "toutes", label: "Toutes les échéances" },
  { value: "retard", label: "En retard" },
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "semaine", label: "7 prochains jours" },
  { value: "plus-tard", label: "Plus tard" },
];

function matchesDue(a: Activity, filter: string) {
  const n = daysBetween(DEMO_TODAY, a.due);
  if (filter === "retard") return n < 0 && !a.done;
  if (filter === "aujourdhui") return n === 0;
  if (filter === "semaine") return n >= 0 && n <= 7;
  if (filter === "plus-tard") return n > 7;
  return true;
}

function ActivityRow({ activity, selected, onSelect }: { activity: Activity; selected: boolean; onSelect: () => void }) {
  const state = useDemo();
  const project = state.projects.find((p) => p.code === activity.projectCode);
  const blocker = completionBlocker(state, activity);
  return (
    <li
      className={cn(
        "rounded-xl border bg-white p-4 shadow-card transition-colors",
        selected ? "border-brand-500 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={activity.done ? `${activity.title} : terminée` : `Marquer « ${activity.title} » comme terminée`}
          disabled={activity.done}
          onClick={() => {
            if (blocker) {
              toast.show({ title: "Activité non terminée", description: blocker, tone: "warn" });
              return;
            }
            labActions.completeActivity(activity.id);
            toast.show({ title: "Activité terminée", description: activity.title });
          }}
          className={cn(
            "mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-full border-2 transition-colors disabled:cursor-default",
            activity.done ? "border-success-500 bg-success-500" : "border-line-strong hover:border-brand-500",
          )}
        />
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span className={cn("text-[16px] font-bold text-ink-900", activity.done && "text-ink-500 line-through")}>{activity.title}</span>
            <Badge tone={activity.status.tone} dot={activity.status.tone !== "danger"} icon={activity.status.tone === "danger" ? CircleAlert : undefined}>
              {activity.status.label}
            </Badge>
          </span>
          <span className="mt-0.5 block text-sm text-ink-600">
            <strong className="font-semibold text-ink-800">{activity.projectCode}</strong> • {project?.name}
            {activity.context && (
              <>
                <span className="mx-2 text-ink-300">|</span>
                {activity.context}
              </>
            )}
          </span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 pl-9 text-sm text-ink-700">
        <span className="flex items-center gap-2">
          <User className="h-4 w-4 text-ink-500" aria-hidden />
          {activity.owner}
        </span>
        <span className={cn("flex items-center gap-2", !activity.done && activity.due < DEMO_TODAY && "text-danger-600")}>
          <CalendarDays className="h-4 w-4 text-ink-500" aria-hidden />
          {formatShort(activity.due)}
        </span>
        <LinkButton href={`/activites/${activity.id}`} variant="outline" className="ml-auto min-w-32" guide={activity.id === "act-lp01" ? 30 : undefined}>
          Ouvrir
        </LinkButton>
      </div>
    </li>
  );
}

function Group({ title, tone, icon: Icon, children }: { title: string; tone: "danger" | "warn" | "neutral"; icon: typeof Clock; children: ReactNode }) {
  return (
    <section>
      <h3
        className={cn(
          "flex items-center gap-2 rounded-lg px-4 py-2.5 text-[17px] font-semibold",
          tone === "danger" ? "bg-danger-50 text-danger-700" : tone === "warn" ? "bg-warn-50 text-warn-700" : "bg-slate-100 text-ink-800",
        )}
      >
        <Icon className={cn("h-5 w-5", tone === "danger" && "fill-danger-600 text-white")} aria-hidden />
        {title}
      </h3>
      <ul className="mt-2 space-y-2">{children}</ul>
    </section>
  );
}

function DetailPanel({ activity }: { activity: Activity }) {
  const state = useDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reassign, setReassign] = useState(false);
  const project = state.projects.find((p) => p.code === activity.projectCode);
  const blocker = completionBlocker(state, activity);
  const current = activityState(activity);
  const n = daysBetween(DEMO_TODAY, activity.due);
  const docs = activity.documents ?? [];

  return (
    <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 text-2xl font-bold text-ink-900">{activity.title}</h2>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={activity.status.tone} icon={activity.status.tone === "danger" ? CircleAlert : undefined} dot={activity.status.tone !== "danger"} size="md">
            {activity.status.label}
          </Badge>
          <Menu
            label="Actions de l'activité"
            trigger={<EllipsisVertical className="h-5 w-5" />}
            triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50"
            items={[
              { label: "Ouvrir la fiche", icon: FileText, href: `/activites/${activity.id}` },
              { label: "Réaffecter", icon: UserRoundPen, onSelect: () => setReassign(true) },
              ...(activity.href ? [{ label: "Ouvrir l'objet lié", icon: ChevronRight, href: activity.href }] : []),
            ]}
          />
        </div>
      </div>
      <p className="mt-1 text-[15px] text-ink-600">
        <strong className="font-semibold text-ink-800">{activity.projectCode}</strong> • {project?.name}
        {activity.context && (
          <>
            <span className="mx-2 text-ink-300">|</span>
            {activity.context}
          </>
        )}
      </p>

      <div className="mt-5 space-y-4 text-[15px]">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
          <div>
            <p className="font-semibold text-ink-900">Description</p>
            <p className="text-ink-600">{activity.description ?? activity.detail}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">Responsable</p>
              <p className="text-ink-600">{activity.owner}</p>
              {activity.ownerRole && <p className="text-sm text-ink-500">{activity.ownerRole}</p>}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">Échéance</p>
              <p className="text-ink-600">
                {formatShort(activity.due)}{" "}
                {!activity.done && <span className={cn(n <= 2 ? "text-danger-600" : "text-ink-500")}>({dueLabel(activity.due)})</span>}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-ink-500" aria-hidden />
          <p className="font-semibold text-ink-900">Statut</p>
          <Badge tone={activity.status.tone} icon={activity.status.tone === "danger" ? CircleAlert : undefined} dot={activity.status.tone !== "danger"} size="md">
            {activity.status.label}
          </Badge>
        </div>
      </div>

      {(activity.prerequisiteNote || blocker) && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="flex items-center gap-3 font-semibold text-ink-900">
            <ListChecks className="h-5 w-5 text-ink-500" aria-hidden />
            Prérequis
          </p>
          <div className="mt-2 flex items-start gap-3 rounded-xl bg-subtle p-4 text-sm">
            <CircleAlert className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
            <div>
              <p className="font-medium text-ink-900">{activity.prerequisiteNote?.title ?? blocker}</p>
              {activity.prerequisiteNote && <p className="text-ink-600">{activity.prerequisiteNote.detail}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-3 font-semibold text-ink-900">
            <FileText className="h-5 w-5 text-ink-500" aria-hidden />
            Documents associés ({docs.length})
          </p>
          <Button variant="outline" size="sm" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
            Ajouter un document
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                labActions.addActivityDocument(activity.id, { name: file.name, type: "Pièce jointe" });
                toast.show({ title: "Document ajouté", description: file.name });
              }
              e.target.value = "";
            }}
          />
        </div>
        {docs.length > 0 && (
          <ul className="mt-2 space-y-2">
            {docs.map((d) => (
              <li key={d.name} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-semibold text-ink-900">{d.name}</span>
                  <span className="block text-ink-500">
                    {d.type} • {formatNumeric(d.date)}
                  </span>
                </span>
                <Menu
                  label={`Actions pour ${d.name}`}
                  items={[
                    {
                      label: "Télécharger",
                      icon: Download,
                      onSelect: () => {
                        downloadText(`${d.name}.txt`, `${d.name}\n${d.type}\nDocument de démonstration.`);
                        toast.show({ title: "Téléchargement lancé", description: d.name });
                      },
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!activity.done && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {current === "a-faire" ? (
            <Button
              size="lg"
              icon={<Play className="h-5 w-5" />}
              onClick={() => {
                labActions.startActivity(activity.id);
                toast.show({ title: "Activité démarrée", description: activity.title });
              }}
            >
              Démarrer
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={Boolean(blocker)}
              title={blocker ?? undefined}
              onClick={() => {
                labActions.completeActivity(activity.id);
                toast.show({
                  title: "Activité terminée",
                  description: activity.kind === "correction" ? "Le chromatogramme est joint et les résultats sont resoumis pour revue." : activity.title,
                });
              }}
            >
              Terminer
            </Button>
          )}
          <Button variant="outline" size="lg" icon={<Users className="h-5 w-5" />} onClick={() => setReassign(true)}>
            Réaffecter
          </Button>
        </div>
      )}
      <ReassignModal key={`${activity.id}-${activity.owner}-${reassign}`} activity={activity} open={reassign} onClose={() => setReassign(false)} />
    </Card>
  );
}

function CalendarView({ activities, onSelect }: { activities: Activity[]; onSelect: (id: string) => void }) {
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const first = `${month}-01`;
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <Card className="mt-5 p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setMonth(DEMO_TODAY.slice(0, 7))}>
          Aujourd&apos;hui
        </Button>
        <Button variant="secondary" size="sm" aria-label="Mois précédent" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" aria-label="Mois suivant" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold capitalize text-ink-900">{formatMonth(first)}</h2>
      </div>
      <div className="relative mt-3 overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
          {["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map((d) => (
            <div key={d} className="bg-subtle px-2 py-2 text-center font-semibold text-ink-700">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const items = activities.filter((a) => a.due === day);
            const inMonth = day.startsWith(month);
            return (
              <div key={day} className={cn("min-h-24 bg-white p-1.5", !inMonth && "bg-slate-50 text-ink-400", day === DEMO_TODAY && "bg-brand-50")}>
                <p className={cn("mb-1 text-xs font-semibold", day === DEMO_TODAY ? "text-brand-700" : "text-ink-500")}>{Number(day.slice(8))}</p>
                <ul className="space-y-1">
                  {items.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(a.id)}
                        className={cn(
                          "w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-xs font-medium",
                          a.done ? "bg-success-50 text-success-700" : isUrgent(a) ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-700",
                        )}
                        title={a.title}
                      >
                        {a.title}
                      </button>
                    </li>
                  ))}
                  {items.length > 3 && <li className="text-xs text-ink-500">+ {items.length - 3} autre(s)</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function NewActivityDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const ASSIGNEES = useAssignees();
  const { projects } = useDemo();
  const active = projects.filter((p) => !p.archived);
  const [projectCode, setProjectCode] = useState(active[0]?.code ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState(ASSIGNEES[0].name);
  const [due, setDue] = useState(addDays(DEMO_TODAY, 3));
  const [context, setContext] = useState("");
  const [priority, setPriority] = useState<"Normale" | "Haute">("Normale");
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    title: title.trim().length < 3 ? "Renseignez l'intitulé de l'activité." : null,
    due: !due ? "Indiquez une échéance." : due < DEMO_TODAY ? "L'échéance ne peut pas être passée." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nouvelle activité"
      subtitle="Créer une activité et l'affecter à un membre de l'équipe."
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
              const id = `act-${Date.now().toString(36)}`;
              const person = ASSIGNEES.find((p) => p.name === owner);
              labActions.createActivity({
                id,
                projectCode,
                title: title.trim(),
                description: description.trim() || title.trim(),
                owner,
                ownerRole: person?.role,
                due,
                context: context.trim() || undefined,
                priority,
              });
              toast.show({ title: "Activité créée", description: `${title.trim()} — ${owner}, échéance ${formatNumeric(due)}.` });
              onCreated(id);
              onClose();
            }}
          >
            Créer l&apos;activité
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Projet" required htmlFor="na-project">
          <Select id="na-project" options={active.map((p) => ({ value: p.code, label: `${p.code} • ${p.name}` }))} value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
        </Field>
        <Field label="Intitulé" required htmlFor="na-title" error={show(errors.title)}>
          <Input id="na-title" placeholder="Ex. Relire le rapport d'essai" value={title} invalid={Boolean(show(errors.title))} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Objet concerné" htmlFor="na-context" optional>
          <Input id="na-context" placeholder="Ex. Lot E-02, Essai ECH-01" value={context} onChange={(e) => setContext(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="na-desc" optional>
          <Textarea id="na-desc" rows={3} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsable" required htmlFor="na-owner">
            <Select id="na-owner" options={ASSIGNEES.map((p) => ({ value: p.name, label: p.name }))} value={owner} onChange={(e) => setOwner(e.target.value)} />
          </Field>
          <Field label="Échéance" required htmlFor="na-due" error={show(errors.due)}>
            <DateInput id="na-due" value={due} onChange={setDue} invalid={Boolean(show(errors.due))} />
          </Field>
        </div>
        <Field label="Priorité">
          <Segmented label="Priorité" options={[{ value: "Normale", label: "Normale" }, { value: "Haute", label: "Haute" }]} value={priority} onChange={setPriority} />
        </Field>
      </div>
    </Drawer>
  );
}

export function ActivitiesView({ initialTab, initialId }: { initialTab: ActivityState; initialId?: string }) {
  const state = useDemo();
  const [tab, setTab] = useState<ActivityState>(initialTab);
  const [view, setView] = useState<"liste" | "calendrier">("liste");
  const [project, setProject] = useState("Tous");
  const [owner, setOwner] = useState("Tous");
  const [due, setDue] = useState("toutes");
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [drawer, setDrawer] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = state.activities
    .filter((a) => project === "Tous" || a.projectCode === project)
    .filter((a) => owner === "Tous" || a.owner === owner)
    .filter((a) => matchesDue(a, due));
  const counts = (["a-faire", "en-cours", "en-revue", "terminee"] as ActivityState[]).map((s) => filtered.filter((a) => activityState(a) === s).length);
  const list = filtered.filter((a) => activityState(a) === tab).sort((a, b) => (tab === "terminee" ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due)));
  const urgent = list.filter((a) => isUrgent(a)).sort((a, b) => Number(b.kind === "correction") - Number(a.kind === "correction"));
  const today = list.filter((a) => !isUrgent(a) && a.due === DEMO_TODAY);
  const upcoming = list.filter((a) => !isUrgent(a) && a.due !== DEMO_TODAY);
  const ordered = tab === "terminee" ? list : [...urgent, ...today, ...upcoming];
  const selected = state.activities.find((a) => a.id === selectedId) ?? ordered[0];
  const owners = [...new Set(state.activities.map((a) => a.owner))].sort((a, b) => a.localeCompare(b, "fr"));
  const filteredOn = project !== "Tous" || owner !== "Tous" || due !== "toutes";

  const row = (a: Activity) => <ActivityRow key={a.id} activity={a} selected={a.id === selected?.id} onSelect={() => setSelectedId(a.id)} />;

  return (
    <>
      <PageHeader
        title="Mes activités"
        subtitle="Suivez et gérez vos activités liées aux projets, essais et lots."
        actions={
          <>
            <div role="radiogroup" aria-label="Affichage" className="flex rounded-xl border border-line bg-white p-1 shadow-card">
              {[
                { value: "liste" as const, label: "Liste", icon: List },
                { value: "calendrier" as const, label: "Calendrier", icon: CalendarDays },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={view === o.value}
                  onClick={() => setView(o.value)}
                  className={cn(
                    "flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-[15px] font-medium",
                    view === o.value ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-ink-700 hover:bg-subtle",
                  )}
                >
                  <o.icon className="h-5 w-5" aria-hidden />
                  {o.label}
                </button>
              ))}
            </div>
            <Button
              size="lg"
              icon={<Plus className="h-5 w-5" />}
              onClick={() => {
                setDrawer((k) => k + 1);
                setDrawerOpen(true);
              }}
            >
              Nouvelle activité
            </Button>
          </>
        }
      />
      <Tabs
        className="mt-5"
        items={(["a-faire", "en-cours", "en-revue", "terminee"] as ActivityState[]).map((s, i) => ({ value: s, label: STATE_LABEL[s], count: counts[i] }))}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelectedId(null);
        }}
      />

      <div className="mt-5 grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <Card className="px-4 py-3">
          <label className="text-sm font-semibold text-ink-800">
            Projet
            <Select className="mt-1" size="sm" options={[{ value: "Tous", label: "Tous les projets" }, ...state.projects.map((p) => ({ value: p.code, label: `${p.code} • ${p.name}` }))]} value={project} onChange={(e) => setProject(e.target.value)} />
          </label>
        </Card>
        <Card className="px-4 py-3">
          <label className="text-sm font-semibold text-ink-800">
            Responsable
            <Select className="mt-1" size="sm" options={[{ value: "Tous", label: "Tous les responsables" }, ...owners]} value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
        </Card>
        <Card className="px-4 py-3">
          <label className="text-sm font-semibold text-ink-800">
            Échéance
            <Select className="mt-1" size="sm" options={DUE_FILTERS} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </Card>
        <button
          type="button"
          disabled={!filteredOn}
          onClick={() => {
            setProject("Tous");
            setOwner("Tous");
            setDue("toutes");
          }}
          className="flex h-12 cursor-pointer items-center gap-2 px-3 text-[15px] font-semibold text-brand-700 hover:underline disabled:cursor-default disabled:text-ink-400 disabled:no-underline"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Réinitialiser les filtres
        </button>
      </div>

      {view === "calendrier" ? (
        <CalendarView
          activities={filtered}
          onSelect={(id) => {
            const a = state.activities.find((x) => x.id === id);
            if (a) setTab(activityState(a));
            setSelectedId(id);
            setView("liste");
          }}
        />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <Card className="min-w-0 p-3 sm:p-4">
            {ordered.length === 0 ? (
              <EmptyState icon={ListChecks} title="Aucune activité" description={filteredOn ? "Aucune activité ne correspond aux filtres." : "Rien dans cette colonne pour le moment."} />
            ) : tab === "terminee" ? (
              <Group title={`Terminées (${list.length})`} tone="neutral" icon={ListChecks}>
                {list.map(row)}
              </Group>
            ) : (
              <div className="space-y-4">
                {urgent.length > 0 && (
                  <Group title={`Urgentes (${urgent.length})`} tone="danger" icon={CircleAlert}>
                    {urgent.map(row)}
                  </Group>
                )}
                {today.length > 0 && (
                  <Group title={`Aujourd'hui (${today.length})`} tone="warn" icon={Clock}>
                    {today.map(row)}
                  </Group>
                )}
                {upcoming.length > 0 && (
                  <Group title={`À venir (${upcoming.length})`} tone="neutral" icon={CalendarDays}>
                    {upcoming.map(row)}
                  </Group>
                )}
              </div>
            )}
          </Card>
          {selected ? (
            <DetailPanel key={selected.id} activity={selected} />
          ) : (
            <Card>
              <EmptyState icon={FileText} title="Sélectionnez une activité" />
            </Card>
          )}
        </div>
      )}
      <p className="mt-3 text-sm text-ink-500">
        <Link href="/planning" className="font-semibold text-brand-700 hover:underline">
          Voir le planning de l&apos;équipe
        </Link>
      </p>
      <NewActivityDrawer
        key={`na-${drawer}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={(id) => {
          setTab("a-faire");
          setSelectedId(id);
        }}
      />
      <ScreenRef n={29} label="Mes activités — liste et priorités" />
    </>
  );
}
