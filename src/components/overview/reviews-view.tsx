"use client";

import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  CircleAlert,
  CircleCheck,
  Database,
  FileText,
  FlaskConical,
  FolderOpen,
  Pill,
  Plus,
  RefreshCw,
  Send,
  TriangleAlert,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, DateInput, Field, Input, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { SegmentTabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { REVIEW_ROLES, REVIEW_TYPES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, formatLong, plural } from "@/lib/format";
import { actions, useDemo } from "@/lib/store";
import type { Review, ReviewParticipant, ReviewStatus } from "@/lib/types";
import { OverviewHeader } from "./overview-header";

const REVIEW_ICONS: Record<Review["icon"], LucideIcon> = {
  flask: FlaskConical,
  pill: Pill,
  chart: ChartNoAxesColumn,
  doc: FileText,
};

const ROLE_ICONS: Record<string, LucideIcon> = {
  "Chef de projet": User,
  "Responsable développement": User,
  "Pharmacien responsable": Database,
};

function ReviewCard({ review, selected, onSelect }: { review: Review; selected: boolean; onSelect: () => void }) {
  const { projects } = useDemo();
  const project = projects.find((p) => p.code === review.projectCode);
  const Icon = REVIEW_ICONS[review.icon];

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 shadow-card transition-colors",
        selected ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full cursor-pointer items-start gap-4 text-left" aria-pressed={selected}>
        <IconTile icon={Icon} size="lg" className="bg-brand-50 text-ink-700" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-[15px] text-ink-800">
              <span className="font-semibold">{review.projectCode}</span> • {project?.name}
            </span>
            <Badge tone={review.badge.tone} icon={review.badge.tone === "warn" ? CircleAlert : review.badge.tone === "success" ? CircleCheck : undefined}>
              {review.badge.label}
            </Badge>
          </span>
          <span className="mt-1 block text-[22px] font-bold leading-tight text-ink-900">{review.title}</span>
          <span className="mt-1 block text-[15px] text-ink-500">{review.type}</span>
        </span>
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-ink-700">
        <span className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-ink-600" strokeWidth={1.7} aria-hidden />
          {review.status === "cloturee" ? "Tenue le" : "Prévue le"} {formatLong(review.date)}
        </span>
        <span className="hidden h-6 w-px bg-line-strong sm:block" aria-hidden />
        <span className="flex items-center gap-2">
          <Users className="h-5 w-5 text-ink-600" strokeWidth={1.7} aria-hidden />
          {review.participants.length} {plural(review.participants.length, "participant")}
        </span>
      </div>
      {review.cta.href ? (
        <Link href={review.cta.href} className="mt-4 inline-flex items-center gap-2 font-semibold text-brand-700 hover:underline underline-offset-4">
          {review.cta.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <button type="button" onClick={onSelect} className="mt-4 inline-flex cursor-pointer items-center gap-2 font-semibold text-brand-700 hover:underline underline-offset-4">
          {review.cta.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function ChecklistIcon({ state }: { state: Review["checklist"][number]["state"] }) {
  if (state === "done")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-500 text-white">
        <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
      </span>
    );
  if (state === "warn")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warn-100 text-warn-600">
        <TriangleAlert className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
    );
  return <span className="h-8 w-8 shrink-0 rounded-md border-2 border-line-strong bg-white" aria-hidden />;
}

function ParticipantsModal({ review, open, onClose }: { review: Review; open: boolean; onClose: () => void }) {
  const [list, setList] = useState<ReviewParticipant[]>(review.participants);
  const toggle = (role: string, checked: boolean) =>
    setList((l) => (checked ? [...l, { role, part: "Contribue" }] : l.filter((p) => p.role !== role)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gérer les participants"
      subtitle={`${review.projectCode} • ${review.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!list.some((p) => p.part === "Organise")}
            onClick={() => {
              actions.setReviewParticipants(review.id, list);
              toast.show({ title: "Participants mis à jour", description: `${list.length} ${plural(list.length, "participant")} pour la revue.` });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-line">
        {REVIEW_ROLES.map((role) => {
          const entry = list.find((p) => p.role === role);
          return (
            <li key={role} className="flex items-center justify-between gap-4 py-3">
              <Checkbox checked={Boolean(entry)} onChange={(c) => toggle(role, c)} label={role} />
              {entry && (
                <Select
                  aria-label={`Rôle de ${role}`}
                  size="sm"
                  className="w-40"
                  options={["Organise", "Contribue", "Approuve"]}
                  value={entry.part}
                  onChange={(e) =>
                    setList((l) => l.map((p) => (p.role === role ? { ...p, part: e.target.value as ReviewParticipant["part"] } : p)))
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
      {!list.some((p) => p.part === "Organise") && (
        <p className="mt-3 text-sm text-danger-600">Désignez au moins un organisateur.</p>
      )}
    </Modal>
  );
}

function ReviewDetail({ review }: { review: Review }) {
  const { projects } = useDemo();
  const project = projects.find((p) => p.code === review.projectCode);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsKey, setParticipantsKey] = useState(0);
  const Icon = REVIEW_ICONS[review.icon];
  const editable = review.status === "a-preparer";
  const complete = review.checklist.every((c) => c.state === "done");

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <IconTile icon={Icon} size="lg" className="bg-brand-50 text-ink-700" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[15px] text-ink-800">
              <span className="font-semibold">{review.projectCode}</span> • {project?.name}
            </p>
            <div className="flex items-center gap-1">
              <Badge tone={review.badge.tone} size="md" icon={review.badge.tone === "warn" ? CircleAlert : review.badge.tone === "success" ? CircleCheck : undefined}>
                {review.badge.label}
              </Badge>
              <Menu
                label="Actions de la revue"
                items={[
                  { label: "Ouvrir le projet", icon: FolderOpen, href: `/projets/${review.projectCode.toLowerCase()}` },
                  { label: "Voir les prérequis", icon: FileText, href: `/projets/${review.projectCode.toLowerCase()}/prerequis` },
                ]}
              />
            </div>
          </div>
          <h2 className="mt-1 text-[24px] font-bold text-ink-900">{review.title}</h2>
          <p className="text-[15px] text-ink-500">{review.type}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-5 text-[15px] text-ink-800">
        <span className="flex items-center gap-2.5">
          <CalendarDays className="h-5 w-5 text-ink-600" strokeWidth={1.7} aria-hidden />
          {review.status === "cloturee" ? "Tenue le" : "Prévue le"} {formatLong(review.date)}
        </span>
        <span className="hidden h-6 w-px bg-line-strong sm:block" aria-hidden />
        <span className="flex items-center gap-2.5">
          <User className="h-5 w-5 text-ink-600" strokeWidth={1.7} aria-hidden />
          Préparée par
          <span className="font-medium text-brand-700">{review.preparedBy}</span>
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-ink-900">Participants</h3>
        {editable && (
          <Button
            variant="outline"
            icon={<UserCog className="h-5 w-5" />}
            onClick={() => {
              setParticipantsKey((k) => k + 1);
              setParticipantsOpen(true);
            }}
          >
            Gérer les participants
          </Button>
        )}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {review.participants.map((p) => {
          const RoleIcon = ROLE_ICONS[p.role] ?? User;
          return (
            <li key={p.role} className="flex items-center gap-4 py-2.5">
              <IconTile icon={RoleIcon} size="sm" className="bg-brand-50 text-ink-700" />
              <span className="flex-1 text-[15px] text-ink-800">{p.role}</span>
              <Badge tone={p.part === "Organise" ? "info" : "neutral"} className="rounded-full px-3">
                {p.part}
              </Badge>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-lg font-bold text-ink-900">
        {editable ? "Points à vérifier avant soumission" : "Points vérifiés"}
      </h3>
      <ul className="mt-3 space-y-3">
        {review.checklist.map((c) => {
          const content = (
            <>
              <ChecklistIcon state={c.state} />
              <span className="min-w-0">
                <span className="block font-semibold text-ink-900">{c.label}</span>
                <span className="block text-sm text-ink-500">{c.detail}</span>
              </span>
            </>
          );
          return (
            <li key={c.id}>
              {editable ? (
                <button
                  type="button"
                  aria-pressed={c.state === "done"}
                  onClick={() => actions.toggleReviewItem(review.id, c.id)}
                  className="flex w-full cursor-pointer items-start gap-4 rounded-lg p-1 text-left transition-colors hover:bg-subtle"
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-start gap-4 p-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-col items-end gap-2 border-t border-line pt-5">
        {editable ? (
          <>
            <Button
              size="lg"
              disabled={!complete}
              className="min-w-72 disabled:bg-slate-300"
              icon={<Send className="h-5 w-5" />}
              onClick={() => {
                actions.submitReview(review.id);
                toast.show({ title: "Revue soumise", description: `${review.projectCode} • ${review.title} — les participants ont été notifiés.` });
              }}
            >
              Soumettre la revue
            </Button>
            <p className="text-sm text-ink-500">
              {complete ? "Toutes les pièces sont complètes." : "Toutes les pièces doivent être complétées avant soumission."}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <CircleCheck className="h-4 w-4 text-success-600" aria-hidden />
            {review.status === "cloturee" ? "Revue clôturée" : "Revue soumise"}
            {review.submittedAt ? ` le ${formatLong(review.submittedAt)}` : ""}.
          </p>
        )}
      </div>

      <ParticipantsModal key={participantsKey} review={review} open={participantsOpen} onClose={() => setParticipantsOpen(false)} />
    </Card>
  );
}

function PlanReviewDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { projects } = useDemo();
  const active = projects.filter((p) => !p.archived);
  const [projectCode, setProjectCode] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState(REVIEW_TYPES[0]);
  const [date, setDate] = useState("");
  const [participants, setParticipants] = useState<string[]>(REVIEW_ROLES.slice(0, 3));
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    project: !projectCode ? "Sélectionnez un projet." : null,
    title: !title.trim() ? "Renseignez l'intitulé de la revue." : null,
    date: !date ? "Choisissez une date." : date < DEMO_TODAY ? "La date ne peut pas être passée." : null,
    participants: participants.length < 2 ? "Sélectionnez au moins deux participants." : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (e: string | null) => (submitted ? e : null);

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    const id = actions.addReview({ projectCode, title: title.trim(), type, date, participants });
    toast.show({ title: "Revue planifiée", description: `${projectCode} • ${title.trim()} — ${formatLong(date)}.` });
    onCreated(id);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Planifier une revue"
      subtitle="Réunir les participants autour d'une décision ou d'un jalon."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" onClick={submit}>
            Planifier la revue
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Projet" required htmlFor="rev-project" error={show(errors.project)}>
          <Select
            id="rev-project"
            placeholder="Sélectionner un projet"
            options={active.map((p) => ({ value: p.code, label: `${p.code} • ${p.name}` }))}
            value={projectCode}
            invalid={Boolean(show(errors.project))}
            onChange={(e) => setProjectCode(e.target.value)}
          />
        </Field>
        <Field label="Intitulé" required htmlFor="rev-title" error={show(errors.title)}>
          <Input id="rev-title" placeholder="Ex. Revue de faisabilité" value={title} invalid={Boolean(show(errors.title))} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Type de revue" htmlFor="rev-type">
          <Select id="rev-type" options={REVIEW_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
        </Field>
        <Field label="Date prévue" required htmlFor="rev-date" error={show(errors.date)}>
          <DateInput id="rev-date" value={date} onChange={setDate} invalid={Boolean(show(errors.date))} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold text-ink-800">Participants</legend>
          <div className="space-y-2.5">
            {REVIEW_ROLES.map((role) => (
              <Checkbox
                key={role}
                className="flex"
                checked={participants.includes(role)}
                onChange={(c) => setParticipants((l) => (c ? [...l, role] : l.filter((r) => r !== role)))}
                label={role}
              />
            ))}
          </div>
          {show(errors.participants) && <p className="mt-2 text-sm text-danger-600">{errors.participants}</p>}
        </fieldset>
      </div>
    </Drawer>
  );
}

const TABS: { value: ReviewStatus; label: string; icon: LucideIcon }[] = [
  { value: "a-preparer", label: "À préparer", icon: FileText },
  { value: "en-cours", label: "En cours", icon: RefreshCw },
  { value: "cloturee", label: "Clôturées", icon: CircleCheck },
];

export function ReviewsView() {
  const { reviews } = useDemo();
  const [tab, setTab] = useState<ReviewStatus>("a-preparer");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planKey, setPlanKey] = useState(0);

  const list = reviews.filter((r) => r.status === tab).sort((a, b) => (tab === "cloturee" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  const selected = list.find((r) => r.id === selectedId) ?? list[0];

  return (
    <>
      <OverviewHeader
        subtitle="Priorités, jalons et décisions de l'équipe"
        action={
          <Button
            size="lg"
            icon={<Plus className="h-5 w-5" />}
            onClick={() => {
              setPlanKey((k) => k + 1);
              setPlanOpen(true);
            }}
          >
            Planifier une revue
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <SegmentTabs
          items={TABS.map((t) => ({ ...t, count: reviews.filter((r) => r.status === t.value).length }))}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setSelectedId(null);
          }}
          className="[&_button]:min-w-44"
        />
        {tab !== "cloturee" && (
          <button
            type="button"
            onClick={() => {
              setTab("cloturee");
              setSelectedId(null);
            }}
            className="inline-flex cursor-pointer items-center gap-2 text-[16px] font-semibold text-brand-700 hover:underline underline-offset-4"
          >
            Voir les revues clôturées
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <Card className="mt-5">
          <EmptyState icon={FileText} title="Aucune revue" description="Aucune revue dans cet état pour le moment." />
        </Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="space-y-4">
            {list.map((r) => (
              <ReviewCard key={r.id} review={r} selected={r.id === selected?.id} onSelect={() => setSelectedId(r.id)} />
            ))}
          </div>
          {selected && <ReviewDetail key={selected.id} review={selected} />}
        </div>
      )}

      <PlanReviewDrawer
        key={planKey}
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onCreated={(id) => {
          setTab("a-preparer");
          setSelectedId(id);
        }}
      />

      <ScreenRef n={3} label="Revues à préparer" />
    </>
  );
}
