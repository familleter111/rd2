"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronRight,
  CirclePlus,
  Copy,
  Database,
  FilePlus2,
  FileText,
  FlaskConical,
  FolderOpen,
  Plus,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GuideSpot } from "@/components/guide/guide-mark";
import { ProjectContextHeader } from "@/components/project-context-header";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, SearchInput, Segmented, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { PEOPLE_LAB } from "@/lib/data-lab";
import { DEMO_TODAY, addDays, formatNumeric, plural } from "@/lib/format";
import { nextMethodRef } from "@/lib/lab";
import { ANALYSIS_STATUS, methodNextAction, methodStatus, methodTodo } from "@/lib/lab-selectors";
import { NoProject } from "@/components/no-project";
import { findProject } from "@/lib/selectors";
import { actions, getDemoState, labActions, useDemo } from "@/lib/store";
import type { Method, Person, Project } from "@/lib/types";
import { useTeam } from "@/lib/people";

type Tab = "methodes" | "demandes" | "resultats";

const TYPES: Method["type"][] = ["Méthode analytique", "Essai pharmacotechnique"];
const ANALYSES = ["Dosage", "Dissolution", "Caractéristiques", "Identification", "Impuretés", "Microbiologie"];
const DEMO_OWNERS: Person[] = [PEOPLE_LAB.sophie, PEOPLE_LAB.thomas, PEOPLE_LAB.claireD, PEOPLE_LAB.marc];

function Detail({ icon: Icon, label, value, sub }: { icon: typeof User; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="text-[13px] text-ink-500">{label}</p>
        <div className="font-semibold text-ink-900">{value}</div>
        {sub && <div className="text-[13px] leading-snug text-ink-500">{sub}</div>}
      </div>
    </div>
  );
}

function MethodCard({ method, project, onArchive }: { method: Method; project?: Project; onArchive: () => void }) {
  const state = useDemo();
  const router = useRouter();
  const status = methodStatus(state, method);
  const next = methodNextAction(state, method);
  const href = `/methodes/${method.ref.toLowerCase()}`;

  return (
    <GuideSpot step={23} active={method.ref === "M-01"} hint="Ouvrez la méthode M-01 • Dosage PA." className="rounded-xl">
      <Card className="relative p-5 transition-colors hover:border-brand-200">
        <div className="flex items-start gap-4">
          <IconTile icon={FileText} size="lg" className="hidden sm:flex" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-10">
              <h3 className="text-xl font-bold text-ink-900">
                <Link href={href} className="after:absolute after:inset-0 after:rounded-xl hover:text-brand-700 focus-visible:outline-none">
                  {method.ref} <span className="text-ink-400">•</span> {method.name}
                </Link>
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[13px] font-medium text-ink-700">{method.technique}</span>
              <Badge tone={status.tone} dot size="md">
                {status.label}
              </Badge>
            </div>
            <p className="mt-1.5 text-[15px] text-ink-600">{method.description}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Detail
            icon={FlaskConical}
            label="Projet"
            value={project ? `${project.code} • ${project.name}` : method.projectCode}
            sub={project ? `${project.formLabel} | ${project.dosage}` : undefined}
          />
          <Detail icon={Database} label="Équipement" value={method.equipment.code} sub={method.equipment.label} />
          <Detail icon={User} label="Responsable" value={method.owner.name} sub={method.owner.role} />
          <Detail icon={CalendarDays} label="Prochaine action" value={next.label} sub={next.date ? formatNumeric(next.date) : "—"} />
        </div>
        <div className="absolute right-4 top-4 z-10">
          <Menu
            label={`Actions pour ${method.ref}`}
            widthClass="w-56"
            items={[
              { label: "Ouvrir", icon: FolderOpen, onSelect: () => router.push(href) },
              {
                label: "Créer une version",
                icon: FilePlus2,
                onSelect: () => {
                  labActions.newMethodVersion(method.ref);
                  toast.show({ title: `Nouvelle version de ${method.ref}`, description: `Version v${method.versions.length + 1} ouverte en brouillon.` });
                },
              },
              {
                label: "Dupliquer",
                icon: Copy,
                onSelect: () => {
                  const ref = nextMethodRef(getDemoState());
                  labActions.duplicateMethod(method.ref);
                  toast.show({ title: `Méthode ${ref} créée`, description: `Copie de ${method.ref} • ${method.name}.`, action: { label: "Ouvrir", href: `/methodes/${ref.toLowerCase()}` } });
                },
              },
              method.archived
                ? {
                    label: "Restaurer",
                    icon: ArchiveRestore,
                    onSelect: () => {
                      labActions.restoreMethod(method.ref);
                      toast.show({ title: `${method.ref} restaurée` });
                    },
                  }
                : { label: "Archiver", icon: Archive, onSelect: onArchive },
            ]}
          />
        </div>
      </Card>
    </GuideSpot>
  );
}

