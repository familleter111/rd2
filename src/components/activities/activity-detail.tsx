"use client";

import {
  Box,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Database,
  Download,
  FileText,
  Flag,
  FlaskConical,
  Folder,
  Info,
  Loader,
  Paperclip,
  PieChart,
  Play,
  Save,
  Check,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { MetaLine } from "@/components/project-context-header";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Breadcrumb, ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { mixerReservation } from "@/lib/data-lab";
import { downloadText, formatDateTime, formatNumeric, formatWeekday } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { EVENT_ICONS } from "@/components/project/project-overview";
import { activityState, findConflicts, lotConditions, workSteps } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { Activity } from "@/lib/types";
import { ReassignModal, activityProgress, completionBlocker } from "./activity-bits";
import { ScopeSummary, WorkSteps } from "./activity-work";

const WISH = { from: "2026-10-05", to: "2026-10-06" };
const TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

function Info3({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm text-ink-600">{label}</p>
        <div className="font-bold text-ink-900">{children}</div>
      </div>
    </div>
  );
}

function ReserveModal({ activity, open, onClose }: { activity: Activity; open: boolean; onClose: () => void }) {
  const state = useDemo();
  const go = useGuideNav();
  const guideConfirm = useGuideTarget(31);
  const base = mixerReservation();
  const [date, setDate] = useState(base.date);
  const [start, setStart] = useState(base.start);
  const [end, setEnd] = useState(base.end);
  const resource = state.resources.find((r) => r.id === activity.reservationFor);
  const conflicts = findConflicts(state, activity.reservationFor ?? "", date, start, end);
  const invalid = end <= start;

  const confirm = () => {
    if (invalid || conflicts.length) return;
    labActions.createEvent({ ...base, id: `ev-mix-${Date.now().toString(36)}`, date, start, end, projectCode: activity.projectCode, lotCode: activity.lotCode, activityId: activity.id });
    toast.show({
      title: "Réservation confirmée",
      description: `${resource?.name ?? "Mélangeur"} réservé le ${formatNumeric(date)} de ${start} à ${end}.`,
      action: { label: "Voir le planning", href: `/planning?semaine=${date}` },
    });
    if (guideConfirm) go(31);
    else onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Réserver le mélangeur"
      subtitle={`${resource?.name ?? activity.reservationFor} — lot ${activity.lotCode ?? ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CalendarDays className="h-4 w-4" />} onClick={confirm} disabled={invalid || conflicts.length > 0} guide={31}>
            Confirmer la réservation
          </Button>
        </>
      }
    >
      <p className="rounded-xl bg-subtle p-3 text-sm text-ink-700">
        Période souhaitée : du {formatNumeric(WISH.from)} au {formatNumeric(WISH.to)} (2 jours). Le mélange est prévu le {formatNumeric(base.date)}.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Date" required htmlFor="rv-date">
          <Select
            id="rv-date"
            options={[WISH.from, WISH.to].map((d) => ({ value: d, label: formatNumeric(d) }))}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Début" required htmlFor="rv-start">
          <Select id="rv-start" options={TIMES} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Fin" required htmlFor="rv-end" error={invalid ? "La fin doit suivre le début." : null}>
          <Select id="rv-end" options={[...TIMES, "12:00", "17:00"].sort()} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <div className={cn("mt-4 flex items-start gap-3 rounded-xl p-4 text-sm", conflicts.length ? "bg-danger-50" : "bg-success-50")}>
        {conflicts.length ? <CircleAlert className="h-5 w-5 shrink-0 fill-danger-500 text-white" aria-hidden /> : <CircleCheck className="h-5 w-5 shrink-0 fill-success-500 text-white" aria-hidden />}
        <span className={conflicts.length ? "text-danger-700" : "text-success-700"}>
          {conflicts.length
            ? `Créneau indisponible : ${conflicts.map((c) => `${c.title} (${c.start}–${c.end})`).join(", ")}.`
            : `Disponibilité vérifiée — ${formatWeekday(date)}, ${start}–${end}.`}
        </span>
      </div>
    </Modal>
  );
}

export function ActivityDetail({ id }: { id: string }) {
  const state = useDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"details" | "documents" | "commentaires" | "historique">("details");
  const [comment, setComment] = useState("");
  const [reassign, setReassign] = useState(false);
  const [reserve, setReserve] = useState(0);
  const [reserveOpen, setReserveOpen] = useState(false);
  const activity = state.activities.find((a) => a.id === id);

  if (!activity) {
    return (
      <>
        <Card className="mt-4">
          <EmptyState
            icon={Folder}
            title="Activité introuvable"
            description="Cette activité n'existe pas ou a été supprimée."
            action={<LinkButton href="/activites">Retour à mes activités</LinkButton>}
          />
        </Card>
        <ScreenRef label="Activité" />
      </>
    );
  }

  const project = state.projects.find((p) => p.code === activity.projectCode);
  const lot = activity.lotCode ? state.lots.find((l) => l.projectCode === activity.projectCode && l.code === activity.lotCode) : undefined;
  const steps = activity.kind === "preparation-lot" && activity.lotCode ? lotConditions(state, activity.projectCode, activity.lotCode) : [];
  const reservationStep = steps.find((s) => s.key === "reservation");
  const work = workSteps(state, activity);
  const progress = activityProgress(state, activity);
  const blocker = completionBlocker(state, activity);
  const current = activityState(activity);
  const resource = activity.reservationFor ? state.resources.find((r) => r.id === activity.reservationFor) : undefined;
  const events = state.history.filter((h) => h.activityId === activity.id).sort((a, b) => b.at.localeCompare(a.at));
  const pilot = activity.lotCode ? state.pilotLots.find((l) => l.projectCode === activity.projectCode && l.lotCode === activity.lotCode) : undefined;
  const docs = activity.documents ?? [];
  const comments = activity.comments ?? [];

  const links: { icon: LucideIcon; label: string; value: string; sub?: string; href: string }[] = [
    ...(project ? [{ icon: Folder, label: "Projet", value: `${project.code} • ${project.name}`, href: `/projets/${project.slug}` }] : []),
    ...(activity.formula ? [{ icon: FlaskConical, label: "Formule", value: activity.formula, href: `/projets/${project?.slug}/formules` }] : []),
    ...(lot
      ? [{ icon: Box, label: "Lot", value: lot.code, sub: lot.type === "Pilote" ? "Lot pilote" : "Lot d'essai", href: lot.type === "Pilote" ? `/projets/${project?.slug}/lots/${lot.code.toLowerCase()}` : `/projets/${project?.slug}/formules/lots?lot=${lot.code}` }]
      : []),
    ...(pilot ? [{ icon: FileText, label: "Mode opératoire", value: `${pilot.mo.code} ${pilot.mo.version}`, href: `/projets/${project?.slug}/lots/${pilot.lotCode.toLowerCase()}` }] : []),
    ...(pilot ? [{ icon: FlaskConical, label: "Méthode d'analyse", value: "M-01 • Dosage PA", href: "/methodes/m-01" }] : activity.methodRef ? [{ icon: FlaskConical, label: "Méthode", value: activity.methodRef, href: `/methodes/${activity.methodRef.toLowerCase()}` }] : []),
    ...(resource ? [{ icon: Database, label: "Équipement", value: resource.id, sub: resource.label, href: `/planning?vue=ressources` }] : []),
  ];

  return (
    <>
      <Breadcrumb items={[{ label: "Mes activités", href: "/activites" }, { label: activity.title }]} />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-ink-900 sm:text-[36px]">{activity.title}</h1>
        <Badge tone={activity.status.tone} dot size="md" className="rounded-full px-3">
          {activity.status.label}
        </Badge>
      </div>
      <MetaLine
        className="mt-1"
        items={[
          <span key="p">
            Projet <strong className="text-ink-800">{project ? `${project.code} • ${project.name}` : activity.projectCode}</strong>
          </span>,
          ...(project ? [project.dosage] : []),
          ...(activity.formula ? [<span key="f">Formule <strong className="text-ink-800">{activity.formula}</strong></span>] : []),
          ...(lot ? [<span key="l">{lot.type === "Pilote" ? "Lot pilote" : "Lot"} <strong className="text-ink-800">{lot.code}</strong></span>] : activity.context ? [activity.context] : []),
        ]}
      />
      <Tabs
        className="mt-5"
        items={[
          { value: "details", label: "Détails" },
          { value: "documents", label: "Documents", count: docs.length },
          { value: "commentaires", label: "Commentaires", count: comments.length },
          { value: "historique", label: "Historique", count: events.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "details" && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <h2 className="text-xl font-bold text-ink-900">Informations générales</h2>
              <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
                <div className="space-y-4 bg-white p-4">
                  <Info3 icon={Folder} label="Projet">
                    {project ? `${project.code} • ${project.name}` : activity.projectCode}
                  </Info3>
                  {activity.formula && (
                    <Info3 icon={FlaskConical} label="Formule">
                      {activity.formula}
                    </Info3>
                  )}
                  {lot && (
                    <Info3 icon={Box} label="Lot">
                      {lot.code} <span className="ml-2 text-sm font-normal text-ink-600">{lot.type === "Pilote" ? "Lot pilote" : "Lot d'essai"}</span>
                    </Info3>
                  )}
                  {!lot && activity.context && (
                    <Info3 icon={Box} label="Objet">
                      {activity.context}
                    </Info3>
                  )}
                </div>
                <div className="space-y-4 bg-white p-4">
                  <Info3 icon={User} label="Responsable">
                    {activity.ownerRole ?? activity.owner}
                    {activity.ownerRole && <span className="block text-sm font-normal text-ink-600">{activity.owner}</span>}
                  </Info3>
                  <Info3 icon={CalendarDays} label="Date d'échéance">
                    {formatNumeric(activity.due)}
                  </Info3>
                  <Info3 icon={Flag} label="Priorité">
                    <span className={cn("mt-1 inline-block rounded-md px-3 py-1 text-sm font-medium", activity.priority === "Haute" ? "bg-danger-50 text-danger-700" : "bg-slate-100 text-ink-700")}>
                      {activity.priority ?? "Normale"}
                    </span>
                  </Info3>
                </div>
                <div className="space-y-4 bg-white p-4">
                  <Info3 icon={Loader} label="Statut">
                    <Badge tone={activity.status.tone} dot size="md" className="mt-1">
                      {activity.status.label}
                    </Badge>
                  </Info3>
                  <Info3 icon={PieChart} label="Avancement">
                    {progress.done} / {progress.total}
                    <span className="mt-2 block h-2.5 w-full max-w-52 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total} aria-label="Avancement">
                      <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </span>
                  </Info3>
                </div>
              </div>
            </Card>

            {steps.length > 0 && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <Card className="p-5">
                  <h2 className="text-xl font-bold text-ink-900">Étapes et prérequis</h2>
                  <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
                    {steps.map((s, i) => (
                      <li key={s.key} className="flex items-start gap-3 px-3 py-3">
                        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink-600">{i + 1}</span>
                        {s.done ? (
                          <CircleCheck className="mt-0.5 h-7 w-7 shrink-0 fill-success-500 text-white" aria-hidden />
                        ) : (
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-warn-500">
                            <span className="h-3 w-3 rounded-full bg-warn-500" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block font-semibold text-ink-900">{s.title}</span>
                          <span className="block text-ink-500">{s.detail}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <Badge tone={s.done ? "success" : "warn"}>{s.done ? "Terminé" : "En attente"}</Badge>
                          <span className="w-20 text-right text-xs text-ink-600">{s.date ? formatNumeric(s.date) : "—"}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </Card>

                {resource && reservationStep && (
                  <Card className={cn("p-5", !reservationStep.done && "border-warn-100")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-ink-900">{reservationStep.done ? "Mélangeur réservé" : "Mélangeur à réserver"}</h2>
                      {reservationStep.done ? (
                        <Badge tone="success" icon={CircleCheck} size="md" className="rounded-full">
                          Réservé
                        </Badge>
                      ) : (
                        <Badge tone="warn" icon={CircleAlert} size="md" className="rounded-full">
                          Action requise
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-ink-600">
                      {reservationStep.done ? reservationStep.detail : "La réservation du mélangeur est nécessaire pour pouvoir démarrer la fabrication du lot pilote."}
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-start gap-3 rounded-xl bg-subtle p-3 text-sm">
                        <CalendarDays className="mt-0.5 h-6 w-6 text-ink-700" strokeWidth={1.5} aria-hidden />
                        <span>
                          <span className="block text-ink-600">Équipement</span>
                          <span className="block font-semibold text-ink-900">{resource.label}</span>
                          <span className="block text-ink-600">{resource.id}</span>
                        </span>
                      </div>
                      <div className="flex items-start gap-3 rounded-xl bg-subtle p-3 text-sm">
                        <CalendarDays className="mt-0.5 h-6 w-6 text-ink-700" strokeWidth={1.5} aria-hidden />
                        <span>
                          <span className="block text-ink-600">Période souhaitée</span>
                          <span className="block font-semibold text-ink-900">
                            Du {formatNumeric(WISH.from)} au {formatNumeric(WISH.to)}
                          </span>
                          <span className="block text-ink-600">2 jours</span>
                        </span>
                      </div>
                    </div>
                    {reservationStep.done ? (
                      <LinkButton href={`/planning?semaine=${reservationStep.date}`} variant="outline" size="lg" className="mt-4 w-full" icon={<CalendarDays className="h-5 w-5" />}>
                        Voir dans le planning
                      </LinkButton>
                    ) : (
                      <Button
                        size="lg"
                        className="mt-4 w-full"
                        icon={<CalendarDays className="h-5 w-5" />}
                        guide={31}
                        onClick={() => {
                          setReserve((k) => k + 1);
                          setReserveOpen(true);
                        }}
                      >
                        Réserver une ressource
                      </Button>
                    )}
                  </Card>
                )}
              </div>
            )}

            {work.length > 0 && (
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold text-ink-900">Travail à réaliser</h2>
                  <Badge tone={work.every((s) => s.done) ? "success" : "info"} size="md" className="rounded-full">
                    {work.filter((s) => s.done).length} / {work.length} étapes
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-600">
                  Cette activité se réalise dans l&apos;application : chaque étape se coche d&apos;elle-même dès que le travail correspondant est enregistré.
                </p>
                <div className="mt-3">
                  <WorkSteps activity={activity} />
                </div>
              </Card>
            )}

            {activity.kind === "cadrage" && project?.scope && (
              <Card className="p-5">
                <h2 className="text-xl font-bold text-ink-900">Fiche de cadrage</h2>
                <div className="mt-3">
                  <ScopeSummary project={project} />
                </div>
              </Card>
            )}

            {steps.length === 0 && (activity.prerequisiteNote || activity.href) && (
              <Card className="p-5">
                <h2 className="text-lg font-bold text-ink-900">Prérequis</h2>
                {activity.prerequisiteNote && (
                  <p className="mt-3 flex items-start gap-3 rounded-xl bg-subtle p-4 text-sm">
                    <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
                    <span>
                      <span className="block font-medium text-ink-900">{activity.prerequisiteNote.title}</span>
                      <span className="text-ink-600">{activity.prerequisiteNote.detail}</span>
                    </span>
                  </p>
                )}
                {activity.href && (
                  <LinkButton href={activity.href} variant="outline" className="mt-3" iconRight={<ChevronRight className="h-4 w-4" />}>
                    Ouvrir l&apos;objet concerné
                  </LinkButton>
                )}
              </Card>
            )}

            <Card className="p-5">
              <h2 className="text-lg font-bold text-ink-900">Commentaires</h2>
              {comments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-xl bg-subtle px-4 py-3 text-sm">
                      <p className="text-ink-800">{c.text}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {c.author} — {formatDateTime(c.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">CP</span>
                <div className="min-w-0 flex-1">
                  <div className="flex gap-3">
                    <Input aria-label="Ajouter un commentaire" placeholder="Ajouter un commentaire…" value={comment} onChange={(e) => setComment(e.target.value)} className="flex-1" />
                    <Button
                      variant="secondary"
                      size="lg"
                      disabled={!comment.trim()}
                      onClick={() => {
                        labActions.addActivityComment(activity.id, comment.trim());
                        setComment("");
                        toast.show({ title: "Commentaire publié" });
                      }}
                    >
                      Publier
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                    Joindre un document
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="text-xl font-bold text-ink-900">Informations associées</h2>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="group grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1.2fr)_16px] items-center gap-3 px-3 py-3 text-sm hover:bg-subtle">
                      <l.icon className="h-5 w-5 text-ink-600" strokeWidth={1.6} aria-hidden />
                      <span className="text-ink-700">{l.label}</span>
                      <span>
                        <span className="block font-medium text-brand-700">{l.value}</span>
                        {l.sub && <span className="block text-xs text-ink-500">{l.sub}</span>}
                      </span>
                      <ChevronRight className="h-4 w-4 text-ink-500 group-hover:text-brand-700" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h2 className="text-xl font-bold text-ink-900">Documents liés</h2>
              {docs.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">Aucun document lié.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                  {docs.map((d) => (
                    <li key={d.name} className="flex items-center gap-3 px-3 py-3 text-sm">
                      <FileText className="h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.5} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink-900">{d.name}</span>
                        <span className="block text-ink-500">{d.type}</span>
                      </span>
                      <span className="text-xs text-ink-600">{formatNumeric(d.date)}</span>
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
              {project && (
                <LinkButton href={`/projets/${project.slug}/documents`} variant="outline" className="mt-3 w-full justify-between" iconRight={<ChevronRight className="h-4 w-4" />}>
                  <span className="flex-1 text-center">Voir tous les documents</span>
                </LinkButton>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <Card className="mt-5 p-5">
          {docs.length === 0 ? (
            <EmptyState icon={FileText} title="Aucun document" />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {docs.map((d) => (
                <li key={d.name} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{d.name}</span>
                    <span className="block text-ink-500">{d.type}</span>
                  </span>
                  <span className="text-ink-600">{formatNumeric(d.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" className="mt-4" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
            Joindre un document
          </Button>
        </Card>
      )}

      {tab === "commentaires" && (
        <Card className="mt-5 p-5">
          {comments.length === 0 ? (
            <EmptyState icon={Users} title="Aucun commentaire" description="Les échanges de l'équipe sur cette activité apparaîtront ici." />
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-xl bg-subtle px-4 py-3 text-sm">
                  <p className="text-ink-800">{c.text}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {c.author} — {formatDateTime(c.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "historique" && (
        <Card className="mt-5 p-5">
          {events.length === 0 ? (
            <EmptyState icon={Clock} title="Aucun événement" description="Les changements de statut et réaffectations sont tracés ici." />
          ) : (
            <ol className="space-y-3">
              {events.map((e) => {
                const Icon = EVENT_ICONS[e.icon];
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
                    <Icon className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
                    <span className="flex-1">
                      <span className="block font-semibold text-ink-900">{e.title}</span>
                      <span className="block text-ink-600">{e.field ? `${e.field} : ${e.oldValue} → ${e.newValue}` : e.description}</span>
                      <span className="block text-xs text-ink-500">
                        {formatDateTime(e.at)} — {e.author}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          for (const file of files) labActions.addActivityDocument(activity.id, { name: file.name, type: "Pièce jointe" });
          if (files.length) toast.show({ title: files.length > 1 ? `${files.length} documents ajoutés` : "Document ajouté", description: files.map((x) => x.name).join(", ") });
          e.target.value = "";
        }}
      />

      {!activity.done ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="lg" icon={<Save className="h-5 w-5" />} onClick={() => toast.show({ title: "Activité enregistrée", description: activity.title })}>
            Enregistrer
          </Button>
          <Button variant="outline" size="lg" icon={<Users className="h-5 w-5" />} onClick={() => setReassign(true)}>
            Réaffecter
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {current === "a-faire" && (
              <Button
                size="lg"
                icon={<Play className="h-5 w-5" />}
                onClick={() => {
                  labActions.startActivity(activity.id);
                  toast.show({ title: "Activité démarrée", description: activity.title });
                }}
              >
                Démarrer l&apos;activité
              </Button>
            )}
            <Button
              size="lg"
              icon={<Check className="h-5 w-5" />}
              disabled={Boolean(blocker)}
              className="disabled:bg-slate-300"
              onClick={() => {
                labActions.completeActivity(activity.id);
                toast.show(
                  activity.kind === "cadrage"
                    ? { title: "Cadrage validé", description: `${activity.projectCode} passe en faisabilité : la revue de lancement est la prochaine étape.` }
                    : { title: "Activité terminée", description: activity.title },
                );
              }}
            >
              {activity.kind === "cadrage" ? "Valider le cadrage" : "Terminer l'activité"}
            </Button>
            {blocker && (
              <p className="flex max-w-72 items-start gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-700 shadow-card">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                {blocker}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
          <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
          Activité terminée.
        </p>
      )}

      <ReassignModal key={`${activity.owner}-${reassign}`} activity={activity} open={reassign} onClose={() => setReassign(false)} />
      {activity.kind === "preparation-lot" && activity.reservationFor && <ReserveModal key={`rv-${reserve}`} activity={activity} open={reserveOpen} onClose={() => setReserveOpen(false)} />}
      <ScreenRef n={activity.id === "act-lp01" ? 30 : undefined} label="Activité — détails et clôture bloquée" />
    </>
  );
}
