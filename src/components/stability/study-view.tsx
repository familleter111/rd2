"use client";

import { CalendarDays, ChartNoAxesColumn, EllipsisVertical, FileText, Info, Paperclip, Pencil, Plus, Save, Send, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { MetaLine, ACTIONS_TRIGGER_CLASS, actionsTrigger } from "@/components/project-context-header";
import { EVENT_ICONS } from "@/components/project/project-overview";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, DateInput, Field, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Breadcrumb, ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { PEOPLE_LAB } from "@/lib/data-lab";
import { DEMO_TODAY, addMonths, formatDateTime, formatNumeric } from "@/lib/format";
import { labActions, useDemo } from "@/lib/store";
import type { StabilityProtocol, StabilityStudy } from "@/lib/types";

type Tab = "protocole" | "echeancier" | "resultats" | "documents" | "historique";

const STORAGE = ["25 °C / 60 % HR (long terme)", "30 °C / 65 % HR (intermédiaire)", "30 °C / 75 % HR (zone IVb)", "40 °C / 75 % HR (accéléré)"];
const PACKAGING = ["Blister de démonstration", "Flacon PEHD", "Flacon verre type I", "Tube aluminium"];
const RESPONSIBLES = [PEOPLE_LAB.marie.name, PEOPLE_LAB.sophie.name, PEOPLE_LAB.thomas.name];
const EXTRA_MILESTONES: [string, number][] = [
  ["M1", 1],
  ["M9", 9],
  ["M18", 18],
  ["M24", 24],
  ["M36", 36],
];

function ProtocolForm({ study, protocol }: { study: StabilityStudy; protocol: StabilityProtocol }) {
  const state = useDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(protocol);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const editable = protocol.status === "Brouillon";
  const set = <K extends keyof StabilityProtocol>(key: K, value: StabilityProtocol[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const project = state.projects.find((p) => p.code === study.projectCode);
  const formulas = [...new Set(state.lots.filter((l) => l.projectCode === study.projectCode).map((l) => l.formula))];
  const lots = state.lots.filter((l) => l.projectCode === study.projectCode);
  const allTests = draft.tests.every((t) => t.selected);
  const missingStorage = !draft.storage;
  const noTests = !draft.tests.some((t) => t.selected);
  const used = new Set(draft.milestones.map((m) => m.code));

  const save = (silent = false) => labActions.saveStudyProtocol(study.id, draft, silent);

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Informations générales</h2>
            <fieldset disabled={!editable} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Projet" required htmlFor="sp-project">
                <Select id="sp-project" options={[{ value: study.projectCode, label: project ? `${project.code} • ${project.name}` : study.projectCode }]} value={study.projectCode} disabled />
              </Field>
              <Field label="Responsable" required htmlFor="sp-owner">
                <Select id="sp-owner" icon={User} options={[...new Set([draft.responsible, ...RESPONSIBLES])]} value={draft.responsible} onChange={(e) => set("responsible", e.target.value)} />
              </Field>
              <Field label="Formule" required htmlFor="sp-formula">
                <Select id="sp-formula" options={formulas} value={draft.formula} onChange={(e) => set("formula", e.target.value)} />
              </Field>
              <Field label="Date de mise en stabilité" required htmlFor="sp-date" hint={draft.startDate ? `T0 le ${formatNumeric(draft.startDate)}` : "À planifier — peut être fixée après soumission."}>
                <DateInput id="sp-date" value={draft.startDate} onChange={(v) => set("startDate", v)} onClear={() => set("startDate", "")} />
              </Field>
              <Field label={study.lotLabel.includes("pilote") ? "Lot pilote" : "Lot"} required htmlFor="sp-lot">
                <Select id="sp-lot" options={lots.map((l) => l.code)} value={draft.lot} onChange={(e) => set("lot", e.target.value)} />
              </Field>
              <Field
                label="Condition de stockage"
                required
                htmlFor="sp-storage"
                info="Condition ICH de conservation des échantillons (température / humidité relative)."
                error={missingStorage && editable ? "À définir avant la soumission." : null}
              >
                <Select id="sp-storage" placeholder="À définir" options={STORAGE} value={draft.storage} invalid={missingStorage} onChange={(e) => set("storage", e.target.value)} />
              </Field>
              <div className="hidden md:block" />
              <Field label="Conditionnement" required htmlFor="sp-pack">
                <Select id="sp-pack" options={[...new Set([draft.packaging, ...PACKAGING])]} value={draft.packaging} onChange={(e) => set("packaging", e.target.value)} />
              </Field>
            </fieldset>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-ink-900">
                Essais à réaliser
                <Info className="h-4 w-4 text-ink-400" aria-label="Essais réalisés à chaque échéance du protocole" />
              </h2>
              <button type="button" onClick={() => setConditionsOpen(true)} className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
                Conditions et fréquence selon le protocole approuvé
              </button>
            </div>
            <div className="relative mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="bg-subtle text-ink-700">
                    <th className="w-12 px-4 py-3">
                      <Checkbox checked={allTests} disabled={!editable} onChange={(v) => set("tests", draft.tests.map((t) => ({ ...t, selected: v })))} label={<span className="sr-only">Tout sélectionner</span>} />
                    </th>
                    <th className="px-4 py-3 font-semibold">Essai</th>
                    <th className="px-4 py-3 font-semibold">Méthode</th>
                    <th className="px-4 py-3 font-semibold">Équipement</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {draft.tests.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={t.selected}
                          disabled={!editable}
                          onChange={(v) => set("tests", draft.tests.map((x) => (x.id === t.id ? { ...x, selected: v } : x)))}
                          label={<span className="sr-only">{t.name}</span>}
                        />
                      </td>
                      <td className="px-4 py-3 text-ink-900">{t.name}</td>
                      <td className="px-4 py-3 text-ink-800">{t.method}</td>
                      <td className="px-4 py-3 font-medium text-ink-900">{t.equipment}</td>
                      <td className="px-4 py-3 text-ink-700">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {noTests && <p className="mt-2 text-sm text-danger-600">Sélectionnez au moins un essai.</p>}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-ink-900">Échéances de suivi</h2>
              {editable && (
                <Menu
                  label="Ajouter une échéance"
                  widthClass="w-56"
                  triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-brand-300 bg-white px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  trigger={
                    <>
                      <Plus className="h-4 w-4" aria-hidden />
                      Ajouter une échéance
                    </>
                  }
                  items={EXTRA_MILESTONES.filter(([code]) => !used.has(code)).map(([code, months]) => ({
                    label: code,
                    description: `${months} mois après la mise en stabilité`,
                    onSelect: () =>
                      set(
                        "milestones",
                        [...draft.milestones, { id: `ms-${code}`, code, months, status: "À planifier" as const }].sort((a, b) => a.months - b.months),
                      ),
                  }))}
                />
              )}
            </div>
            <ol className="mt-3 space-y-1">
              {draft.milestones.map((m, i) => (
                <li key={m.id} className="relative flex items-start gap-3 rounded-xl py-2">
                  {i < draft.milestones.length - 1 && <span className="absolute left-[21px] top-12 h-[calc(100%-28px)] w-px bg-line-strong" aria-hidden />}
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-extrabold text-ink-900 ring-1 ring-brand-100">{m.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-ink-900">{m.code}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {m.date ? formatNumeric(m.date) : draft.startDate ? formatNumeric(addMonths(draft.startDate, m.months)) : "À planifier"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{m.status === "À planifier" ? "Exemple de calendrier à valider" : m.status}</p>
                  </div>
                  {editable && (
                    <Menu
                      label={`Actions pour ${m.code}`}
                      items={[{ label: "Retirer l'échéance", icon: Trash2, tone: "danger", onSelect: () => set("milestones", draft.milestones.filter((x) => x.id !== m.id)) }]}
                    />
                  )}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Documents associés</h2>
            {draft.documents.length === 0 ? (
              <p className="mt-3 flex items-center gap-3 text-sm text-ink-600">
                <FileText className="h-8 w-8 text-ink-500" strokeWidth={1.3} aria-hidden />
                Aucun document associé pour le moment.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {draft.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                    <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                    <span className="flex-1 font-medium text-ink-900">{d.name}</span>
                    <span className="text-ink-500">{formatNumeric(d.date)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" className="mt-3" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()} disabled={!editable}>
              Ajouter un document
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) set("documents", [...draft.documents, { id: `d-${Date.now().toString(36)}`, name: file.name, date: DEMO_TODAY }]);
                e.target.value = "";
              }}
            />
          </Card>
        </div>
      </div>

      {editable ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className="flex min-w-72 flex-1 items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-ink-700">
            <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
            Le protocole doit être soumis pour planifier les échéances et démarrer la mise en stabilité.
          </p>
          <Button
            variant="outline"
            size="lg"
            icon={<Save className="h-5 w-5" />}
            onClick={() => {
              save();
              toast.show({ title: "Brouillon enregistré", description: `Protocole de stabilité ${study.id}.` });
            }}
          >
            Enregistrer le brouillon
          </Button>
          <div className="relative">
            <Button
              size="lg"
              icon={<Send className="h-5 w-5" />}
              disabled={missingStorage || noTests}
              className="disabled:bg-slate-300"
              onClick={() => {
                save(true);
                labActions.submitStudyProtocol(study.id);
                toast.show({ title: `Protocole ${study.id} soumis`, description: draft.startDate ? "Échéances planifiées à partir de la date de mise en stabilité." : "Planifiez la date de mise en stabilité." });
              }}
            >
              Soumettre le protocole
            </Button>
            {missingStorage && (
              <p role="tooltip" className="absolute bottom-full right-0 mb-2 w-72 rounded-lg bg-ink-800 px-3 py-2 text-xs text-white shadow-pop">
                La condition de stockage doit être renseignée avant de soumettre le protocole.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-3 rounded-xl bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
          <Send className="h-5 w-5" aria-hidden />
          Protocole soumis{protocol.submittedAt ? ` le ${formatDateTime(protocol.submittedAt)}` : ""} — {protocol.storage}, {protocol.packaging}.
        </p>
      )}

      <Modal open={conditionsOpen} onClose={() => setConditionsOpen(false)} size="md" title="Conditions et fréquence" subtitle="Référence : lignes directrices ICH Q1A(R2)">
        <ul className="space-y-2 text-sm">
          {STORAGE.map((s) => (
            <li key={s} className="rounded-lg border border-line px-3 py-2">
              <span className="font-semibold text-ink-900">{s}</span>
              <span className="block text-ink-600">{s.includes("40") ? "0, 3 et 6 mois" : "0, 3, 6, 9, 12, 18, 24 et 36 mois"}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

export function StudyView({ id }: { id: string }) {
  const state = useDemo();
  const study = state.studies.find((s) => s.id.toLowerCase() === id.toLowerCase());
  const [tab, setTab] = useState<Tab>("protocole");

  if (!study) {
    return (
      <>
        <Card className="mt-4">
          <EmptyState icon={ChartNoAxesColumn} title="Étude introuvable" action={<LinkButton href="/stabilite">Retour aux études</LinkButton>} />
        </Card>
        <ScreenRef label="Étude de stabilité" />
      </>
    );
  }

  const project = state.projects.find((p) => p.code === study.projectCode);
  const protocol = study.protocol;
  const events = state.history.filter((h) => h.studyId === study.id).sort((a, b) => b.at.localeCompare(a.at));
  const status = protocol ? protocol.status : study.status;

  return (
    <>
      <Breadcrumb items={[{ label: "Stabilité", href: "/stabilite" }, { label: study.id }]} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] font-extrabold tracking-tight text-ink-900 sm:text-[36px]">
              {study.id} <span className="text-ink-400">•</span> Protocole de stabilité
            </h1>
            <Badge tone={protocol?.status === "Soumis" ? "info" : "warn"} icon={Pencil} size="md" className="rounded-lg px-3 py-1.5 text-[15px]">
              {status}
            </Badge>
          </div>
          <MetaLine
            className="mt-1"
            items={[
              <span key="p">
                Projet <strong className="text-ink-800">{project ? `${project.code} • ${project.name}` : study.projectCode}</strong>
              </span>,
              <span key="f">
                Formule <strong className="text-ink-800">{study.formula}</strong>
              </span>,
              <span key="l">
                {study.lotLabel.includes("pilote") ? "Lot pilote" : "Lot"} <strong className="text-ink-800">{study.lotCode}</strong>
              </span>,
              study.dosage,
            ]}
          />
        </div>
        <Menu
          label="Actions"
          widthClass="w-64"
          triggerClassName={ACTIONS_TRIGGER_CLASS}
          trigger={actionsTrigger("Actions")}
          items={[
            { label: "Toutes les études", icon: ChartNoAxesColumn, href: "/stabilite" },
            ...(project ? [{ label: "Fiche projet", icon: FileText, href: `/projets/${project.slug}` }] : []),
            { label: "Planning (étuves)", icon: CalendarDays, href: "/planning?vue=ressources" },
          ]}
        />
      </div>
      <Tabs
        className="mt-4"
        items={[
          { value: "protocole", label: "Protocole" },
          { value: "echeancier", label: "Échéancier" },
          { value: "resultats", label: "Résultats" },
          { value: "documents", label: "Documents" },
          { value: "historique", label: "Historique", count: events.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {!protocol ? (
        <Card className="mt-5">
          <EmptyState
            icon={FileText}
            title="Aucun protocole associé"
            description="Le protocole doit être préparé avant de démarrer l'étude."
            action={
              <Button
                icon={<FileText className="h-4 w-4" />}
                onClick={() => {
                  labActions.prepareStudyProtocol(study.id);
                  toast.show({ title: `Protocole ${study.id} créé` });
                }}
              >
                Préparer le protocole
              </Button>
            }
          />
        </Card>
      ) : tab === "protocole" ? (
        <ProtocolForm key={`${protocol.status}-${protocol.updatedAt}`} study={study} protocol={protocol} />
      ) : tab === "echeancier" ? (
        <Card className="mt-5 p-5">
          <ul className="divide-y divide-line rounded-xl border border-line">
            {protocol.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-12 font-bold text-ink-900">{m.code}</span>
                <span className="flex-1 text-ink-700">{m.months ? `${m.months} mois` : "Mise en stabilité"}</span>
                <span className="text-ink-800">{m.date ? formatNumeric(m.date) : "À planifier"}</span>
                <Badge tone={m.status === "Planifiée" ? "info" : m.status === "Réalisée" ? "success" : "neutral"} dot>
                  {m.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : tab === "resultats" ? (
        <Card className="mt-5">
          <EmptyState icon={ChartNoAxesColumn} title="Aucun résultat" description="Les résultats de stabilité apparaîtront après la première échéance (T0)." />
        </Card>
      ) : tab === "documents" ? (
        <Card className="mt-5 p-5">
          {protocol.documents.length === 0 ? (
            <EmptyState icon={FileText} title="Aucun document" description="Ajoutez des documents depuis l'onglet Protocole." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {protocol.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                  <span className="flex-1 text-ink-900">{d.name}</span>
                  <span className="text-ink-500">{formatNumeric(d.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="mt-5 p-5">
          {events.length === 0 ? (
            <EmptyState icon={EllipsisVertical} title="Aucun événement" />
          ) : (
            <ol className="space-y-3">
              {events.map((e) => {
                const Icon = EVENT_ICONS[e.icon];
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
                    <Icon className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
                    <span className="flex-1">
                      <span className="block font-semibold text-ink-900">{e.title}</span>
                      <span className="block text-ink-600">{e.description}</span>
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
      <Link href="/stabilite" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
        Retour aux études de stabilité
      </Link>
      <ScreenRef n={study.id === "ST-01" ? 41 : undefined} label="Stabilité — protocole" />
    </>
  );
}