function TodoPanel({ methods, project }: { methods: Method[]; project: Project }) {
  const state = useDemo();
  const todos = methods.map((m) => ({ m, todo: methodTodo(state, m) })).filter((x) => x.todo);
  const groups = [
    { kind: "protocole" as const, title: "Protocoles à préparer" },
    { kind: "resultats" as const, title: "Résultats à valider" },
  ];

  return (
    <Card className="h-fit p-4 xl:sticky xl:top-[96px]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-ink-900">À traiter</h2>
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-50 px-2 text-sm font-bold text-brand-700">{todos.length}</span>
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((g) => {
          const list = todos.filter((x) => x.todo?.kind === g.kind);
          return (
            <section key={g.kind} className="rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <h3 className="font-semibold text-ink-900">{g.title}</h3>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-bold text-ink-700">{list.length}</span>
              </div>
              {list.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-500">Rien à traiter.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {list.map(({ m, todo }) => (
                    <li key={m.ref}>
                      <Link
                        href={`/methodes/${m.ref.toLowerCase()}${g.kind === "resultats" && m.lifecycle ? "/validation" : ""}`}
                        className="group flex items-center gap-3 px-3 py-3 hover:bg-subtle"
                      >
                        <IconTile icon={FileText} size="md" className="bg-slate-100 text-ink-700" />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block font-semibold text-ink-900">
                            {m.ref} <span className="ml-1.5">{m.name}</span>
                          </span>
                          <span className="block text-ink-500">
                            {project.code} • {project.name}
                          </span>
                          <span className="block text-ink-500">{todo?.due ? formatNumeric(todo.due) : "—"}</span>
                        </span>
                        <ChevronRight className="h-5 w-5 text-ink-500 group-hover:text-brand-700" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <Link
        href="/activites"
        className="mt-3 flex h-11 items-center justify-center gap-2 rounded-lg border border-brand-300 font-semibold text-brand-700 hover:bg-brand-50"
      >
        Voir toutes les tâches
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </Card>
  );
}

function NewMethodDrawer({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const OWNERS = useTeam(DEMO_OWNERS);
  const router = useRouter();
  const [name, setName] = useState("");
  const [technique, setTechnique] = useState("");
  const [type, setType] = useState<Method["type"]>("Méthode analytique");
  const [analysis, setAnalysis] = useState("");
  const [origin, setOrigin] = useState<Method["origin"]>("Interne");
  const [equipmentCode, setEquipmentCode] = useState("");
  const [owner, setOwner] = useState(OWNERS[0].name);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { resources } = useDemo();
  const equipment = resources.filter((r) => r.category === "Équipement");
  const errors = {
    name: !name.trim() ? "Renseignez l'intitulé." : null,
    technique: !technique.trim() ? "Précisez la technique (ex. CLHP)." : null,
    analysis: !analysis ? "Choisissez un type d'analyse." : null,
    equipment: !equipmentCode ? "Choisissez l'équipement principal." : null,
    description: description.trim().length < 10 ? "Décrivez la méthode (10 caractères minimum)." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);

  const create = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const ref = nextMethodRef(getDemoState());
    const res = resources.find((r) => r.id === equipmentCode);
    labActions.addMethod({
      name: name.trim(),
      technique: technique.trim(),
      description: description.trim(),
      analysis,
      type,
      origin,
      projectCode: project.code,
      equipmentCode,
      equipmentLabel: res?.label ?? equipmentCode,
      owner: OWNERS.find((o) => o.name === owner) ?? OWNERS[0],
    });
    toast.show({ title: `Méthode ${ref} créée`, description: `${name.trim()} — applicabilité à confirmer.` });
    onClose();
    router.push(`/methodes/${ref.toLowerCase()}`);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nouvelle méthode"
      subtitle={`Ajouter une méthode au projet ${project.code} • ${project.name}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Annuler
          </Button>
          <Button size="lg" onClick={create}>
            Créer la méthode
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Intitulé" required htmlFor="m-name" error={show(errors.name)}>
          <Input id="m-name" placeholder="Ex. Teneur en eau" value={name} invalid={Boolean(show(errors.name))} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Technique" required htmlFor="m-tech" error={show(errors.technique)}>
            <Input id="m-tech" placeholder="Ex. CLHP" value={technique} invalid={Boolean(show(errors.technique))} onChange={(e) => setTechnique(e.target.value)} />
          </Field>
          <Field label="Type d'analyse" required htmlFor="m-analysis" error={show(errors.analysis)}>
            <Select id="m-analysis" placeholder="Sélectionner" options={ANALYSES} value={analysis} invalid={Boolean(show(errors.analysis))} onChange={(e) => setAnalysis(e.target.value)} />
          </Field>
        </div>
        <Field label="Catégorie">
          <Segmented label="Catégorie" options={TYPES.map((t) => ({ value: t, label: t === "Méthode analytique" ? "Analytique" : "Pharmacotechnique" }))} value={type} onChange={setType} />
        </Field>
        <Field label="Origine">
          <Segmented label="Origine" options={[{ value: "Interne", label: "Interne" }, { value: "Pharmacopée", label: "Pharmacopée" }]} value={origin} onChange={setOrigin} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Équipement principal" required htmlFor="m-equip" error={show(errors.equipment)}>
            <Select
              id="m-equip"
              placeholder="Sélectionner"
              options={equipment.map((r) => ({ value: r.id, label: `${r.id} — ${r.label}` }))}
              value={equipmentCode}
              invalid={Boolean(show(errors.equipment))}
              onChange={(e) => setEquipmentCode(e.target.value)}
            />
          </Field>
          <Field label="Responsable" htmlFor="m-owner">
            <Select id="m-owner" options={OWNERS.map((o) => ({ value: o.name, label: `${o.name} — ${o.role}` }))} value={owner} onChange={(e) => setOwner(e.target.value)} />
          </Field>
        </div>
        <Field label="Description" required htmlFor="m-desc" error={show(errors.description)}>
          <Textarea id="m-desc" rows={3} maxLength={300} value={description} invalid={Boolean(show(errors.description))} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}

function NewRequestDrawer({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const state = useDemo();
  const lots = state.lots.filter((l) => l.projectCode === project.code);
  const methods = state.methods.filter((m) => m.projectCode === project.code && !m.archived);
  const [lotCode, setLotCode] = useState("");
  const [method, setMethod] = useState("");
  const [due, setDue] = useState(addDays(DEMO_TODAY, 7));
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    lot: !lotCode ? "Sélectionnez un lot." : null,
    method: !method ? "Sélectionnez une méthode." : null,
    due: !due ? "Indiquez une échéance." : due < DEMO_TODAY ? "L'échéance ne peut pas être passée." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Créer une demande d'analyse"
      subtitle={`Demander une analyse au laboratoire pour ${project.code} • ${project.name}.`}
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
              const m = methods.find((x) => x.ref === method)!;
              const ref = actions.addAnalysisRequest({ projectCode: project.code, lotCode, analysis: m.name, method, due, comment: comment.trim() || undefined });
              toast.show({ title: `Demande ${ref} créée`, description: `${m.name} sur le lot ${lotCode} — échéance ${formatNumeric(due)}.` });
              onClose();
            }}
          >
            Créer la demande
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Lot" required htmlFor="da-lot" error={show(errors.lot)}>
          <Select
            id="da-lot"
            placeholder="Sélectionner un lot"
            options={lots.map((l) => ({ value: l.code, label: `${l.code} — ${l.formula} (${l.status})` }))}
            value={lotCode}
            invalid={Boolean(show(errors.lot))}
            onChange={(e) => setLotCode(e.target.value)}
          />
        </Field>
        <Field label="Méthode" required htmlFor="da-method" error={show(errors.method)}>
          <Select
            id="da-method"
            placeholder="Sélectionner une méthode"
            options={methods.map((m) => ({ value: m.ref, label: `${m.ref} — ${m.name}` }))}
            value={method}
            invalid={Boolean(show(errors.method))}
            onChange={(e) => setMethod(e.target.value)}
          />
        </Field>
        <Field label="Échéance" required htmlFor="da-due" error={show(errors.due)}>
          <DateInput id="da-due" value={due} onChange={setDue} invalid={Boolean(show(errors.due))} />
        </Field>
        <Field label="Commentaire" htmlFor="da-comment" optional>
          <Textarea id="da-comment" rows={3} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}

export function MethodsView({
  slug,
  initialTab,
  openNewRequest,
}: {
  slug: string;
  initialTab: Tab;
  openNewRequest: boolean;
}) {
  const state = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const project = findProject(state, slug) ?? state.projects[0];
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [methodOpen, setMethodOpen] = useState(false);
  const [methodKey, setMethodKey] = useState(0);
  const [requestOpen, setRequestOpen] = useState(openNewRequest);
  const [requestKey, setRequestKey] = useState(0);
  const [archiving, setArchiving] = useState<Method | null>(null);

  if (!project) {
    return <NoProject title="Méthodes & essais" subtitle="Catalogue des méthodes, demandes d'analyse et résultats." description="Les méthodes sont rattachées à un projet : créez un premier projet pour ajouter des méthodes et demander des analyses." />;
  }

  const all = state.methods.filter((m) => m.projectCode === project.code);
  const statuses = [...new Set(all.map((m) => methodStatus(state, m).label))];
  const q = query.trim().toLowerCase();
  const methods = all
    .filter((m) => statusFilter === "Tous" || methodStatus(state, m).label === statusFilter)
    .filter((m) => typeFilter === "Tous" || m.type === typeFilter)
    .filter((m) => !q || `${m.ref} ${m.name} ${m.technique} ${m.analysis} ${m.equipment.code} ${m.equipment.label}`.toLowerCase().includes(q))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.ref.localeCompare(b.ref, "fr", { numeric: true }));
  const requests = state.analysisRequests.filter((r) => r.projectCode === project.code);
  const analyses = state.analyses.filter((a) => a.projectCode === project.code);

  return (
    <>
      <ProjectContextHeader
        project={project}
        crumbs={[{ label: "Méthodes & essais" }]}
        switchHref={(s) => `/methodes?projet=${s}`}
        actions={[
          {
            label: "Nouvelle demande d'analyse",
            icon: Plus,
            onSelect: () => {
              setRequestKey((k) => k + 1);
              setRequestOpen(true);
            },
          },
        ]}
      />
      <Tabs
        className="mt-5"
        items={[
          { value: "methodes", label: "Méthodes" },
          { value: "demandes", label: "Demandes d'analyse", count: requests.length },
          { value: "resultats", label: "Résultats", count: analyses.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "methodes" && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto]">
            <SearchInput value={query} onChange={setQuery} placeholder="Rechercher une méthode (nom, analyse, équipement…)" className="[&_input]:h-12 [&_input]:bg-white" />
            <Select aria-label="Filtrer par statut" options={[{ value: "Tous", label: "Tous les statuts" }, ...statuses]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="[&_select]:h-12" />
            <Select aria-label="Filtrer par type" options={[{ value: "Tous", label: "Tous les types" }, ...TYPES]} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="[&_select]:h-12" />
            <Button
              size="lg"
              icon={<CirclePlus className="h-5 w-5" />}
              onClick={() => {
                setMethodKey((k) => k + 1);
                setMethodOpen(true);
              }}
            >
              Nouvelle méthode
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="min-w-0 space-y-4">
              {methods.length === 0 ? (
                <Card>
                  <EmptyState icon={FlaskConical} title="Aucune méthode" description="Aucune méthode ne correspond à la recherche ou aux filtres." />
                </Card>
              ) : (
                methods.map((m) => <MethodCard key={m.ref} method={m} project={project} onArchive={() => setArchiving(m)} />)
              )}
              <p className="px-1 text-sm text-ink-500">
                {methods.length} {plural(methods.length, "méthode")} affichée{methods.length > 1 ? "s" : ""} sur {all.length}
              </p>
            </div>
            <TodoPanel methods={all} project={project} />
          </div>
        </>
      )}

      {tab === "demandes" && (
        <Card className="mt-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
            <p className="text-sm text-ink-700">
              {requests.length} {plural(requests.length, "demande")} pour {project.code}
            </p>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setRequestKey((k) => k + 1);
                setRequestOpen(true);
              }}
            >
              Nouvelle demande
            </Button>
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[15px]">
              <thead>
                <tr className="bg-subtle text-sm text-ink-700">
                  <th className="rounded-l-lg px-4 py-2.5 font-semibold">Référence</th>
                  <th className="px-4 py-2.5 font-semibold">Lot</th>
                  <th className="px-4 py-2.5 font-semibold">Analyse</th>
                  <th className="px-4 py-2.5 font-semibold">Méthode</th>
                  <th className="px-4 py-2.5 font-semibold">Échéance</th>
                  <th className="px-4 py-2.5 font-semibold">Demandeur</th>
                  <th className="rounded-r-lg px-4 py-2.5 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {requests.map((r) => (
                  <tr key={r.ref}>
                    <td className="px-4 py-3 font-semibold text-ink-900">{r.ref}</td>
                    <td className="px-4 py-3 text-ink-800">{r.lotCode}</td>
                    <td className="px-4 py-3 text-ink-800">{r.analysis}</td>
                    <td className="px-4 py-3">
                      <Link href={`/methodes/${r.method.toLowerCase()}`} className="text-brand-700 hover:underline">
                        {r.method}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-800">{formatNumeric(r.due)}</td>
                    <td className="px-4 py-3 text-ink-800">{r.requester}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.status.tone} dot>
                        {r.status.label}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-500">
                      Aucune demande d&apos;analyse pour ce projet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "resultats" && (
        <Card className="mt-5 p-4">
          {analyses.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun résultat d'essai"
              description="Les résultats apparaissent ici dès qu'un essai est lancé depuis l'onglet « Essais » d'une méthode (protocole approuvé)."
              action={
                <Button variant="outline" onClick={() => router.push("/methodes/m-01")}>
                  Ouvrir la méthode M-01
                </Button>
              }
            />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[15px]">
                <thead>
                  <tr className="bg-subtle text-sm text-ink-700">
                    <th className="rounded-l-lg px-4 py-2.5 font-semibold">Essai</th>
                    <th className="px-4 py-2.5 font-semibold">Méthode</th>
                    <th className="px-4 py-2.5 font-semibold">Lot</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Résultats</th>
                    <th className="rounded-r-lg px-4 py-2.5 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {analyses.map((a) => {
                    const filled = a.results.filter((r) => r.value.trim()).length;
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-3">
                          <Link href={`/methodes/${a.methodRef.toLowerCase()}/analyses/${a.id.toLowerCase()}`} className="font-semibold text-brand-700 hover:underline">
                            {a.id}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-800">{a.methodRef}</td>
                        <td className="px-4 py-3 text-ink-800">
                          {a.lotCode} ({a.formula})
                        </td>
                        <td className="px-4 py-3 text-ink-800">{formatNumeric(a.date)}</td>
                        <td className="px-4 py-3 text-ink-800">
                          {filled} / {a.results.length}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={ANALYSIS_STATUS[a.status].tone} dot>
                            {a.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <NewMethodDrawer key={`m-${methodKey}`} project={project} open={methodOpen} onClose={() => setMethodOpen(false)} />
      <NewRequestDrawer
        key={`r-${requestKey}`}
        project={project}
        open={requestOpen}
        onClose={() => {
          setRequestOpen(false);
          if (openNewRequest) router.replace(`${pathname}?projet=${project.slug}&onglet=demandes`, { scroll: false });
        }}
      />
      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        title={`Archiver ${archiving?.ref ?? ""} ?`}
        message="La méthode reste consultable et restaurable ; elle n'apparaît plus dans les tâches à traiter."
        confirmLabel="Archiver"
        danger
        onConfirm={() => {
          if (!archiving) return;
          labActions.archiveMethod(archiving.ref);
          toast.show({ title: `${archiving.ref} archivée`, tone: "info" });
        }}
      />
      <ScreenRef n={22} label="Méthodes & essais — catalogue" />
    </>
  );
}
