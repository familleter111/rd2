"use client";

import { CircleCheck, CirclePlus, FileText, Info, Paperclip, Pencil, Plus, Save, Sigma, Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea, controlClass } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { COMPONENT_ROLES, COMPONENT_UNITS } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { findProject, projectFormulas } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Component } from "@/lib/types";
import { PerKilogramNote, compositionTotal, unitLabelFor } from "./formula-bits";
import { ProjectTabs } from "./project-frame";

let rowSeq = 0;
const newRow = (name = "", role = "Excipient", unit = "mg"): Component => ({ id: `row-${++rowSeq}`, name, role, qty: "", unit });

const GENERIC_ROWS = (unit: string) => [newRow("Principe actif", "Principe actif", unit), newRow("Excipient A", "Excipient", unit), newRow("Excipient B", "Excipient", unit)];

export function NewFormulaView({ slug, parentCode }: { slug: string; parentCode?: string }) {
  const state = useDemo();
  const router = useRouter();
  const project = findProject(state, slug);
  const formulas = project ? projectFormulas(state, project.code) : [];
  const nextCode = project ? actions.nextFormulaCode(project.code) : "F1";
  const defaultParent = formulas.find((f) => f.code === parentCode)?.code ?? formulas[formulas.length - 1]?.code ?? "";
  const dosageUnit = project?.dosage.split(" ")[1] ?? "mg";
  const rowUnit = COMPONENT_UNITS.includes(dosageUnit) ? dosageUnit : "mg";

  const [parent, setParent] = useState(defaultParent);
  const [tab, setTab] = useState<"composition" | "procede">("composition");
  const [rows, setRows] = useState<Component[]>(() => GENERIC_ROWS(rowUnit));
  const [process, setProcess] = useState<string[]>(() => formulas.find((f) => f.code === defaultParent)?.process ?? []);
  const [motif, setMotif] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [createLot, setCreateLot] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!project) return null;

  const parentFormula = formulas.find((f) => f.code === parent);
  const documents = state.documents.filter((d) => d.projectCode === project.code);
  const total = compositionTotal(rows);
  const activeRows = rows.filter((r) => r.role === "Principe actif");
  const activeTotal = compositionTotal(activeRows);
  const dosageValue = Number(project.dosage.split(" ")[0]?.replace(",", "."));
  const dosageMatches = activeTotal && activeTotal.unit === dosageUnit ? activeTotal.total === dosageValue : null;

  const rowErrors = rows.map((r) => {
    if (!r.name.trim()) return "Nom requis";
    if (r.qty.trim() && (Number.isNaN(Number(r.qty.replace(",", "."))) || Number(r.qty.replace(",", ".")) < 0)) return "Quantité invalide";
    return null;
  });
  const errors = {
    // The first version of a formula modifies nothing: no reason is asked.
    motif: parent && !motif.trim() ? "Décrivez le motif de cette nouvelle version." : null,
    rows: rowErrors.some(Boolean) ? "Corrigez les composants signalés." : !activeRows.length ? "Ajoutez au moins un principe actif." : null,
  };

  const updateRow = (id: string, patch: Partial<Component>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = () => {
    setSubmitted(true);
    if (errors.motif || errors.rows) {
      if (errors.rows) setTab("composition");
      return;
    }
    const code = actions.createFormula({
      projectCode: project.code,
      parent: parent || undefined,
      composition: rows.map((r) => ({ ...r, name: r.name.trim(), qty: r.qty.trim() })),
      process: process.filter((p) => p.trim()),
      motif: parent ? motif.trim() : "",
      sources,
    });
    toast.show({ title: `Formule ${code} enregistrée`, description: `Brouillon créé${parent ? ` à partir de ${parent}` : ""}. ${parent ? `${parent} reste inchangée.` : ""}` });
    router.push(createLot ? `/projets/${slug}/formules/lots?creer=1&formule=${code}` : `/projets/${slug}/formules`);
  };

  return (
    <>
      <ProjectTabs slug={slug} />

      <Card className="mt-5 p-5">
        <h2 className="text-xl font-bold text-ink-900">Informations générales</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Version de la formule" required htmlFor="nf-code" hint={`Prochaine version : ${nextCode}${parent ? ` (${parent} reste inchangée)` : ""}`}>
            <Input id="nf-code" value={nextCode} readOnly className="bg-slate-100 font-semibold" />
          </Field>
          <Field label="Formule parente" required htmlFor="nf-parent" hint={parent ? `Cette nouvelle version est basée sur ${parent}.` : "Formule initiale, sans parent."}>
            <Select
              id="nf-parent"
              options={[...formulas.map((f) => ({ value: f.code, label: `${f.code} — ${f.label}` })), { value: "", label: "Aucune (formule initiale)" }]}
              value={parent}
              onChange={(e) => setParent(e.target.value)}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-[15px] font-semibold text-ink-800">Statut</p>
            <Badge tone="warn" icon={Pencil} size="md" className="h-11 px-4 text-[15px]">
              Brouillon
            </Badge>
          </div>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
        <Card className="p-5">
          <Tabs
            size="md"
            items={[
              { value: "composition", label: "Composition" },
              { value: "procede", label: "Procédé" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "composition" ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-brand-50/80 px-4 py-3 text-sm text-ink-700">
                <Info className="h-5 w-5 shrink-0 fill-brand-600 text-white" aria-hidden />
                <span className="flex-1">Renseignez les quantités de chaque composant. Compléter les quantités pour vérifier le total.</span>
                {parentFormula && parentFormula.composition.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRows(parentFormula.composition.map((c) => ({ ...c, id: `row-${++rowSeq}` })));
                      setProcess([...parentFormula.process]);
                    }}
                    className="cursor-pointer font-semibold text-brand-700 hover:underline underline-offset-4"
                  >
                    Reprendre la composition de {parentFormula.code}
                  </button>
                )}
              </div>

              <div className="relative mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[640px] text-left text-[15px]">
                  <thead>
                    <tr className="bg-subtle text-sm font-semibold text-ink-800">
                      <th className="px-3 py-3">Composant</th>
                      <th className="px-3 py-3">Rôle</th>
                      <th className="px-3 py-3">Quantité</th>
                      <th className="px-3 py-3">Unité</th>
                      <th className="w-12 px-2 py-3">
                        <span className="sr-only">Supprimer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r, i) => {
                      const err = submitted ? rowErrors[i] : null;
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2.5">
                            <input
                              aria-label={`Nom du composant ${i + 1}`}
                              value={r.name}
                              placeholder="Nom du composant"
                              onChange={(e) => updateRow(r.id, { name: e.target.value })}
                              className={cn(
                                "h-10 w-full rounded-md border border-transparent bg-transparent px-2 font-semibold text-ink-900 outline-none hover:border-line-strong focus:border-brand-500 focus:bg-white",
                                err === "Nom requis" && "border-danger-500",
                              )}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <Select size="sm" aria-label={`Rôle du composant ${i + 1}`} options={COMPONENT_ROLES} value={r.role} onChange={(e) => updateRow(r.id, { role: e.target.value })} className="min-w-40" />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              aria-label={`Quantité du composant ${i + 1}`}
                              inputMode="decimal"
                              value={r.qty}
                              placeholder="Saisir une valeur"
                              onChange={(e) => updateRow(r.id, { qty: e.target.value })}
                              className={cn(controlClass, "h-9 w-36 px-3 text-sm", err === "Quantité invalide" && "border-danger-500")}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <Select size="sm" aria-label={`Unité du composant ${i + 1}`} options={COMPONENT_UNITS} value={r.unit} onChange={(e) => updateRow(r.id, { unit: e.target.value })} className="w-24" />
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              aria-label={`Supprimer ${r.name || `le composant ${i + 1}`}`}
                              disabled={rows.length === 1}
                              onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))}
                              className="cursor-pointer rounded-md p-2 text-ink-600 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {submitted && errors.rows && <p className="mt-2 text-sm text-danger-600">{errors.rows}</p>}

              <button
                type="button"
                onClick={() => setRows((list) => [...list, newRow("", "Excipient", rowUnit)])}
                className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 font-medium text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50/60"
              >
                <CirclePlus className="h-5 w-5 fill-brand-600 text-white" aria-hidden />
                Ajouter un composant
              </button>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50/80 px-4 py-3.5 text-[15px] text-ink-700">
                <Sigma className="h-5 w-5 text-ink-700" aria-hidden />
                {total ? (
                  <>
                    <span>
                      Total de la formule : <strong className="text-ink-900">{String(total.total).replace(".", ",")} {total.unit}</strong> par unité
                    </span>
                    {dosageMatches === true && (
                      <Badge tone="success" icon={CircleCheck}>
                        Principe actif conforme au dosage ({project.dosage})
                      </Badge>
                    )}
                    {dosageMatches === false && activeTotal && (
                      <Badge tone="warn" icon={TriangleAlert}>
                        Principe actif : {activeTotal.total} {activeTotal.unit} ≠ dosage {project.dosage}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span>Compléter les quantités pour vérifier le total de la formule.</span>
                )}
              </div>
              <PerKilogramNote rows={rows} unitLabel={unitLabelFor(project.form)} className="mt-3" />
            </>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-ink-600">Étapes du procédé de fabrication{parent ? `, reprises de ${parent}` : ""}. Modifiez-les si nécessaire.</p>
              <ol className="mt-3 space-y-2">
                {process.map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</span>
                    <Input aria-label={`Étape ${i + 1}`} value={step} onChange={(e) => setProcess((l) => l.map((s, j) => (j === i ? e.target.value : s)))} />
                    <button
                      type="button"
                      aria-label={`Supprimer l'étape ${i + 1}`}
                      onClick={() => setProcess((l) => l.filter((_, j) => j !== i))}
                      className="cursor-pointer rounded-md p-2 text-ink-600 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </li>
                ))}
              </ol>
              <Button variant="outline" className="mt-3" icon={<Plus className="h-4 w-4" />} onClick={() => setProcess((l) => [...l, ""])}>
                Ajouter une étape
              </Button>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          {parent && (
            <Field label="Motif de modification" required htmlFor="nf-motif" error={submitted ? errors.motif : null}>
              <Textarea
                id="nf-motif"
                rows={4}
                maxLength={500}
                value={motif}
                invalid={submitted && Boolean(errors.motif)}
                placeholder="Décrire le motif de cette nouvelle version (ex. optimisation, remplacement d'excipient, etc.)."
                onChange={(e) => setMotif(e.target.value)}
              />
            </Field>
          )}

          <div className={parent ? "mt-4" : undefined}>
            <p className="text-[15px] font-semibold text-ink-800">Sources associées</p>
            <p className="text-sm text-ink-500">Lier les documents ou références justifiant cette {parent ? "modification" : "formule"}.</p>
            <Menu
              label="Ajouter une source"
              align="left"
              widthClass="w-80"
              className="mt-3"
              triggerClassName="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 font-semibold text-brand-700 hover:bg-brand-50"
              trigger={
                <>
                  <Paperclip className="h-5 w-5" aria-hidden />
                  Ajouter une source
                </>
              }
              items={
                documents.filter((d) => !sources.includes(d.id)).length
                  ? documents
                      .filter((d) => !sources.includes(d.id))
                      .map((d) => ({ label: d.name, description: `${d.type} — v${d.version}`, icon: FileText, onSelect: () => setSources((l) => [...l, d.id]) }))
                  : [{ label: "Aucun autre document disponible", disabled: true }]
              }
            />
            {sources.length ? (
              <ul className="mt-3 space-y-2">
                {sources.map((id) => {
                  const d = documents.find((x) => x.id === id);
                  if (!d) return null;
                  return (
                    <li key={id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-brand-600" aria-hidden />
                      <span className="flex-1 text-ink-900">{d.name}</span>
                      <button type="button" aria-label={`Retirer ${d.name}`} onClick={() => setSources((l) => l.filter((x) => x !== id))} className="cursor-pointer rounded p-1 text-ink-500 hover:text-danger-600">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-2.5 rounded-lg bg-brand-50/80 px-3.5 py-2.5 text-sm text-ink-700">
                <Info className="h-4 w-4 fill-brand-600 text-white" aria-hidden />
                Aucune source associée pour le moment.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <Checkbox
              checked={createLot}
              onChange={setCreateLot}
              label={<span className="font-semibold">Créer un lot d&apos;essai après enregistrement</span>}
              description="Un lot d'essai sera créé à partir de cette formule (optionnel)."
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <LinkButton href={`/projets/${slug}/formules`} variant="outline" size="lg">
              Annuler
            </LinkButton>
            <Button size="lg" icon={<Save className="h-5 w-5" />} onClick={save}>
              Enregistrer le brouillon
            </Button>
          </div>
        </Card>
      </div>

      <ScreenRef n={18} label="Éditer une nouvelle formule" />
    </>
  );
}
