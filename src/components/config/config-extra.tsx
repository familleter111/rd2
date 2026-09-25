"use client";

import { Bell, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { formatNumeric } from "@/lib/format";
import { dossierActions, useDemo } from "@/lib/store";
import { ConfigFrame } from "./config-frame";

/** "Ressources" tab: equipment and people bookable in the planning, with their qualification. */
export function ResourcesConfig() {
  const state = useDemo();
  return (
    <ConfigFrame title="Configuration" subtitle="Gérer les rôles, les accès et les paramètres de l'espace R&D." screen={<ScreenRef label="Configuration — ressources" />}>
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink-900">Ressources réservables</h2>
            <p className="text-[15px] text-ink-600">Équipements et personnes disponibles dans le planning, avec leur statut de qualification.</p>
          </div>
          <LinkButton href="/planning?vue=ressources" variant="outline">
            Voir le planning des ressources
          </LinkButton>
        </div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
