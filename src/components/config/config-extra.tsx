"use client";

import { Bell, CalendarDays, Mail, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, Select, Toggle } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { formatNumeric } from "@/lib/format";
import { actions, dossierActions, useDemo } from "@/lib/store";
import type { Resource } from "@/lib/types";
import { ConfigFrame } from "./config-frame";

/** Kinds of resources offered when adding one: label, category and pictogram. */
const RESOURCE_KINDS: { type: string; label: string; category: Resource["category"]; icon: Resource["icon"] }[] = [
  { type: "HPLC", label: "Chromatographe HPLC", category: "Équipement", icon: "hplc" },
  { type: "Spectrophotomètre UV", label: "Spectrophotomètre UV", category: "Équipement", icon: "uv" },
  { type: "Balance analytique", label: "Balance analytique", category: "Équipement", icon: "balance" },
  { type: "Dissolution", label: "Appareil de dissolution", category: "Équipement", icon: "dissolution" },
  { type: "Friabilimètre", label: "Friabilimètre", category: "Équipement", icon: "friability" },
  { type: "Mélangeur", label: "Mélangeur", category: "Équipement", icon: "mixer" },
  { type: "Étuve", label: "Étuve de stabilité", category: "Équipement", icon: "oven" },
  { type: "Réfrigérateur", label: "Réfrigérateur", category: "Équipement", icon: "fridge" },
  { type: "Autre équipement", label: "Équipement", category: "Équipement", icon: "balance" },
  { type: "Personnel", label: "Personnel", category: "Personnel", icon: "person" },
];

const TEAMS = ["Analytique", "Fabrication", "Contrôle qualité", "Stabilité", "Développement"];

function AddResourceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useDemo();
  const [name, setName] = useState("");
  const [kind, setKind] = useState(RESOURCE_KINDS[0].type);
  const [team, setTeam] = useState(TEAMS[0]);
  const [owner, setOwner] = useState("");
  const [qualified, setQualified] = useState<Resource["qualification"]["status"]>("Qualifié");
  const [next, setNext] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const trimmed = name.trim();
  const duplicate = state.resources.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());
  const errors = {
    name: !trimmed ? "Renseignez le nom de la ressource." : duplicate ? "Une ressource porte déjà ce nom." : null,
    next: !next ? "Renseignez la date de la prochaine vérification." : null,
  };

  const submit = () => {
    setSubmitted(true);
    if (errors.name || errors.next) return;
    const k = RESOURCE_KINDS.find((x) => x.type === kind) ?? RESOURCE_KINDS[0];
    actions.addResource({
      name: trimmed,
      type: k.type,
      label: k.label,
      team,
      category: k.category,
      icon: k.icon,
      owner: owner.trim() || `Équipe ${team}`,
      qualification: { status: qualified, next },
    });
    toast.show({ title: "Ressource ajoutée", description: `${trimmed} est disponible dans le planning.` });
    setName("");
    setOwner("");
    setNext("");
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Ajouter une ressource"
      subtitle="Équipement ou personne réservable dans le planning."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="mr-auto">
            Annuler
          </Button>
          <Button onClick={submit}>Ajouter la ressource</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom ou identifiant" required htmlFor="res-name" error={submitted ? errors.name : null} className="md:col-span-2">
          <Input id="res-name" placeholder="Ex. identifiant de l'équipement" value={name} invalid={Boolean(submitted && errors.name)} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type" required htmlFor="res-kind">
          <Select id="res-kind" options={RESOURCE_KINDS.map((k) => k.type)} value={kind} onChange={(e) => setKind(e.target.value)} />
        </Field>
        <Field label="Équipe" required htmlFor="res-team">
          <Select id="res-team" options={TEAMS} value={team} onChange={(e) => setTeam(e.target.value)} />
        </Field>
        <Field label="Propriétaire" optional htmlFor="res-owner" className="md:col-span-2">
          <Input id="res-owner" placeholder={`Équipe ${team}`} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
        <Field label="Qualification" required htmlFor="res-qualification">
          <Select id="res-qualification" options={["Qualifié", "À vérifier"]} value={qualified} onChange={(e) => setQualified(e.target.value as Resource["qualification"]["status"])} />
        </Field>
        <Field label="Prochaine vérification" required htmlFor="res-next" error={submitted ? errors.next : null}>
          <DateInput id="res-next" value={next} onChange={setNext} invalid={Boolean(submitted && errors.next)} />
        </Field>
      </div>
    </Modal>
  );
}

