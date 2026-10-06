"use client";

import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Database,
  ExternalLink,
  FileText,
  FlaskConical,
  Lock,
  MessageSquareText,
  Package,
  Pencil,
  Plus,
  SquareArrowOutUpRight,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, DateInput, Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { VerticalStepper } from "@/components/ui/stepper";
import { SegmentTabs, Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { LOT_UNITS, PEOPLE, STANDARD_TESTS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, addDays, formatLong, formatNumber, formatNumeric, formatShort, plural } from "@/lib/format";
import { findProject, LOT_STATUS_TONE, projectFormulas } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Lot, LotType, Method, Project, Sample, TestResult } from "@/lib/types";
import { TestStatusText } from "./formula-bits";
import { FormulaSubTabs, ProjectTabs } from "./project-frame";

const TYPE_LABEL: Record<LotType, string> = { Essai: "Lot d'essai", Pilote: "Lot pilote", Échantillon: "Lot échantillon" };
const TABS: { value: LotType; label: string }[] = [
  { value: "Essai", label: "Lots d'essai" },
  { value: "Pilote", label: "Lots pilotes" },
  { value: "Échantillon", label: "Échantillons" },
];

function defaultUnit(project: Project) {
  return project.kind === "comprime" ? "comprimés" : project.kind === "gelule" ? "gélules" : project.kind === "solution" ? "flacons" : "kg";
}

function LotCard({ lot, selected, onSelect, onSample }: { lot: Lot; selected: boolean; onSelect: () => void; onSample: () => void }) {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-white p-5 shadow-card transition-colors",
        selected ? "border-brand-500 ring-1 ring-brand-300" : "border-line hover:border-brand-200",
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full cursor-pointer text-left" aria-pressed={selected}>
        <span className="flex items-center gap-3 pr-8">
          <span className="text-2xl font-bold text-ink-900">{lot.code}</span>
          <Badge tone={LOT_STATUS_TONE[lot.status]} dot>
            {lot.status}
          </Badge>
        </span>
        <span className="mt-1 block text-[15px] text-ink-600">
          {TYPE_LABEL[lot.type]} • {lot.formula}
        </span>
        <dl className="mt-4 grid grid-cols-[100px_1fr] gap-y-1.5 text-[15px]">
          <dt className="text-ink-500">Formule</dt>
          <dd className="text-ink-900">{lot.formula}</dd>
          <dt className="text-ink-500">Quantité</dt>
          <dd className="text-ink-900">
            {formatNumber(lot.quantity)} {lot.unit}
          </dd>
          <dt className="text-ink-500">Créé le</dt>
          <dd className="text-ink-900">{formatShort(lot.createdAt)}</dd>
        </dl>
      </button>
      <div className="absolute right-3 top-3">
        <Menu
          label={`Actions pour ${lot.code}`}
          items={[
            { label: "Voir le détail", icon: SquareArrowOutUpRight, onSelect },
            { label: "Enregistrer un prélèvement", icon: Plus, onSelect: onSample },
          ]}
        />
      </div>
    </div>
  );
}

