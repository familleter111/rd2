import type { Metadata } from "next";
import { LotHistoryView } from "@/components/lots/lot-extra";

export const metadata: Metadata = { title: "Lot pilote — historique" };

export default async function Page({ params }: PageProps<"/projets/[code]/lots/[lot]/historique">) {
  const { code, lot } = await params;
  return <LotHistoryView slug={code} lotSlug={lot} />;
}
