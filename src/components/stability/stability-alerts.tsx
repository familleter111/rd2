"use client";

import { CalendarDays, Check, ChevronRight, Clock, ExternalLink, Info, Layers, RotateCcw, TriangleAlert, User, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { PEOPLE_LAB } from "@/lib/data-lab";
import { formatNumeric } from "@/lib/format";
import { labActions, useDemo } from "@/lib/store";
import type { StabilityAlert, StabilityAlertLevel, StabilityAlertStatus, StabilityStudy, Tone } from "@/lib/types";
import { useTeam } from "@/lib/people";

const LEVELS: StabilityAlertLevel[] = ["Faible", "Moyen", "Élevé"];
const STATUSES: StabilityAlertStatus[] = ["Ouverte", "Prise en charge", "Résolue"];
const DEMO_ASSIGNEES = [PEOPLE_LAB.julie, PEOPLE_LAB.thomas, PEOPLE_LAB.sophie, PEOPLE_LAB.claireD, PEOPLE_LAB.marie];

const LEVEL_LOOK: Record<StabilityAlertLevel, { tone: Tone; icon: LucideIcon; iconClass: string; card: string; chip: string }> = {
  Faible: { tone: "info", icon: Info, iconClass: "fill-brand-600 text-white", card: "border-brand-300 bg-brand-50/60", chip: "bg-brand-50 text-brand-700" },
  Moyen: { tone: "warn", icon: TriangleAlert, iconClass: "fill-warn-500 text-white", card: "border-warn-500/60 bg-warn-50", chip: "bg-warn-50 text-warn-700" },
  Élevé: { tone: "danger", icon: TriangleAlert, iconClass: "fill-danger-500 text-white", card: "border-danger-200 bg-danger-50", chip: "bg-danger-50 text-danger-700" },
};

const STATUS_TONE: Record<StabilityAlertStatus, Tone> = { Ouverte: "warn", "Prise en charge": "info", Résolue: "success" };

/** Study tab to open for an alert. */
const TAB_OF: Record<StabilityAlert["origin"], string> = { Échéancier: "echeancier", Résultats: "resultats", Documentation: "protocole" };

type Row = { study: StabilityStudy; alert: StabilityAlert };

function AlertDetail({ row }: { row: Row }) {
  const ASSIGNEES = useTeam(DEMO_ASSIGNEES);
  const router = useRouter();
  const { study, alert: a } = row;
  const look = LEVEL_LOOK[a.level];
  const setStatus = (status: StabilityAlertStatus, message: string) => {
    labActions.updateStabilityAlert(study.id, a.id, { status });
    toast.show({ title: message, description: `${study.id} • ${a.title}` });
  };
  const info: { icon: LucideIcon; label: string; value: ReactNode }[] = [
    { icon: CalendarDays, label: "Origine", value: a.origin },
    { icon: Clock, label: "Échéance", value: a.due ? formatNumeric(a.due) : "À confirmer" },
    { icon: User, label: "Responsable", value: a.responsible },
    {
      icon: Layers,
      label: "Statut",
      value: (
        <Badge tone={STATUS_TONE[a.status]} size="md">
          {a.status}
        </Badge>
      ),
    },
  ];

  return (
    <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink-900">
            {study.id} <span className="text-ink-400">•</span> {study.lotCode}
          </h2>
          <p className="mt-1 text-lg text-ink-800">{a.title}</p>
        </div>
        <Badge tone={look.tone} icon={look.icon} size="md" className="rounded-full px-3 py-1.5">
          Niveau : {a.level}
        </Badge>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-4">
        {info.map((i, k) => (
          <div key={i.label} className={cn("flex items-start gap-3", k % 2 === 1 && "border-l border-line pl-6")}>
            <i.icon className="mt-0.5 h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
            <div>
              <dt className="text-sm text-ink-600">{i.label}</dt>
              <dd className="mt-0.5 text-[16px] text-ink-900">{i.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <h3 className="mt-4 font-bold text-ink-900">Description</h3>
      <p className="mt-1 text-[15px] text-ink-700">{a.description}</p>

      <h3 className="mt-5 border-t border-line pt-4 font-bold text-ink-900">Actions</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 [&_button]:px-3 [&_button]:text-[14px] [&_a]:px-3 [&_a]:text-[14px]">
        <Button size="lg" icon={<ExternalLink className="h-5 w-5" />} onClick={() => router.push(`/stabilite/${study.id.toLowerCase()}?onglet=${TAB_OF[a.origin]}`)}>
          Ouvrir l&apos;étude
        </Button>
        {a.activityId ? (
          <LinkButton href={`/activites/${a.activityId}`} variant="outline" size="lg" icon={<CalendarDays className="h-5 w-5" />}>
            Voir l&apos;activité
          </LinkButton>
        ) : (
          <Button
            variant="outline"
            size="lg"
            icon={<CalendarDays className="h-5 w-5" />}
            disabled={a.status === "Résolue"}
            onClick={() => {
              labActions.createAlertActivity(study.id, a.id);
              toast.show({ title: "Activité créée", description: `« ${a.title} » — ${a.responsible}, dans Mes activités.` });
            }}
          >
            Créer une activité
          </Button>
        )}
        <Menu
          label="Assigner"
          className="w-full"
          align="left"
          widthClass="w-72"
          triggerClassName="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-brand-300 bg-white text-[15px] font-semibold text-brand-700 hover:bg-brand-50"
          trigger={
            <>
              <User className="h-5 w-5" aria-hidden />
              Assigner
            </>
          }
          items={ASSIGNEES.map((p) => ({
            label: p.name,
            description: p.role,
            icon: p.name === a.responsible ? Check : User,
            disabled: p.name === a.responsible,
            onSelect: () => {
              labActions.updateStabilityAlert(study.id, a.id, { responsible: p.name });
              toast.show({ title: "Alerte assignée", description: `${a.title} → ${p.name}.` });
            },
          }))}
        />
        {a.status === "Ouverte" ? (
          <Button size="lg" icon={<Check className="h-5 w-5" />} onClick={() => setStatus("Prise en charge", "Alerte prise en charge")}>
            Marquer comme prise en charge
          </Button>
        ) : a.status === "Prise en charge" ? (
          <Button size="lg" icon={<Check className="h-5 w-5" />} onClick={() => setStatus("Résolue", "Alerte résolue")}>
            Marquer comme résolue
          </Button>
        ) : (
          <Button variant="outline" size="lg" icon={<RotateCcw className="h-5 w-5" />} onClick={() => setStatus("Ouverte", "Alerte rouverte")}>
            Rouvrir l&apos;alerte
          </Button>
        )}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
        <Info className="mt-0.5 h-6 w-6 shrink-0 fill-brand-600 text-white" aria-hidden />
        <div>
          <p className="font-semibold text-brand-700">Note</p>
          <p className="text-sm text-ink-700">La prise en charge ne valide pas les résultats.</p>
        </div>
      </div>
    </Card>
  );
}

/** "Alertes" tab of the stability module (screen 44). */
export function StabilityAlerts({ initialAlert }: { initialAlert?: string }) {
  const state = useDemo();
  const [project, setProject] = useState("Tous");
  const [owner, setOwner] = useState("Tous");
  const [level, setLevel] = useState("Tous");
  const [status, setStatus] = useState("Toutes");
  const all: Row[] = state.studies.flatMap((study) => study.alerts.map((alert) => ({ study, alert })));
  const rows = all
    .filter((r) => project === "Tous" || r.study.projectCode === project)
    .filter((r) => owner === "Tous" || r.alert.responsible === owner)
    .filter((r) => level === "Tous" || r.alert.level === level)
    .filter((r) => status === "Toutes" || r.alert.status === status)
    // Open alerts first; among them, the ones without a confirmed due date, then by due date.
    .sort(
      (a, b) =>
        Number(a.alert.status === "Résolue") - Number(b.alert.status === "Résolue") ||
        (a.alert.due ?? "").localeCompare(b.alert.due ?? ""),
    );
  const [selectedId, setSelectedId] = useState<string | null>(initialAlert ?? null);
  const selected = rows.find((r) => r.alert.id === selectedId) ?? rows[0];
  const projects = [...new Set(state.studies.map((s) => s.projectCode))];

  return (
    <>
      <Card className="mt-5 grid grid-cols-4 gap-4 p-4">
        <label className="text-sm font-semibold text-ink-800">
          Projet
          <Select
            className="mt-1.5"
            options={[{ value: "Tous", label: "Tous les projets" }, ...projects.map((code) => ({ value: code, label: `${code} • ${state.projects.find((p) => p.code === code)?.name ?? ""}` }))]}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold text-ink-800">
          Responsable
          <Select className="mt-1.5" options={[{ value: "Tous", label: "Tous les responsables" }, ...new Set(all.map((r) => r.alert.responsible))]} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </label>
        <label className="text-sm font-semibold text-ink-800">
          Niveau
          <Select className="mt-1.5" options={[{ value: "Tous", label: "Tous les niveaux" }, ...LEVELS]} value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label className="text-sm font-semibold text-ink-800">
          Statut
          <Select className="mt-1.5" options={[{ value: "Toutes", label: "Toutes les alertes" }, ...STATUSES]} value={status} onChange={(e) => setStatus(e.target.value)} />
        </label>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="h-fit p-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-xl font-bold text-ink-900">Alertes de stabilité</h2>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
              {rows.length} alerte{rows.length > 1 ? "s" : ""}
            </span>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={TriangleAlert} title="Aucune alerte" description="Aucune alerte ne correspond aux filtres." />
          ) : (
            <ul className="mt-3 space-y-3">
              {rows.map((r) => {
                const look = LEVEL_LOOK[r.alert.level];
                const active = r.alert.id === selected?.alert.id;
                const resolved = r.alert.status === "Résolue";
                return (
                  <li key={r.alert.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedId(r.alert.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors",
                        active ? look.card : "border-line bg-white hover:border-brand-200",
                        resolved && !active && "opacity-70",
                      )}
                    >
                      <look.icon className={cn("h-9 w-9 shrink-0", look.iconClass)} strokeWidth={1.6} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold text-ink-900">
                          {r.study.id} <span className="text-ink-400">•</span> {r.study.lotCode}
                        </span>
                        <span className="block text-[16px] text-ink-800">{r.alert.title}</span>
                        <span className="mt-2 flex flex-wrap gap-2">
                          <span className={cn("rounded-md px-2 py-0.5 text-sm", look.chip)}>{r.alert.origin}</span>
                          <span className={cn("rounded-md px-2 py-0.5 text-sm", resolved ? "bg-success-50 text-success-700" : look.chip)}>{resolved ? "Résolue" : r.alert.status === "Prise en charge" ? "Prise en charge" : r.alert.tag}</span>
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {selected && <AlertDetail row={selected} />}
      </div>
    </>
  );
}