function SampleModal({ lot, open, onClose }: { lot: Lot; open: boolean; onClose: () => void }) {
  const [type, setType] = useState<Sample["type"]>("Contrôle");
  const [quantity, setQuantity] = useState("30");
  const [date, setDate] = useState(DEMO_TODAY);
  const [analyses, setAnalyses] = useState("1");
  const [submitted, setSubmitted] = useState(false);
  const qty = Number(quantity);
  const error = !(qty > 0) ? "Indiquez une quantité positive." : qty > lot.quantity ? "La quantité dépasse la taille du lot." : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enregistrer un prélèvement"
      subtitle={`Lot ${lot.code} — ${formatNumber(lot.quantity)} ${lot.unit}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              setSubmitted(true);
              if (error || !date) return;
              const code = actions.addSample({
                projectCode: lot.projectCode,
                lotCode: lot.code,
                type,
                quantity: qty,
                unit: lot.unit,
                date,
                analyses: Math.max(0, Number(analyses) || 0),
              });
              toast.show({ title: `Prélèvement ${code} enregistré`, description: `${qty} ${lot.unit} — ${type.toLowerCase()}.` });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="smp-type">
          <Select id="smp-type" options={["Contrôle", "Stabilité", "Rétention"]} value={type} onChange={(e) => setType(e.target.value as Sample["type"])} />
        </Field>
        <Field label={`Quantité (${lot.unit})`} required htmlFor="smp-qty" error={submitted ? error : null}>
          <Input id="smp-qty" inputMode="numeric" value={quantity} invalid={submitted && Boolean(error)} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Date de prélèvement" required htmlFor="smp-date">
          <DateInput id="smp-date" value={date} onChange={setDate} />
        </Field>
        <Field label="Analyses prévues" htmlFor="smp-analyses">
          <Input id="smp-analyses" inputMode="numeric" value={analyses} onChange={(e) => setAnalyses(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
    </Modal>
  );
}

/** Method of the project that covers a control ("Dissolution" → the dissolution method), if any. */
function methodFor(methods: Method[], criterion: string) {
  const c = criterion.toLowerCase();
  return methods.find((m) => m.analysis.toLowerCase() === c || m.name.toLowerCase().includes(c));
}

/** Asks for controls on a lot: the usual controls of the dosage form are proposed, others can be added. */
function AddAnalysesModal({ lot, project, open, onClose }: { lot: Lot; project: Project; open: boolean; onClose: () => void }) {
  const state = useDemo();
  const methods = state.methods.filter((m) => m.projectCode === project.code && !m.archived);
  const existing = state.tests.filter((t) => t.projectCode === project.code && t.lotCode === lot.code).map((t) => t.criterion);
  const [rows, setRows] = useState(() => STANDARD_TESTS[project.kind].map((t) => ({ ...t, on: !existing.includes(t.criterion) })));
  const [custom, setCustom] = useState("");
  const [customSpec, setCustomSpec] = useState("");
  const [due, setDue] = useState(addDays(DEMO_TODAY, 7));
  const [submitted, setSubmitted] = useState(false);

  const extra = custom.trim();
  const selected = [
    ...rows.filter((r) => r.on && !existing.includes(r.criterion)).map((r) => ({ criterion: r.criterion, spec: r.spec })),
    ...(extra && !existing.includes(extra) && !rows.some((r) => r.criterion === extra) ? [{ criterion: extra, spec: customSpec.trim() }] : []),
  ];
  const errors = {
    tests: !selected.length ? "Sélectionnez au moins une analyse." : null,
    due: !due ? "Indiquez la date de résultat attendue." : due < DEMO_TODAY ? "La date ne peut pas être passée." : null,
  };

  const submit = () => {
    setSubmitted(true);
    if (errors.tests || errors.due) return;
    const n = actions.addLotTests({
      projectCode: project.code,
      lotCode: lot.code,
      due,
      tests: selected.map((t) => ({ ...t, method: methodFor(methods, t.criterion)?.ref })),
    });
    toast.show({ title: `${n} ${plural(n, "analyse")} demandée${n > 1 ? "s" : ""}`, description: `Lot ${lot.code} — résultats attendus pour le ${formatNumeric(due)}.` });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Demander des analyses"
      subtitle={`Lot ${lot.code} — formule ${lot.formula} • ${project.form} ${project.dosage}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<FlaskConical className="h-4 w-4" />} onClick={submit}>
            Demander {selected.length > 0 ? `${selected.length} ${plural(selected.length, "analyse")}` : "les analyses"}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-ink-600">
        Contrôles habituels pour la forme « {project.form.toLowerCase()} », avec leur critère d&apos;acceptation indicatif. Décochez ceux qui ne s&apos;appliquent pas.
      </p>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
        {rows.map((r, i) => {
          const done = existing.includes(r.criterion);
          const method = methodFor(methods, r.criterion);
          return (
            <li key={r.criterion} className="flex items-center gap-3 px-4 py-3">
              <Checkbox
                className="flex-1"
                checked={done || r.on}
                disabled={done}
                onChange={(on) => setRows((l) => l.map((x, j) => (j === i ? { ...x, on } : x)))}
                label={<span className="font-semibold text-ink-900">{r.criterion}</span>}
                description={r.spec}
              />
              <span className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-700">
                {done ? "Déjà demandée" : method ? `${method.ref} • ${method.technique}` : "Contrôle direct"}
              </span>
            </li>
          );
        })}
      </ul>
      {submitted && errors.tests && <p className="mt-2 text-sm text-danger-600">{errors.tests}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Autre analyse" htmlFor="an-custom" optional>
          <Input id="an-custom" placeholder="Ex. Uniformité de teneur" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </Field>
        <Field label="Critère d'acceptation" htmlFor="an-custom-spec" optional>
          <Input id="an-custom-spec" placeholder="Ex. VA ≤ 15,0 (Ph. Eur. 2.9.40)" value={customSpec} disabled={!extra} onChange={(e) => setCustomSpec(e.target.value)} />
        </Field>
        <Field label="Résultats attendus pour le" required htmlFor="an-due" error={submitted ? errors.due : null}>
          <DateInput id="an-due" value={due} onChange={setDue} invalid={submitted && Boolean(errors.due)} />
        </Field>
      </div>
      <p className="mt-3 text-sm text-ink-500">
        Une demande d&apos;analyse est transmise au laboratoire pour chaque contrôle couvert par une méthode du projet ; les autres sont des contrôles directs.
      </p>
    </Modal>
  );
}