/** "Ressources" tab: equipment and people bookable in the planning, with their qualification. */
export function ResourcesConfig() {
  const state = useDemo();
  const [adding, setAdding] = useState(false);
  return (
    <ConfigFrame title="Configuration" subtitle="Gérer les rôles, les accès et les paramètres de l'espace R&D." screen={<ScreenRef label="Configuration — ressources" />}>
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink-900">Ressources réservables</h2>
            <p className="text-[15px] text-ink-600">Équipements et personnes disponibles dans le planning, avec leur statut de qualification.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LinkButton href="/planning?vue=ressources" variant="outline">
              Voir le planning des ressources
            </LinkButton>
            <Button icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
              Ajouter une ressource
            </Button>
          </div>
        </div>
        {state.resources.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucune ressource configurée"
            description="Ajoutez les équipements et les personnes que l'équipe pourra réserver dans le planning."
            action={
              <Button variant="outline" icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
                Ajouter une ressource
              </Button>
            }
            className="mt-4 rounded-xl border border-dashed border-line"
          />
        ) : (
        <div className="relative mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="bg-subtle text-[13px] text-ink-700">
                <th className="px-4 py-3 font-medium">Ressource</th>
                <th className="px-3 py-3 font-medium">Catégorie</th>
                <th className="px-3 py-3 font-medium">Équipe</th>
                <th className="px-3 py-3 font-medium">Propriétaire</th>
                <th className="px-3 py-3 font-medium">Qualification</th>
                <th className="px-3 py-3 font-medium">Prochaine vérification</th>
                <th className="w-12 px-3 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {state.resources.map((r) => (
                <tr key={r.id} className="border-t border-line/70">
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink-900">{r.name}</span>
                    <span className="text-ink-500">{r.label}</span>
                  </td>
                  <td className="px-3 py-3 text-ink-800">{r.category}</td>
                  <td className="px-3 py-3 text-ink-800">{r.team}</td>
                  <td className="px-3 py-3 text-ink-800">{r.owner}</td>
                  <td className="px-3 py-3">
                    <Badge tone={r.qualification.status === "Qualifié" ? "success" : "warn"}>{r.qualification.status}</Badge>
                  </td>
                  <td className="px-3 py-3 text-ink-800">{formatNumeric(r.qualification.next)}</td>
                  <td className="px-3 py-3">
                    {!state.events.some((e) => e.resourceIds.includes(r.id)) && (
                      <button
                        type="button"
                        aria-label={`Retirer ${r.name}`}
                        title="Retirer la ressource"
                        onClick={() => {
                          actions.removeResource(r.id);
                          toast.show({ title: "Ressource retirée", description: r.name, tone: "info" });
                        }}
                        className="cursor-pointer rounded p-1 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <AddResourceModal open={adding} onClose={() => setAdding(false)} />
    </ConfigFrame>
  );
}

/** "Notifications" tab: channels of each notification type. */
export function NotificationsConfig() {
  const state = useDemo();
  return (
    <ConfigFrame title="Configuration" subtitle="Gérer les rôles, les accès et les paramètres de l'espace R&D." screen={<ScreenRef label="Configuration — notifications" />}>
      <Card className="mt-5 p-5">
        <h2 className="text-xl font-bold text-ink-900">Notifications</h2>
        <p className="text-[15px] text-ink-600">Choisissez comment l&apos;équipe est prévenue de chaque type d&apos;événement.</p>
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {state.notificationSettings.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900">{n.label}</span>
                <span className="text-sm text-ink-600">{n.detail}</span>
              </span>
              <span className="flex items-center gap-2 text-sm text-ink-700">
                <Bell className="h-4 w-4" aria-hidden />
                Application
                <Toggle checked={n.app} label={`${n.label} — application`} onChange={(v) => dossierActions.setNotification(n.id, "app", v)} />
              </span>
              <span className="flex items-center gap-2 text-sm text-ink-700">
                <Mail className="h-4 w-4" aria-hidden />
                E-mail
                <Toggle checked={n.email} label={`${n.label} — e-mail`} onChange={(v) => dossierActions.setNotification(n.id, "email", v)} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </ConfigFrame>
  );
}
