"use client";

import { BarChart3, Box, CalendarDays, ChevronRight, CircleCheck, Clock, FileText, FlaskConical, Pencil, Play, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput, Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { lotConditions } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { PilotLot, Project } from "@/lib/types";
import { findPilot } from "./lot-frame";

const CONDITION_ICONS = { formule: FileText, "mode-operatoire": FileText, matieres: Box, reservation: Settings } as const;

export function MoModal({ pilot, open, onClose }: { pilot: PilotLot; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="md" title={`Mode opératoire ${pilot.mo.code} ${pilot.mo.version}`} subtitle={pilot.mo.label}>
      <Badge tone="success" dot size="md">
        {pilot.mo.status} le {formatNumeric(pilot.mo.approvedAt)}
      </Badge>
      <ol className="mt-4 space-y-3">
        {pilot.steps.map((s, i) => (
          <li key={s.key} className="flex gap-3 rounded-xl border border-line p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
            <div className="text-sm">
              <p className="font-semibold text-ink-900">{s.title}</p>
              <p className="text-ink-600">{s.instruction}</p>
              <p className="mt-1 text-xs text-ink-500">
                Équipement : {s.equipment} • {s.equipmentLabel}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function EditPreparationModal({ project, pilot, open, onClose }: { project: Project; pilot: PilotLot; open: boolean; onClose: () => void }) {
  const [date, setDate] = useState(pilot.plannedDate);
  const [responsible, setResponsible] = useState(pilot.responsible);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Modifier la préparation"
      subtitle={`Lot pilote ${pilot.lotCode}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!date}
            onClick={() => {
              labActions.updatePreparation(project.code, pilot.lotCode, { plannedDate: date, responsible });
              toast.show({ title: "Préparation modifiée", description: `Date prévue : ${formatNumeric(date)} — ${responsible}.` });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date prévue" required htmlFor="prep-date">
          <DateInput id="prep-date" value={date} onChange={setDate} />
        </Field>
        <Field label="Responsable" htmlFor="prep-owner">
          <Select id="prep-owner" options={["Production", "Responsable production", "Pharmacien responsable"]} value={responsible} onChange={(e) => setResponsible(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: typeof User; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-3 py-2 text-[15px]">
      <Icon className="mt-0.5 h-5 w-5 text-ink-600" strokeWidth={1.6} aria-hidden />
      <span className="text-ink-600">{label}</span>
      <span className="font-semibold text-ink-900">{children}</span>
    </div>
  );
}

export function LotPreparationView({ slug, lotSlug }: { slug: string; lotSlug: string }) {
  const state = useDemo();
  const router = useRouter();
  const go = useGuideNav();
  const guideStart = useGuideTarget(36);
  const [moOpen, setMoOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const { project, pilot } = findPilot(state, slug, lotSlug);
  if (!project || !pilot) return null;

  const conditions = lotConditions(state, project.code, pilot.lotCode);
  const ready = conditions.every((c) => c.done);
  const equipment = state.resources.find((r) => r.id === pilot.equipment);
  const fixHref: Record<string, string> = {
    formule: `/projets/${project.slug}/formules/comparaison?examen=1`,
    reservation: "/activites/act-lp01",
  };
  const ORDER = ["formule", "mode-operatoire", "matieres", "reservation"];
  const cards = [...conditions].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)).map((c) => ({
    ...c,
    heading: c.key === "formule" ? `Formule ${pilot.formula}` : c.key === "mode-operatoire" ? `Mode opératoire ${pilot.mo.code}` : c.key === "matieres" ? "Matières disponibles" : `${equipment?.name ?? pilot.equipment}`,
    sub: c.done
      ? c.key === "formule"
        ? "Approuvée"
        : c.key === "mode-operatoire"
          ? "Approuvé"
          : c.key === "matieres"
            ? "Stock vérifié"
            : "Réservé"
      : c.key === "formule"
        ? "Décision à approuver"
        : c.key === "reservation"
          ? "À réserver"
          : "En attente",
  }));

  const start = () => {
    labActions.startLot(project.code, pilot.lotCode);
    toast.show({ title: `Fabrication du lot ${pilot.lotCode} démarrée`, description: "L'étape de pesée est ouverte ; l'activité de préparation est clôturée." });
    if (guideStart) {
      toast.show({ title: "Parcours : pesée terminée", description: "L'étape de mélange est en cours depuis 09:00.", tone: "info" });
      go(36);
    } else router.push(`/projets/${project.slug}/lots/${pilot.lotCode.toLowerCase()}/execution`);
  };

  return (
    <>
      <Card className="mt-5 p-5">
        <h2 className="text-xl font-bold text-ink-900">Conditions préalables</h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => {
            const Icon = CONDITION_ICONS[c.key as keyof typeof CONDITION_ICONS] ?? FileText;
            const content = (
              <>
                {c.done ? (
                  <CircleCheck className="absolute left-3 top-3 h-7 w-7 fill-success-500 text-white" aria-hidden />
                ) : (
                  <Clock className="absolute left-3 top-3 h-7 w-7 text-warn-600" aria-hidden />
                )}
                <Icon className="ml-8 h-9 w-9 shrink-0 text-ink-700" strokeWidth={1.4} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-bold text-ink-900">{c.heading}</span>
                  <span className={cn("block text-sm", c.done ? "text-ink-600" : "font-semibold text-warn-700")}>{c.sub}</span>
                </span>
              </>
            );
            const cls = cn(
              "relative flex min-h-24 items-center gap-4 rounded-xl border px-4 py-4",
              c.done ? "border-success-100 bg-success-50/70" : "border-warn-100 bg-warn-50/70 hover:border-warn-200",
            );
            return (
              <li key={c.key}>
                {!c.done && fixHref[c.key] ? (
                  <Link href={fixHref[c.key]} className={cls}>
                    {content}
                  </Link>
                ) : (
                  <div className={cls}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink-900">Matières pour le lot pilote</h2>
          <ul className="mt-4 space-y-3">
            {pilot.materials.map((m) => (
              <li key={m.code} className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-subtle">
                  <FlaskConical className="h-7 w-7 text-ink-700" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="min-w-36">
                  <span className="block font-bold text-ink-900">{m.name}</span>
                  <span className="block text-sm text-ink-600">{m.code}</span>
                </span>
                <span className="border-l border-line pl-4">
                  <span className="block text-xs text-ink-500">Lot sélectionné</span>
                  <span className="block font-bold text-ink-900">{m.lot}</span>
                </span>
                <Badge tone={m.verified ? "success" : "warn"} icon={m.verified ? CircleCheck : Clock} size="md" className="ml-auto rounded-full px-3 py-1.5">
                  {m.verified ? "Stock vérifié" : "À vérifier"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink-900">Détails de préparation</h2>
          <div className="mt-3 divide-y divide-transparent">
            <DetailRow icon={CalendarDays} label="Date prévue">
              {formatNumeric(pilot.plannedDate)}
            </DetailRow>
            <DetailRow icon={Settings} label="Équipement">
              {pilot.equipment} • {equipment?.label ?? "Mélangeur"}
            </DetailRow>
            <DetailRow icon={User} label="Responsable">
              {pilot.responsible}
            </DetailRow>
            <DetailRow icon={FileText} label="Mode opératoire">
              {pilot.mo.code}
              <button type="button" onClick={() => setMoOpen(true)} className="mt-1 flex cursor-pointer items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                Voir le mode opératoire <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </DetailRow>
          </div>
          <div className="mt-2 border-t border-line pt-2">
            <DetailRow icon={BarChart3} label="Méthode de contrôle">
              <Link href="/methodes/m-01" className="hover:text-brand-700 hover:underline">
                {pilot.controlMethod} • Dosage PA
              </Link>
              <span className="block text-sm font-normal text-ink-600">(méthode analytique)</span>
            </DetailRow>
          </div>
          <div className="mt-4 space-y-3">
            {pilot.status === "Préparation" && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                icon={<Pencil className="h-5 w-5" />}
                onClick={() => {
                  setEditKey((k) => k + 1);
                  setEditOpen(true);
                }}
              >
                Modifier la préparation
              </Button>
            )}
            <Button variant="outline" size="lg" className="w-full" icon={<FileText className="h-5 w-5" />} onClick={() => setMoOpen(true)}>
              Voir le mode opératoire
            </Button>
            {pilot.status === "Préparation" ? (
              <>
                <Button size="lg" className="w-full" icon={<Play className="h-5 w-5 fill-white" />} disabled={!ready} onClick={start} guide={36}>
                  Démarrer le lot
                </Button>
                {!ready && <p className="text-center text-sm text-ink-500">Disponible lorsque toutes les conditions préalables sont remplies.</p>}
              </>
            ) : (
              <LinkButton href={`/projets/${project.slug}/lots/${pilot.lotCode.toLowerCase()}/execution`} size="lg" className="w-full" icon={<Play className="h-5 w-5" />} guide={36}>
                Suivre l&apos;exécution
              </LinkButton>
            )}
          </div>
        </Card>
      </div>
      <MoModal pilot={pilot} open={moOpen} onClose={() => setMoOpen(false)} />
      <EditPreparationModal key={`edit-${editKey}`} project={project} pilot={pilot} open={editOpen} onClose={() => setEditOpen(false)} />
      <ScreenRef n={pilot.lotCode === "LP-01" ? 35 : undefined} label="Lot pilote — préparation" />
    </>
  );
}