/** Records the result of a control and its conformity to the acceptance criterion. */
function ResultModal({ test, project, open, onClose }: { test: TestResult; project: Project; open: boolean; onClose: () => void }) {
  const example = STANDARD_TESTS[project.kind].find((t) => t.criterion === test.criterion)?.example;
  const [result, setResult] = useState(test.result ?? "");
  const [status, setStatus] = useState<"Conforme" | "Non conforme">(test.status === "Non conforme" ? "Non conforme" : "Conforme");
  const [date, setDate] = useState(test.date ?? DEMO_TODAY);
  const [submitted, setSubmitted] = useState(false);
  const error = !result.trim() ? "Saisissez le résultat obtenu." : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={test.result ? "Corriger le résultat" : "Saisir le résultat"}
      subtitle={`${test.criterion} — lot ${test.lotCode} (${test.formula})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              setSubmitted(true);
              if (error || !date) return;
              actions.recordTestResult(test.id, { result: result.trim(), status, date });
              toast.show({ title: "Résultat enregistré", description: `${test.criterion} : ${result.trim()} — ${status.toLowerCase()}.`, tone: status === "Conforme" ? "success" : "warn" });
              onClose();
            }}
          >
            Enregistrer le résultat
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {test.spec && (
          <p className="rounded-xl bg-subtle px-4 py-3 text-[15px] text-ink-700">
            <span className="font-semibold text-ink-900">Critère d&apos;acceptation : </span>
            {test.spec}
          </p>
        )}
        <Field label="Résultat obtenu" required htmlFor="res-value" error={submitted ? error : null}>
          <Input id="res-value" data-autofocus placeholder={example ? `Ex. ${example}` : "Valeur mesurée ou observation"} value={result} invalid={submitted && Boolean(error)} onChange={(e) => setResult(e.target.value)} />
        </Field>
        <Field label="Conformité">
          <Segmented
            label="Conformité"
            options={[
              { value: "Conforme", label: "Conforme" },
              { value: "Non conforme", label: "Non conforme" },
            ]}
            value={status}
            onChange={setStatus}
          />
        </Field>
        <Field label="Date du résultat" required htmlFor="res-date">
          <DateInput id="res-date" value={date} onChange={setDate} />
        </Field>
      </div>
    </Modal>
  );
}

const PLAN_DEFAULTS: { type: Sample["type"]; label: string; qty: string }[] = [
  { type: "Contrôle", label: "Échantillon de contrôle", qty: "30" },
  { type: "Stabilité", label: "Échantillon de stabilité", qty: "60" },
  { type: "Rétention", label: "Échantillothèque (rétention)", qty: "40" },
];

function CreateLotDrawer({
  project,
  open,
  onClose,
  presetFormula,
  onCreated,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
  presetFormula?: string;
  onCreated: (code: string, type: LotType) => void;
}) {
  const state = useDemo();
  const formulas = projectFormulas(state, project.code);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<LotType>("Essai");
  const [formula, setFormula] = useState(formulas.find((f) => f.code === presetFormula)?.code ?? "");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(defaultUnit(project));
  const [date, setDate] = useState(DEMO_TODAY);
  const [owner, setOwner] = useState("");
  const [comment, setComment] = useState("");
  const [plan, setPlan] = useState(PLAN_DEFAULTS.map((p) => ({ ...p, on: p.type !== "Rétention" })));
  const [submitted, setSubmitted] = useState(false);

  const code = actions.nextLotCode(project.code, type);
  const errors = {
    formula: !formula ? "Sélectionnez une formule." : null,
    quantity: !(Number(quantity) > 0) ? "Indiquez une quantité positive." : null,
    owner: !owner ? "Sélectionnez un responsable." : null,
    date: !date ? "Indiquez la date de fabrication." : null,
  };
  const planErrors = plan.some((p) => p.on && !(Number(p.qty) > 0)) ? "Chaque prélèvement retenu doit avoir une quantité." : null;
  const show = (e: string | null) => (submitted ? e : null);
  const selectedFormula = formulas.find((f) => f.code === formula);

  const next = () => {
    setSubmitted(true);
    if (step === 1 && Object.values(errors).some(Boolean)) return;
    if (step === 2 && planErrors) return;
    if (step < 3) {
      setSubmitted(false);
      return setStep(step + 1);
    }
    const created = actions.createLot(
      { projectCode: project.code, type, formula, quantity: Number(quantity), unit, date, owner, comment: comment.trim() },
      plan.filter((p) => p.on).map((p) => ({ type: p.type, quantity: Number(p.qty) })),
    );
    toast.show({ title: `Lot ${created} créé`, description: `${TYPE_LABEL[type]} — formule ${formula}, ${formatNumber(Number(quantity))} ${unit}.` });
    onCreated(created, type);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Créer un lot"
      subtitle={`${project.code} • ${project.name}`}
      widthClass="max-w-[440px]"
      footer={
        <div className="grid grid-cols-2 gap-3">
          {step === 1 ? (
            <Button variant="secondary" size="lg" onClick={onClose}>
              Annuler
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>
              Précédent
            </Button>
          )}
          <Button size="lg" onClick={next}>
            {step === 3 ? "Créer le lot" : "Continuer"}
          </Button>
        </div>
      }
    >
      <VerticalStepper steps={["Lot", "Prélèvements", "Vérification"]} current={step} />

      <div className="mt-6">
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Type de lot" required>
              <Segmented label="Type de lot" options={TABS.map((t) => ({ value: t.value, label: t.value }))} value={type} onChange={setType} />
            </Field>
            <Field label="Formule" required htmlFor="lot-formula" error={show(errors.formula)}>
              <Select
                id="lot-formula"
                placeholder="Sélectionner une formule"
                options={formulas.map((f) => ({ value: f.code, label: `${f.code} — Version ${f.revision}${f.status === "Brouillon" ? " (brouillon)" : ""}` }))}
                value={formula}
                invalid={Boolean(show(errors.formula))}
                onChange={(e) => setFormula(e.target.value)}
              />
            </Field>
            <Field label="Code du lot" htmlFor="lot-code" info="Généré automatiquement selon le type de lot.">
              <div className="relative">
                <Input id="lot-code" readOnly value={`${code} (généré automatiquement)`} className="bg-slate-100 pr-10 text-ink-600" />
                <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
              </div>
            </Field>
            <div className="grid grid-cols-[1fr_150px] gap-3">
              <Field label="Quantité" required htmlFor="lot-qty" error={show(errors.quantity)}>
                <Input id="lot-qty" inputMode="numeric" value={quantity} invalid={Boolean(show(errors.quantity))} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Unité" required htmlFor="lot-unit">
                <Select id="lot-unit" options={LOT_UNITS} value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
            </div>
            <Field label="Date de fabrication" htmlFor="lot-date" error={show(errors.date)}>
              <DateInput id="lot-date" value={date} onChange={setDate} />
            </Field>
            <Field label="Responsable" required htmlFor="lot-owner" error={show(errors.owner)}>
              <Select id="lot-owner" placeholder="Sélectionner un responsable" options={PEOPLE} value={owner} invalid={Boolean(show(errors.owner))} onChange={(e) => setOwner(e.target.value)} />
            </Field>
            <Field label="Commentaires" htmlFor="lot-comment" optional>
              <Textarea id="lot-comment" rows={3} maxLength={300} placeholder="Ajouter un commentaire (optionnel)" value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-[15px] text-ink-600">Planifiez les prélèvements à réaliser à la fabrication du lot. Ils pourront être complétés ensuite.</p>
            <ul className="mt-4 space-y-3">
              {plan.map((p, i) => (
                <li key={p.type} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <Checkbox checked={p.on} onChange={(on) => setPlan((l) => l.map((x, j) => (j === i ? { ...x, on } : x)))} label={p.label} className="flex-1" />
                  <Input
                    aria-label={`Quantité — ${p.label}`}
                    inputMode="numeric"
                    disabled={!p.on}
                    value={p.qty}
                    onChange={(e) => setPlan((l) => l.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/\D/g, "") } : x)))}
                    className="h-10 w-24"
                  />
                  <span className="w-20 text-sm text-ink-500">{unit}</span>
                </li>
              ))}
            </ul>
            {submitted && planErrors && <p className="mt-2 text-sm text-danger-600">{planErrors}</p>}
          </div>
        )}

        {step === 3 && (
          <dl className="divide-y divide-line rounded-xl border border-line">
            {[
              ["Code du lot", code],
              ["Type", TYPE_LABEL[type]],
              ["Formule", selectedFormula ? `${selectedFormula.code} — Version ${selectedFormula.revision}` : formula],
              ["Quantité", `${formatNumber(Number(quantity))} ${unit}`],
              ["Date de fabrication", formatLong(date)],
              ["Responsable", owner],
              ["Prélèvements", plan.filter((p) => p.on).map((p) => `${p.type} (${p.qty})`).join(", ") || "Aucun"],
              ["Commentaires", comment || "—"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-[15px]">
                <dt className="text-ink-500">{k}</dt>
                <dd className="text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Drawer>
  );
}

type InnerTab = "echantillons" | "analyses" | "documents";

function LotDetail({ lot, project, onSample, initialTab }: { lot: Lot; project: Project; onSample: () => void; initialTab?: InnerTab }) {
  const state = useDemo();
  const router = useRouter();
  const pilot = state.pilotLots.find((l) => l.projectCode === project.code && l.lotCode === lot.code);
  const [tab, setTab] = useState<InnerTab>(initialTab ?? "echantillons");
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [resultId, setResultId] = useState<string | null>(null);
  const openAdd = () => {
    setTab("analyses");
    setAddKey((k) => k + 1);
    setAddOpen(true);
  };
  const samples = state.samples.filter((s) => s.projectCode === project.code && s.lotCode === lot.code);
  const tests = state.tests.filter((t) => t.projectCode === project.code && t.lotCode === lot.code);
  const docs = state.documents.filter((d) => d.projectCode === project.code && d.lot === lot.code);
  const formula = state.formulas.find((f) => f.projectCode === project.code && f.code === lot.formula);

  return (
    <Card className="mt-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-ink-900">
            {lot.code} <span className="text-ink-400">•</span> {TYPE_LABEL[lot.type]}
            <Badge tone={LOT_STATUS_TONE[lot.status]} icon={lot.status === "En cours" ? CircleAlert : undefined} dot={lot.status !== "En cours"} size="md">
              {lot.status}
            </Badge>
          </h2>
          <p className="mt-1 text-[15px] text-ink-600">
            Formule {lot.formula} • {formatNumber(lot.quantity)} {lot.unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            className="min-w-36"
            onClick={() =>
              pilot
                ? router.push(`/projets/${project.slug}/lots/${lot.code.toLowerCase()}`)
                : toast.show({ title: `Lot ${lot.code}`, description: "Le dossier de fabrication détaillé n'est pas disponible pour ce lot.", tone: "info" })
            }
          >
            Ouvrir le lot
          </Button>
          <Menu
            label={`Plus d'actions pour ${lot.code}`}
            items={[
              { label: "Demander des analyses", icon: FlaskConical, onSelect: openAdd },
              { label: "Enregistrer un prélèvement", icon: Plus, onSelect: onSample },
              { label: "Voir les documents du projet", icon: FileText, href: `/projets/${project.slug}/documents` },
            ]}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 border-y border-line py-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-6 w-6 text-ink-600" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[13px] text-ink-500">Formule liée</p>
            <p className="font-semibold text-ink-900">{lot.formula}</p>
            {formula && (
              <Link href={`/projets/${project.slug}/formules`} className="text-sm text-brand-700 hover:underline">
                Version {formula.revision}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-6 w-6 text-ink-600" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[13px] text-ink-500">Date de création</p>
            <p className="text-ink-900">{formatShort(lot.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <User className="mt-0.5 h-6 w-6 text-ink-600" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[13px] text-ink-500">Responsable</p>
            <p className="flex items-center gap-1 text-brand-700">
              {lot.owner}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-6 w-6 text-ink-600" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[13px] text-ink-500">Quantité</p>
            <p className="text-ink-900">
              {formatNumber(lot.quantity)} {lot.unit}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MessageSquareText className="mt-0.5 h-6 w-6 shrink-0 text-ink-600" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[13px] text-ink-500">Commentaires</p>
            <p className="text-sm text-ink-800">{lot.comment || "—"}</p>
          </div>
        </div>
      </div>

      <Tabs
        className="mt-4"
        size="sm"
        items={[
          { value: "echantillons", label: "Échantillons", count: samples.length },
          { value: "analyses", label: "Analyses liées", count: tests.length },
          { value: "documents", label: "Documents source", count: docs.length },
        ]}
        value={tab}
        onChange={setTab}
        actions={
          tab === "echantillons" ? (
            <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={onSample}>
              Enregistrer un prélèvement
            </Button>
          ) : tab === "analyses" ? (
            <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Demander des analyses
            </Button>
          ) : undefined
        }
      />

      <div className="relative mt-4 overflow-x-auto">
        {tab === "echantillons" &&
          (samples.length ? (
            <table className="w-full min-w-[720px] text-left text-[15px]">
              <thead>
                <tr className="bg-subtle text-sm text-ink-700">
                  <th className="rounded-l-lg px-4 py-2.5 font-semibold">Code échantillon</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Quantité</th>
                  <th className="px-4 py-2.5 font-semibold">Date de prélèvement</th>
                  <th className="px-4 py-2.5 font-semibold">Statut</th>
                  <th className="px-4 py-2.5 font-semibold">Analyses liées</th>
                  <th className="rounded-r-lg px-4 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {samples.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-semibold text-ink-900">{s.code}</td>
                    <td className="px-4 py-3 text-ink-800">{s.type}</td>
                    <td className="px-4 py-3 text-ink-800">
                      {formatNumber(s.quantity)} {s.unit}
                    </td>
                    <td className="px-4 py-3 text-ink-800">{formatShort(s.date)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-ink-800">
                        <StatusDot tone={s.status === "Prélevé" ? "success" : "neutral"} />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.analyses > 0 ? (
                        <button type="button" onClick={() => setTab("analyses")} className="cursor-pointer text-brand-700 underline underline-offset-4">
                          {s.analyses} {plural(s.analyses, "analyse")}
                        </button>
                      ) : (
                        <span className="text-ink-500">Aucune</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Menu
                        label={`Actions pour ${s.code}`}
                        items={[
                          { label: "Voir les analyses", icon: FlaskConical, onSelect: () => setTab("analyses") },
                          {
                            label: "Supprimer le prélèvement",
                            icon: Trash2,
                            tone: "danger",
                            onSelect: () => {
                              actions.deleteSample(s.id);
                              toast.show({ title: `Prélèvement ${s.code} supprimé`, tone: "info" });
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={Package} title="Aucun prélèvement" description="Enregistrez un prélèvement pour suivre les échantillons de ce lot." />
          ))}

        {tab === "analyses" &&
          (tests.length ? (
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead>
                <tr className="bg-subtle text-sm text-ink-700">
                  <th className="rounded-l-lg px-4 py-2.5 font-semibold">Critère</th>
                  <th className="px-4 py-2.5 font-semibold">Méthode</th>
                  <th className="px-4 py-2.5 font-semibold">Résultat</th>
                  <th className="px-4 py-2.5 font-semibold">Statut</th>
                  <th className="rounded-r-lg px-4 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-ink-900">{t.criterion}</span>
                      {t.spec && <span className="block text-sm text-ink-500">{t.spec}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.method ? (
                        <Link href={`/methodes?ref=${t.method}`} className="text-brand-700 hover:underline">
                          {t.method}
                        </Link>
                      ) : (
                        <span className="text-ink-500">Contrôle direct</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-800">{t.result ?? "—"}</td>
                    <td className="px-4 py-3">
                      <TestStatusText status={t.status} short />
                    </td>
                    <td className="px-4 py-3">
                      {t.result ? (
                        <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setResultId(t.id)}>
                          Corriger
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setResultId(t.id)}>
                          Saisir le résultat
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={FlaskConical}
              title="Aucune analyse liée"
              description="Demandez les contrôles à réaliser sur ce lot : leurs résultats alimentent la comparaison des formules et la décision."
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
                  Demander des analyses
                </Button>
              }
            />
          ))}

        {tab === "documents" &&
          (docs.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{d.name}</span>
                    <span className="block text-sm text-ink-500">
                      {d.type} — v{d.version} — {d.status}
                    </span>
                  </span>
                  <Link href={`/projets/${project.slug}/documents?doc=${d.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                    Ouvrir
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileText} title="Aucun document source" description="Aucun document n'est rattaché à ce lot." />
          ))}
      </div>

      <AddAnalysesModal key={`add-${addKey}`} lot={lot} project={project} open={addOpen} onClose={() => setAddOpen(false)} />
      {tests
        .filter((t) => t.id === resultId)
        .map((t) => (
          <ResultModal key={t.id} test={t} project={project} open onClose={() => setResultId(null)} />
        ))}
    </Card>
  );
}

export function LotsView({
  slug,
  openCreate,
  presetFormula,
  initialLot,
  initialTab,
}: {
  slug: string;
  openCreate: boolean;
  presetFormula?: string;
  initialLot?: string;
  initialTab?: string;
}) {
  const state = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const project = findProject(state, slug);
  const lots = project ? state.lots.filter((l) => l.projectCode === project.code) : [];
  const initial = lots.find((l) => l.code === initialLot);

  const [type, setType] = useState<LotType>(initial?.type ?? "Essai");
  const [selectedCode, setSelectedCode] = useState<string | null>(initial?.code ?? null);
  const [createOpen, setCreateOpen] = useState(openCreate);
  const [createKey, setCreateKey] = useState(0);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleKey, setSampleKey] = useState(0);

  if (!project) return null;

  const visible = lots.filter((l) => l.type === type).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const selected = visible.find((l) => l.code === selectedCode) ?? visible.find((l) => l.status === "En cours") ?? visible[0];

  const openSample = (code: string) => {
    setSelectedCode(code);
    setSampleKey((k) => k + 1);
    setSampleOpen(true);
  };

  return (
    <>
      <ProjectTabs slug={slug} />
      <FormulaSubTabs slug={slug} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentTabs
          items={TABS.map((t) => ({ ...t, count: lots.filter((l) => l.type === t.value).length }))}
          value={type}
          onChange={(v) => {
            setType(v);
            setSelectedCode(null);
          }}
        />
        <Button
          size="lg"
          icon={<Plus className="h-5 w-5" />}
          onClick={() => {
            setCreateKey((k) => k + 1);
            setCreateOpen(true);
          }}
        >
          Créer un lot
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={Package}
            title={`Aucun ${TYPE_LABEL[type].toLowerCase()}`}
            description="Créez un lot à partir d'une formule du projet."
            action={
              <Button
                variant="outline"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setCreateKey((k) => k + 1);
                  setCreateOpen(true);
                }}
              >
                Créer un lot
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((l) => (
              <LotCard key={l.id} lot={l} selected={l.code === selected?.code} onSelect={() => setSelectedCode(l.code)} onSample={() => openSample(l.code)} />
            ))}
          </div>
          {selected && (
            <LotDetail
              key={selected.id}
              lot={selected}
              project={project}
              onSample={() => openSample(selected.code)}
              initialTab={initialTab === "analyses" || initialTab === "documents" ? initialTab : undefined}
            />
          )}
        </>
      )}

      <CreateLotDrawer
        key={`create-${createKey}`}
        project={project}
        open={createOpen}
        presetFormula={presetFormula}
        onClose={() => {
          setCreateOpen(false);
          if (openCreate) router.replace(pathname, { scroll: false });
        }}
        onCreated={(code, lotType) => {
          setType(lotType);
          setSelectedCode(code);
        }}
      />
      {selected && <SampleModal key={`sample-${sampleKey}`} lot={selected} open={sampleOpen} onClose={() => setSampleOpen(false)} />}
      <ScreenRef label="Lots et échantillons (maquette 21 de la première série)" />
    </>
  );
}
