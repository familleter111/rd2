"use client";

import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Download,
  FileText,
  FlaskConical,
  FolderSearch,
  Paperclip,
  Pill,
  Save,
  Send,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { GuideSpot, useGuideNav } from "@/components/guide/guide-mark";
import { MetaLine } from "@/components/project-context-header";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Breadcrumb, ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadText, formatDateTime, formatNumeric, plural } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { ANALYSIS_STATUS, inSpec } from "@/lib/lab-selectors";
import { labActions, useDemo } from "@/lib/store";
import type { Analysis, AnalysisResult, Method } from "@/lib/types";
import { EVENT_ICONS } from "@/components/project/project-overview";

const DEMO_VALUES = ["99,2", "99,5", "99,3", "100,1", "98,9", "99,7"];

function InfoItem({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 bg-white p-4">
      <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="text-ink-500">{label}</p>
        <p className="font-bold text-ink-900">{value}</p>
        {sub && <p className="text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

function Donut({ done, total }: { done: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const ratio = total ? done / total : 0;
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-brand-100)" strokeWidth="6" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-brand-600)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * ratio} ${c}`} />
    </svg>
  );
}

function ResultEntry({ method, analysis }: { method: Method; analysis: Analysis }) {
  const state = useDemo();
  const router = useRouter();
  const go = useGuideNav();
  const guideSubmit = useGuideTarget(27);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"saisie" | "pieces" | "historique">("saisie");
  const [results, setResults] = useState<AnalysisResult[]>(analysis.results);
  // Once part of the results is entered, the remaining empty ones are flagged right away.
  const initialMissing = analysis.results.filter((r) => !r.value.trim()).map((r) => r.sample);
  const [touched, setTouched] = useState<Set<string>>(new Set(initialMissing.length < analysis.results.length ? initialMissing : []));
  const editable = analysis.status === "Brouillon" || analysis.status === "Correction demandée";
  const project = state.projects.find((p) => p.code === analysis.projectCode);
  const spec = method.protocol?.criteria[0]?.value ?? "";
  const missing = results.filter((r) => !r.value.trim());
  const filled = results.length - missing.length;
  const dirty = JSON.stringify(results) !== JSON.stringify(analysis.results);
  const conformity = missing.length ? undefined : results.every((r) => inSpec(r.value, spec) !== false);
  const events = state.history.filter((h) => h.analysisId === analysis.id).sort((a, b) => b.at.localeCompare(a.at));

  const setResult = (sample: string, patch: Partial<AnalysisResult>) => setResults((list) => list.map((r) => (r.sample === sample ? { ...r, ...patch } : r)));
  const save = () => {
    if (dirty) labActions.saveAnalysis(analysis.id, results);
  };

  const submit = () => {
    if (missing.length) {
      setTouched(new Set(missing.map((r) => r.sample)));
      return;
    }
    save();
    labActions.submitAnalysis(analysis.id);
    toast.show({ title: "Résultats soumis pour revue", description: `${analysis.id} — le relecteur a été notifié.` });
    if (guideSubmit) go(27);
    else router.push(`/methodes/${method.ref.toLowerCase()}/validation`);
  };

  const importResults = () => {
    setResults((list) => list.map((r, i) => (r.value.trim() ? r : { ...r, value: DEMO_VALUES[i % DEMO_VALUES.length] })));
    toast.show({ title: "Résultats importés", description: "Valeurs reprises du fichier d'acquisition (données-brutes.csv).", tone: "info" });
  };

  const addFile = (name: string) => {
    labActions.addAnalysisAttachment(analysis.id, { name, kind: /\.csv$/i.test(name) ? "Fichier de données" : "Pièce jointe" });
    toast.show({ title: "Pièce ajoutée", description: name });
  };

  return (
    <>
      <Tabs
        className="mt-5"
        items={[
          { value: "saisie", label: "Saisie" },
          { value: "pieces", label: "Pièces jointes", count: analysis.attachments.length },
          { value: "historique", label: "Historique", count: events.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addFile(file.name);
          e.target.value = "";
        }}
      />

      {analysis.status === "Correction demandée" && analysis.correction && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm">
          <CircleAlert className="h-5 w-5 shrink-0 fill-danger-500 text-white" aria-hidden />
          <div>
            <p className="font-semibold text-danger-700">Correction demandée — échéance {formatNumeric(analysis.correction.due)}</p>
            <p className="text-ink-700">{analysis.correction.reason}</p>
          </div>
        </div>
      )}
      {!editable && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
          <Send className="h-5 w-5 text-brand-600" aria-hidden />
          <span className="flex-1 text-ink-700">
            Résultats {analysis.status === "Validée" ? "validés" : "soumis pour revue"}
            {analysis.submittedAt ? ` le ${formatDateTime(analysis.submittedAt)}` : ""}.
          </span>
          <LinkButton href={`/methodes/${method.ref.toLowerCase()}/validation`} variant="outline" size="sm" guide={27}>
            Voir la revue
          </LinkButton>
        </div>
      )}

      {tab === "saisie" && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-w-0 p-5">
            <h2 className="text-xl font-bold text-ink-900">Informations sur l&apos;essai</h2>
            <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem icon={FileText} label="Méthode" value={`${method.ref} • ${method.name}`} />
              <InfoItem icon={Pill} label="Projet" value={project ? `${project.code} • ${project.name}` : analysis.projectCode} sub={project?.dosage} />
              <InfoItem icon={FileText} label="Protocole" value={`${analysis.protocolVersion} (approuvé)`} sub={`Approuvé le ${formatNumeric(analysis.protocolApprovedAt)}`} />
              <InfoItem icon={FlaskConical} label="Lot" value={analysis.lotCode} sub={`Fabriqué le ${formatNumeric(analysis.lotMadeAt)}`} />
              <InfoItem icon={FileText} label="Formule" value={analysis.formula} />
              <InfoItem icon={CalendarDays} label="Date de l'essai" value={formatNumeric(analysis.date)} />
            </div>

            <h2 className="mt-6 text-xl font-bold text-ink-900">Résultats</h2>
            <div className="relative mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="bg-subtle text-ink-700">
                    <th className="px-4 py-3 font-semibold">N° échantillon</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">
                      Résultat ({analysis.unit}) <span className="text-danger-600">*</span>
                    </th>
                    <th className="px-4 py-3 font-semibold">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {results.map((r) => {
                    const error = !r.value.trim() && touched.has(r.sample);
                    const out = inSpec(r.value, spec) === false;
                    return (
                      <tr key={r.sample}>
                        <td className="px-4 py-3 font-medium text-ink-900">{r.sample}</td>
                        <td className="px-4 py-3 text-ink-700">{r.description}</td>
                        <td className="px-4 py-3 align-top">
                          <GuideSpot step={27} active={editable && !r.value.trim()} hint="À faire d'abord : saisir le résultat manquant (ex. 99,3), puis « Soumettre pour revue ».">
                            <input
                              aria-label={`Résultat ${r.sample}`}
                              inputMode="decimal"
                              value={r.value}
                              disabled={!editable}
                              onBlur={() => setTouched((t) => new Set(t).add(r.sample))}
                              onChange={(e) => setResult(r.sample, { value: e.target.value })}
                              className={cn(controlClass, "h-10 px-3", error && "border-danger-500 bg-danger-50/40")}
                              aria-invalid={error || undefined}
                            />
                          </GuideSpot>
                          {error && <p className="mt-1 text-[13px] text-danger-600">Résultat requis</p>}
                          {out && <p className="mt-1 text-[13px] text-warn-700">Hors critère ({spec})</p>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input
                            aria-label={`Commentaire ${r.sample}`}
                            value={r.comment}
                            disabled={!editable}
                            onChange={(e) => setResult(r.sample, { comment: e.target.value })}
                            className={cn(controlClass, "h-10 px-3")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="h-fit p-5">
            <h2 className="text-xl font-bold text-ink-900">Contrôle de saisie</h2>
            <div className="mt-4 flex items-center gap-4">
              <Donut done={filled} total={results.length} />
              <div>
                <p className="text-lg font-bold text-ink-900">
                  {filled} / {results.length} résultats renseignés
                </p>
                <p className="text-sm text-ink-500">{missing.length ? `${missing.length} ${plural(missing.length, "valeur manquante", "valeurs manquantes")}` : "Saisie complète"}</p>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              {missing.length ? (
                <div className="flex items-start gap-3">
                  <CircleAlert className="h-8 w-8 shrink-0 fill-danger-500 text-white" aria-hidden />
                  <div>
                    <p className="font-bold text-danger-600">
                      {missing.length} {plural(missing.length, "valeur manquante", "valeurs manquantes")}
                    </p>
                    <p className="text-sm text-ink-600">Renseignez tous les résultats pour pouvoir soumettre l&apos;essai.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <CircleCheck className="h-8 w-8 shrink-0 fill-success-500 text-white" aria-hidden />
                  <div>
                    <p className="font-bold text-success-700">Tous les résultats sont renseignés</p>
                    <p className="text-sm text-ink-600">L&apos;essai peut être soumis pour revue.</p>
                  </div>
                </div>
              )}
            </div>
            <ul className="mt-4 space-y-2 border-t border-line pt-4">
              {analysis.attachments.map((f) => (
                <li key={f.id} className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-subtle">
                    <FileText className="h-6 w-6 text-ink-700" strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-bold text-ink-900">{f.name}</span>
                    <span className="block text-ink-500">{f.kind}</span>
                    <span className="block text-ink-500">Ajouté le {formatNumeric(f.date)}</span>
                  </span>
                  <Menu
                    label={`Actions pour ${f.name}`}
                    items={[
                      {
                        label: "Télécharger",
                        icon: Download,
                        onSelect: () => {
                          downloadText(f.name.endsWith(".csv") ? f.name : `${f.name}.txt`, "echantillon;resultat\n" + results.map((r) => `${r.sample};${r.value}`).join("\n"), "text/csv");
                          toast.show({ title: "Téléchargement lancé", description: f.name });
                        },
                      },
                      ...(editable ? [{ label: "Retirer", icon: Trash2, tone: "danger" as const, onSelect: () => labActions.removeAnalysisAttachment(analysis.id, f.id) }] : []),
                    ]}
                  />
                </li>
              ))}
              {editable && (
                <li>
                  <Button variant="outline" size="lg" icon={<Paperclip className="h-5 w-5" />} onClick={() => fileRef.current?.click()}>
                    Ajouter une pièce
                  </Button>
                </li>
              )}
            </ul>
            <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
              {conformity === undefined ? (
                <CircleCheck className="h-8 w-8 shrink-0 fill-slate-400 text-white" aria-hidden />
              ) : conformity ? (
                <CircleCheck className="h-8 w-8 shrink-0 fill-success-500 text-white" aria-hidden />
              ) : (
                <CircleAlert className="h-8 w-8 shrink-0 fill-warn-500 text-white" aria-hidden />
              )}
              <div className="flex-1">
                <p className="font-bold text-ink-900">Conformité globale</p>
                <p className="text-sm text-ink-500">{conformity === undefined ? "Non renseignée" : conformity ? `Conforme (critère ${spec})` : `Au moins un résultat hors critère (${spec})`}</p>
              </div>
              <span title="Calculée à partir du critère d'acceptation principal du protocole." className="cursor-help text-ink-500">
                <CircleHelp className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </Card>
        </div>
      )}

      {tab === "pieces" && (
        <Card className="mt-5 p-5">
          {analysis.attachments.length === 0 ? (
            <EmptyState icon={Paperclip} title="Aucune pièce jointe" description="Ajoutez les données brutes et les chromatogrammes de l'essai." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {analysis.attachments.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{f.name}</span>
                    <span className="block text-ink-500">{f.kind}</span>
                  </span>
                  <span className="text-ink-600">{formatNumeric(f.date)}</span>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <Button variant="outline" className="mt-4" icon={<Paperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              Ajouter une pièce
            </Button>
          )}
        </Card>
      )}

      {tab === "historique" && (
        <Card className="mt-5 p-5">
          <ol className="space-y-3">
            {events.map((e) => {
              const Icon = EVENT_ICONS[e.icon];
              return (
                <li key={e.id} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
                  <Icon className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{e.title}</span>
                    <span className="block text-ink-600">
                      {e.field ? `${e.field} : ${e.oldValue} → ${e.newValue}` : e.description}
                    </span>
                    <span className="block text-xs text-ink-500">
                      {formatDateTime(e.at)} — {e.author}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {editable && (
        <Card className="mt-5 flex flex-wrap items-start gap-3 p-4">
          <Button variant="outline" size="lg" icon={<Upload className="h-5 w-5" />} onClick={importResults} disabled={!missing.length}>
            Importer les résultats
          </Button>
          <Button variant="outline" size="lg" icon={<Paperclip className="h-5 w-5" />} onClick={() => fileRef.current?.click()}>
            Ajouter une pièce
          </Button>
          <div className="ml-auto flex flex-wrap items-start gap-3">
            <Button
              size="lg"
              variant={missing.length ? "primary" : "outline"}
              icon={<Save className="h-5 w-5" />}
              onClick={() => {
                save();
                toast.show({ title: "Saisie enregistrée", description: `${filled} / ${results.length} résultats renseignés.` });
              }}
              disabled={!dirty}
            >
              Enregistrer
            </Button>
            <div>
              <Button size="lg" icon={<Send className="h-5 w-5" />} onClick={submit} disabled={missing.length > 0} guide={27} className="disabled:bg-slate-300">
                {analysis.status === "Correction demandée" ? "Resoumettre pour revue" : "Soumettre pour revue"}
              </Button>
              {missing.length > 0 && (
                <p className="mt-2 max-w-60 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink-700 shadow-card">
                  Impossible de soumettre : {missing.length} {plural(missing.length, "résultat manquant", "résultats manquants")}.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

export function AnalysisView({ slug, analysisId }: { slug: string; analysisId: string }) {
  const state = useDemo();
  const method = state.methods.find((m) => m.ref.toLowerCase() === slug.toLowerCase());
  const analysis = state.analyses.find((a) => a.id.toLowerCase() === analysisId.toLowerCase());

  if (!method || !analysis) {
    return (
      <>
        <Card className="mt-4">
          <EmptyState
            icon={FolderSearch}
            title="Essai introuvable"
            description={`L'essai ${analysisId.toUpperCase()} n'a pas encore été lancé. Préparez puis lancez les essais depuis l'onglet « Essais » de la méthode.`}
            action={<LinkButton href={`/methodes/${slug}/essais`}>Préparer les essais</LinkButton>}
          />
        </Card>
        <ScreenRef n={slug.toLowerCase() === "m-01" ? 26 : undefined} label="Essai — saisir les résultats" />
      </>
    );
  }

  const project = state.projects.find((p) => p.code === analysis.projectCode);
  const status = ANALYSIS_STATUS[analysis.status];
  const editable = analysis.status === "Brouillon" || analysis.status === "Correction demandée";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Méthodes & essais", href: `/methodes?projet=${analysis.projectCode.toLowerCase()}` },
          { label: method.ref, href: `/methodes/${method.ref.toLowerCase()}` },
          { label: analysis.id },
        ]}
      />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-ink-900 sm:text-[36px]">
          {editable ? "Saisir les résultats" : "Résultats"} – {analysis.id}
        </h1>
        <Badge tone={status.tone} dot size="md" className="rounded-full px-3">
          {status.label}
        </Badge>
      </div>
      <MetaLine
        className="mt-1"
        items={[
          <span key="m">
            Méthode : <strong className="text-ink-800">{method.ref}</strong> • {method.name}
          </span>,
          <span key="p">
            Projet : <strong className="text-ink-800">{project ? `${project.code} • ${project.name}` : analysis.projectCode}</strong>
          </span>,
          <span key="l">
            Lot : <strong className="text-ink-800">{analysis.lotCode}</strong>
          </span>,
        ]}
      />
      <MetaLine
        items={[
          <span key="f">Formule : {analysis.formula}</span>,
          <span key="v">
            Protocole : {analysis.protocolVersion} (approuvé)
          </span>,
          <Link key="h" href={`/methodes/${method.ref.toLowerCase()}/historique`} className="text-base text-brand-700 hover:underline">
            Historique de la méthode
          </Link>,
        ]}
      />
      <ResultEntry key={`${analysis.id}-${analysis.status}-${JSON.stringify(analysis.results)}`} method={method} analysis={analysis} />
      <ScreenRef n={method.ref === "M-01" ? 26 : undefined} label="Essai — saisir les résultats" />
    </>
  );
}
