"use client";

import { Archive, CalendarDays, Check, CircleCheck, Clock, Download, ExternalLink, FileQuestion, FileText, Info, Send, User, Users, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { approvedReview, openBlockingReserves, transferSteps } from "@/lib/dossier-selectors";
import { buildPdf, downloadBlob } from "@/lib/export-files";
import { formatNumeric } from "@/lib/format";
import { dossierActions } from "@/lib/store";
import type { Reserve, Transfer, TransferDocument } from "@/lib/types";
import { DossierHeader, DossierMissing, DossierTabs, projectCrumbs, useDossier } from "./dossier-frame";
import { LiftReserveModal } from "./reserves-view";

const STATUS_TONE: Record<Transfer["status"], "info" | "warn" | "success" | "neutral"> = {
  "À préparer": "neutral",
  "À réceptionner": "info",
  "Complément demandé": "warn",
  Réceptionné: "success",
};

function Stat({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="text-sm font-semibold text-ink-800">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <Icon className="h-7 w-7 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
        <div className="min-w-0 text-[17px] font-medium text-ink-900">{children}</div>
      </div>
    </div>
  );
}

function DocTile({ doc, slug }: { doc: TransferDocument; slug: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line p-4">
      <FileText className="h-9 w-9 shrink-0 text-ink-700" strokeWidth={1.4} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink-900">{doc.title}</p>
        <p className="text-sm text-ink-500">{doc.code}</p>
        <p className="text-sm text-ink-500">
          {doc.version} <span className="mx-1 text-ink-300">|</span> {formatNumeric(doc.date)}
        </p>
        <Badge tone="success" icon={CircleCheck} size="md" className="mt-2">
          Approuvé
        </Badge>
      </div>
      <Menu
        label={`Actions pour ${doc.title}`}
        items={[
          ...(doc.docId ? [{ label: "Ouvrir le document", icon: ExternalLink, href: `/projets/${slug}/documents/${doc.docId}` }] : []),
          {
            label: "Télécharger",
            icon: Download,
            onSelect: () => {
              downloadBlob(`${doc.code}.pdf`, buildPdf([{ text: doc.title, size: 16, bold: true }, { text: `${doc.code} — ${doc.version} du ${formatNumeric(doc.date)}` }, { text: "Document de transfert (démonstration).", size: 9, gap: 12 }]));
              toast.show({ title: "Téléchargement lancé", description: `${doc.code}.pdf` });
            },
          },
        ]}
      />
    </div>
  );
}

export function TransferView({ slug }: { slug: string }) {
  const { state, project, dossier } = useDossier(slug);
  const [examined, setExamined] = useState(false);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [lifting, setLifting] = useState<Reserve | null>(null);

  if (!project) return null;
  const transfer = state.transfers.find((t) => t.projectCode === project.code);
  if (!dossier || !transfer) return <DossierMissing slug={slug} />;

  const review = approvedReview(state, project.code);
  const blocking = openBlockingReserves(state, project.code);
  const steps = transferSteps(state, project.code);
  const blocked = transfer.status === "À préparer" && (!review || blocking.length > 0);
  const statusLabel = blocked ? "Bloqué" : transfer.status;

  return (
    <>
      <DossierHeader
        crumbs={[...projectCrumbs(project), { label: "Transfert" }]}
        title={`Transfert du projet ${project.code}`}
        meta={[
          project.name,
          project.dosage,
          <span key="f" className="font-semibold text-ink-900">
            {dossier.formula}
          </span>,
          <span key="p" className="flex items-center gap-2">
            <StatusDot tone={project.closedAt ? "neutral" : "success"} />
            {project.closedAt ? "Projet clôturé" : `Phase actuelle : ${project.phase}`}
          </span>,
        ]}
      />
      <DossierTabs slug={slug} />

      <Card className="mt-5 grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
        <Stat icon={Clock} label="Statut du transfert">
          <span className={cn("inline-block rounded-lg px-4 py-1.5 text-[15px] font-semibold", blocked ? "bg-warn-50 text-warn-700" : { neutral: "bg-slate-100 text-ink-700", info: "bg-brand-100 text-brand-700", warn: "bg-warn-50 text-warn-700", success: "bg-success-50 text-success-700" }[STATUS_TONE[transfer.status]])}>
            {statusLabel}
          </span>
        </Stat>
        <Stat icon={CalendarDays} label="Date de mise à disposition">
          {transfer.transmittedAt ? formatNumeric(transfer.transmittedAt) : "—"}
        </Stat>
        <Stat icon={Users} label="Équipe source">
          {transfer.sourceTeam}
        </Stat>
        <Stat icon={Users} label="Équipe destinataire">
          {transfer.targetTeam}
        </Stat>
        <Stat icon={User} label="Responsable transfert">
          {transfer.owner}
        </Stat>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Documents remis pour transfert</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {transfer.documents.map((d) => (
                <DocTile key={d.id} doc={d} slug={slug} />
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-xl font-bold text-ink-900">Avancement du transfert</h2>
            <ol className="mt-4">
              {steps.map((s, i) => (
                <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < steps.length - 1 && <span className={cn("absolute left-[15px] top-9 h-[calc(100%-36px)] w-0.5", s.done ? "bg-success-500" : "bg-line-strong")} aria-hidden />}
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white", s.done ? "bg-success-500" : "bg-slate-400")}>
                    {s.done ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink-900">{s.title}</p>
                    <p className="text-sm text-ink-600">{s.detail}</p>
                  </div>
                  <span className="text-sm text-ink-700">{s.date ? formatNumeric(s.date) : "-"}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="h-fit p-5">
          {transfer.status === "À préparer" && (
            <>
              <h2 className="text-xl font-bold text-ink-900">Préparer le transfert</h2>
              {!review ? (
                <>
                  <p className="mt-3 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-ink-700">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                    Une revue de dossier approuvée est nécessaire avant de transmettre les documents à l&apos;équipe Production.
                  </p>
                  <LinkButton href={`/dossiers/${slug}/revues`} className="mt-4">
                    Voir les revues
                  </LinkButton>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-ink-600">
                    Revue {review.id} {review.status.toLowerCase()} le {review.decidedAt ? formatNumeric(review.decidedAt) : "—"}.
                  </p>
                  {blocking.length > 0 ? (
                    <>
                      <p className="mt-4 font-semibold text-ink-900">Réserves bloquantes à lever</p>
                      <ul className="mt-2 space-y-2">
                        {blocking.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-warn-200 bg-warn-50/60 p-3">
                            <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink-700">{r.id}</span>
                            <span className="min-w-0 flex-1 text-sm">
                              <span className="block font-medium text-ink-900">{r.description}</span>
                              <span className="text-ink-600">
                                {r.owner} • échéance {formatNumeric(r.due)}
                              </span>
                            </span>
                            <Button size="sm" variant="outline" onClick={() => setLifting(r)}>
                              Lever
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-4 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-3 text-sm font-medium text-success-700">
                      <CircleCheck className="h-5 w-5" aria-hidden />
                      Aucune réserve bloquante ouverte.
                    </p>
                  )}
                  <Button
                    size="lg"
                    className="mt-4 w-full disabled:bg-slate-300"
                    icon={<Send className="h-5 w-5" />}
                    disabled={blocking.length > 0}
                    onClick={() => {
                      dossierActions.transmitTransfer(project.code);
                      toast.show({ title: "Documents transmis", description: `${transfer.documents.length} documents mis à disposition de l'${transfer.targetTeam.toLowerCase()}.` });
                    }}
                  >
                    Transmettre à l&apos;{transfer.targetTeam.toLowerCase()}
                  </Button>
                  {blocking.length > 0 && <p className="mt-2 text-sm text-ink-500">Le transfert reste bloqué tant que les réserves bloquantes sont ouvertes.</p>}
                </>
              )}
            </>
          )}

          {transfer.status === "À réceptionner" && (
            <>
              <h2 className="text-xl font-bold text-ink-900">Confirmer la réception</h2>
              <p className="mt-4 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-ink-700">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                L&apos;équipe Production doit examiner les documents transmis avant de confirmer leur réception. Cette étape atteste de la bonne réception du dossier de
                transfert. Elle ne constitue pas une autorisation de fabrication.
              </p>
              <p className="mt-5 font-semibold text-ink-900">Documents examinés</p>
              <Checkbox className="mt-2" checked={examined} onChange={setExamined} label="J'ai examiné l'ensemble des documents transmis." />
              <Field label="Commentaire (optionnel)" htmlFor="tr-comment" className="mt-5" error={commentError}>
                <Textarea id="tr-comment" rows={4} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Saisir un commentaire…" />
              </Field>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  size="lg"
                  icon={<FileQuestion className="h-5 w-5" />}
                  disabled={!examined}
                  className="disabled:bg-slate-100"
                  onClick={() => {
                    if (comment.trim().length < 10) return setCommentError("Précisez le complément demandé dans le commentaire (10 caractères minimum).");
                    dossierActions.requestComplement(project.code, comment.trim());
                    toast.show({ title: "Complément demandé", description: "L'équipe R&D a été notifiée.", tone: "info" });
                  }}
                >
                  Demander un complément
                </Button>
                <Button
                  size="lg"
                  icon={<Check className="h-5 w-5" />}
                  disabled={!examined}
                  className="disabled:bg-slate-300"
                  onClick={() => {
                    dossierActions.confirmReception(project.code, comment.trim());
                    toast.show({ title: "Réception confirmée", description: `Transfert du projet ${project.code} réceptionné par l'${transfer.targetTeam.toLowerCase()}.` });
                  }}
                >
                  Confirmer la réception
                </Button>
              </div>
              {!examined && (
                <p className="mt-3 flex items-center gap-2 text-sm text-ink-500">
                  <Info className="h-4 w-4" aria-hidden />
                  Les actions seront disponibles après avoir confirmé l&apos;examen des documents.
                </p>
              )}
            </>
          )}

          {transfer.status === "Complément demandé" && (
            <>
              <h2 className="text-xl font-bold text-ink-900">Complément demandé</h2>
              <p className="mt-3 rounded-xl bg-warn-50 p-4 text-[15px] text-warn-700">{transfer.complementRequest}</p>
              <p className="mt-3 text-sm text-ink-600">Complétez les documents puis transmettez-les de nouveau à l&apos;équipe Production.</p>
              <Button
                size="lg"
                className="mt-4 w-full"
                icon={<Send className="h-5 w-5" />}
                onClick={() => {
                  dossierActions.transmitTransfer(project.code);
                  toast.show({ title: "Documents retransmis", description: "L'équipe Production a été notifiée." });
                }}
              >
                Retransmettre les documents
              </Button>
            </>
          )}

          {transfer.status === "Réceptionné" && (
            <>
              <h2 className="text-xl font-bold text-ink-900">Transfert réceptionné</h2>
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 font-medium text-success-700">
                <CircleCheck className="h-5 w-5" aria-hidden />
                Réception confirmée le {transfer.receivedAt ? formatNumeric(transfer.receivedAt) : "—"}.
              </p>
              {transfer.comment && <p className="mt-3 rounded-lg bg-subtle px-4 py-3 text-sm text-ink-700">{transfer.comment}</p>}
              {!project.closedAt && (
                <LinkButton href={`/projets/${slug}/cloture`} variant="outline" className="mt-4" icon={<Archive className="h-4 w-4" />}>
                  Préparer la clôture du projet
                </LinkButton>
              )}
            </>
          )}
        </Card>
      </div>
      <LiftReserveModal key={lifting?.id} reserve={lifting} onClose={() => setLifting(null)} />
      <ScreenRef n={project.code === "CS-01" ? 53 : undefined} label="Transfert — préparation et réception" />
    </>
  );
}
