import type { Metadata } from "next";
import { PlanningView, type PlanningTab } from "@/components/planning/planning-view";

export const metadata: Metadata = { title: "Planning" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

export default async function Page({ searchParams }: PageProps<"/planning">) {
  const sp = await searchParams;
  const vue = str(sp.vue);
  const tab: PlanningTab = vue === "ressources" ? "ressources" : vue === "charge" ? "charge" : "agenda";
  const semaine = str(sp.semaine);
  const jour = str(sp.jour);
  const week = isDate(semaine) ? semaine! : isDate(jour) ? jour! : "2026-10-05";
  const day = isDate(jour) ? jour! : "2026-10-07";
  const slug = str(sp.projet)?.toLowerCase() ?? "cs-01";
  const eventId = str(sp.evenement);
  return <PlanningView key={`${slug}-${tab}-${week}-${day}-${eventId ?? ""}`} slug={slug} initialTab={tab} week={week} day={day} eventId={eventId} />;
}
