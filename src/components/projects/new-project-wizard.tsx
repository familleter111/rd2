"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CalendarDays,
  CircleCheck,
  Clock,
  Copy,
  Cylinder,
  Factory,
  FileText,
  FlaskConical,
  Info,
  Network,
  Package,
  Pill,
  Settings,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, DateInput, Field, Input, MultiSelect, Segmented, Select } from "@/components/ui/field";
import { BackLink, Breadcrumb, PageHeader, ScreenRef } from "@/components/ui/page";
import { Stepper } from "@/components/ui/stepper";
import { toast } from "@/components/ui/toast";
import {
  COUNTRIES,
  DOSAGE_UNITS,
  FAMILIES,
  FAMILY_LABEL,
  FORMS_BY_FAMILY,
  OPTIONAL_STUDIES,
  PREREQUISITE_TEMPLATES,
  REFERENCE_PRODUCTS,
  TEAM_ROLES,
  TEMPLATE_BY_FAMILY,
  TEMPLATES,
} from "@/lib/catalog";
import type { DemoState } from "@/lib/data";
import { AI_EXTRACTS, type AiStage } from "@/lib/data-ai";
import { formatLong, plural } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Family, ProjectDraft, Tone } from "@/lib/types";
import {
  AI_IDLE,
  AiActivitiesCard,
  AiLookupCard,
  AnalysedFiles,
  DetectedDataModal,
  DetectionModal,
  DocumentsStart,
  DosageConflictModal,
  FilePreviewModal,
  SourceTag,
  aiDraft,
  aiScreen,
  aiStateFor,
  applyDetection,
  useDetectionProgress,
  type AiState,
} from "./ai-detection";

export type WizardSource =
  | { kind: "new" }
  | { kind: "draft" }
  | { kind: "duplicate"; slug: string }
  | { kind: "template"; family: string }
  /** Guided tour: pre-filled wizard at a given state (screens 08, 09, 10). */
  | { kind: "demo"; variant: "parcours" | "verification" | "erreurs" }
  /** Guided tour: "Détection IA" series of step 1 (screens IA-01 → IA-06). */
  | { kind: "ia"; stage: AiStage };

const DEFAULT_PREREQUISITES = PREREQUISITE_TEMPLATES.slice(0, 4).map((p) => p.name);

function emptyDraft(family: Family = "Sèche"): ProjectDraft {
  return {
    step: 1,
    code: "",
    name: "",
    dci: "",
    family,
    form: FORMS_BY_FAMILY[family][0],
    dosage: "",
    dosageUnit: family === "Semi-solide" ? "%" : family === "Liquide" ? "mg/mL" : "mg",
    countries: [],
    referenceProduct: "",
    files: [],
    template: TEMPLATE_BY_FAMILY[family],
    galenic: true,
    analytic: true,
    studies: [],
    team: {},
    startDate: "",
    targetDate: "",
    effort: "",
    prerequisites: DEFAULT_PREREQUISITES,
  };
}

/** Complete draft used by the guided tour (screens 08 and 09). */
function demoDraft(): ProjectDraft {
  return {
    ...emptyDraft("Sèche"),
    code: "GL-01",
    name: "Gélule 250 mg",
    dci: "Principe actif D",
    form: "Gélule",
    dosage: "250",
    dosageUnit: "mg",
    countries: ["Maroc", "Tunisie"],
    referenceProduct: REFERENCE_PRODUCTS[3],
    team: { chef: "Chef de projet", developpement: "Responsable développement", qualite: "Responsable contrôle qualité", production: "Responsable production" },
    startDate: "2026-10-01",
    targetDate: "2027-03-31",
  };
}

