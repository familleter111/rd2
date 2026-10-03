"use client";

import { CalendarDays, ChevronRight, CircleCheck, EllipsisVertical, ExternalLink, FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Breadcrumb, PageHeader, ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { PEOPLE_LAB } from "@/lib/data-lab";
import { formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { nextStudyId } from "@/lib/lab";
import { findProject } from "@/lib/selectors";
import { getDemoState, labActions, useDemo } from "@/lib/store";
import type { StabilityStudy, StudyStatus, Tone } from "@/lib/types";
import { StabilityAlerts } from "./stability-alerts";
import { useTeamNames } from "@/lib/people";

export const STUDY_TONE: Record<StudyStatus, Tone> = {
  "À préparer": "warn",
  "Protocole en cours": "info",
  "Protocole soumis": "info",
  "Protocole approuvé": "success",
  "En cours": "info",
  "En revue": "neutral",
};

type Tab = "etudes" | "echeances" | "alertes";
const DEMO_OWNERS = [PEOPLE_LAB.sophie.name, PEOPLE_LAB.thomas.name, PEOPLE_LAB.claireD.name, PEOPLE_LAB.marie.name];

function NewStudyDrawer({ projectCode, open, onClose, onCreated }: { projectCode: string; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const OWNERS = useTeamNames(DEMO_OWNERS);
  const state = useDemo();
  const [project, setProject] = useState(projectCode);
  const lots = state.lots.filter((l) => l.projectCode === project);
  const [lotCode, setLotCode] = useState("");
  const [owner, setOwner] = useState(OWNERS[0]);
  const [submitted, setSubmitted] = useState(false);
  const lot = lots.find((l) => l.code === lotCode);
  const p = state.projects.find((x) => x.code === project);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nouvelle étude"
      subtitle="Créer une étude de stabilité sur un lot."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="lg"
            onClick={() => {
              setSubmitted(true);
              if (!lot || !p) return;
              const id = nextStudyId(getDemoState());
              const kind = lot.type === "Pilote" ? "lot pilote" : lot.type === "Essai" ? "lot d'essai" : "lot";
              labActions.createStudy({ id, projectCode: project, lotCode: lot.code, lotLabel: `${lot.code} (${kind})`, formula: lot.formula, dosage: p.dosage, owner });
              toast.show({ title: `Étude ${id} créée`, description: `Lot ${lot.code} — protocole à préparer.` });
              onCreated(id);
              onClose();
            }}
          >
            Créer l&apos;étude
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Projet" required htmlFor="ns-project">
          <Select
            id="ns-project"
            options={state.projects.filter((x) => !x.archived).map((x) => ({ value: x.code, label: `${x.code} • ${x.name}` }))}
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setLotCode("");
            }}
          />
        </Field>
        <Field label="Lot" required htmlFor="ns-lot" error={submitted && !lot ? "Sélectionnez un lot." : null}>
          <Select id="ns-lot" placeholder="Sélectionner un lot" options={lots.map((l) => ({ value: l.code, label: `${l.code} — ${l.formula} (${l.type})` }))} value={lotCode} invalid={submitted && !lot} onChange={(e) => setLotCode(e.target.value)} />
        </Field>
        <Field label="Responsable stabilité" required htmlFor="ns-owner">
          <Select id="ns-owner" options={OWNERS} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}

function StudyDetail({ study }: { study: StabilityStudy }) {
  const state = useDemo();
  const router = useRouter();
  const go = useGuideNav();
  const guideOpen = useGuideTarget(41);
  const project = state.projects.find((p) => p.code === study.projectCode);
  const href = `/stabilite/${study.id.toLowerCase()}`;
  const open = (prepare: boolean) => {
    if (prepare && !study.protocol) {
      labActions.prepareStudyProtocol(study.id);
      toast.show({ title: `Protocole ${study.id} créé`, description: "Complétez la condition de stockage puis soumettez le protocole." });
    }
    if (guideOpen && study.id === "ST-01") go(41);
    else router.push(href);
  };
  const rows: [string, string][] = [
    ["Projet", project ? `${project.code} • ${project.name}` : study.projectCode],
    ["Lot", study.lotLabel],
    ["Formule", `${study.formula}  |  ${study.dosage}`],
    ["Responsable stabilité", study.owner],
  ];
  return (
    <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-extrabold text-ink-900">{study.id}</h2>
          <Badge tone={STUDY_TONE[study.status]} size="md" className="rounded-full px-3">
            {study.status}
          </Badge>
        </div>
        <Menu
          label={`Actions pour ${study.id}`}
          trigger={<EllipsisVertical className="h-5 w-5" />}
          triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50"
          items={[
            { label: "Ouvrir l'étude", icon: ExternalLink, onSelect: () => router.push(href) },
            ...(project ? [{ label: "Fiche projet", icon: FileText, href: `/projets/${project.slug}` }] : []),
          ]}
        />
      </div>
      <dl className="mt-4 space-y-2.5 text-[15px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[190px_minmax(0,1fr)] gap-3">
            <dt className="text-ink-600">{k}</dt>
            <dd className="text-ink-900">{v}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[190px_minmax(0,1fr)] items-center gap-3">
          <dt className="text-ink-600">Statut</dt>
          <dd>
            <Badge tone={STUDY_TONE[study.status]} size="md" className="rounded-full">
              {study.status}
            </Badge>
          </dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-line pt-4">
        <h3 className="font-bold text-ink-900">Protocole</h3>
        {study.protocol ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <FileText className="h-10 w-10 text-ink-500" strokeWidth={1.3} aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink-900">Protocole de stabilité — {study.protocol.status.toLowerCase()}</p>
              <p className="text-ink-500">{study.protocol.storage || "Condition de stockage à définir"}</p>
            </div>
            <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={() => open(false)}>
              Voir le protocole
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FileText className="h-6 w-6 text-ink-500" strokeWidth={1.4} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink-900">Aucun protocole associé</p>
              <p className="text-ink-500">Le protocole doit être préparé avant de démarrer l&apos;étude.</p>
            </div>
            <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={() => open(true)} guide={study.id === "ST-01" ? 41 : undefined}>
              Préparer le protocole
            </Button>
          </div>
        )}
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <h3 className="font-bold text-ink-900">Prochaine tâche</h3>
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line-strong">
            <CircleCheck className="h-5 w-5 text-ink-500" aria-hidden />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-ink-900">{study.nextTask.title}</p>
            <p className="text-ink-500">{study.nextTask.detail}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button size="lg" icon={<ExternalLink className="h-5 w-5" />} onClick={() => open(true)}>
          Ouvrir l&apos;étude
        </Button>
      </div>
    </Card>
  );
}

