import type { Metadata } from "next";
import { ActivitiesView } from "@/components/activities/activities-view";
import type { ActivityState } from "@/lib/types";

export const metadata: Metadata = { title: "Mes activités" };

const TABS: ActivityState[] = ["a-faire", "en-cours", "en-revue", "terminee"];

export default async function Page({ searchParams }: PageProps<"/activites">) {
  const { onglet, activite } = await searchParams;
  const tab = TABS.find((t) => t === onglet) ?? "a-faire";
  const id = typeof activite === "string" ? activite : undefined;
  return <ActivitiesView key={`${tab}-${id ?? ""}`} initialTab={tab} initialId={id} />;
}
