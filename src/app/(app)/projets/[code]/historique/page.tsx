import type { Metadata } from "next";
import { HistoryView } from "@/components/project/history-view";

export const metadata: Metadata = { title: "Historique du projet" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/historique">) {
  const { code } = await params;
  const { objet, periode, evenement } = await searchParams;
  const initialObject = typeof objet === "string" ? objet : undefined;
  const initialEventId = typeof evenement === "string" ? evenement : undefined;
  return (
    <HistoryView
      key={`${initialObject}-${initialEventId}-${periode}`}
      slug={code}
      initialObject={initialObject}
      initialEventId={initialEventId}
      allPeriods={periode === "tout"}
    />
  );
}
