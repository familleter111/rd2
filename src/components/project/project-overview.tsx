"use client";

import {
  Archive,
  Box,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FlaskConical,
  FolderOpen,
  Goal,
  History,
  Plus,
  Settings,
  SquareArrowOutUpRight,
  SquareCheck,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { completionBlocker } from "@/components/activities/activity-bits";
import { WorkSteps } from "@/components/activities/activity-work";
import { JourneyStrip } from "@/components/project-bits";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { PEOPLE, STATUS_OPTIONS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, addDays, formatDateTime, formatLong, formatShort, formatTime, formatWeekday, relativeDue } from "@/lib/format";
import { workSteps } from "@/lib/lab-selectors";
import { findProject } from "@/lib/selectors";
import { actions, labActions, useDemo } from "@/lib/store";
import type { Activity, GlobalStatus, HistoryEvent, Project } from "@/lib/types";
import { ProjectTabs } from "./project-frame";

const ACTIVITY_ICONS: Record<Activity["icon"], LucideIcon> = {
  doc: FileText,
  box: Box,
  flask: FlaskConical,
  review: ClipboardCheck,
};

export const EVENT_ICONS: Record<HistoryEvent["icon"], LucideIcon> = {
  edit: FileText,
  doc: FileText,
  flask: FlaskConical,
  box: Box,
  check: SquareCheck,
  send: SquareArrowOutUpRight,
  folder: FileText,
  calendar: CalendarDays,
  alert: TriangleAlert,
  chart: ChartNoAxesColumn,
};

function ActivityRow({ activity, onOpen }: { activity: Activity; onOpen: () => void }) {
  const Icon = ACTIVITY_ICONS[activity.icon];
  const isToday = activity.due === DEMO_TODAY;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full cursor-pointer flex-col gap-3 rounded-xl border border-line p-4 text-left transition-colors hover:border-brand-200 hover:bg-subtle/60 sm:flex-row sm:items-center",
          activity.done && "opacity-60",
        )}
      >
        <IconTile icon={Icon} size="lg" className="bg-brand-50 text-brand-600" />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[17px] font-bold text-ink-900", activity.done && "line-through")}>{activity.title}</span>
          <span className="block text-sm text-ink-600">{activity.detail}</span>
          <span className="mt-2 flex flex-wrap gap-2">
            {activity.tags.map((t) => (
              <span key={t} className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                {t}
              </span>
            ))}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-4 border-line sm:w-60 sm:border-l sm:pl-5">
          <span className="flex-1 space-y-1.5">
            {activity.done ? (
              <Badge tone="success" icon>
                Terminée
              </Badge>
            ) : (
              <Badge tone={activity.status.tone} dot size="md">
                {activity.status.label}
              </Badge>
            )}
            <span className={cn("flex items-center gap-2 text-sm", isToday ? "text-danger-600" : "text-ink-700")}>
              <CalendarDays className="h-4 w-4" aria-hidden />
              {isToday ? "Aujourd'hui" : formatLong(activity.due)}
            </span>
            <span className="flex items-center gap-2 text-sm text-ink-700">
              <User className="h-4 w-4 text-ink-500" aria-hidden />
              {activity.owner}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-ink-500" aria-hidden />
        </span>
      </button>
    </li>
  );
}

/**
 * Panel of an activity. An activity created with the project (scoping, galenic or analytical
 * planning) is done in the application: the panel lists its steps and leads to the work, and
 * the activity can only be closed once they are done. Other activities are simple tasks.
 */
