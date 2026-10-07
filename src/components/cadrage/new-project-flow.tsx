"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FileText,
  FlaskConical,
  FolderPlus,
  Globe,
  Info,
  Map as MapIcon,
  Package,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Badge, IconTile } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, DateInput, Field, Input, MultiSelect, Select } from "@/components/ui/field";
import { BackLink, PageHeader, ScreenRef } from "@/components/ui/page";
import { Stepper } from "@/components/ui/stepper";
import { toast } from "@/components/ui/toast";
import {
  ALL_FORMS,
  CADRAGE_ROLES,
  EXPECTED_DOCUMENTS,
  PROCEDURES,
  PROCEDURE_UNKNOWN,
  applyDocument,
  cadrageUnknowns,
  confirmDatum,
  correctDatum,
  dataFromCandidate,
  dataFromManual,
  docState,
  familyOfForm,
  infoQuality,
  isIdentityProof,
  isReadable,
  isVerified,
  resolveDatum,
  unreadNote,
} from "@/lib/cadrage";
import { COUNTRIES, CURRENT_USER, DOSAGE_UNITS, PEOPLE } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatFileSize, formatLong, plural } from "@/lib/format";
import { useTeamNames } from "@/lib/people";
import {
  DOCUMENT_TYPES,
  REFERENCE_SOURCE_LABEL,
  candidateLabel,
  findCandidate,
  guessDocumentType,
  identifyReference,
  siblingDosages,
  type ReferenceCandidate,
} from "@/lib/reference-catalog";
import { nextNumber, pad2, stamp, uid } from "@/lib/state-utils";
import { cadrageActions, useDemo } from "@/lib/store";
import type { CadrageDatum, CadrageDocument, DosageVariant, ProjectCadrage, TeamMember } from "@/lib/types";
import { cadrageWorkbook } from "@/lib/step-exports";
import { DatumList, DatumModal, DocStateBadge, ExcelButton, PathwaySteps, ProofDrawer, QualityBar, SectionTitle, UnknownsList } from "./cadrage-bits";

const STEPS = [
  { title: "Produit de référence", subtitle: "Identifier et documenter" },
  { title: "Identité & périmètre", subtitle: "Confirmer et compléter" },
  { title: "Vérification", subtitle: "Ce qui sera créé" },
];

const REGULATORY_PEOPLE = ["Responsable affaires réglementaires", "Responsable assurance qualité"];

type Errors = Record<string, string>;

interface Manual {
  name: string;
  dci: string;
  form: string;
  dosage: string;
  unit: string;
  holder: string;
  country: string;
}

const EMPTY_MANUAL: Manual = { name: "", dci: "", form: ALL_FORMS[0], dosage: "", unit: "mg", holder: "", country: "" };

