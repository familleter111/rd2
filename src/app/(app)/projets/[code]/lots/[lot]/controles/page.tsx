import type { Metadata } from "next";
import { LotControlsView } from "@/components/lots/lot-controls";

export const metadata: Metadata = { title: "Lot pilote — contrôles" };

export default async function Page({ params }: PageProps<"/projets/[code]/lots/[lot]/controles">) {
  const { code, lot } = await params;
  return <LotControlsView slug={code} lotSlug={lot} />;
}
