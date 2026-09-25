import type { Metadata } from "next";
import { LotPreparationView } from "@/components/lots/lot-preparation";

export const metadata: Metadata = { title: "Lot pilote — préparation" };

export default async function Page({ params }: PageProps<"/projets/[code]/lots/[lot]">) {
  const { code, lot } = await params;
  return <LotPreparationView slug={code} lotSlug={lot} />;
}
