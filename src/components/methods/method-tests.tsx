"use client";

import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  FileText,
  FlaskConical,
  House,
  Info,
  Package,
  Pill,
  Play,
  Plus,
  Repeat,
  Save,
  TestTube,
  User,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { Stepper } from "@/components/ui/stepper";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { PEOPLE_LAB, defaultTestPlan } from "@/lib/data-lab";
import { DEMO_TODAY, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { nextAnalysisId } from "@/lib/lab";
import { ANALYSIS_STATUS, analysesOf } from "@/lib/lab-selectors";
import { getDemoState, labActions, useDemo } from "@/lib/store";
import type { Method, Person, TestPlan } from "@/lib/types";
import { findMethodBySlug } from "./method-frame";
import { useTeam } from "@/lib/people";

const DEMO_ANALYSTS: Person[] = [PEOPLE_LAB.marie, PEOPLE_LAB.julien, PEOPLE_LAB.thomas];
const CONSUMABLES = ["Phase mobile préparée", "Filtres seringue 0,45 µm", "Flacons d'injection", "Étalon de référence", "Colonne de rechange"];
const STEPS = [
  { title: "Échantillons", subtitle: "Sélection des échantillons" },
  { title: "Ressources", subtitle: "Équipement et consommables" },
  { title: "Vérification", subtitle: "Contrôle et lancement" },
];

function SummaryRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[22px_110px_minmax(0,1fr)] items-start gap-2 py-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 text-ink-500" strokeWidth={1.7} aria-hidden />
      <span className="text-ink-600">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function CheckRow({ ok, warn, title, detail, action }: { ok: boolean; warn?: boolean; title: string; detail: string; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
      {ok ? (
        <CircleCheck className="h-6 w-6 shrink-0 fill-success-500 text-white" aria-hidden />
      ) : (
        <CircleAlert className={cn("h-6 w-6 shrink-0 text-white", warn ? "fill-warn-500" : "fill-danger-500")} aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-900">{title}</span>
        <span className="block text-sm text-ink-500">{detail}</span>
      </span>
      {action}
    </li>
  );
}

function PlanWizard({ method, initial, onCancel }: { method: Method; initial: TestPlan; onCancel?: () => void }) {
  const ANALYSTS = useTeam(DEMO_ANALYSTS);
  const state = useDemo();
  const router = useRouter();
  const go = useGuideNav();
  const guideLaunch = useGuideTarget(26);
  const [plan, setPlan] = useState<TestPlan>(initial);
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof TestPlan>(key: K, value: TestPlan[K]) => setPlan((p) => ({ ...p, [key]: value }));

  const project = state.projects.find((p) => p.code === method.projectCode);
  const lots = state.lots.filter((l) => l.projectCode === method.projectCode);
  const lot = lots.find((l) => l.code === plan.lotCode);
  const formulas = [...new Set(lots.map((l) => l.formula))];
  const lotSamples = state.samples.filter((s) => s.projectCode === method.projectCode && s.lotCode === plan.lotCode);
  const available = lotSamples.filter((s) => !plan.samples.includes(s.code));
  const resource = state.resources.find((r) => r.id === plan.equipment);
  const equipmentOptions = state.resources.filter((r) => r.category === "Équipement" && (r.type === resource?.type || r.id === method.equipment.code));
  const reservation = state.events.find((e) => e.kind === "reservation" && e.resourceIds.includes(plan.equipment) && e.projectCode === method.projectCode && e.date >= DEMO_TODAY);
  const qualifiedForMethod = !resource?.qualifiedFor || resource.qualifiedFor.includes(method.ref);
  const protocol = method.protocol!;

  const errors = {
    lot: !plan.lotCode ? "Sélectionnez un lot." : null,
    formula: !plan.formula ? "Sélectionnez la formule." : null,
    samples: plan.samples.length === 0 ? "Sélectionnez au moins un échantillon." : null,
    equipment: !plan.equipment ? "Choisissez l'équipement." : null,
  };
  const stepErrors = plan.step === 1 ? [errors.lot, errors.formula, errors.samples] : plan.step === 2 ? [errors.equipment] : Object.values(errors);
  const show = (e: string | null) => (attempted ? e : null);

  const persist = (next: TestPlan) => labActions.saveTestPlan(next);

  const goStep = (step: 1 | 2 | 3) => {
    setAttempted(false);
    const next = { ...plan, step };
    setPlan(next);
    persist(next);
  };

  const launch = () => {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
    persist(plan);
    const id = nextAnalysisId(getDemoState());
    labActions.launchTests(method.ref);
    toast.show({ title: `Essais lancés — ${id}`, description: `${plan.samples.length} échantillons du lot ${plan.lotCode} à analyser (${plan.repetitions} répétitions).` });
    if (guideLaunch) {
      toast.show({ title: "Parcours : saisie en cours", description: "L'analyste a déjà saisi 2 résultats sur 3.", tone: "info" });
      go(26);
    } else router.push(`/methodes/${method.ref.toLowerCase()}/analyses/${id.toLowerCase()}`);
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <Card className="p-5 sm:p-6">
          <h2 className="text-2xl font-bold text-ink-900">Préparer les essais — {method.ref}</h2>
          <p className="mt-1 text-[15px] text-ink-600">Configurer les échantillons et les ressources pour lancer la séquence d&apos;essais.</p>
          <Stepper steps={STEPS} current={plan.step} onStepClick={(n) => goStep(n as 1 | 2 | 3)} className="mt-5" />

          {plan.step === 1 && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Projet" required htmlFor="tp-project">
                  <Select id="tp-project" options={[{ value: method.projectCode, label: project ? `${project.code} • ${project.name}` : method.projectCode }]} value={method.projectCode} disabled />
                </Field>
                <Field label="Lot" required htmlFor="tp-lot" error={show(errors.lot)}>
                  <Select
                    id="tp-lot"
                    placeholder="Sélectionner un lot"
                    options={lots.map((l) => ({ value: l.code, label: `${l.code} • ${l.type === "Pilote" ? "Lot pilote" : l.type === "Essai" ? "Lot d'essai" : "Lot échantillon"}` }))}
                    value={plan.lotCode}
                    invalid={Boolean(show(errors.lot))}
                    onChange={(e) => {
                      const l = lots.find((x) => x.code === e.target.value);
                      setPlan((p) => ({ ...p, lotCode: e.target.value, formula: l?.formula ?? p.formula, samples: [] }));
                    }}
                  />
                </Field>
                <Field label="Formule" required htmlFor="tp-formula" error={show(errors.formula)}>
                  <Select id="tp-formula" placeholder="Sélectionner" options={formulas} value={plan.formula} invalid={Boolean(show(errors.formula))} onChange={(e) => set("formula", e.target.value)} />
                </Field>
                <Field label="Analyse" required htmlFor="tp-analysis">
                  <Select id="tp-analysis" options={[method.name]} value={method.name} disabled />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="tp-rep" className="text-[15px] font-semibold text-ink-800">
                  Nombre de répétitions <span className="text-danger-600">*</span>
                </label>
                <Select id="tp-rep" options={["1", "2", "3", "4", "6"]} value={String(plan.repetitions)} onChange={(e) => set("repetitions", Number(e.target.value))} className="w-28" />
                <span className="flex items-center gap-1.5 text-sm text-ink-500">
                  Chaque échantillon sera analysé {plan.repetitions} fois
                  <Info className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-ink-900">
                    Échantillons sélectionnés ({plan.samples.length}/{lotSamples.length})
                  </h3>
                  <Menu
                    label="Ajouter un échantillon"
                    widthClass="w-72"
                    triggerClassName="inline-flex h-10 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                    trigger={
                      <>
                        <Plus className="h-4 w-4" aria-hidden />
                        Ajouter un échantillon
                      </>
                    }
                    items={[
                      ...available.map((s) => ({
                        label: s.code,
                        description: `${s.type} — ${s.quantity} ${s.unit}`,
                        onSelect: () => set("samples", [...plan.samples, s.code]),
                      })),
                      ...(available.length === 0 ? [{ label: "Aucun autre échantillon", disabled: true }] : []),
                      {
                        label: "Enregistrer un prélèvement",
                        icon: Plus,
                        href: `/projets/${project?.slug ?? "cs-01"}/formules/lots?lot=${plan.lotCode}`,
                        separatorBefore: true,
                      },
                    ]}
                  />
                </div>
                {show(errors.samples) && <p className="mt-2 text-sm text-danger-600">{errors.samples}</p>}
                {plan.samples.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-500">
                    {plan.lotCode ? "Aucun échantillon sélectionné." : "Choisissez un lot pour sélectionner ses échantillons."}
                  </p>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {plan.samples.map((code, i) => (
                      <li key={code} className="relative flex items-start gap-3 rounded-xl border border-line p-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                          <TestTube className="h-6 w-6" strokeWidth={1.6} aria-hidden />
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className="block font-bold text-ink-900">{code}</span>
                          <span className="block text-ink-500">
                            {method.projectCode} / {plan.lotCode} / {plan.formula}
                          </span>
                          <span className="block text-ink-500">Échantillon n° {i + 1}</span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Retirer ${code}`}
                          onClick={() => set("samples", plan.samples.filter((x) => x !== code))}
                          className="absolute right-2 top-2 cursor-pointer rounded p-1 text-ink-500 hover:text-danger-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {plan.step === 2 && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Équipement"
                  required
                  htmlFor="tp-equipment"
                  error={show(errors.equipment)}
                  hint={resource ? `${resource.label} — qualification ${resource.qualification.status.toLowerCase()} (prochaine vérification ${formatNumeric(resource.qualification.next)})` : undefined}
                >
                  <Select id="tp-equipment" options={equipmentOptions.map((r) => r.id)} value={plan.equipment} onChange={(e) => set("equipment", e.target.value)} />
                </Field>
                <Field label="Colonne" htmlFor="tp-column">
                  <Input id="tp-column" value={plan.column} onChange={(e) => set("column", e.target.value)} />
                </Field>
                <Field label="Analyste" required htmlFor="tp-analyst">
                  <Select
                    id="tp-analyst"
                    options={ANALYSTS.map((a) => ({ value: a.name, label: `${a.name} — ${a.role}` }))}
                    value={plan.analyst.name}
                    onChange={(e) => set("analyst", ANALYSTS.find((a) => a.name === e.target.value) ?? plan.analyst)}
                  />
                </Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-[15px] font-semibold text-ink-800">Consommables</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CONSUMABLES.map((c) => (
                    <Checkbox
                      key={c}
                      checked={plan.consumables.includes(c)}
                      onChange={(checked) => set("consumables", checked ? [...plan.consumables, c] : plan.consumables.filter((x) => x !== c))}
                      label={c}
                    />
                  ))}
                </div>
              </fieldset>
              <div className={cn("flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm", reservation ? "bg-success-50" : "bg-warn-50")}>
                {reservation ? <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden /> : <CircleAlert className="h-5 w-5 fill-warn-500 text-white" aria-hidden />}
                <span className="flex-1 text-ink-700">
                  {reservation
                    ? `${plan.equipment} réservé le ${formatNumeric(reservation.date)} de ${reservation.start} à ${reservation.end}.`
                    : `${plan.equipment} n'est pas encore réservé pour ces essais.`}
                </span>
                {!reservation && (
                  <LinkButton href={`/planning/reservation?ressource=${plan.equipment}&date=2026-10-07&debut=11:00&fin=13:00`} variant="outline" size="sm">
                    Réserver
                  </LinkButton>
                )}
              </div>
            </div>
          )}

          {plan.step === 3 && (
            <ul className="mt-6 space-y-2.5">
              <CheckRow ok title={`Protocole ${protocol.version} approuvé`} detail={`Approuvé le ${formatNumeric(protocol.approvedAt ?? protocol.updatedAt)}.`} />
              <CheckRow
                ok={plan.samples.length > 0}
                title={`${plan.samples.length} échantillon(s) — ${plan.samples.length * plan.repetitions} injections`}
                detail={`Lot ${plan.lotCode || "—"}, formule ${plan.formula || "—"}, ${plan.repetitions} répétitions.`}
              />
              <CheckRow
                ok={qualifiedForMethod && resource?.qualification.status === "Qualifié"}
                warn={qualifiedForMethod}
                title={`Équipement ${plan.equipment}`}
                detail={
                  !qualifiedForMethod
                    ? `Compatibilité à vérifier : ${plan.equipment} n'est pas qualifié pour ${method.ref}.`
                    : resource?.qualification.status === "Qualifié"
                      ? "Qualification à jour."
                      : `Qualification à vérifier avant le ${formatNumeric(resource?.qualification.next ?? DEMO_TODAY)} — utilisation possible.`
                }
              />
              <CheckRow
                ok={Boolean(reservation)}
                warn
                title="Réservation de l'équipement"
                detail={reservation ? `Réservé le ${formatNumeric(reservation.date)} (${reservation.start}–${reservation.end}).` : "Réservation recommandée — les essais peuvent être lancés en démonstration."}
              />
              <CheckRow ok title="Responsable des essais" detail={`${plan.analyst.name} — ${plan.analyst.role}.`} />
            </ul>
          )}
        </Card>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            icon={<Save className="h-5 w-5" />}
            onClick={() => {
              persist(plan);
              toast.show({ title: "Brouillon enregistré", description: `Préparation des essais ${method.ref} enregistrée.` });
            }}
          >
            Enregistrer le brouillon
          </Button>
          {onCancel && (
            <Button variant="ghost" size="lg" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <div className="ml-auto flex gap-3">
            {plan.step > 1 && (
              <Button variant="outline" size="lg" icon={<ArrowLeft className="h-5 w-5" />} onClick={() => goStep((plan.step - 1) as 1 | 2)}>
                Retour
              </Button>
            )}
            {plan.step < 3 ? (
              <Button
                size="lg"
                iconRight={<ArrowRight className="h-5 w-5" />}
                guide={26}
                guideHint="Passer les étapes Échantillons et Ressources, puis « Lancer les essais »."
                onClick={() => {
                  setAttempted(true);
                  if (stepErrors.some(Boolean)) return;
                  goStep((plan.step + 1) as 2 | 3);
                }}
              >
                Continuer
              </Button>
            ) : (
              <Button size="lg" icon={<Play className="h-5 w-5" />} onClick={launch} guide={26}>
                Lancer les essais
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
        <h2 className="text-lg font-bold text-ink-900">Récapitulatif</h2>
        <div className="mt-2 divide-y divide-line">
          <SummaryRow icon={House} label="Projet" value={project ? `${project.code} • ${project.name}` : method.projectCode} />
          <SummaryRow icon={FileText} label="Lot" value={lot ? `${lot.code} • ${lot.type === "Pilote" ? "Lot pilote" : "Lot d'essai"}` : "—"} />
          <SummaryRow icon={Pill} label="Formule" value={plan.formula || "—"} />
          <SummaryRow icon={FlaskConical} label="Analyse" value={method.name} />
          <SummaryRow icon={Repeat} label="Répétitions" value={plan.repetitions} />
          <SummaryRow icon={TestTube} label="Échantillons" value={`${plan.samples.length} ${plan.samples.length > 1 ? "échantillons sélectionnés" : "échantillon sélectionné"}`} />
        </div>
        <div className="mt-3 space-y-4 border-t border-line pt-4 text-sm">
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">Responsable des essais</p>
              <p className="text-ink-700">{plan.analyst.role}</p>
              <p className="text-ink-500">{plan.analyst.name}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">Protocole</p>
              <p className="text-ink-700">
                {method.ref} – {protocol.version}
              </p>
              <p className="text-ink-500">Approuvé le {formatNumeric(protocol.approvedAt ?? protocol.updatedAt)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold text-ink-900">Équipement</p>
              <p className="text-ink-700">{plan.equipment}</p>
            </div>
            <Badge tone={reservation ? "success" : "info"} dot size="md" className="rounded-full">
              {reservation ? "Réservé" : "À réserver"}
            </Badge>
          </div>
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">Consommables</p>
              <p className="text-ink-500">{plan.consumables.length} prévu(s)</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function MethodTestsView({ slug }: { slug: string }) {
  const state = useDemo();
  const [fresh, setFresh] = useState(0);
  const method = findMethodBySlug(state, slug);
  if (!method) return null;
  const n = method.ref === "M-01" ? 25 : undefined;
  const plan = state.testPlans.find((p) => p.methodRef === method.ref);
  const analyses = analysesOf(state, method.ref);

  if (method.protocol?.status !== "Approuvé") {
    return (
      <>
        <Card className="mt-5">
          <EmptyState
            icon={FlaskConical}
            title="Protocole à approuver"
            description="Les essais ne peuvent être préparés qu'à partir d'un protocole approuvé par les relecteurs."
            action={<LinkButton href={`/methodes/${method.ref.toLowerCase()}/protocole`}>Voir le protocole</LinkButton>}
          />
        </Card>
        <ScreenRef n={n} label="Méthode — préparer les essais" />
      </>
    );
  }

  const showWizard = plan || analyses.length === 0 || fresh > 0;

  return (
    <>
      {analyses.length > 0 && (
        <Card className="mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink-900">Essais lancés</h2>
            {!showWizard && (
              <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setFresh((k) => k + 1)}>
                Préparer de nouveaux essais
              </Button>
            )}
          </div>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {analyses.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-bold text-ink-900">{a.id}</span>
                <span className="text-sm text-ink-600">
                  Lot {a.lotCode} • {a.formula} • {a.results.length} échantillons • lancé le {formatNumeric(a.date)}
                </span>
                <Badge tone={ANALYSIS_STATUS[a.status].tone} dot className="ml-auto">
                  {a.status}
                </Badge>
                <LinkButton
                  href={a.status === "Brouillon" || a.status === "Correction demandée" ? `/methodes/${method.ref.toLowerCase()}/analyses/${a.id.toLowerCase()}` : `/methodes/${method.ref.toLowerCase()}/validation`}
                  variant="outline"
                  size="sm"
                  guide={a.status === "Brouillon" ? 26 : undefined}
                >
                  {a.status === "Brouillon" || a.status === "Correction demandée" ? "Saisir les résultats" : "Voir la revue"}
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {showWizard && (
        <PlanWizard
          key={`${plan?.updatedAt ?? "new"}-${fresh}`}
          method={method}
          initial={plan ?? defaultTestPlan(method)}
          onCancel={analyses.length > 0 && !plan ? () => setFresh(0) : undefined}
        />
      )}
      <ScreenRef n={n} label="Méthode — préparer les essais" />
    </>
  );
}
