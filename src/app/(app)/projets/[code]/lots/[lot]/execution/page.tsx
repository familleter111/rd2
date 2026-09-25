import type { Metadata } from "next";
import { LotExecutionView } from "@/components/lots/lot-execution";

export const metadata: Metadata = { title: "Lot pilote — exécution" };

export default async function Page({ params }: PageProps<"/projets/[code]/lots/[lot]/execution">) {
  const { code, lot } = await params;
  return <LotExecutionView slug={code} lotSlug={lot} />;
}
