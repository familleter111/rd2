"use client";

import {
  CircleCheck,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  History,
  Link2,
  Pencil,
  Save,
  Send,
  SquareCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuideNav } from "@/components/guide/guide-mark";
import { ACTIONS_TRIGGER_CLASS, actionsTrigger } from "@/components/project-context-header";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { findSection, proofInfo, sectionIssues } from "@/lib/dossier-selectors";
import { formatDateTime, formatNumeric } from "@/lib/format";
import { useGuideTarget } from "@/lib/guide";
import { dossierActions } from "@/lib/store";
import type { Dossier, DossierPart, DossierSection } from "@/lib/types";
import { DossierHeader, DossierMissing, projectCrumbs, useDossier } from "./dossier-frame";

type SectionTab = "contenu" | "sources" | "revue" | "historique";

function PartCard({
  n,
  part,
  section,
  dossier,
  editable,
}: {
  n: number;
  part: DossierPart;
  section: DossierSection;
  dossier: Dossier;
  editable: boolean;
}) {
  const { state } = useDossier(dossier.projectCode.toLowerCase());
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(part.text);
  const links = section.links.filter((l) => l.partId === part.id);

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-400 text-sm font-bold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-ink-900">{part.title}</h3>
            <div className="flex items-center gap-2">
              {editable && !editing && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setText(part.text);
                    setEditing(true);
                    setOpen(true);
                  }}
                >
                  Éditer
                </Button>
              )}
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? `Replier ${part.title}` : `Déplier ${part.title}`}
                onClick={() => setOpen((v) => !v)}
                className="cursor-pointer rounded p-1 text-ink-600 hover:bg-slate-100"
              >
                <ChevronDown className={cn("h-5 w-5 transition-transform", !open && "-rotate-90")} aria-hidden />
              </button>
            </div>
          </div>
          {open && (
            <>
              {editing ? (
                <div className="mt-2">
                  <Textarea aria-label={`Texte du paragraphe ${part.title}`} rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        dossierActions.updateSectionPart(dossier.projectCode, section.id, part.id, text.trim());
                        setEditing(false);
                        toast.show({ title: "Paragraphe enregistré", description: `${section.code} — ${part.title}` });
                      }}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={cn("mt-1 text-[15px] leading-relaxed", part.text ? "text-ink-700" : "italic text-ink-400")}>{part.text || "Paragraphe à rédiger."}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {links.map((l) => {
                  const proof = section.proofs.find((p) => p.id === l.proofId);
                  if (!proof) return null;
                  const info = proofInfo(state, dossier, proof);
                  return (
                    <span key={l.id} className="inline-flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-1.5 text-sm">
                      <FileText className="h-4 w-4 text-brand-700" aria-hidden />
                      {info.href ? (
                        <Link href={info.href} className="font-medium text-brand-700 hover:underline">
                          {proof.label}
                        </Link>
                      ) : (
                        <span className="font-medium text-brand-700">{proof.label}</span>
                      )}
                      <span className="text-ink-500">• {l.ref.toLowerCase()}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                      {editable && (
                        <button
                          type="button"
                          aria-label={`Retirer le lien vers ${proof.label}`}
                          onClick={() => dossierActions.unlinkProof(dossier.projectCode, section.id, l.id)}
                          className="cursor-pointer text-ink-400 hover:text-danger-600"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function LinkProofModal({ dossier, section, open, onClose }: { dossier: Dossier; section: DossierSection; open: boolean; onClose: () => void }) {
  const { state } = useDossier(dossier.projectCode.toLowerCase());
  const docs = state.documents.filter((d) => d.projectCode === dossier.projectCode && !d.archived);
  const [docId, setDocId] = useState(docs[0]?.id ?? "");
  const [partId, setPartId] = useState(section.parts[0]?.id ?? "");
  const [ref, setRef] = useState("Section 1");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lier une preuve"
      subtitle={`${section.code} — ${section.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!docId || !partId || !ref.trim()}
            onClick={() => {
              dossierActions.linkProof(dossier.projectCode, section.id, { docId, partId, ref: ref.trim() });
              toast.show({ title: "Preuve liée", description: `${docs.find((d) => d.id === docId)?.name} → ${section.parts.find((p) => p.id === partId)?.title}` });
              onClose();
            }}
          >
            Lier la preuve
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Document" required htmlFor="lp-doc">
          <Select id="lp-doc" options={docs.map((d) => ({ value: d.id, label: `${d.name} v${d.version} — ${d.status}` }))} value={docId} onChange={(e) => setDocId(e.target.value)} />
        </Field>
        <Field label="Partie citée du document" required htmlFor="lp-ref" hint="Ex. « Section 2.1 »">
          <Input id="lp-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Paragraphe de la section" required htmlFor="lp-part">
          <Select id="lp-part" options={section.parts.map((p) => ({ value: p.id, label: p.title }))} value={partId} onChange={(e) => setPartId(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function DossierSectionView({ slug, sectionId }: { slug: string; sectionId: string }) {
  const { state, project, dossier } = useDossier(slug);
  const router = useRouter();
  const go = useGuideNav();
  const guideSubmit = useGuideTarget(50);
  const [tab, setTab] = useState<SectionTab>("contenu");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkKey, setLinkKey] = useState(0);
  const [editIntro, setEditIntro] = useState(false);

  if (!project) return null;
  if (!dossier) return <DossierMissing slug={slug} />;
  const found = findSection(dossier, sectionId);
  if (!found) {
    return (
      <Card className="mt-6">
        <EmptyState icon={FileSearch} title="Section introuvable" action={<LinkButton href={`/dossiers/${slug}`}>Retour au dossier</LinkButton>} />
      </Card>
    );
  }
  const { module: mod, section } = found;
  const issues = sectionIssues(state, dossier, section);
  const editable = section.status === "À compléter" || section.status === "À évaluer";
  const label = section.status === "À compléter" ? "Brouillon" : section.status;
  const tone = section.status === "Approuvée" ? "success" : section.status === "En revue" ? "info" : "neutral";
  const prefix = section.code.split(".").slice(0, 3).join(".");
  const events = state.history.filter((h) => h.projectCode === project.code && h.href?.includes(`/sections/${section.id}`)).sort((a, b) => b.at.localeCompare(a.at));

  const submit = () => {
    dossierActions.submitSection(project.code, section.id);
    toast.show({ title: "Section soumise", description: `${section.code} ${section.title} — en revue par Qualité.` });
    if (guideSubmit) {
      toast.show({
        title: "Parcours : quelques jours plus tard…",
        description: "Le rapport de stabilité consolidé est ajouté et la synthèse approuvée : le dossier est complet, la revue peut être préparée.",
        tone: "info",
      });
      go(50);
    }
  };

  return (
    <>
      <DossierHeader
        crumbs={[...projectCrumbs(project), { label: "Dossier CTD", href: `/dossiers/${slug}` }]}
        title={`${project.code} • ${project.name}`}
        meta={[
          <span key="m" className="flex items-center gap-2">
            Module {mod.n} <span className="text-ink-400">•</span> {mod.title}
          </span>,
          project.dosage,
          dossier.formula,
        ]}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={tone} size="md" className="gap-2 px-4 py-2 text-[15px]">
              <StatusDot tone={tone} />
              {label}
            </Badge>
            <Menu
              label="Actions dossier"
              trigger={actionsTrigger("Actions dossier")}
              triggerClassName={ACTIONS_TRIGGER_CLASS}
              items={[
                { label: "Structure du dossier", icon: FileText, href: `/dossiers/${slug}` },
                { label: "Revues du dossier", icon: Users, href: `/dossiers/${slug}/revues` },
                { label: "Exporter le dossier", icon: Download, href: `/dossiers/${slug}/export` },
              ]}
            />
          </div>
        }
      />
      <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">{section.title}</h2>
      <Tabs
        className="mt-3"
        items={[
          { value: "contenu", label: "Contenu" },
          { value: "sources", label: "Documents sources", count: section.proofs.length },
          { value: "revue", label: "Revue" },
          { value: "historique", label: "Historique", count: events.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "contenu" && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[230px_minmax(0,1fr)_360px]">
          <Card className="h-fit p-3">
            <p className="px-2 pb-2 pt-1 font-bold text-ink-900">Section {prefix}</p>
            <nav aria-label={`Sections du module ${mod.n}`}>
              {mod.sections.map((x) => (
                <Link
                  key={x.id}
                  href={`/dossiers/${slug}/sections/${x.id}`}
                  aria-current={x.id === section.id ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-[15px]",
                    x.id === section.id ? "bg-brand-50 font-semibold text-ink-900 shadow-[inset_4px_0_0_var(--color-brand-600)]" : "text-ink-700 hover:bg-subtle",
                  )}
                >
                  {x.title}
                </Link>
              ))}
            </nav>
          </Card>

          <Card className="min-w-0 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-xl font-bold text-ink-900">{section.heading}</h3>
              {editable && (
                <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditIntro((v) => !v)}>
                  Éditer
                </Button>
              )}
            </div>
            {editIntro ? (
              <IntroEditor dossier={dossier} section={section} onDone={() => setEditIntro(false)} />
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{section.intro}</p>
            )}
            <ol className="mt-4 space-y-3">
              {section.parts.map((p, i) => (
                <PartCard key={p.id} n={i + 1} part={p} section={section} dossier={dossier} editable={editable} />
              ))}
            </ol>
          </Card>

          <div className="space-y-5">
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-ink-900">Preuves associées</h3>
                {editable && (
                  <Button
                    size="sm"
                    icon={<Link2 className="h-4 w-4" />}
                    onClick={() => {
                      setLinkKey((k) => k + 1);
                      setLinkOpen(true);
                    }}
                  >
                    Lier une preuve
                  </Button>
                )}
              </div>
              {section.proofs.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">Aucune preuve associée.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {section.proofs.map((p) => {
                    const info = proofInfo(state, dossier, p);
                    return (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                        <FileText className="h-6 w-6 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink-900">{p.label}</span>
                          <span className="block text-sm text-ink-500">{p.kind}</span>
                          <span className="block text-sm text-ink-500">{info.date ? formatNumeric(info.date) : "—"}</span>
                        </span>
                        {info.approved ? (
                          <Badge tone="success" icon={CircleCheck}>
                            Approuvé
                          </Badge>
                        ) : (
                          <Badge tone="warn">{info.status}</Badge>
                        )}
                        {info.href && (
                          <Link href={info.href} aria-label={`Ouvrir ${p.label}`} className="rounded p-1 text-ink-500 hover:bg-slate-100">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="text-lg font-bold text-ink-900">Liaisons avec le contenu</h3>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {section.links.map((l) => {
                  const proof = section.proofs.find((p) => p.id === l.proofId);
                  const part = section.parts.find((p) => p.id === l.partId);
                  const href = proof ? proofInfo(state, dossier, proof).href : undefined;
                  const body = (
                    <>
                      <FileText className="h-5 w-5 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink-900">{proof?.label}</span>
                        <span className="block text-sm text-ink-500">
                          {l.ref} → {part?.title}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {href ? (
                        <Link href={href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-subtle">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
                      )}
                    </li>
                  );
                })}
                {section.links.length === 0 && <li className="px-3 py-3 text-sm text-ink-500">Aucune liaison.</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "sources" && (
        <Card className="mt-5 p-5">
          <h3 className="text-lg font-bold text-ink-900">Documents sources</h3>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {section.proofs.map((p) => {
              const info = proofInfo(state, dossier, p);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 text-ink-700" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-900">{p.label}</span>
                    <span className="text-sm text-ink-500">
                      {p.kind} • cité dans {section.links.filter((l) => l.proofId === p.id).length} paragraphe(s)
                    </span>
                  </span>
                  <Badge tone={info.approved ? "success" : "warn"}>{info.status}</Badge>
                  {info.href && (
                    <LinkButton href={info.href} variant="outline" size="sm">
                      Ouvrir
                    </LinkButton>
                  )}
                </li>
              );
            })}
            {section.proofs.length === 0 && <li className="px-4 py-3 text-sm text-ink-500">Aucun document source.</li>}
          </ul>
        </Card>
      )}

      {tab === "revue" && (
        <Card className="mt-5 p-5">
          <h3 className="text-lg font-bold text-ink-900">Revue de la section</h3>
          <ol className="mt-3 space-y-3">
            <li className="flex items-center gap-3">
              <StatusDot tone={section.submittedAt ? "success" : "neutral"} />
              Rédaction et soumission — {section.submittedAt ? `soumise le ${formatDateTime(section.submittedAt)}` : "en cours"}
            </li>
            <li className="flex items-center gap-3">
              <StatusDot tone={section.status === "Approuvée" ? "success" : section.status === "En revue" ? "warn" : "neutral"} />
              Revue Qualité — {section.status === "Approuvée" ? "approuvée" : section.status === "En revue" ? "à examiner" : "après soumission"}
            </li>
          </ol>
          {section.status === "En revue" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
              <span className="flex-1">Démonstration : simulez la revue de la section par Qualité.</span>
              <Button
                variant="outline"
                size="sm"
                icon={<SquareCheck className="h-4 w-4" />}
                onClick={() => {
                  dossierActions.approveSection(project.code, section.id);
                  toast.show({ title: "Section approuvée", description: `${section.code} ${section.title}` });
                }}
              >
                Approuver la section
              </Button>
            </div>
          )}
        </Card>
      )}

      {tab === "historique" && (
        <Card className="mt-5 p-5">
          <h3 className="text-lg font-bold text-ink-900">Historique de la section</h3>
          {events.length === 0 ? (
            <EmptyState icon={History} title="Aucun événement" description="Les modifications et soumissions de la section apparaîtront ici." />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-32 text-sm text-ink-600">{formatDateTime(e.at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-900">{e.title}</span>
                    <span className="block text-sm text-ink-500">
                      Par {e.author}
                      {e.field && ` — ${e.field}`}
                    </span>
                  </span>
                  <Link href={`/projets/${slug}/historique?evenement=${e.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    Voir dans l&apos;historique du projet
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-canvas/90 px-4 py-4 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            icon={<Save className="h-5 w-5" />}
            onClick={() => toast.show({ title: "Section enregistrée", description: `${section.code} ${section.title}` })}
            disabled={!editable}
          >
            Enregistrer
          </Button>
          <Button size="lg" icon={<Send className="h-5 w-5" />} onClick={submit} disabled={!editable || issues.length > 0} guide={50} className="disabled:bg-slate-300">
            {editable ? "Soumettre la section" : "Section soumise"}
          </Button>
          {editable && (
            <p className="text-sm text-ink-500">
              {issues.length ? `La section doit être complète avant soumission : ${issues[0]}` : "La section est complète : elle peut être soumise pour revue."}
            </p>
          )}
          {!editable && (
            <Button variant="ghost" onClick={() => router.push(`/dossiers/${slug}/revues`)}>
              Voir les revues du dossier
            </Button>
          )}
        </div>
      </div>

      <LinkProofModal key={linkKey} dossier={dossier} section={section} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <ScreenRef n={project.code === "CS-01" && section.id === "developpement" ? 49 : undefined} label="Dossier CTD — contenu d'une section" />
    </>
  );
}

function IntroEditor({ dossier, section, onDone }: { dossier: Dossier; section: DossierSection; onDone: () => void }) {
  const [text, setText] = useState(section.intro);
  return (
    <div className="mt-2">
      <Textarea aria-label="Introduction de la section" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={() => {
            dossierActions.updateSectionIntro(dossier.projectCode, section.id, text.trim());
            onDone();
          }}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
