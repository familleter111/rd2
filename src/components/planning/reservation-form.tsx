"use client";

import { CalendarDays, ChevronRight, CircleAlert, CircleCheck, Clock, FileText, FlaskConical, Folder, TriangleAlert, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GuideSpot } from "@/components/guide/guide-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, DateInput, Select } from "@/components/ui/field";
import { Breadcrumb, PageHeader, ScreenRef } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { PEOPLE_LAB } from "@/lib/data-lab";
import { formatDuration, formatNumeric, toMinutes } from "@/lib/format";
import { findConflicts } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import { ConflictModal, ResourceTile, TIME_OPTIONS, type SlotRequest } from "./planning-bits";
import { useTeamNames } from "@/lib/people";

const ACTIVITIES = ["Analyse Dosage PA", "Mélange", "Contrôle en cours", "Essai de dissolution", "Autre activité"];
const DEMO_ANALYSTS = ["Laboratoire", PEOPLE_LAB.julien.name, PEOPLE_LAB.marie.name, PEOPLE_LAB.thomas.name];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <span className="text-[15px] font-semibold text-ink-800">
        {label} <span className="text-danger-600">*</span>
      </span>
      {children}
    </div>
  );
}

export interface ReservationPreset {
  resourceId: string;
  date: string;
  start: string;
  end: string;
  projectCode: string;
  lotCode: string;
  activity: string;
}