function initialDraft(state: DemoState, source: WizardSource): { draft: ProjectDraft; notice?: string } {
  if (source.kind === "ia") {
    return { draft: aiDraft(emptyDraft("Sèche"), source.stage), notice: "Déposez vos documents, puis lancez la détection IA." };
  }
  if (source.kind === "demo") {
    if (source.variant === "erreurs") return { draft: { ...emptyDraft("Sèche"), code: "CS-01" } };
    return { draft: demoDraft(), notice: "Parcours guidé : formulaire pré-rempli pour la démonstration." };
  }
  if (source.kind === "draft" && state.draft) {
    return { draft: { ...state.draft }, notice: "Brouillon repris — complétez les informations manquantes pour créer le projet." };
  }
  if (source.kind === "duplicate") {
    const p = findProject(state, source.slug);
    if (p) {
      const [value, ...unit] = p.dosage.split(" ");
      const team: Record<string, string> = {};
      TEAM_ROLES.forEach((r) => {
        const member = p.team.find((m) => m.role === r.label);
        if (member?.person) team[r.key] = member.person;
      });
      const prereqs = state.prerequisites.filter((x) => x.projectCode === p.code).map((x) => x.name);
      return {
        draft: {
          ...emptyDraft(p.family),
          form: p.form,
          dci: p.dci,
          dosage: value,
          dosageUnit: unit.join(" ") || "mg",
          countries: [...p.countries],
          referenceProduct: p.referenceProduct,
          template: p.template,
          team,
          prerequisites: PREREQUISITE_TEMPLATES.map((t) => t.name).filter((n) => prereqs.includes(n)),
          sourceProject: `${p.code} • ${p.name}`,
        },
        notice: `Structure reprise de ${p.code} • ${p.name} — les résultats (formules, lots, essais) ne sont pas copiés.`,
      };
    }
  }
  if (source.kind === "template" && (FAMILIES as string[]).includes(source.family)) {
    const family = source.family as Family;
    return { draft: emptyDraft(family), notice: `Modèle appliqué : ${TEMPLATE_BY_FAMILY[family]}.` };
  }
  return { draft: emptyDraft() };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

type Errors = Record<string, string>;

function validateProduct(d: ProjectDraft, existingCodes: string[]): Errors {
  const e: Errors = {};
  const code = d.code.trim().toUpperCase();
  if (!code) e.code = "Renseignez le code du projet.";
  else if (existingCodes.includes(code)) e.code = "Ce code existe déjà.";
  else if (!/^[A-Z]{2,3}-\d{2}$/.test(code)) e.code = "Format attendu : 2 lettres, un tiret et 2 chiffres (ex. CS-02).";
  if (!d.name.trim()) e.name = "Renseignez le nom du projet.";
  if (!d.dci.trim()) e.dci = "Renseignez la DCI.";
  if (!d.dosage.trim()) e.dosage = "Renseignez le dosage.";
  else if (!(Number(d.dosage.replace(",", ".")) > 0)) e.dosage = "Le dosage doit être un nombre positif.";
  if (!d.countries.length) e.countries = "Sélectionnez au moins un pays.";
  if (!d.referenceProduct) e.referenceProduct = "Sélectionnez un produit de référence.";
  return e;
}

function validatePathway(d: ProjectDraft): Errors {
  const e: Errors = {};
  if (!d.galenic && !d.analytic) e.pathway = "Incluez au moins un parcours de développement.";
  TEAM_ROLES.forEach((r) => {
    if (!d.team[r.key]) e[`team-${r.key}`] = "Sélectionnez un responsable.";
  });
  if (d.startDate && d.targetDate && d.targetDate < d.startDate) e.targetDate = "La date cible précède la date de démarrage.";
  return e;
}

const FIELD_LABELS: Record<string, string> = {
  code: "Code du projet",
  name: "Nom du projet",
  dci: "DCI",
  dosage: "Dosage",
  countries: "Pays cible",
  referenceProduct: "Produit de référence",
  pathway: "Parcours de développement",
  "team-chef": "Chef de projet",
  "team-developpement": "Responsable développement",
  "team-qualite": "Responsable contrôle qualité",
  "team-production": "Responsable production / transfert",
  targetDate: "Date cible",
};

function ErrorSummary({ errors }: { errors: Errors }) {
  const keys = Object.keys(errors);
  if (!keys.length) return null;
  const focus = (key: string) => {
    const el = document.getElementById(`field-${key}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };
  return (
    <div role="alert" className="flex flex-col gap-4 rounded-xl border border-danger-200 bg-danger-50 p-5 sm:flex-row sm:items-center">
      <CircleAlert className="h-10 w-10 shrink-0 fill-danger-600 text-white" aria-hidden />
      <div className="flex-1">
        <p className="text-lg font-bold text-danger-700">
          {keys.length} {plural(keys.length, "champ à corriger", "champs à corriger")}
        </p>
        <p className="text-[15px] text-ink-700">Veuillez renseigner les champs suivants pour continuer.</p>
      </div>
      <ul className="space-y-1 border-danger-200 sm:border-l sm:pl-6">
        {keys.map((key) => (
          <li key={key} className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-danger-500" aria-hidden />
            <button type="button" onClick={() => focus(key)} className="cursor-pointer text-[15px] text-brand-700 underline underline-offset-4 hover:text-brand-800">
              {FIELD_LABELS[key] ?? key}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Produit                                                    */
/* ------------------------------------------------------------------ */

function SummaryValue({ value }: { value: string }) {
  return value ? <span className="text-ink-900">{value}</span> : <span className="text-ink-400">À renseigner</span>;
}

type AiFieldKey = keyof NonNullable<ProjectDraft["ai"]>["fields"];

function ProductStep({
  draft,
  setDraft,
  errors,
  ai,
  onDetect,
  onShowDetection,
  onFilesChange,
  onPreview,
  onReview,
}: {
  draft: ProjectDraft;
  setDraft: (d: ProjectDraft) => void;
  errors: Errors;
  ai: AiState;
  onDetect: () => void;
  onShowDetection: () => void;
  /** Files added or removed: a previous detection no longer applies. */
  onFilesChange: () => void;
  onPreview: (name: string) => void;
  onReview: (name: string) => void;
}) {
  // A value changed by hand loses its "Issu des documents" tag.
  const untag = (...keys: string[]) =>
    draft.ai && { ...draft.ai, fields: Object.fromEntries(Object.entries(draft.ai.fields).filter(([k]) => !keys.includes(k))) };
  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => setDraft({ ...draft, [key]: value, ai: untag(key) });
  const setFamily = (family: Family) =>
    setDraft({
      ...draft,
      family,
      form: FORMS_BY_FAMILY[family][0],
      template: TEMPLATE_BY_FAMILY[family],
      dosageUnit: family === "Semi-solide" ? "%" : family === "Liquide" ? "mg/mL" : "mg",
      ai: untag("family", "form"),
    });
  const tag = (key: AiFieldKey) => (draft.ai?.fields[key] ? <SourceTag confirmed={draft.ai.fields[key] === "confirme"} /> : null);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
      <Card className="p-6">
        {!draft.ai && (
          <div className="mb-6 border-b border-line pb-6">
            <DocumentsStart
              draft={draft}
              setDraft={(d) => {
                setDraft(d);
                onFilesChange();
              }}
              ai={ai}
              onDetect={onDetect}
              onShow={onShowDetection}
              onPreview={onPreview}
            />
          </div>
        )}
        <h2 className="text-xl font-bold text-ink-900">Informations produit</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)]">
          <Field label="Code projet" required htmlFor="field-code" error={errors.code} info="2 lettres, un tiret et 2 chiffres. Le code doit être unique.">
            <Input id="field-code" placeholder="Ex. CS-01" value={draft.code} invalid={Boolean(errors.code)} onChange={(e) => set("code", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Nom du projet" required htmlFor="field-name" error={errors.name} aside={tag("name")}>
            <Input id="field-name" placeholder="Saisir un nom de projet" value={draft.name} invalid={Boolean(errors.name)} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="DCI" required htmlFor="field-dci" error={errors.dci} aside={tag("dci")}>
            <Input id="field-dci" placeholder="Saisir la DCI" value={draft.dci} invalid={Boolean(errors.dci)} onChange={(e) => set("dci", e.target.value)} />
          </Field>
        </div>

        <Field label="Famille" required className="mt-5" aside={tag("family")}>
          <Segmented label="Famille" options={FAMILIES.map((f) => ({ value: f, label: f }))} value={draft.family} onChange={setFamily} />
        </Field>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Forme" required htmlFor="field-form" aside={tag("form")}>
            <Select id="field-form" options={FORMS_BY_FAMILY[draft.family]} value={draft.form} onChange={(e) => set("form", e.target.value)} />
          </Field>
          <Field label="Dosage" required htmlFor="field-dosage" error={errors.dosage} aside={tag("dosage")}>
            <div className="grid grid-cols-[1fr_130px] gap-3">
              <Input id="field-dosage" inputMode="decimal" placeholder="Saisir un dosage" value={draft.dosage} invalid={Boolean(errors.dosage)} onChange={(e) => set("dosage", e.target.value)} />
              <Select aria-label="Unité du dosage" options={DOSAGE_UNITS} value={draft.dosageUnit} onChange={(e) => set("dosageUnit", e.target.value)} />
            </div>
          </Field>
          <Field label="Pays cible" required htmlFor="field-countries" error={errors.countries} aside={tag("countries")}>
            <MultiSelect
              id="field-countries"
              label="Pays cible"
              options={COUNTRIES}
              value={draft.countries}
              onChange={(v) => set("countries", v)}
              placeholder="Sélectionner un ou plusieurs pays"
              invalid={Boolean(errors.countries)}
            />
          </Field>
          <Field label="Produit de référence" required htmlFor="field-referenceProduct" error={errors.referenceProduct} aside={tag("referenceProduct")}>
            <Select
              id="field-referenceProduct"
              placeholder="Sélectionner un produit de référence"
              options={REFERENCE_PRODUCTS}
              value={draft.referenceProduct}
              invalid={Boolean(errors.referenceProduct)}
              onChange={(e) => set("referenceProduct", e.target.value)}
            />
          </Field>
        </div>

        {draft.ai && (
          <div className="mt-6 border-t border-line pt-5">
            <AnalysedFiles files={draft.files} onReview={onReview} />
          </div>
        )}
      </Card>

      <div className="space-y-5">
        {!draft.ai && <AiLookupCard />}
        <Card className="p-5">
          <h2 className="text-xl font-bold text-ink-900">Ce qui sera créé</h2>
          <div className="mt-4 rounded-xl border border-line">
            <div className="flex items-start gap-3 p-4">
              <IconTile icon={FileText} className="bg-brand-50 text-ink-700" />
              <div>
                <p className="font-semibold text-ink-900">{draft.name ? "Projet R&D" : "En attente des informations produit"}</p>
                <p className="text-sm text-ink-600">Les informations saisies seront utilisées pour créer le projet et initialiser son parcours.</p>
              </div>
            </div>
            <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2 rounded-b-xl bg-subtle px-5 py-4 text-sm">
              <dt className="text-ink-600">Code projet</dt>
              <dd><SummaryValue value={draft.code} /></dd>
              <dt className="text-ink-600">Nom du projet</dt>
              <dd><SummaryValue value={draft.name} /></dd>
              <dt className="text-ink-600">DCI</dt>
              <dd><SummaryValue value={draft.dci} /></dd>
              <dt className="text-ink-600">Famille</dt>
              <dd><SummaryValue value={draft.family} /></dd>
              <dt className="text-ink-600">Forme</dt>
              <dd><SummaryValue value={draft.form} /></dd>
              <dt className="text-ink-600">Dosage</dt>
              <dd className="flex gap-6">
                <SummaryValue value={draft.dosage} />
                <span className="text-ink-600">{draft.dosageUnit}</span>
              </dd>
              <dt className="text-ink-600">Pays cible</dt>
              <dd><SummaryValue value={draft.countries.join(", ")} /></dd>
              <dt className="text-ink-600">Produit de référence</dt>
              <dd><SummaryValue value={draft.referenceProduct} /></dd>
            </dl>
          </div>
        </Card>
        {draft.ai && <AiActivitiesCard prefill={draft.ai} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Parcours & équipe                                          */
/* ------------------------------------------------------------------ */

const FAMILY_FORM_OPTIONS = FAMILIES.flatMap((f) => FORMS_BY_FAMILY[f].map((form) => ({ value: `${f}|${form}`, label: `${f} / ${form}` })));

const PATHWAYS = [
  {
    key: "galenic" as const,
    title: "Développement galénique",
    icon: Settings,
    detail: (d: ProjectDraft) => `Définir et optimiser la formule et le procédé pour la ${FAMILY_LABEL[d.family].toLowerCase()}.`,
    activities: ["Pré-formulation et compatibilités", "Formules d'essai (F1, F2…)", "Lots d'essai et optimisation du procédé", "Choix de la formule"],
  },
  {
    key: "analytic" as const,
    title: "Développement analytique",
    icon: FlaskConical,
    detail: () => "Développer et valider les méthodes analytiques associées.",
    activities: ["Revue des méthodes de la pharmacopée", "Développement des méthodes internes", "Validation analytique", "Spécifications du produit fini"],
  },
];

const STUDY_ICONS: Record<string, LucideIcon> = { chart: ChartNoAxesColumn, users: Users, shield: ShieldCheck };
const ROLE_ICONS: Record<string, LucideIcon> = { user: User, users: Users, settings: Settings, factory: Factory };

function Section({ icon: Icon, title, children, aside }: { icon: LucideIcon; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-lg font-bold text-ink-900">
          <Icon className="h-6 w-6 text-ink-700" strokeWidth={1.6} aria-hidden />
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function PathwayStep({ draft, setDraft, errors }: { draft: ProjectDraft; setDraft: (d: ProjectDraft) => void; errors: Errors }) {
  const [openPathway, setOpenPathway] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(Boolean(draft.startDate || draft.targetDate || draft.effort));
  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-5">
      <Section icon={Cylinder} title="Famille et modèle">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Famille de produit" required htmlFor="field-familyForm">
            <Select
              id="field-familyForm"
              icon={Pill}
              options={FAMILY_FORM_OPTIONS}
              value={`${draft.family}|${draft.form}`}
              onChange={(e) => {
                const [family, form] = e.target.value.split("|") as [Family, string];
                setDraft({ ...draft, family, form, template: family === draft.family ? draft.template : TEMPLATE_BY_FAMILY[family] });
              }}
            />
          </Field>
          <Field label="Modèle" required htmlFor="field-template">
            <Select id="field-template" icon={FileText} options={TEMPLATES} value={draft.template} onChange={(e) => set("template", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={Network} title="Parcours de développement">
        <div className="grid gap-4 md:grid-cols-2">
          {PATHWAYS.map((p) => (
            <div key={p.key} className="rounded-xl border border-line bg-subtle/60 p-4">
              <div className="flex items-start gap-3">
                <p.icon className="mt-0.5 h-7 w-7 shrink-0 text-ink-700" strokeWidth={1.6} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-ink-900">{p.title}</p>
                    <Badge tone="info">Recommandé</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{p.detail(draft)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Checkbox checked={draft[p.key]} onChange={(v) => set(p.key, v)} label="Inclure dans le projet" />
                <button
                  type="button"
                  aria-expanded={openPathway === p.key}
                  aria-label={`Détail du ${p.title.toLowerCase()}`}
                  onClick={() => setOpenPathway((v) => (v === p.key ? null : p.key))}
                  className="cursor-pointer rounded-md p-1 text-ink-600 hover:bg-white"
                >
                  <ChevronRight className={`h-5 w-5 transition-transform ${openPathway === p.key ? "rotate-90" : ""}`} />
                </button>
              </div>
              {openPathway === p.key && (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm text-ink-700">
                  {p.activities.map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand-600" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        {errors.pathway && (
          <p id="field-pathway" tabIndex={-1} className="mt-3 flex items-center gap-2 text-sm text-danger-600">
            <CircleAlert className="h-4 w-4" aria-hidden />
            {errors.pathway}
          </p>
        )}
      </Section>

      <Section icon={Package} title="Études optionnelles">
        <div className="grid gap-4 md:grid-cols-3">
          {OPTIONAL_STUDIES.map((s) => {
            const Icon = STUDY_ICONS[s.icon];
            const included = draft.studies.includes(s.key);
            return (
              <div key={s.key} className={`rounded-xl border p-4 ${included ? "border-brand-300 bg-brand-50/50" : "border-line"}`}>
                <div className="flex items-start gap-3">
                  <IconTile icon={Icon} size="sm" className="bg-brand-50 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900">{s.title}</p>
                      <Badge tone={s.tag.tone}>{s.tag.label}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-600">{s.detail}</p>
                  </div>
                </div>
                <Checkbox
                  className="mt-3"
                  checked={included}
                  onChange={(v) => set("studies", v ? [...draft.studies, s.key] : draft.studies.filter((k) => k !== s.key))}
                  label="Inclure cette étude"
                />
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={User} title="Équipe projet">
        <div className="grid items-end gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {TEAM_ROLES.map((role) => (
            <Field key={role.key} label={<span className="text-sm">{role.label}</span>} required htmlFor={`field-team-${role.key}`} error={errors[`team-${role.key}`]}>
              <Select
                id={`field-team-${role.key}`}
                icon={ROLE_ICONS[role.icon]}
                placeholder="Sélectionner…"
                options={[...role.options]}
                value={draft.team[role.key] ?? ""}
                invalid={Boolean(errors[`team-${role.key}`])}
                onChange={(e) => set("team", { ...draft.team, [role.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Card>
        <button
          type="button"
          aria-expanded={calendarOpen}
          onClick={() => setCalendarOpen((v) => !v)}
          className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left"
        >
          <CalendarDays className="h-6 w-6 text-ink-700" strokeWidth={1.6} aria-hidden />
          <span className="text-lg font-bold text-ink-900">Calendrier, estimation et prérequis</span>
          <span className="flex-1 text-sm text-ink-500">Définir les jalons principaux, estimer les ressources et préciser les prérequis avant démarrage.</span>
          <ChevronDown className={`h-5 w-5 text-ink-600 transition-transform ${calendarOpen ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {calendarOpen && (
          <div className="border-t border-line px-5 pb-5 pt-4">
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Date de démarrage" htmlFor="field-startDate">
                <DateInput id="field-startDate" value={draft.startDate} onChange={(v) => set("startDate", v)} />
              </Field>
              <Field label="Date cible" htmlFor="field-targetDate" error={errors.targetDate}>
                <DateInput id="field-targetDate" value={draft.targetDate} onChange={(v) => set("targetDate", v)} invalid={Boolean(errors.targetDate)} />
              </Field>
              <Field label="Charge estimée" htmlFor="field-effort" hint="En jours-homme">
                <Input id="field-effort" inputMode="numeric" placeholder="Ex. 120" value={draft.effort} onChange={(e) => set("effort", e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-[15px] font-semibold text-ink-800">Prérequis à demander au démarrage</legend>
              <div className="grid gap-2.5 md:grid-cols-2">
                {PREREQUISITE_TEMPLATES.map((p) => (
                  <Checkbox
                    key={p.name}
                    checked={draft.prerequisites.includes(p.name)}
                    onChange={(v) => set("prerequisites", v ? [...draft.prerequisites, p.name] : draft.prerequisites.filter((n) => n !== p.name))}
                    label={p.name}
                    description={`${p.detail} — ${p.source}`}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </Card>
    </div>
  );
}

function PreviewRow({ label, tag, tone = "neutral" }: { label: string; tag: string; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-ink-700">{label}</span>
      <Badge tone={tone}>{tag}</Badge>
    </div>
  );
}

function PreviewBlock({ n, icon: Icon, title, tag, tone = "neutral", action, children }: {
  n: number;
  icon: LucideIcon;
  title: string;
  tag?: string;
  tone?: Tone;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{n}</span>
        <Icon className="h-5 w-5 text-ink-700" strokeWidth={1.7} aria-hidden />
        <span className="flex-1 font-bold text-ink-900">{title}</span>
        {action ?? (tag && <Badge tone={tone}>{tag}</Badge>)}
      </div>
      <div className="mt-2 pl-11">{children}</div>
    </div>
  );
}

function ProjectPreview({ draft, onEditProduct }: { draft: ProjectDraft; onEditProduct: () => void }) {
  const teamComplete = TEAM_ROLES.every((r) => draft.team[r.key]);
  const scheduled = Boolean(draft.startDate && draft.targetDate);
  return (
    <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
      <h2 className="flex items-center gap-3 text-xl font-bold text-ink-900">
        <FileText className="h-6 w-6 text-ink-700" strokeWidth={1.6} aria-hidden />
        Aperçu du projet
      </h2>
      <div className="mt-4 space-y-3">
        <PreviewBlock
          n={1}
          icon={FlaskConical}
          title="Cadrage"
          action={
            <button type="button" onClick={onEditProduct} className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
              Modifier
            </button>
          }
        >
          <dl className="grid grid-cols-[80px_1fr] gap-y-1 text-sm">
            <dt className="text-ink-500">Famille</dt>
            <dd className="text-ink-900">{draft.family} / {draft.form}</dd>
            <dt className="text-ink-500">Modèle</dt>
            <dd className="text-ink-900">{draft.template}</dd>
          </dl>
        </PreviewBlock>
        <PreviewBlock n={2} icon={Clock} title="Prérequis" tag={prerequisiteCount(draft) ? `${prerequisiteCount(draft)} à demander` : "À définir"} tone={prerequisiteCount(draft) ? "info" : "neutral"}>
          {draft.ai && <PreviewRow label="Activités proposées (détection IA)" tag={`${draft.ai.activities.length} à affecter`} tone="info" />}
          <PreviewRow label="Études optionnelles" tag={draft.studies.length ? `${draft.studies.length} ${plural(draft.studies.length, "incluse")}` : "À confirmer"} tone={draft.studies.length ? "info" : "warn"} />
          <PreviewRow label="Ressources" tag={teamComplete ? "Attribuées" : "À attribuer"} tone={teamComplete ? "success" : "neutral"} />
          <PreviewRow label="Calendrier" tag={scheduled ? "Estimé" : "À estimer"} tone={scheduled ? "success" : "neutral"} />
        </PreviewBlock>
        <PreviewBlock n={3} icon={FlaskConical} title="Développement" tag="À planifier">
          <PreviewRow label="Développement galénique" tag={draft.galenic ? "Inclus" : "Exclu"} tone={draft.galenic ? "info" : "neutral"} />
          <PreviewRow label="Développement analytique" tag={draft.analytic ? "Inclus" : "Exclu"} tone={draft.analytic ? "info" : "neutral"} />
        </PreviewBlock>
        <PreviewBlock n={4} icon={Package} title="Lot pilote" tag="À planifier">
          <PreviewRow label="Lots et fabrication pilote" tag="À définir" />
        </PreviewBlock>
        <PreviewBlock n={5} icon={Settings} title="Contrôles & stabilité" tag="À planifier">
          <PreviewRow label="Contrôles" tag="À définir" />
          <PreviewRow label="Stabilité" tag="À définir" />
        </PreviewBlock>
        <PreviewBlock n={6} icon={FileText} title="CTD & transfert" tag="À planifier">
          <PreviewRow label="Dossier d'enregistrement" tag="À définir" />
          <PreviewRow label="Transfert industriel" tag="À définir" />
        </PreviewBlock>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Vérification                                               */
/* ------------------------------------------------------------------ */

/** Prerequisites created with the project: the selected ones and those the detection did not find. */
const prerequisiteCount = (d: ProjectDraft) => new Set([...d.prerequisites, ...(d.ai?.prerequisites ?? [])]).size;

function RecapCard({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: [string, string][] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        <button type="button" onClick={onEdit} className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
          Modifier
        </button>
      </div>
      <dl className="mt-3 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[200px_1fr] gap-4 py-2.5 text-[15px]">
            <dt className="text-ink-600">{k}</dt>
            <dd className="text-ink-900">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function ReviewStep({ draft, goTo }: { draft: ProjectDraft; goTo: (step: 1 | 2) => void }) {
  const studies = OPTIONAL_STUDIES.filter((s) => draft.studies.includes(s.key)).map((s) => s.title);
  const activities = 1 + (draft.galenic ? 1 : 0) + (draft.analytic ? 1 : 0) + (draft.ai?.activities.length ?? 0);
  const prerequisites = prerequisiteCount(draft);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <RecapCard
          title="Produit"
          onEdit={() => goTo(1)}
          rows={[
            ["Code projet", draft.code.toUpperCase()],
            ["Nom du projet", draft.name],
            ["DCI", draft.dci],
            ["Famille / forme", `${draft.family} / ${draft.form}`],
            ["Dosage", `${draft.dosage} ${draft.dosageUnit}`],
            ["Pays cible", draft.countries.join(", ")],
            ["Produit de référence", draft.referenceProduct],
            ["Pièces initiales", draft.files.length ? draft.files.map((f) => f.name).join(", ") : "Aucune"],
            ...(draft.ai
              ? [["Détection IA", `${Object.keys(draft.ai.fields).length} champs repris des documents — dosage retenu : ${draft.dosage} ${draft.dosageUnit}`] as [string, string]]
              : []),
          ]}
        />
        <RecapCard
          title="Parcours & équipe"
          onEdit={() => goTo(2)}
          rows={[
            ["Modèle", draft.template],
            ["Parcours", [draft.galenic && "Développement galénique", draft.analytic && "Développement analytique"].filter(Boolean).join(", ")],
            ["Études optionnelles", studies.join(", ") || "Aucune"],
            ...TEAM_ROLES.map((r): [string, string] => [r.label, draft.team[r.key] ?? ""]),
          ]}
        />
        <RecapCard
          title="Calendrier et prérequis"
          onEdit={() => goTo(2)}
          rows={[
            ["Date de démarrage", draft.startDate ? formatLong(draft.startDate) : "Dès la création"],
            ["Date cible", draft.targetDate ? formatLong(draft.targetDate) : "À estimer (6 mois par défaut)"],
            ["Charge estimée", draft.effort ? `${draft.effort} jours-homme` : "À estimer"],
            ["Prérequis", [...new Set([...draft.prerequisites, ...(draft.ai?.prerequisites ?? [])])].join(", ") || "Aucun"],
          ]}
        />
      </div>
      <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
        <h2 className="text-xl font-bold text-ink-900">Ce qui sera créé</h2>
        <ul className="mt-4 space-y-3">
          {[
            { icon: FileText, label: `Projet ${draft.code.toUpperCase()} • ${draft.name}`, detail: `${draft.template} — phase Cadrage` },
            { icon: Clock, label: `${prerequisites} ${plural(prerequisites, "prérequis")}`, detail: "Statut « À planifier »" },
            {
              icon: Check,
              label: `${activities} ${plural(activities, "activité")}`,
              detail: draft.ai ? `Cadrage, parcours et ${draft.ai.activities.length} activités proposées (brouillon)` : "Cadrage et planification des parcours",
            },
            { icon: FileText, label: `${draft.files.length} ${plural(draft.files.length, "document")}`, detail: "Pièces initiales (catégorie Références)" },
          ].map((item) => (
            <li key={item.label} className="flex items-start gap-3 rounded-xl border border-line p-3">
              <IconTile icon={item.icon} size="sm" className="bg-brand-50 text-brand-600" />
              <div>
                <p className="font-semibold text-ink-900">{item.label}</p>
                <p className="text-sm text-ink-500">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex gap-2.5 rounded-xl bg-brand-50/70 p-3 text-sm text-ink-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          La création est tracée dans l&apos;historique du projet.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

const STEPS = [
  { title: "Produit", subtitle: "Informations générales" },
  { title: "Parcours & équipe", subtitle: "Modèle et responsables" },
  { title: "Vérification", subtitle: "Récapitulatif avant création" },
];

const SCREENS = {
  1: { n: 7, label: "Créer un projet — Produit" },
  2: { n: 8, label: "Créer un projet — Parcours & équipe" },
  3: { n: 9, label: "Créer un projet — Vérification" },
};

export function NewProjectWizard({ source }: { source: WizardSource }) {
  const state = useDemo();
  const router = useRouter();
  const [{ draft: initial, notice }] = useState(() => initialDraft(state, source));
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [step, setStep] = useState<1 | 2 | 3>(
    source.kind === "draft" ? initial.step : source.kind === "demo" ? (source.variant === "parcours" ? 2 : source.variant === "verification" ? 3 : 1) : 1,
  );
  const [attempted, setAttempted] = useState<Record<number, boolean>>(source.kind === "demo" && source.variant === "erreurs" ? { 1: true } : {});
  const [ai, setAi] = useState<AiState>(() => aiStateFor(source.kind === "ia" ? source.stage : undefined));
  const [preview, setPreview] = useState<string | null>(null);
  useDetectionProgress(ai, setAi);

  const existingCodes = state.projects.map((p) => p.code);
  const productErrors = validateProduct(draft, existingCodes);
  const pathwayErrors = validatePathway(draft);
  const currentErrors = step === 1 ? productErrors : step === 2 ? pathwayErrors : {};
  const shownErrors = attempted[step] ? currentErrors : {};
  const blocked = Boolean(attempted[step] && Object.keys(currentErrors).length);
  // Documents dropped, detection not applied yet: the form is still to be completed (IA-01).
  const awaitingDetection = step === 1 && !blocked && draft.files.length > 0 && !draft.ai && Object.keys(productErrors).length > 0;

  const detection = {
    start: () => setAi((a) => ({ ...AI_IDLE, activities: a.activities, phase: "running" })),
    show: () => setAi((a) => (a.progress >= 100 ? { ...a, phase: "data", tab: "produit", minimized: false } : { ...a, minimized: false })),
    minimize: () => setAi((a) => ({ ...a, minimized: true })),
    cancel: () => setAi(() => AI_IDLE),
    close: () => setAi((a) => ({ ...a, phase: "idle", minimized: false })),
    resolve: () => setAi((a) => ({ ...a, phase: "conflict" })),
    review: (name: string) =>
      setAi((a) => ({ ...a, phase: "data", tab: "produit", source: { extract: Math.max(0, AI_EXTRACTS.findIndex((x) => x.file === name)) } })),
    apply: () => {
      setDraft(applyDetection(draft, ai));
      setAi((a) => ({ ...a, phase: "idle", minimized: false }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };

  const goTo = (target: 1 | 2 | 3) => {
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    setAttempted((a) => ({ ...a, [step]: true }));
    if (Object.keys(currentErrors).length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === 1) goTo(2);
    else if (step === 2) goTo(3);
    else {
      const slug = actions.createProject(draft);
      toast.show({ title: "Projet créé", description: `${draft.code.toUpperCase()} • ${draft.name} a été créé et son parcours initialisé.` });
      router.push(`/projets/${slug}`);
    }
  };

  const saveDraft = () => {
    actions.saveDraft({ ...draft, step });
    toast.show({ title: "Brouillon enregistré", description: "Vous pouvez le reprendre depuis la page Projets.", action: { label: "Voir les projets", href: "/projets" } });
  };

  const screen =
    step === 1 ? (blocked ? { n: 10, label: "Champs manquants et code déjà utilisé" } : (aiScreen(ai, draft) ?? SCREENS[1])) : SCREENS[step];
  const prefilled = draft.ai ? Object.keys(draft.ai.fields).length : 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        {step === 1 ? (
          <BackLink href="/projets">Retour aux projets</BackLink>
        ) : (
          <Breadcrumb items={[{ label: "Projets", href: "/projets" }, { label: "Nouveau projet" }]} />
        )}
      </div>
      <PageHeader
        className="mt-3"
        title={step === 1 ? "Nouveau projet" : "Créer un projet"}
        subtitle={
          step === 1
            ? "Créer un projet R&D à partir d'un produit et d'un modèle de parcours."
            : step === 2
              ? "Définir le parcours de développement et l'équipe projet."
              : "Vérifier les informations avant de créer le projet."
        }
      />
      <Stepper steps={STEPS} current={step} onStepClick={(n) => goTo(n as 1 | 2)} className="mt-6 max-w-5xl" />

      {step === 1 && prefilled > 0 ? (
        <p className="mt-5 flex items-center gap-3 rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-[15px] text-ink-800">
          <CircleCheck className="h-5 w-5 fill-success-500 text-white" aria-hidden />
          {prefilled} {plural(prefilled, "champ prérempli", "champs préremplis")} depuis vos documents. Vérifiez-les avant de continuer.
        </p>
      ) : notice && (
        <p className="mt-5 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-[15px] text-ink-700">
          {source.kind === "duplicate" ? <Copy className="h-5 w-5 text-brand-600" aria-hidden /> : <Info className="h-5 w-5 text-brand-600" aria-hidden />}
          {notice}
        </p>
      )}

      {Object.keys(shownErrors).length > 0 && (
        <div className="mt-5">
          <ErrorSummary errors={shownErrors} />
        </div>
      )}

      <div className="mt-6">
        {step === 1 && (
          <ProductStep
            draft={draft}
            setDraft={setDraft}
            errors={shownErrors}
            ai={ai}
            onDetect={detection.start}
            onShowDetection={detection.show}
            onFilesChange={detection.cancel}
            onPreview={setPreview}
            onReview={detection.review}
          />
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <PathwayStep draft={draft} setDraft={setDraft} errors={shownErrors} />
            <ProjectPreview draft={draft} onEditProduct={() => goTo(1)} />
          </div>
        )}
        {step === 3 && <ReviewStep draft={draft} goTo={goTo} />}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-canvas/90 px-4 py-4 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {step === 1 ? (
              <LinkButton href="/projets" variant="secondary" size="lg">
                Annuler
              </LinkButton>
            ) : (
              <Button variant="outline" size="lg" icon={<ArrowLeft className="h-5 w-5" />} onClick={() => goTo((step - 1) as 1 | 2)}>
                Précédent
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {step === 1 && !awaitingDetection && Object.keys(productErrors).length > 0 && (
              <span className="hidden text-sm text-ink-500 md:inline">Le brouillon reste incomplet.</span>
            )}
            <Button variant="outline" size="lg" icon={<FileText className="h-5 w-5" />} onClick={saveDraft}>
              {step === 1 ? "Enregistrer le brouillon" : "Brouillon"}
            </Button>
            <span className="flex flex-col items-center gap-1">
              <Button
                size="lg"
                disabled={blocked || awaitingDetection}
                className="min-w-40"
                iconRight={step === 3 ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                onClick={next}
                guide={step === 1 ? 8 : step === 2 ? 9 : undefined}
              >
                {step === 3 ? "Créer le projet" : "Continuer"}
              </Button>
              {awaitingDetection && <span className="whitespace-nowrap text-xs text-ink-500">Champs obligatoires à compléter</span>}
            </span>
          </div>
        </div>
      </div>

      <ScreenRef n={screen.n} label={screen.label} />

      {step === 1 && (
        <>
          <DetectionModal
            open={ai.phase === "running" && !ai.minimized}
            ai={ai}
            files={draft.files}
            onCancel={detection.cancel}
            onMinimize={detection.minimize}
            onShow={detection.show}
          />
          <DetectedDataModal open={ai.phase === "data"} ai={ai} setAi={setAi} onClose={detection.close} onResolve={detection.resolve} onApply={detection.apply} />
          {ai.phase === "conflict" && (
            <DosageConflictModal
              open
              current={ai.dosage}
              onBack={() => setAi((a) => ({ ...a, phase: "data" }))}
              onConfirm={(dosage) => setAi((a) => ({ ...a, phase: "data", tab: "parcours", dosage }))}
            />
          )}
          <FilePreviewModal name={preview} onClose={() => setPreview(null)} />
        </>
      )}
    </>
  );
}
