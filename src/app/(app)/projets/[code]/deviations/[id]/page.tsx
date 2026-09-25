import type { Metadata } from "next";
import { DeviationView, type DeviationTab } from "@/components/deviations/deviation-view";

export const metadata: Metadata = { title: "Déviation" };

const TABS: DeviationTab[] = ["constat", "analyse", "actions", "efficacite", "historique"];

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/deviations/[id]">) {
  const { code, id } = await params;
  const { onglet } = await searchParams;
  const tab = TABS.find((t) => t === onglet) ?? "actions";
  return <DeviationView key={`${id}-${tab}`} slug={code} id={id} initialTab={tab} />;
}