export function StabilityView({ slug, initialTab, initialStudy, initialAlert }: { slug: string; initialTab: Tab; initialStudy?: string; initialAlert?: string }) {
  const state = useDemo();
  const [project, setProject] = useState(findProject(state, slug)?.code ?? (state.demo ? "CS-01" : "Tous"));
  const [lot, setLot] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(initialStudy ?? null);
  const [drawer, setDrawer] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const p = state.projects.find((x) => x.code === project);
  const ofProject = state.studies.filter((s) => project === "Tous" || s.projectCode === project);
  const studies = ofProject
    .filter((s) => lot === "Tous" || s.lotCode === lot)
    .filter((s) => status === "Tous" || s.status === status)
    .sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }) * (order === "asc" ? 1 : -1));
  const selected = studies.find((s) => s.id === selectedId) ?? studies[0];
  const milestones = studies.flatMap((s) => (s.protocol?.milestones ?? []).map((m) => ({ study: s, m })));
  const openAlerts = state.studies.flatMap((s) => s.alerts).filter((a) => a.status !== "Résolue").length;

  return (
    <>
      <Breadcrumb items={tab === "alertes" ? [{ label: "Stabilité" }] : [{ label: "Stabilité", href: "/stabilite" }, { label: tab === "etudes" ? "Études" : "Échéances" }]} />
      <PageHeader
        className="mt-3"
        title={tab === "alertes" ? "Stabilité" : "Études de stabilité"}
        subtitle={
          tab === "alertes" ? (
            "Suivi des études de stabilité et de leurs alertes"
          ) : p ? (
            <span className="flex flex-wrap items-center gap-3">
              <strong className="font-bold text-ink-900">
                {p.code} • {p.name}
              </strong>
              <span className="h-5 w-px bg-line-strong" aria-hidden />
              {p.dosage}
            </span>
          ) : (
            "Tous les projets"
          )
        }
      />
      <Tabs
        className="mt-4"
        items={[
          { value: "etudes", label: "Études" },
          { value: "echeances", label: "Échéances", count: milestones.length },
          { value: "alertes", label: "Alertes", count: openAlerts },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab !== "alertes" && (
      <Card className="mt-5 grid grid-cols-1 items-end gap-4 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-sm font-semibold text-ink-800">
          Projet
          <Select
            className="mt-1.5"
            options={[{ value: "Tous", label: "Tous les projets" }, ...state.projects.map((x) => ({ value: x.code, label: `${x.code} • ${x.name}` }))]}
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setLot("Tous");
              setSelectedId(null);
            }}
          />
        </label>
        <label className="text-sm font-semibold text-ink-800">
          Lot
          <Select className="mt-1.5" options={[{ value: "Tous", label: "Tous les lots" }, ...[...new Set(ofProject.map((s) => s.lotCode))]]} value={lot} onChange={(e) => setLot(e.target.value)} />
        </label>
        <label className="text-sm font-semibold text-ink-800">
          Statut
          <Select className="mt-1.5" options={[{ value: "Tous", label: "Tous les statuts" }, ...[...new Set(state.studies.map((s) => s.status))]]} value={status} onChange={(e) => setStatus(e.target.value)} />
        </label>
        <Button
          size="lg"
          icon={<Plus className="h-5 w-5" />}
          onClick={() => {
            setDrawer((k) => k + 1);
            setDrawerOpen(true);
          }}
        >
          Nouvelle étude
        </Button>
      </Card>
      )}

      {tab === "etudes" && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="h-fit p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <p className="text-lg font-bold text-ink-900">
                {studies.length} étude{studies.length > 1 ? "s" : ""}
              </p>
              <Select
                aria-label="Tri"
                size="sm"
                className="w-56"
                options={[
                  { value: "asc", label: "Tri : Numéro (croissant)" },
                  { value: "desc", label: "Tri : Numéro (décroissant)" },
                ]}
                value={order}
                onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
              />
            </div>
            {studies.length === 0 ? (
              <EmptyState icon={FileText} title="Aucune étude" description="Aucune étude ne correspond aux filtres." />
            ) : (
              <ul className="mt-3 space-y-3">
                {studies.map((s) => {
                  const active = s.id === selected?.id;
                  const sp = state.projects.find((x) => x.code === s.projectCode);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                          active ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-3">
                            <span className="text-xl font-extrabold text-ink-900">{s.id}</span>
                            <Badge tone={STUDY_TONE[s.status]} size="md" className="rounded-full">
                              {s.status}
                            </Badge>
                          </span>
                          <span className="mt-2 grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                            <span className="text-ink-600">Projet</span>
                            <span className="text-ink-900">{sp ? `${sp.code} • ${sp.name}` : s.projectCode}</span>
                            <span className="text-ink-600">Lot</span>
                            <span className="text-ink-900">{s.lotLabel}</span>
                            <span className="text-ink-600">Prochaine tâche</span>
                            <span className="text-ink-900">{s.nextTask.title}</span>
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
          {selected && <StudyDetail study={selected} />}
        </div>
      )}

      {tab === "echeances" && (
        <Card className="mt-5 p-4">
          {milestones.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Aucune échéance" description="Les échéances apparaissent une fois le protocole préparé." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead>
                  <tr className="bg-subtle text-sm text-ink-700">
                    <th className="rounded-l-lg px-4 py-2.5 font-semibold">Étude</th>
                    <th className="px-4 py-2.5 font-semibold">Lot</th>
                    <th className="px-4 py-2.5 font-semibold">Échéance</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="rounded-r-lg px-4 py-2.5 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {milestones.map(({ study, m }) => (
                    <tr key={`${study.id}-${m.id}`}>
                      <td className="px-4 py-3 font-semibold text-ink-900">{study.id}</td>
                      <td className="px-4 py-3 text-ink-800">{study.lotLabel}</td>
                      <td className="px-4 py-3 text-ink-800">{m.code}</td>
                      <td className="px-4 py-3 text-ink-800">{m.date ? formatNumeric(m.date) : "À planifier"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={m.status === "Réalisée" ? "success" : m.status === "Planifiée" ? "info" : "neutral"} dot>
                          {m.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "alertes" && <StabilityAlerts initialAlert={initialAlert} />}

      <NewStudyDrawer
        key={`ns-${drawer}`}
        projectCode={project === "Tous" ? (state.demo ? "CS-01" : (state.projects[0]?.code ?? "")) : project}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={(id) => {
          setTab("etudes");
          setSelectedId(id);
        }}
      />
      {tab === "alertes" ? (
        <ScreenRef n={44} label="Stabilité — alertes" />
      ) : tab === "echeances" ? (
        <ScreenRef label="Stabilité — échéances" />
      ) : (
        <ScreenRef n={40} label="Stabilité — études" />
      )}
    </>
  );
}