function ErrorSummary({ errors }: { errors: Errors }) {
  const list = Object.values(errors);
  if (!list.length) return null;
  return (
    <div role="alert" className="mt-5 flex gap-4 rounded-xl border border-danger-200 bg-danger-50 p-4">
      <CircleAlert className="h-7 w-7 shrink-0 fill-danger-600 text-white" aria-hidden />
      <div>
        <p className="font-bold text-danger-700">
          {list.length} {plural(list.length, "point à compléter", "points à compléter")} avant de continuer
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[15px] text-ink-800">
          {list.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Produit de référence                                       */
/* ------------------------------------------------------------------ */

function CandidateCard({ c, selected, onSelect }: { c: ReferenceCandidate; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-start gap-4 rounded-xl border p-4 text-left transition-colors",
        selected ? "border-brand-500 bg-brand-50/70 ring-1 ring-brand-300" : "border-line bg-white hover:border-brand-300 hover:bg-brand-50/30",
      )}
    >
      <span className={cn("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white", selected ? "border-brand-600" : "border-line-strong")} aria-hidden>
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[17px] font-bold text-ink-900">
            {c.name} {c.dosage} {c.unit}
          </span>
          <Badge tone="info">{c.form}</Badge>
          <Badge tone="neutral" icon={Globe}>
            {c.country}
          </Badge>
        </span>
        <span className="mt-1.5 grid gap-x-6 gap-y-1 text-sm text-ink-700 sm:grid-cols-2">
          <span>
            <span className="text-ink-500">Substance active : </span>
            {c.dci}
          </span>
          <span>
            <span className="text-ink-500">Titulaire / fabricant : </span>
            {c.holder}
          </span>
        </span>
        <span className="mt-1 block text-[13px] text-ink-500">Source : {REFERENCE_SOURCE_LABEL}</span>
      </span>
    </button>
  );
}

function DocumentsInput({ docs, setDocs }: { docs: CadrageDocument[]; setDocs: (d: CadrageDocument[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const at = stamp();
    const added = Array.from(files)
      .filter((f) => !docs.some((d) => d.name === f.name))
      .map((f): CadrageDocument => ({ id: uid("cdoc"), name: f.name, size: formatFileSize(f.size), type: guessDocumentType(f.name), version: 1, receivedAt: at, readable: false }));
    setDocs([...docs, ...added]);
    if (input.current) input.current.value = "";
  };
  return (
    <div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-subtle px-6 py-7 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"
      >
        <Upload className="h-7 w-7 text-brand-600" strokeWidth={1.7} aria-hidden />
        <span className="text-[15px] font-semibold text-ink-900">Ajouter le RCP ou la notice</span>
        <span className="text-sm text-ink-500">Glissez les fichiers ici ou cliquez pour les choisir — PDF, Word ou image scannée</span>
        <input ref={input} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tif,.tiff" className="sr-only" onChange={(e) => add(e.target.files)} />
      </label>
      {docs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.7} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink-900">{d.name}</span>
                <span className="block text-[13px] text-ink-500">{d.size} · original conservé (version 1)</span>
              </span>
              <Select
                aria-label={`Type du document ${d.name}`}
                size="sm"
                className="w-64"
                options={DOCUMENT_TYPES}
                value={d.type}
                onChange={(e) => setDocs(docs.map((x) => (x.id === d.id ? { ...x, type: e.target.value } : x)))}
              />
              <IconButton label={`Retirer ${d.name}`} onClick={() => setDocs(docs.filter((x) => x.id !== d.id))}>
                <X className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && <p className="mt-2 text-[13px] text-ink-500">Le type est proposé d&apos;après le nom du fichier : confirmez-le ou corrigez-le.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flow                                                                */
/* ------------------------------------------------------------------ */

export function NewProjectFlow() {
  const state = useDemo();
  const router = useRouter();
  const people = [...new Set([...useTeamNames([...PEOPLE, ...REGULATORY_PEOPLE])])];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});

  /* Step 1 */
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ query: string; results: ReferenceCandidate[] } | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState<Manual>(EMPTY_MANUAL);
  const [docs, setDocs] = useState<CadrageDocument[]>([]);
  const candidate = findCandidate(candidateId ?? undefined);

  /* Step 2 */
  const [data, setData] = useState<CadrageDatum[]>([]);
  const [signature, setSignature] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [form, setForm] = useState(ALL_FORMS[0]);
  const [variants, setVariants] = useState<DosageVariant[]>([]);
  const [newDosage, setNewDosage] = useState("");
  const [newUnit, setNewUnit] = useState("mg");
  const [markets, setMarkets] = useState<string[]>([]);
  const [procedure, setProcedure] = useState(PROCEDURE_UNKNOWN);
  const [team, setTeam] = useState<Record<string, string>>({ chef: CURRENT_USER });
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [expected, setExpected] = useState(EXPECTED_DOCUMENTS.map((e) => e.type));

  const [proof, setProof] = useState<CadrageDatum | null>(null);
  const [editing, setEditing] = useState<{ key: string; mode: "edit" | "resolve" } | null>(null);

  const value = (key: string) => data.find((d) => d.key === key)?.value ?? "";
  const critical = data.filter((d) => d.critical);
  const quality = infoQuality(data);

  /* ---------------- Step 1 ---------------- */

  const identify = () => {
    const results = identifyReference(query);
    setSearch({ query: query.trim(), results });
    setCandidateId(null);
    setManualMode(results.length === 0);
    if (!results.length) setManual((m) => ({ ...m, name: m.name || query.trim() }));
  };

  const manualErrors = (): Errors => {
    const e: Errors = {};
    if (!manual.name.trim()) e.name = "Nom du médicament de référence.";
    if (!manual.dci.trim()) e.dci = "Substance active (DCI) de la référence.";
    if (!(Number(manual.dosage.replace(",", ".")) > 0)) e.dosage = "Dosage de la référence (nombre positif).";
    if (!manual.holder.trim()) e.holder = "Titulaire ou fabricant de la référence.";
    if (!manual.country) e.country = "Pays de la référence : une même marque peut différer d'un pays à l'autre.";
    return e;
  };
  const step1Errors: Errors = candidate ? {} : manualMode ? manualErrors() : { reference: search ? "Sélectionnez la présentation exacte, ou saisissez l'identité manuellement." : "Identifiez le médicament de référence." };

  /** Builds the sourced values once the reference and its documents are known (kept while they do not change). */
  const prepareIdentity = () => {
    const next = JSON.stringify([candidateId, manualMode ? manual : null, docs.map((d) => [d.id, d.type])]);
    if (next === signature) return;
    const at = stamp();
    const read = docs.map((d) => {
      const readable = isReadable(candidate, d.type);
      return { ...d, readable, note: readable ? undefined : unreadNote(d.type) };
    });
    const dosage = `${manual.dosage.trim().replace(",", ".")} ${manual.unit}`;
    let built = candidate ? dataFromCandidate(candidate, at) : dataFromManual({ name: manual.name, dci: manual.dci, form: manual.form, dosage, holder: manual.holder, country: manual.country }, at);
    for (const d of read) built = applyDocument(built, candidate, d, at);
    setDocs(read);
    setData(built);
    setSignature(JSON.stringify([candidateId, manualMode ? manual : null, read.map((d) => [d.id, d.type])]));

    // Defaults of the product to develop: same form and dosage as the reference, to be adjusted.
    const refForm = candidate?.form ?? manual.form;
    const [refDosage, ...refUnit] = (candidate ? `${candidate.dosage} ${candidate.unit}` : dosage).split(" ");
    const dci = candidate?.dci ?? manual.dci.trim();
    setForm(ALL_FORMS.includes(refForm) ? refForm : ALL_FORMS[0]);
    setVariants([{ id: uid("var"), dosage: refDosage, unit: refUnit.join(" ") || "mg", reference: true }]);
    setNewUnit(refUnit.join(" ") || "mg");
    setName(`${dci} ${refDosage} ${refUnit.join(" ")}`.trim());
    if (!code) setCode(`GN-${pad2(nextNumber(state.projects.map((p) => p.code), /^GN-(\d+)$/))}`);
  };

  /* ---------------- Step 2 ---------------- */

  const update = (key: string, fn: (d: CadrageDatum) => CadrageDatum) => setData((list) => list.map((d) => (d.key === key ? fn(d) : d)));
  const pendingIdentity = critical.filter((d) => d.status === "Extraite à confirmer");

  const step2Errors = (): Errors => {
    const e: Errors = {};
    const unconfirmed = critical.filter((d) => !isVerified(d));
    if (unconfirmed.length) e.identity = `Identité à confirmer : ${unconfirmed.map((d) => d.label.toLowerCase()).join(", ")}.`;
    const c = code.trim().toUpperCase();
    if (!c) e.code = "Code du projet.";
    else if (state.projects.some((p) => p.code === c)) e.code = `Le code ${c} est déjà utilisé par un autre projet.`;
    else if (!/^[A-Z]{2,3}-\d{2}$/.test(c)) e.code = "Code du projet : 2 ou 3 lettres, un tiret et 2 chiffres (ex. GN-01).";
    if (!name.trim()) e.name = "Nom du projet.";
    if (!variants.length) e.variants = "Au moins un dosage visé.";
    if (!markets.length) e.markets = "Pays de dépôt : au moins un marché visé.";
    if (!team.chef) e.chef = "Chef de projet.";
    if (startDate && targetDate && targetDate < startDate) e.targetDate = "La date cible précède la date de démarrage.";
    return e;
  };

  const addVariant = (dosage: string, unit: string) => {
    const v = dosage.trim().replace(",", ".");
    if (!(Number(v) > 0) || variants.some((x) => x.dosage === v && x.unit === unit)) return;
    setVariants([...variants, { id: uid("var"), dosage: v, unit, reference: false }]);
    setNewDosage("");
  };
  const suggestions = candidate ? siblingDosages(candidate).filter((c) => !variants.some((v) => v.dosage === c.dosage && v.unit === c.unit)) : [];

  /* ---------------- Navigation ---------------- */

  const errors = step === 1 ? step1Errors : step === 2 ? step2Errors() : {};
  const shown = attempted[step] ? errors : {};

  const members: TeamMember[] = CADRAGE_ROLES.map((r) => ({ role: r.label, person: team[r.key] ?? "" }));
  const draft: Omit<ProjectCadrage, "g0"> = {
    candidateId: candidateId ?? undefined,
    reference: { name: value("name"), holder: value("holder"), country: value("country"), sourceLabel: candidate ? REFERENCE_SOURCE_LABEL : "Saisie manuelle" },
    data,
    markets,
    procedure,
    variants,
    startDate,
    targetDate,
    documents: docs,
    expected: EXPECTED_DOCUMENTS.filter((e) => expected.includes(e.type)),
  };

  const goTo = (target: 1 | 2 | 3) => {
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    setAttempted((a) => ({ ...a, [step]: true }));
    if (Object.keys(errors).length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === 1) {
      prepareIdentity();
      goTo(2);
    } else if (step === 2) goTo(3);
    else {
      const projectCode = code.trim().toUpperCase();
      cadrageActions.create({ code: projectCode, name, form, cadrage: draft, team });
      toast.show({ title: "Projet créé", description: `${projectCode} • ${name.trim()} — fiche d'identité, périmètre, variantes et documents initiaux enregistrés.` });
      router.push(`/projets/${projectCode.toLowerCase()}/cadrage`);
    }
  };

  const unknowns = cadrageUnknowns({ ...draft, g0: { status: "Attendue" } }, members);
  const review = data.filter((d) => d.status === "Extraite à confirmer" || d.status === "Contradictoire").length;
  const editingDatum = editing && data.find((d) => d.key === editing.key);

  return (
    <>
      <BackLink href="/projets">Retour aux projets</BackLink>
      <PageHeader
        className="mt-3"
        title="Nouveau projet"
        subtitle={
          step === 1
            ? "Commencez par le médicament de référence : la plateforme préremplit ce qu'elle peut lire."
            : step === 2
              ? "Confirmez l'identité lue, puis complétez seulement ce que le système ne connaît pas."
              : "Vérifiez ce qui sera créé, ce qui manque encore et le parcours proposé."
        }
      />
      <Stepper steps={STEPS} current={step} onStepClick={(n) => goTo(n as 1 | 2)} className="mt-6 max-w-5xl" />
      <ErrorSummary errors={shown} />

      {/* ---------------------------------------------------------------- */}
      {step === 1 && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            <Card className="p-6">
              <SectionTitle icon={Pill} title="Médicament de référence" subtitle="Le produit dont vous développez le générique." />
              <form
                className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  identify();
                }}
              >
                <Field label="Médicament de référence" required htmlFor="reference" className="flex-1">
                  <Input id="reference" placeholder="Nom de marque ou substance active — ex. Princeps A" value={query} onChange={(e) => setQuery(e.target.value)} />
                </Field>
                <Button type="submit" size="lg" className="h-11" icon={<Search className="h-5 w-5" />} disabled={query.trim().length < 2}>
                  Identifier le produit
                </Button>
              </form>
              <p className="mt-3 flex gap-2.5 rounded-xl bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                <span>
                  Un nom seul ne lance aucune analyse définitive : une même marque peut désigner plusieurs présentations selon les pays. Source connectée :{" "}
                  <strong className="font-semibold">{REFERENCE_SOURCE_LABEL}</strong> — essayez « Princeps A », « Princeps B » ou « Princeps C ».
                </span>
              </p>

              {search && search.results.length > 0 && (
                <div className="mt-6">
                  <p className="text-[15px] font-semibold text-ink-900">
                    {search.results.length} {plural(search.results.length, "présentation trouvée", "présentations trouvées")} pour « {search.query} » — choisissez le produit exact
                  </p>
                  <div role="radiogroup" aria-label="Présentations du médicament de référence" className="mt-3 space-y-2.5">
                    {search.results.map((c) => (
                      <CandidateCard
                        key={c.id}
                        c={c}
                        selected={candidateId === c.id}
                        onSelect={() => {
                          setCandidateId(c.id);
                          setManualMode(false);
                        }}
                      />
                    ))}
                  </div>
                  {!manualMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateId(null);
                        setManualMode(true);
                        setManual((m) => ({ ...m, name: m.name || search.query }));
                      }}
                      className="mt-3 cursor-pointer text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Aucune ne correspond — saisir l&apos;identité manuellement
                    </button>
                  )}
                </div>
              )}

              {search && search.results.length === 0 && (
                <p className="mt-6 flex gap-2.5 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-[15px] text-ink-800">
                  <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-warn-600" aria-hidden />
                  Aucun candidat pour « {search.query} » dans la source connectée. Renseignez l&apos;identité minimale ci-dessous et importez le RCP ou la notice.
                </p>
              )}

              {manualMode && (
                <div className="mt-6 border-t border-line pt-5">
                  <h3 className="text-[17px] font-bold text-ink-900">Identité minimale du produit de référence</h3>
                  <p className="mt-0.5 text-sm text-ink-500">Ces valeurs seront marquées « saisie manuelle » tant qu&apos;aucun document n&apos;en est la preuve.</p>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <Field label="Nom du médicament" required htmlFor="m-name" error={shown.name}>
                      <Input id="m-name" value={manual.name} invalid={Boolean(shown.name)} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
                    </Field>
                    <Field label="Substance active (DCI)" required htmlFor="m-dci" error={shown.dci}>
                      <Input id="m-dci" value={manual.dci} invalid={Boolean(shown.dci)} onChange={(e) => setManual({ ...manual, dci: e.target.value })} />
                    </Field>
                    <Field label="Forme pharmaceutique" required htmlFor="m-form">
                      <Select id="m-form" options={ALL_FORMS} value={manual.form} onChange={(e) => setManual({ ...manual, form: e.target.value })} />
                    </Field>
                    <Field label="Dosage" required htmlFor="m-dosage" error={shown.dosage}>
                      <div className="grid grid-cols-[1fr_120px] gap-3">
                        <Input id="m-dosage" inputMode="decimal" placeholder="Ex. 500" value={manual.dosage} invalid={Boolean(shown.dosage)} onChange={(e) => setManual({ ...manual, dosage: e.target.value })} />
                        <Select aria-label="Unité du dosage" options={DOSAGE_UNITS} value={manual.unit} onChange={(e) => setManual({ ...manual, unit: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="Titulaire / fabricant" required htmlFor="m-holder" error={shown.holder}>
                      <Input id="m-holder" value={manual.holder} invalid={Boolean(shown.holder)} onChange={(e) => setManual({ ...manual, holder: e.target.value })} />
                    </Field>
                    <Field label="Pays de la référence" required htmlFor="m-country" error={shown.country}>
                      <Select id="m-country" placeholder="Sélectionner…" options={COUNTRIES} value={manual.country} invalid={Boolean(shown.country)} onChange={(e) => setManual({ ...manual, country: e.target.value })} />
                    </Field>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <SectionTitle icon={FileText} title="Documents du princeps" subtitle="Optionnel à cette étape — sans document, l'identité repose sur la source connectée ou sur votre saisie." />
              <div className="mt-5">
                <DocumentsInput docs={docs} setDocs={setDocs} />
              </div>
            </Card>
          </div>

          <Card className="h-fit p-5 xl:sticky xl:top-[96px]">
            <h2 className="text-lg font-bold text-ink-900">Ce que fait la plateforme</h2>
            <ul className="mt-4 space-y-4">
              {[
                { icon: FileText, title: "Elle préremplit", detail: "Les informations identifiables dans la source et les documents, chacune avec son extrait." },
                { icon: CircleHelp, title: "Elle ne demande que ce qui manque", detail: "Pays de dépôt, dosages visés, forme, chef de projet et cible de calendrier." },
                { icon: Package, title: "Elle sépare trois objets", detail: "Le produit de référence, le principe actif du fournisseur et le produit en développement." },
                { icon: ShieldCheck, title: "Vous décidez", detail: "Rien n'est tenu pour acquis tant que vous n'avez pas confirmé l'identité et le périmètre." },
              ].map((x) => (
                <li key={x.title} className="flex items-start gap-3">
                  <IconTile icon={x.icon} size="sm" />
                  <div>
                    <p className="font-semibold text-ink-900">{x.title}</p>
                    <p className="text-sm leading-snug text-ink-600">{x.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 2 && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Card className="p-6">
              <SectionTitle
                icon={Pill}
                title="Identité du produit de référence"
                subtitle="Les valeurs marquées * identifient le produit : confirmez-les avec leur extrait source."
                aside={
                  pendingIdentity.length > 0 && (
                    <Button variant="outline" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => setData((list) => list.map((d) => (d.critical ? confirmDatum(d, stamp()) : d)))}>
                      Confirmer l&apos;identité affichée
                    </Button>
                  )
                }
              />
              <DatumList
                className="mt-4"
                data={critical}
                onProof={setProof}
                onConfirm={(d) => update(d.key, (x) => confirmDatum(x, stamp()))}
                onEdit={(d) => setEditing({ key: d.key, mode: "edit" })}
                onResolve={(d) => setEditing({ key: d.key, mode: "resolve" })}
              />
              <h3 className="mt-6 text-[15px] font-bold text-ink-900">Autres informations lues</h3>
              <p className="text-sm text-ink-500">Non bloquantes pour créer le projet : ce qui reste à confirmer vous sera proposé ensuite, ce qui manque rejoint la liste des inconnues.</p>
              <DatumList
                className="mt-3"
                data={data.filter((d) => !d.critical)}
                onProof={setProof}
                onConfirm={(d) => update(d.key, (x) => confirmDatum(x, stamp()))}
                onEdit={(d) => setEditing({ key: d.key, mode: "edit" })}
                onResolve={(d) => setEditing({ key: d.key, mode: "resolve" })}
              />
            </Card>

            <Card className="p-6">
              <SectionTitle icon={FlaskConical} title="Produit à développer" subtitle="Distinct du produit de référence : forme et dosages que vous visez." />
              <div className="mt-5 grid gap-5 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Code projet" required htmlFor="code" error={shown.code && "À corriger"} info="2 ou 3 lettres, un tiret et 2 chiffres. Le code doit être unique.">
                  <Input id="code" value={code} invalid={Boolean(shown.code)} onChange={(e) => setCode(e.target.value.toUpperCase())} />
                </Field>
                <Field label="Nom du projet" required htmlFor="name" error={shown.name && "À renseigner"}>
                  <Input id="name" value={name} invalid={Boolean(shown.name)} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Forme visée" required htmlFor="form" hint={form !== value("form") ? `Différente de la référence (${value("form").toLowerCase()})` : "Identique à la référence"}>
                  <Select id="form" options={ALL_FORMS} value={form} onChange={(e) => setForm(e.target.value)} />
                </Field>
              </div>

              <div className="mt-5">
                <p className="mb-1.5 text-[15px] font-semibold text-ink-800">
                  Dosages visés <span className="text-danger-600">*</span>
                </p>
                <ul className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <li key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 py-1.5 pl-3 pr-1.5 text-[15px] font-semibold text-brand-800">
                      {v.dosage} {v.unit}
                      {v.reference && <span className="text-xs font-medium text-brand-700">dosage de la référence</span>}
                      <button
                        type="button"
                        aria-label={`Retirer le dosage ${v.dosage} ${v.unit}`}
                        onClick={() => setVariants(variants.filter((x) => x.id !== v.id))}
                        className="cursor-pointer rounded p-1 text-brand-700 hover:bg-brand-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                  {suggestions.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => addVariant(c.dosage, c.unit)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-white px-3 py-1.5 text-[15px] font-medium text-ink-700 hover:border-brand-400 hover:text-brand-700"
                      >
                        <Plus className="h-4 w-4" />
                        {c.dosage} {c.unit}
                        <span className="text-xs text-ink-500">existe pour la référence</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Input aria-label="Autre dosage" inputMode="decimal" placeholder="Autre dosage" className="w-40" value={newDosage} onChange={(e) => setNewDosage(e.target.value)} />
                  <Select aria-label="Unité" options={DOSAGE_UNITS} value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className="w-28" />
                  <Button variant="outline" icon={<Plus className="h-4 w-4" />} disabled={!(Number(newDosage.replace(",", ".")) > 0)} onClick={() => addVariant(newDosage, newUnit)}>
                    Ajouter une variante
                  </Button>
                </div>
                <p className="mt-2 text-[13px] text-ink-500">
                  Chaque dosage devient une variante avec des preuves communes et des preuves propres : une conclusion obtenue sur un dosage n&apos;est pas étendue automatiquement
                  aux autres.
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <SectionTitle icon={Globe} title="Marché visé" subtitle="Le marché détermine les références applicables et la procédure." />
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field label="Pays de dépôt" required htmlFor="markets" error={shown.markets && "Sélectionnez au moins un pays."}>
                  <MultiSelect id="markets" label="Pays de dépôt" options={COUNTRIES} value={markets} onChange={setMarkets} placeholder="Sélectionner un ou plusieurs pays" invalid={Boolean(shown.markets)} />
                </Field>
                <Field label="Procédure d'enregistrement" htmlFor="procedure" hint="Peut rester à déterminer : elle rejoint alors la liste des inconnues.">
                  <Select id="procedure" options={PROCEDURES} value={procedure} onChange={(e) => setProcedure(e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card className="p-6">
              <SectionTitle icon={Users} title="Équipe" subtitle="Seul le chef de projet est requis ; les autres rôles peuvent être désignés plus tard." />
              <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {CADRAGE_ROLES.map((r) => (
                  <Field key={r.key} label={r.label} required={r.required} htmlFor={`team-${r.key}`} hint={r.detail} error={r.key === "chef" && shown.chef ? "Désignez le chef de projet." : undefined}>
                    <Select
                      id={`team-${r.key}`}
                      placeholder="À désigner"
                      options={people}
                      value={team[r.key] ?? ""}
                      invalid={r.key === "chef" && Boolean(shown.chef)}
                      onChange={(e) => setTeam({ ...team, [r.key]: e.target.value })}
                    />
                  </Field>
                ))}
              </div>
              {!state.demo && <p className="mt-3 text-[13px] text-ink-500">Les membres de l&apos;équipe se déclarent dans Configuration → Rôles et accès.</p>}
            </Card>

            <Card className="p-6">
              <SectionTitle icon={CalendarDays} title="Cible de calendrier" subtitle="Optionnel — sans date cible, le calendrier rejoint la liste des inconnues." />
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field label="Date de démarrage" htmlFor="start">
                  <DateInput id="start" value={startDate} onChange={setStartDate} onClear={() => setStartDate("")} />
                </Field>
                <Field label="Dossier prêt pour validation interne — cible" htmlFor="target" error={shown.targetDate}>
                  <DateInput id="target" value={targetDate} onChange={setTargetDate} onClear={() => setTargetDate("")} invalid={Boolean(shown.targetDate)} />
                </Field>
              </div>
            </Card>
          </div>

          <div className="h-fit space-y-5 xl:sticky xl:top-[96px]">
            <Card className="p-5">
              <h2 className="text-lg font-bold text-ink-900">Trois objets distincts</h2>
              <ul className="mt-4 space-y-3">
                <li className="rounded-xl border border-line p-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-600">
                    <Pill className="h-4 w-4" aria-hidden />
                    Produit de référence
                  </p>
                  <p className="mt-1 font-bold text-ink-900">
                    {value("name")} {value("dosage")}
                  </p>
                  <p className="text-sm text-ink-600">
                    {value("form")} · {value("holder")} · {value("country")}
                  </p>
                </li>
                <li className="rounded-xl border border-line p-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-600">
                    <Building2 className="h-4 w-4" aria-hidden />
                    Principe actif du fournisseur
                  </p>
                  <p className="mt-1 font-bold text-ink-900">{value("dci")}</p>
                  <p className="text-sm text-ink-400">Fournisseur non documenté à ce stade</p>
                </li>
                <li className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                    <FlaskConical className="h-4 w-4" aria-hidden />
                    Produit en développement
                  </p>
                  <p className="mt-1 font-bold text-ink-900">
                    {code || "Code à définir"} • {name || "Nom à définir"}
                  </p>
                  <p className="text-sm text-ink-600">
                    {form} · {variants.map((v) => `${v.dosage} ${v.unit}`).join(", ") || "dosages à définir"} · {markets.join(", ") || "marché à définir"}
                  </p>
                </li>
              </ul>
            </Card>
            <Card className="p-5">
              <h2 className="text-lg font-bold text-ink-900">Qualité de l&apos;information</h2>
              <p className="mt-0.5 text-sm text-ink-500">{data.length} valeurs de la fiche produit</p>
              <div className="mt-4">
                <QualityBar quality={quality} />
              </div>
            </Card>
            {docs.length > 0 && (
              <Card className="p-5">
                <h2 className="text-lg font-bold text-ink-900">Documents reçus</h2>
                <ul className="mt-3 space-y-3">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-ink-900">{d.name}</p>
                          <p className="text-[13px] text-ink-500">{d.type}</p>
                        </div>
                        <DocStateBadge state={docState(d, data)} />
                      </div>
                      {d.note && <p className="mt-1 text-[13px] leading-snug text-ink-500">{d.note}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 3 && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <Card className="p-6">
              <SectionTitle
                icon={FolderPlus}
                title={`${code.trim().toUpperCase()} • ${name.trim()}`}
                subtitle={`Générique de ${value("name")} ${value("dosage")} — ${value("holder")} (${value("country")})`}
                aside={
                  <button type="button" onClick={() => goTo(2)} className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
                    Modifier
                  </button>
                }
              />
              <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {(
                  [
                    ["Substance active", value("dci")],
                    ["Forme visée", form],
                    ["Dosages visés", variants.map((v) => `${v.dosage} ${v.unit}`).join(", ")],
                    ["Pays de dépôt", markets.join(", ")],
                    ["Procédure", procedure],
                    ["Chef de projet", team.chef],
                    ["Démarrage", startDate ? formatLong(startDate) : "Dès la création"],
                    ["Cible — dossier prêt pour validation interne", targetDate ? formatLong(targetDate) : "Non définie"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[13px] text-ink-500">{k}</dt>
                    <dd className="font-semibold text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="p-6">
              <SectionTitle icon={FileText} title="Documents attendus" subtitle="Liste initiale proposée. Décochez ce qui ne s'applique pas à ce projet ; un fichier présent ne vaut pas contenu suffisant." />
              <div className="mt-3 grid gap-x-6 gap-y-1 md:grid-cols-2">
                {EXPECTED_DOCUMENTS.map((e) => (
                  <Checkbox
                    key={e.type}
                    className="py-1.5"
                    checked={expected.includes(e.type)}
                    disabled={isIdentityProof(e.type)}
                    onChange={(v) => setExpected(v ? [...expected, e.type] : expected.filter((t) => t !== e.type))}
                    label={e.type}
                    description={`${docs.some((d) => d.type === e.type) ? "Reçu" : "Attendu"} · ${e.neededFor}`}
                  />
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <SectionTitle icon={CircleHelp} title={`Liste des inconnues (${unknowns.length})`} subtitle="Ce que le projet ne sait pas encore. Aucune valeur n'est inventée pour combler un manque." />
              <div className="mt-4">
                <UnknownsList items={unknowns} />
              </div>
            </Card>
          </div>

          <div className="h-fit space-y-5 xl:sticky xl:top-[96px]">
            <Card className="p-5">
              <h2 className="text-lg font-bold text-ink-900">Ce qui sera créé</h2>
              <ul className="mt-4 space-y-3">
                {[
                  { icon: Pill, label: "Fiche d'identité", detail: `${quality.verified} ${plural(quality.verified, "valeur vérifiée", "valeurs vérifiées")}, ${quality.toConfirm} à confirmer, ${quality.missing} non documentées` },
                  { icon: Globe, label: "Périmètre de marché", detail: `${markets.join(", ")} — ${procedure === PROCEDURE_UNKNOWN ? "procédure à déterminer" : procedure}` },
                  { icon: FlaskConical, label: `${variants.length} ${plural(variants.length, "variante")} de dosage`, detail: variants.map((v) => `${v.dosage} ${v.unit}`).join(", ") },
                  { icon: Users, label: "Équipe", detail: `${members.filter((m) => m.person).length} ${plural(members.filter((m) => m.person).length, "rôle désigné", "rôles désignés")} sur ${members.length}` },
                  { icon: FileText, label: `${docs.length} ${plural(docs.length, "document")} initial${docs.length > 1 ? "aux" : ""}`, detail: docs.length ? docs.map((d) => d.type).join(", ") : "Aucun document importé" },
                ].map((x) => (
                  <li key={x.label} className="flex items-start gap-3 rounded-xl border border-line p-3">
                    <IconTile icon={x.icon} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{x.label}</p>
                      <p className="text-sm leading-snug text-ink-500">{x.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
                <p className="text-[13px] font-semibold text-brand-700">Première carte du projet</p>
                <p className="mt-0.5 font-bold text-ink-900">{review ? "Documents à examiner" : "Cadrage à valider (porte G0)"}</p>
                <p className="text-sm text-ink-600">
                  {review
                    ? `${review} ${plural(review, "donnée lue reste", "données lues restent")} à confirmer avec son extrait source.`
                    : "Quel produit et quel marché développons-nous ? La faisabilité se prépare ensuite."}
                </p>
              </div>
              <p className="mt-3 flex gap-2 text-[13px] text-ink-500">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden />
                Les activités ne sont créées que pour lever une inconnue ou appliquer une décision. La création est tracée dans l&apos;historique.
              </p>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2.5 text-lg font-bold text-ink-900">
                <MapIcon className="h-5 w-5 text-ink-700" strokeWidth={1.7} aria-hidden />
                Parcours proposé
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">Adapté à la forme « {form.toLowerCase()} ». Les étapes ne sont pas strictement séquentielles.</p>
              <div className="mt-4">
                <PathwaySteps family={familyOfForm(form)} />
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-8 mt-6 border-t border-line bg-canvas/90 px-8 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {step === 1 ? (
            <LinkButton href="/projets" variant="secondary" size="lg">
              Annuler
            </LinkButton>
          ) : (
            <Button variant="outline" size="lg" icon={<ArrowLeft className="h-5 w-5" />} onClick={() => goTo((step - 1) as 1 | 2)}>
              Précédent
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <ExcelButton
              size="lg"
              filename={`Cadrage_${code.trim().toUpperCase() || "nouveau-projet"}_etape-${step}`}
              sheets={() => {
                // At step 1 the values are not built yet: export what is known of the reference so far.
                const at = stamp();
                const typed = dataFromManual({ name: manual.name || query, dci: manual.dci, form: manualMode ? manual.form : "", dosage: manual.dosage ? `${manual.dosage} ${manual.unit}` : "", holder: manual.holder, country: manual.country }, at);
                const known = step === 1 ? (candidate ? dataFromCandidate(candidate, at) : typed) : data;
                const ref = (key: string) => known.find((d) => d.key === key)?.value ?? "";
                return cadrageWorkbook({ code: code.trim().toUpperCase(), name, form: step === 1 ? ref("form") : form, team: members, cadrage: { ...draft, data: known, reference: { ...draft.reference, name: ref("name"), holder: ref("holder"), country: ref("country") } } });
              }}
            />
          <Button size="lg" className="min-w-44" iconRight={step === 3 ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />} onClick={next}>
            {step === 1 ? "Confirmer le produit" : step === 2 ? "Continuer" : "Créer le projet"}
          </Button>
          </div>
        </div>
      </div>

      <ScreenRef n={7} label="Créer et cadrer le projet" />

      <ProofDrawer datum={proof && (data.find((d) => d.key === proof.key) ?? proof)} context={candidate ? candidateLabel(candidate) : value("name")} onClose={() => setProof(null)} />
      {editing && editingDatum && (
        <DatumModal
          key={`${editing.key}-${editing.mode}`}
          datum={editingDatum}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSubmit={(v, note) => {
            update(editing.key, (d) => (editing.mode === "resolve" ? resolveDatum(d, v, note, stamp()) : correctDatum(d, v, note, stamp())));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