export function ReservationForm({ preset }: { preset: ReservationPreset }) {
  const ANALYSTS = [...new Set(["Laboratoire", ...useTeamNames(DEMO_ANALYSTS)])];
  const state = useDemo();
  const router = useRouter();
  // The defaults of the page come from the mock-up: outside the demonstration, only existing objects are kept.
  const knownProject = state.projects.some((p) => p.code === preset.projectCode) ? preset.projectCode : (state.projects[0]?.code ?? "");
  const [resourceId, setResourceId] = useState(state.resources.some((r) => r.id === preset.resourceId) ? preset.resourceId : (state.resources[0]?.id ?? ""));
  const [projectCode, setProjectCode] = useState(knownProject);
  const [lotCode, setLotCode] = useState(state.lots.some((l) => l.projectCode === knownProject && l.code === preset.lotCode) || state.demo ? preset.lotCode : "");
  const [activity, setActivity] = useState(state.demo ? preset.activity : "");
  const [analyst, setAnalyst] = useState(ANALYSTS[0]);
  const [date, setDate] = useState(preset.date);
  const [start, setStart] = useState(preset.start);
  const [end, setEnd] = useState(preset.end);
  const [notify, setNotify] = useState(true);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictKey, setConflictKey] = useState(0);

  const resource = state.resources.find((r) => r.id === resourceId);
  const project = state.projects.find((p) => p.code === projectCode);
  const lots = state.lots.filter((l) => l.projectCode === projectCode);
  const lot = lots.find((l) => l.code === lotCode);
  const duration = toMinutes(end) - toMinutes(start);
  const invalid = !date || duration <= 0;
  const conflicts = invalid ? [] : findConflicts(state, resourceId, date, start, end);
  const qualificationLate = resource ? resource.qualification.status === "À vérifier" && date > resource.qualification.next : false;
  const request: SlotRequest = { resourceId, date, start, end, method: activity.includes("Dosage") ? "M-01" : undefined };

  const confirm = () => {
    if (invalid) return;
    if (conflicts.length) {
      setConflictKey((k) => k + 1);
      setConflictOpen(true);
      return;
    }
    const id = `ev-${Date.now().toString(36)}`;
    labActions.createEvent({
      id,
      kind: "reservation",
      title: activity,
      projectCode,
      lotCode: lotCode || undefined,
      place: resource?.name,
      resourceIds: [resourceId],
      date,
      start,
      end,
      analyst: analyst === "Laboratoire" ? undefined : analyst,
      method: request.method,
      description: `Réservation de ${resource?.name ?? resourceId} pour « ${activity} »${lotCode ? ` (lot ${lotCode})` : ""}.`,
      timelineLabel: `${projectCode} • ${activity.split(" ")[0]}`,
      notify,
    });
    toast.show({
      title: "Réservation confirmée",
      description: `${resource?.name} — ${formatNumeric(date)} de ${start} à ${end}${notify ? " · participants notifiés" : ""}.`,
    });
    router.push(`/planning?vue=ressources&jour=${date}`);
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Planning", href: "/planning" }, { label: "Nouvelle réservation" }]} />
      <PageHeader className="mt-3" title="Nouvelle réservation" subtitle="Planifier l'utilisation d'une ressource pour une activité d'essai." />
      <LinkTabs
        className="mt-4"
        items={[
          { href: "/planning", label: "Agenda", active: false },
          { href: "/planning?vue=ressources", label: "Ressources", active: true },
          { href: "/planning?vue=charge", label: "Charge", active: false },
        ]}
      />

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-ink-900">Détails de la réservation</h2>
          <div className="mt-4 space-y-4">
            <Row label="Ressource">
              <div className="flex items-center gap-3">
                {resource && <ResourceTile resource={resource} size="sm" />}
                <Select
                  aria-label="Ressource"
                  className="flex-1"
                  options={state.resources.map((r) => ({ value: r.id, label: `${r.name} — ${r.label}` }))}
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                />
              </div>
            </Row>
            <Row label="Projet">
              <Select
                aria-label="Projet"
                icon={Folder}
                options={state.projects.filter((p) => !p.archived).map((p) => ({ value: p.code, label: `${p.code} • ${p.name} — ${p.formLabel} | ${p.dosage}` }))}
                value={projectCode}
                onChange={(e) => {
                  setProjectCode(e.target.value);
                  setLotCode("");
                }}
              />
            </Row>
            <Row label="Lot">
              <Select
                aria-label="Lot"
                icon={FlaskConical}
                placeholder="Sélectionner un lot"
                options={lots.map((l) => ({ value: l.code, label: `${l.code} — ${l.type === "Pilote" ? "Lot pilote" : l.type === "Essai" ? "Lot d'essai" : "Lot"}` }))}
                value={lotCode}
                onChange={(e) => setLotCode(e.target.value)}
              />
            </Row>
            <Row label="Activité">
              <Select aria-label="Activité" icon={FileText} options={ACTIVITIES} value={activity} onChange={(e) => setActivity(e.target.value)} />
            </Row>
            <Row label="Analyste">
              <Select aria-label="Analyste" icon={User} options={ANALYSTS} value={analyst} onChange={(e) => setAnalyst(e.target.value)} />
            </Row>
          </div>
          <GuideSpot
            step={34}
            active={!conflicts.length}
            hint="Pour voir le conflit : choisir le 07/10/2026 de 10:00 à 12:00 (créneau déjà pris), puis « Confirmer la réservation »."
            className="mt-5"
          >
            <div className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <label className="text-[15px] font-semibold text-ink-800">
              Date <span className="text-danger-600">*</span>
              <DateInput className="mt-1.5" value={date} onChange={setDate} invalid={!date} />
            </label>
            <label className="text-[15px] font-semibold text-ink-800">
              Heure de début <span className="text-danger-600">*</span>
              <Select className="mt-1.5" icon={Clock} options={TIME_OPTIONS} value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="text-[15px] font-semibold text-ink-800">
              Heure de fin <span className="text-danger-600">*</span>
              <Select className="mt-1.5" icon={Clock} options={TIME_OPTIONS} value={end} invalid={duration <= 0} onChange={(e) => setEnd(e.target.value)} />
            </label>
            </div>
          </GuideSpot>
          {duration <= 0 && <p className="mt-2 text-sm text-danger-600">L&apos;heure de fin doit être postérieure à l&apos;heure de début.</p>}
          <Checkbox
            className="mt-5"
            checked={notify}
            onChange={setNotify}
            label={<span className="font-semibold">Notifier les participants</span>}
            description="Un e-mail sera envoyé aux participants après la réservation."
          />
        </Card>

        <Card className="h-fit p-5 sm:p-6">
          <h2 className="text-xl font-bold text-ink-900">Résumé de la réservation</h2>
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-subtle p-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card">
              <Clock className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <p className="text-sm text-ink-600">Durée</p>
              <p className="text-3xl font-bold text-ink-900">{duration > 0 ? formatDuration(duration) : "—"}</p>
              <p className="text-sm text-ink-700">{date ? `Le ${formatNumeric(date)} de ${start} à ${end}` : "Date à préciser"}</p>
            </div>
          </div>
          <div className="mt-4 space-y-4 divide-y divide-line">
            <div className="flex items-start gap-3">
              {conflicts.length ? (
                <CircleAlert className="h-8 w-8 shrink-0 fill-danger-500 text-white" aria-hidden />
              ) : (
                <CircleCheck className="h-8 w-8 shrink-0 fill-success-500 text-white" aria-hidden />
              )}
              <div>
                <p className="font-semibold text-ink-900">Disponibilité de la ressource</p>
                {conflicts.length ? (
                  <>
                    <p className="text-lg font-semibold text-danger-600">Créneau indisponible</p>
                    <p className="text-sm text-ink-600">Chevauche : {conflicts.map((c) => `${c.title} (${c.start}–${c.end})`).join(", ")}.</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-success-700">Disponibilité vérifiée</p>
                    <p className="text-sm text-ink-600">La ressource est disponible sur ce créneau.</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3 pt-4">
              {qualificationLate ? (
                <TriangleAlert className="h-8 w-8 shrink-0 fill-warn-500 text-white" aria-hidden />
              ) : (
                <CircleCheck className="h-8 w-8 shrink-0 fill-success-500 text-white" aria-hidden />
              )}
              <div>
                <p className="font-semibold text-ink-900">Vérification de la ressource</p>
                {qualificationLate ? (
                  <>
                    <p className="text-lg font-semibold text-warn-700">Qualification à renouveler</p>
                    <p className="text-sm text-ink-600">Vérification prévue le {formatNumeric(resource!.qualification.next)}, avant la date demandée.</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-success-700">Vérification documentaire effectuée</p>
                    <p className="text-sm text-ink-600">La ressource peut être réservée.</p>
                  </>
                )}
              </div>
            </div>
            {project && (
              <p className="pt-4 text-sm text-ink-600">
                {project.code} • {project.name}
                {lot ? ` — ${lot.code}` : ""} · {activity}
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" size="lg" className="min-w-40" onClick={() => router.push("/planning?vue=ressources")}>
          Annuler
        </Button>
        <Button size="lg" icon={<CalendarDays className="h-5 w-5" />} onClick={confirm} disabled={invalid} guide={conflicts.length ? 34 : undefined}>
          Confirmer la réservation
        </Button>
        <Link href={`/planning?semaine=${date}`} className="flex items-center gap-1 px-2 font-semibold text-brand-700 hover:underline">
          Voir le planning
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <ConflictModal
        key={`conflict-${conflictKey}`}
        request={request}
        open={conflictOpen}
        onClose={() => setConflictOpen(false)}
        onUse={(slot) => {
          setResourceId(slot.resourceId);
          setStart(slot.start);
          setEnd(slot.end);
          setDate(slot.date);
          setConflictOpen(false);
          toast.show({ title: "Créneau mis à jour", description: `${slot.resourceId} — ${slot.start} à ${slot.end}. Confirmez la réservation.`, tone: "info" });
        }}
      />
      {conflictOpen ? <ScreenRef n={34} label="Conflit de réservation" /> : <ScreenRef n={33} label="Réserver une ressource" />}
    </>
  );
}