function ActivityDrawer({ activity, onClose }: { activity: Activity | null; onClose: () => void }) {
  const state = useDemo();
  const steps = activity ? workSteps(state, activity) : [];
  const blocker = activity ? completionBlocker(state, activity) : null;
  const guided = steps.length > 0;
  const href = activity ? `/activites/${activity.id}` : "#";
  return (
    <Drawer
      open={Boolean(activity)}
      onClose={onClose}
      title={activity?.title ?? ""}
      subtitle={activity?.detail}
      widthClass={guided ? "max-w-[600px]" : undefined}
      footer={
        activity && (
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Fermer
            </Button>
            <LinkButton href={href} variant="outline" size="lg">
              Ouvrir l&apos;activité
            </LinkButton>
            {guided && !activity.done ? (
              <Button
                size="lg"
                icon={<SquareCheck className="h-5 w-5" />}
                disabled={Boolean(blocker)}
                className="disabled:bg-slate-300"
                onClick={() => {
                  labActions.completeActivity(activity.id);
                  toast.show(
                    activity.kind === "cadrage"
                      ? { title: "Cadrage validé", description: `${activity.projectCode} passe en faisabilité : la revue de lancement est la prochaine étape.` }
                      : { title: "Activité terminée", description: activity.title },
                  );
                  onClose();
                }}
              >
                {activity.kind === "cadrage" ? "Valider le cadrage" : "Terminer l'activité"}
              </Button>
            ) : (
              <Button
                size="lg"
                icon={<SquareCheck className="h-5 w-5" />}
                onClick={() => {
                  actions.toggleActivity(activity.id);
                  toast.show({ title: activity.done ? "Activité rouverte" : "Activité terminée", description: activity.title });
                  onClose();
                }}
              >
                {activity.done ? "Rouvrir l'activité" : "Marquer comme terminée"}
              </Button>
            )}
          </div>
        )
      }
    >
      {activity && (
        <>
          <dl className="divide-y divide-line">
            {[
              ["Statut", activity.done ? "Terminée" : activity.status.label],
              ["Échéance", `${formatLong(activity.due)} — ${relativeDue(activity.due)}`],
              ["Responsable", activity.owner],
              ["Étiquettes", activity.tags.join(", ")],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-3 py-3 text-[15px]">
                <dt className="text-ink-500">{k}</dt>
                <dd className="text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
          {guided && (
            <section className="mt-5">
              <h3 className="text-lg font-bold text-ink-900">Travail à réaliser</h3>
              <p className="mt-1 text-sm text-ink-600">
                Cette activité se réalise dans l&apos;application : chaque étape se coche d&apos;elle-même dès que le travail est enregistré.
              </p>
              <div className="mt-3">
                <WorkSteps activity={activity} ficheHref={href} />
              </div>
              {blocker && !activity.done && <p className="mt-3 rounded-xl bg-subtle px-4 py-3 text-sm text-ink-700">{blocker}</p>}
            </section>
          )}
        </>
      )}
    </Drawer>
  );
}

const ACTIVITY_TYPES: { value: Activity["icon"]; label: string }[] = [
  { value: "flask", label: "Essai" },
  { value: "box", label: "Approvisionnement" },
  { value: "review", label: "Revue" },
  { value: "doc", label: "Document" },
];

function AddActivityDrawer({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState<Activity["icon"]>("flask");
  const [due, setDue] = useState(addDays(DEMO_TODAY, 1));
  const [owner, setOwner] = useState(project.owner);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    title: !title.trim() ? "Renseignez l'intitulé de l'activité." : null,
    due: !due ? "Choisissez une échéance." : null,
  };
  const valid = !errors.title && !errors.due;

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    actions.addActivity({
      projectCode: project.code,
      title: title.trim(),
      detail: detail.trim(),
      tag: ACTIVITY_TYPES.find((t) => t.value === type)!.label,
      due,
      owner,
      icon: type,
    });
    toast.show({ title: "Activité ajoutée", description: `${title.trim()} — échéance ${formatLong(due)}.` });
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ajouter une activité"
      subtitle={`${project.code} • ${project.name}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" onClick={submit}>
            Ajouter l&apos;activité
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Intitulé" required htmlFor="act-title" error={submitted ? errors.title : null}>
          <Input id="act-title" data-autofocus value={title} placeholder="Ex. Lancer la dissolution F2" invalid={submitted && Boolean(errors.title)} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="act-detail" optional>
          <Textarea id="act-detail" rows={3} maxLength={300} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
        <Field label="Type" htmlFor="act-type">
          <Select id="act-type" options={ACTIVITY_TYPES} value={type} onChange={(e) => setType(e.target.value as Activity["icon"])} />
        </Field>
        <Field label="Échéance" required htmlFor="act-due" error={submitted ? errors.due : null}>
          <DateInput id="act-due" value={due} onChange={setDue} invalid={submitted && Boolean(errors.due)} />
        </Field>
        <Field label="Responsable" htmlFor="act-owner">
          <Select id="act-owner" options={PEOPLE} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}

const PHASES = ["Cadrage", "Faisabilité", "Essais en cours", "Stabilité", "Transfert"];

function ConfigureDrawer({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [owner, setOwner] = useState(project.owner);
  const [phase, setPhase] = useState(project.phase);
  const [nextStep, setNextStep] = useState(project.nextStep);
  const [targetDate, setTargetDate] = useState(project.targetDate);
  const [status, setStatus] = useState<GlobalStatus>(project.globalStatus);
  const [submitted, setSubmitted] = useState(false);
  const nameError = !name.trim() ? "Renseignez le nom du projet." : null;

  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    const changes: string[] = [];
    if (name.trim() !== project.name) changes.push(`nom : ${project.name} → ${name.trim()}`);
    if (owner !== project.owner) changes.push(`chef de projet : ${owner}`);
    if (phase !== project.phase) changes.push(`phase : ${project.phase} → ${phase}`);
    if (nextStep !== project.nextStep) changes.push(`prochaine étape : ${nextStep}`);
    if (targetDate !== project.targetDate) changes.push(`date cible : ${formatLong(targetDate)}`);
    if (status !== project.globalStatus) changes.push(`statut : ${project.globalStatus} → ${status}`);
    if (!changes.length) return onClose();
    actions.updateProject(
      project.code,
      {
        name: name.trim(),
        owner,
        phase,
        nextStep,
        targetDate,
        globalStatus: status,
        team: project.team.map((m) => (m.role === "Chef de projet" ? { ...m, person: owner } : m)),
      },
      `Modifications — ${changes.join(" ; ")}.`,
    );
    toast.show({ title: "Configuration enregistrée", description: `${changes.length} modification(s) tracée(s) dans l'historique.` });
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Configurer le projet"
      subtitle={`${project.code} • ${project.name}`}
      icon={<Settings className="mt-1.5 h-6 w-6 text-ink-800" strokeWidth={1.8} aria-hidden />}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" onClick={save}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Nom du projet" required htmlFor="cfg-name" error={submitted ? nameError : null}>
          <Input id="cfg-name" value={name} invalid={submitted && Boolean(nameError)} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Chef de projet" htmlFor="cfg-owner">
          <Select id="cfg-owner" options={PEOPLE} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
        <Field label="Phase actuelle" htmlFor="cfg-phase">
          <Select id="cfg-phase" options={[...new Set([project.phase, ...PHASES])]} value={phase} onChange={(e) => setPhase(e.target.value)} />
        </Field>
        <Field label="Prochaine étape" htmlFor="cfg-next">
          <Input id="cfg-next" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
        </Field>
        <Field label="Date cible" htmlFor="cfg-target">
          <DateInput id="cfg-target" value={targetDate} onChange={setTargetDate} />
        </Field>
        <Field label="Statut global" htmlFor="cfg-status">
          <Select id="cfg-status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value as GlobalStatus)} />
        </Field>
        <p className="rounded-xl bg-brand-50/70 p-3 text-sm text-ink-700">Chaque modification est tracée dans l&apos;historique du projet.</p>
      </div>
    </Drawer>
  );
}

export function ProjectOverview({ slug, configure }: { slug: string; configure: boolean }) {
  const state = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const project = findProject(state, slug);
  const [showAll, setShowAll] = useState(false);
  const [openActivity, setOpenActivity] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [configOpen, setConfigOpen] = useState(configure);
  const [configKey, setConfigKey] = useState(0);

  if (!project) return null;

  const activities = state.activities
    .filter((a) => a.projectCode === project.code)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const shown = showAll ? activities : activities.filter((a) => !a.done && a.due <= addDays(DEMO_TODAY, 1));
  const journal = state.history.filter((h) => h.projectCode === project.code).slice(0, 3);
  const activity = activities.find((a) => a.id === openActivity) ?? null;

  const closeConfig = () => {
    setConfigOpen(false);
    if (configure) router.replace(pathname, { scroll: false });
  };

  return (
    <>
      <ProjectTabs
        slug={slug}
        actions={
          <>
            <Button
              variant="secondary"
              size="lg"
              icon={<Settings className="h-5 w-5" strokeWidth={1.8} />}
              onClick={() => {
                setConfigKey((k) => k + 1);
                setConfigOpen(true);
              }}
            >
              Configurer
            </Button>
            <Button
              size="lg"
              icon={<Plus className="h-5 w-5" />}
              onClick={() => {
                setAddKey((k) => k + 1);
                setAddOpen(true);
              }}
            >
              Ajouter une activité
            </Button>
            <Menu
              label="Autres actions du projet"
              items={[
                ...(state.dossiers.some((d) => d.projectCode === project.code) ? [{ label: "Dossier du projet", icon: FolderOpen, href: `/dossiers/${slug}` }] : []),
                { label: project.closedAt ? "Clôture du projet" : "Clôturer le projet", icon: Archive, href: `/projets/${slug}/cloture` },
              ]}
            />
          </>
        }
      />

      <Card className="mt-5 p-4">
        <JourneyStrip current={project.journeyStep} />
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_470px]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-3 text-xl font-bold text-ink-900">
              <CalendarDays className="h-7 w-7 text-ink-700" strokeWidth={1.6} aria-hidden />
              {showAll ? "Activités du projet" : "Aujourd'hui dans ce projet"}
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-ink-600">{formatWeekday(DEMO_TODAY)}</span>
              <span className="h-5 w-px bg-line-strong" aria-hidden />
              <button type="button" onClick={() => setShowAll((v) => !v)} className="cursor-pointer font-semibold text-brand-700 hover:underline underline-offset-4">
                {showAll ? "Aujourd'hui" : "Voir tout"}
              </button>
            </div>
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={SquareCheck}
              title="Rien d'urgent aujourd'hui"
              description="Aucune activité n'arrive à échéance aujourd'hui ou demain."
              action={
                <Button variant="outline" onClick={() => setShowAll(true)}>
                  Voir toutes les activités
                </Button>
              }
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {shown.map((a) => (
                <ActivityRow key={a.id} activity={a} onOpen={() => setOpenActivity(a.id)} />
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-xl font-bold text-ink-900">
                <Goal className="h-7 w-7 text-ink-700" strokeWidth={1.6} aria-hidden />
                Prochain jalon
              </h2>
              <Link href={`/planning?projet=${slug}&semaine=${project.milestone.date}`} className="text-sm font-semibold text-brand-700 hover:underline underline-offset-4">
                Voir le planning
              </Link>
            </div>
            <div className="mt-4 rounded-xl border border-line p-4">
              <p className="text-lg font-bold text-ink-900">{project.milestone.title}</p>
              <p className="text-[15px] text-ink-600">{project.milestone.detail}</p>
              <p className="mt-3 flex items-center gap-2.5 text-[15px] text-ink-800">
                <CalendarDays className="h-5 w-5 text-ink-600" aria-hidden />
                {formatLong(project.milestone.date)}
                <Badge tone="neutral">{relativeDue(project.milestone.date)}</Badge>
              </p>
              {project.milestone.blocker && (
                <div className="mt-4 flex gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3.5">
                  <TriangleAlert className="h-6 w-6 shrink-0 fill-danger-600 text-white" aria-hidden />
                  <div>
                    <p className="font-semibold text-danger-700">Prérequis bloquant</p>
                    <p className="text-sm text-ink-700">{project.milestone.blocker}</p>
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-3 text-[15px]">
                <User className="h-5 w-5 text-ink-600" aria-hidden />
                <span className="text-ink-600">Responsable</span>
                <User className="ml-4 h-4 w-4 text-ink-500" aria-hidden />
                <span className="text-ink-900">{project.milestone.owner}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-xl font-bold text-ink-900">
                <FileText className="h-7 w-7 text-ink-700" strokeWidth={1.6} aria-hidden />
                Journal récent
              </h2>
              <Link href={`/projets/${slug}/historique?periode=tout`} className="text-sm font-semibold text-brand-700 hover:underline underline-offset-4">
                Voir tout
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {journal.map((e) => {
                const Icon = EVENT_ICONS[e.icon];
                return (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <IconTile icon={Icon} size="sm" className="bg-brand-50 text-ink-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-900">{e.title}</p>
                      <p className="truncate text-sm text-ink-500">{e.context}</p>
                    </div>
                    <p className="shrink-0 text-right text-[13px] text-ink-600">
                      {formatShort(e.at)}
                      <br />
                      {formatTime(e.at)}
                    </p>
                    <Menu
                      label={`Actions pour ${e.title}`}
                      items={[
                        { label: "Voir le détail", icon: History, href: `/projets/${slug}/historique?evenement=${e.id}` },
                        ...(e.href ? [{ label: "Ouvrir la source", icon: SquareArrowOutUpRight, href: e.href }] : []),
                      ]}
                    />
                  </li>
                );
              })}
              {journal.length === 0 && <li className="py-6 text-center text-sm text-ink-500">Aucun événement pour le moment.</li>}
            </ul>
            {journal[0] && <p className="sr-only">Dernier événement le {formatDateTime(journal[0].at)}</p>}
          </Card>
        </div>
      </div>

      <ActivityDrawer activity={activity} onClose={() => setOpenActivity(null)} />
      <AddActivityDrawer key={`add-${addKey}`} project={project} open={addOpen} onClose={() => setAddOpen(false)} />
      <ConfigureDrawer key={`cfg-${configKey}`} project={project} open={configOpen} onClose={closeConfig} />
      <ScreenRef n={11} label="Vue d'un projet" />
    </>
  );
}
